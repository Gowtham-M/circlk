import base64
import io
import re
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import qrcode
from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
from pymongo import ASCENDING, DESCENDING

from .extensions import db
from .langchain_event_chat import event_chat_service
from .models import check_password, hash_password, price_with_platform_fee, to_decimal, to_decimal128
from .schemas import booking_to_dict, event_to_dict, user_to_dict

api_bp = Blueprint("api", __name__)


def bad_request(message: str, status=400):
    return {"error": message}, status


def clean_optional_text(value):
    text = str(value or "").strip()
    return text or None


def now_utc():
    return datetime.utcnow()


def users_collection():
    return db.collection("users")


def events_collection():
    return db.collection("events")


def bookings_collection():
    return db.collection("bookings")


def seats_left_for_event(event_id: int, capacity: int) -> int:
    totals = list(
        bookings_collection().aggregate(
            [
                {"$match": {"event_id": event_id, "status": "confirmed"}},
                {"$group": {"_id": "$event_id", "total": {"$sum": "$quantity"}}},
            ]
        )
    )
    booked = int(totals[0]["total"]) if totals else 0
    return max(int(capacity) - booked, 0)


def event_with_related(event):
    host = users_collection().find_one({"id": event["host_id"]}, {"_id": 0, "id": 1, "name": 1})
    seats_left = seats_left_for_event(event["id"], event["capacity"])
    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    return event_to_dict(event, fee_percent, host=host, seats_left=seats_left)


@api_bp.post("/auth/signup")
def signup():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not all([name, email, password]):
        return bad_request("name, email and password are required")
    if len(password) < 8:
        return bad_request("password must be at least 8 characters")
    if users_collection().find_one({"email": email}):
        return bad_request("email already registered", 409)

    user = {
        "id": db.next_id("users"),
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    users_collection().insert_one(user)

    token = create_access_token(identity=str(user["id"]))
    return {"token": token, "user": user_to_dict(user)}, 201


@api_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = users_collection().find_one({"email": email})
    if not user or not check_password(password, user["password_hash"]):
        return bad_request("invalid credentials", 401)

    token = create_access_token(identity=str(user["id"]))
    return {"token": token, "user": user_to_dict(user)}


@api_bp.get("/events")
def list_events():
    city = request.args.get("city", "").strip()
    filters = {}
    if city:
        filters["city"] = {"$regex": re.escape(city), "$options": "i"}

    events = list(events_collection().find(filters, {"_id": 0}).sort("event_time", ASCENDING))
    if not events:
        return {"events": []}

    host_ids = [item["host_id"] for item in events]
    hosts = {
        item["id"]: item
        for item in users_collection().find(
            {"id": {"$in": host_ids}},
            {"_id": 0, "id": 1, "name": 1},
        )
    }

    event_ids = [item["id"] for item in events]
    booked_map = {
        row["_id"]: int(row["total"])
        for row in bookings_collection().aggregate(
            [
                {"$match": {"event_id": {"$in": event_ids}, "status": "confirmed"}},
                {"$group": {"_id": "$event_id", "total": {"$sum": "$quantity"}}},
            ]
        )
    }

    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    payload = []
    for event in events:
        booked = booked_map.get(event["id"], 0)
        seats_left = max(int(event["capacity"]) - booked, 0)
        payload.append(event_to_dict(event, fee_percent, host=hosts.get(event["host_id"]), seats_left=seats_left))

    return {"events": payload}


@api_bp.get("/events/<int:event_id>")
def get_event(event_id: int):
    event = events_collection().find_one({"id": event_id}, {"_id": 0})
    if not event:
        return bad_request("event not found", 404)
    return {"event": event_with_related(event)}


@api_bp.post("/events")
@jwt_required()
def create_event():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    required = [
        "title",
        "description",
        "city",
        "venue",
        "category",
        "event_time",
        "base_price",
        "capacity",
    ]
    missing = [
        field
        for field in required
        if field not in data or data.get(field) is None or data.get(field) == ""
    ]
    if missing:
        return bad_request(f"missing fields: {', '.join(missing)}")

    if not users_collection().find_one({"id": user_id}, {"_id": 1}):
        return bad_request("user not found", 404)

    try:
        event_time_raw = str(data["event_time"]).strip()
        if event_time_raw.endswith("Z"):
            event_time_raw = f"{event_time_raw[:-1]}+00:00"
        event_time = datetime.fromisoformat(event_time_raw)
        base_price = Decimal(str(data["base_price"]).strip())
        capacity = int(str(data["capacity"]).strip())
    except Exception:
        return bad_request("invalid event_time, base_price or capacity")
    if base_price < 0:
        return bad_request("base_price cannot be negative")
    if capacity < 1:
        return bad_request("capacity must be at least 1")

    image_url = clean_optional_text(data.get("image_url"))
    if image_url and not (
        image_url.startswith("data:image/") or image_url.startswith("http")
    ):
        return bad_request("image_url must be a valid image data URL or http URL")

    event = {
        "id": db.next_id("events"),
        "title": data["title"].strip(),
        "description": data["description"].strip(),
        "city": data["city"].strip(),
        "venue": data["venue"].strip(),
        "address": clean_optional_text(data.get("address")),
        "duration": clean_optional_text(data.get("duration")),
        "format": clean_optional_text(data.get("format")),
        "category": data["category"].strip(),
        "image_url": image_url,
        "event_time": event_time,
        "base_price": to_decimal128(base_price),
        "capacity": capacity,
        "host_id": user_id,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    events_collection().insert_one(event)
    return {"event": event_with_related(event)}, 201


@api_bp.post("/events/chat/message")
@jwt_required()
def chat_create_event_message():
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    session_id = str(data.get("session_id") or "").strip()
    message = str(data.get("message") or "").strip()
    if not session_id:
        return bad_request("session_id is required")
    if not message:
        return bad_request("message is required")

    try:
        result = event_chat_service.handle_message(
            session_id=session_id,
            user_id=user_id,
            user_message=message,
        )
    except RuntimeError as exc:
        return bad_request(str(exc), 500)
    except Exception as exc:
        return bad_request(f"chat processing failed: {exc}", 400)

    if result.get("event_id"):
        event = events_collection().find_one({"id": int(result["event_id"])}, {"_id": 0})
        if not event:
            return bad_request("event not found", 404)
        result["event"] = event_with_related(event)
    return result


@api_bp.post("/events/chat/upload-image")
@jwt_required()
def chat_create_event_upload_image():
    session_id = str(request.form.get("session_id") or "").strip()
    image_file = request.files.get("image")

    if not session_id:
        return bad_request("session_id is required")
    if image_file is None:
        return bad_request("image file is required")

    try:
        assistant_reply = event_chat_service.set_image_from_upload(
            session_id=session_id,
            file_name=image_file.filename or "",
            mime_type=image_file.mimetype or "",
            content=image_file.read(),
        )
    except Exception as exc:
        return bad_request(str(exc))
    return {"assistant": assistant_reply}


@api_bp.post("/events/<int:event_id>/book")
@jwt_required()
def book_event(event_id: int):
    user_id = int(get_jwt_identity())
    event = events_collection().find_one({"id": event_id}, {"_id": 0})
    if not event:
        return bad_request("event not found", 404)
    if not users_collection().find_one({"id": user_id}, {"_id": 1}):
        return bad_request("user not found", 404)

    data = request.get_json(silent=True) or {}
    try:
        quantity = int(data.get("quantity", 1))
    except Exception:
        return bad_request("quantity must be a number")
    if quantity < 1:
        return bad_request("quantity must be greater than 0")
    if quantity > seats_left_for_event(event_id, event["capacity"]):
        return bad_request("not enough seats available")

    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    ticket_price = price_with_platform_fee(event["base_price"], fee_percent)
    total_paid = (ticket_price * Decimal(quantity)).quantize(Decimal("0.01"))

    payment_reference = f"PAY-{uuid4().hex[:12].upper()}"
    booking = {
        "id": db.next_id("bookings"),
        "quantity": quantity,
        "total_paid": to_decimal128(total_paid),
        "status": "confirmed",
        "payment_reference": payment_reference,
        "user_id": user_id,
        "event_id": event_id,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    bookings_collection().insert_one(booking)

    payment_url = (
        f"https://payments.example.com/checkout?ref={payment_reference}&amount={to_decimal(booking['total_paid'])}"
    )
    qr_payload = f"booking:{booking['id']}|event:{event_id}|ref:{payment_reference}"
    qr_image_base64 = generate_qr_base64(qr_payload)

    return {
        "booking": booking_to_dict(booking),
        "payment_url": payment_url,
        "qr_code_base64": qr_image_base64,
    }, 201


@api_bp.get("/my/bookings")
@jwt_required()
def my_bookings():
    user_id = int(get_jwt_identity())
    bookings = list(
        bookings_collection()
        .find({"user_id": user_id}, {"_id": 0})
        .sort("created_at", DESCENDING)
    )
    return {"bookings": [booking_to_dict(item) for item in bookings]}


def generate_qr_base64(payload: str):
    img = qrcode.make(payload)
    stream = io.BytesIO()
    img.save(stream, format="PNG")
    stream.seek(0)
    return base64.b64encode(stream.read()).decode("utf-8")

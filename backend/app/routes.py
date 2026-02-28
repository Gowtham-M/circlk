import base64
import io
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

import qrcode
from flask import Blueprint, current_app, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from .extensions import db
from .langchain_event_chat import event_chat_service
from .models import Booking, Event, User
from .schemas import booking_to_dict, event_to_dict, user_to_dict

api_bp = Blueprint("api", __name__)


def bad_request(message: str, status=400):
    return {"error": message}, status


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
    if User.query.filter_by(email=email).first():
        return bad_request("email already registered", 409)

    user = User(name=name, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    token = create_access_token(identity=str(user.id))
    return {"token": token, "user": user_to_dict(user)}, 201


@api_bp.post("/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return bad_request("invalid credentials", 401)

    token = create_access_token(identity=str(user.id))
    return {"token": token, "user": user_to_dict(user)}


@api_bp.get("/events")
def list_events():
    city = request.args.get("city", "").strip()
    query = Event.query.order_by(Event.event_time.asc())
    if city:
        query = query.filter(Event.city.ilike(f"%{city}%"))
    events = query.all()
    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    return {"events": [event_to_dict(event, fee_percent) for event in events]}


@api_bp.get("/events/<int:event_id>")
def get_event(event_id: int):
    event = Event.query.get_or_404(event_id)
    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    return {"event": event_to_dict(event, fee_percent)}


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

    try:
        event_time_raw = str(data["event_time"]).strip()
        if event_time_raw.endswith("Z"):
            # Support UTC designator commonly sent by JS clients.
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
    image_url = (data.get("image_url") or "").strip() or None
    if image_url and not (
        image_url.startswith("data:image/") or image_url.startswith("http")
    ):
        return bad_request("image_url must be a valid image data URL or http URL")

    event = Event(
        title=data["title"].strip(),
        description=data["description"].strip(),
        city=data["city"].strip(),
        venue=data["venue"].strip(),
        category=data["category"].strip(),
        image_url=image_url,
        event_time=event_time,
        base_price=base_price,
        capacity=capacity,
        host_id=user_id,
    )
    db.session.add(event)
    db.session.commit()
    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    return {"event": event_to_dict(event, fee_percent)}, 201


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
        event = Event.query.get_or_404(result["event_id"])
        fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
        result["event"] = event_to_dict(event, fee_percent)
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
    event = Event.query.get_or_404(event_id)
    data = request.get_json(silent=True) or {}
    try:
        quantity = int(data.get("quantity", 1))
    except Exception:
        return bad_request("quantity must be a number")
    if quantity < 1:
        return bad_request("quantity must be greater than 0")
    if quantity > event.seats_left():
        return bad_request("not enough seats available")

    fee_percent = current_app.config["PLATFORM_FEE_PERCENT"]
    ticket_price = event.price_with_platform_fee(fee_percent)
    total_paid = (ticket_price * Decimal(quantity)).quantize(Decimal("0.01"))

    payment_reference = f"PAY-{uuid4().hex[:12].upper()}"
    booking = Booking(
        quantity=quantity,
        total_paid=total_paid,
        status="confirmed",
        payment_reference=payment_reference,
        user_id=user_id,
        event_id=event.id,
    )
    db.session.add(booking)
    db.session.commit()

    payment_url = f"https://payments.example.com/checkout?ref={payment_reference}&amount={total_paid}"
    qr_payload = f"booking:{booking.id}|event:{event.id}|ref:{payment_reference}"
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
    bookings = Booking.query.filter_by(user_id=user_id).order_by(Booking.created_at.desc()).all()
    return {"bookings": [booking_to_dict(item) for item in bookings]}


def generate_qr_base64(payload: str):
    img = qrcode.make(payload)
    stream = io.BytesIO()
    img.save(stream, format="PNG")
    stream.seek(0)
    return base64.b64encode(stream.read()).decode("utf-8")

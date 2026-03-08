import base64
import json
import mimetypes
import os
import re
import threading
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Dict

from .extensions import db
from .models import to_decimal128


REQUIRED_FIELDS = [
    "title",
    "description",
    "city",
    "venue",
    "category",
    "event_time",
    "base_price",
    "capacity",
]


def _normalize_event_time(raw_value: str) -> datetime:
    value = (raw_value or "").strip()

    def _parse_one(candidate: str):
        candidate = candidate.strip()
        if candidate.endswith("Z"):
            candidate = f"{candidate[:-1]}+00:00"
        if not candidate:
            return None
        return datetime.fromisoformat(candidate)

    # Primary path: already a single ISO datetime.
    try:
        parsed = _parse_one(value)
        if parsed:
            return parsed
    except Exception:
        pass

    # Fallback: handle range-like strings and pick the first valid datetime.
    for separator in ["/", " to ", ",", "|"]:
        if separator in value:
            for part in value.split(separator):
                try:
                    parsed = _parse_one(part)
                    if parsed:
                        return parsed
                except Exception:
                    continue

    raise ValueError(
        "event_time must be one ISO datetime (example: 2026-03-05T18:30:00+05:30)"
    )


def _to_decimal(raw_value) -> Decimal:
    return Decimal(str(raw_value).strip())


def _to_int(raw_value) -> int:
    return int(str(raw_value).strip())


@dataclass
class ChatSession:
    data: Dict[str, object] = field(default_factory=dict)
    awaiting_confirmation: bool = False


class EventChatService:
    def __init__(self):
        self._sessions: Dict[str, ChatSession] = {}
        self._lock = threading.Lock()

    def _get_session(self, session_id: str) -> ChatSession:
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = ChatSession()
            return self._sessions[session_id]

    def _get_llm(self):
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not configured.")
        try:
            from langchain_openai import ChatOpenAI
        except Exception as exc:
            raise RuntimeError(
                "LangChain OpenAI dependency missing. Install langchain-openai."
            ) from exc
        return ChatOpenAI(model="gpt-4o-mini", temperature=0.2)

    def _parse_llm_json(self, raw_content: str):
        raw = (raw_content or "").strip()
        if not raw:
            return None

        # 1) Direct JSON response
        try:
            return json.loads(raw)
        except Exception:
            pass

        # 2) Common markdown fenced JSON output
        fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", raw, flags=re.IGNORECASE)
        if fenced:
            try:
                return json.loads(fenced.group(1))
            except Exception:
                pass

        # 3) First JSON object found in free-form text
        obj = re.search(r"\{[\s\S]*\}", raw)
        if obj:
            try:
                return json.loads(obj.group(0))
            except Exception:
                pass

        return None

    def _extract_fields_with_llm(self, state: Dict[str, object], user_message: str):
        llm = self._get_llm()
        prompt = f"""
You are an event-creation assistant.
Extract any event fields from the user message and return only JSON with these keys:
title, description, city, venue, address, duration, format, category, event_time, base_price, capacity, image_url, intent, assistant_reply

Rules:
- intent must be one of: collect, confirm, create, cancel.
- Use null for unknown fields.
- event_time must be exactly one ISO datetime if known (not a range).
- If user gives a date/time range, set event_time to the start datetime.
- capacity must be an integer if known.
- base_price must be numeric if known.
- assistant_reply should be concise and ask for missing details if needed.

Current known state:
{state}

User message:
{user_message}
"""
        result = llm.invoke(prompt)
        payload = self._parse_llm_json(getattr(result, "content", ""))
        if not payload:
            payload = {
                "intent": "collect",
                "assistant_reply": (
                    "I could not parse that properly. Please share event title, date/time, city, venue, "
                    "category, base price, and capacity."
                ),
            }
        return payload

    def _missing_fields(self, data: Dict[str, object]):
        missing = []
        for field_name in REQUIRED_FIELDS:
            value = data.get(field_name)
            if value is None or value == "":
                missing.append(field_name)
        return missing

    def _validate_for_create(self, data: Dict[str, object]):
        event_time = _normalize_event_time(str(data["event_time"]))
        base_price = _to_decimal(data["base_price"])
        capacity = _to_int(data["capacity"])
        if base_price < 0:
            raise ValueError("base_price cannot be negative")
        if capacity < 1:
            raise ValueError("capacity must be at least 1")
        return event_time, base_price, capacity

    def set_image_from_upload(self, session_id: str, file_name: str, mime_type: str, content: bytes):
        session = self._get_session(session_id)
        if not mime_type:
            mime_type = mimetypes.guess_type(file_name or "")[0] or "application/octet-stream"
        if not mime_type.startswith("image/"):
            raise ValueError("Uploaded file must be an image.")
        encoded = base64.b64encode(content).decode("utf-8")
        data_url = f"data:{mime_type};base64,{encoded}"
        session.data["image_url"] = data_url
        return "Image uploaded. Continue with the event details."

    def handle_message(self, session_id: str, user_id: int, user_message: str):
        session = self._get_session(session_id)
        payload = self._extract_fields_with_llm(session.data, user_message)

        intent = (payload.get("intent") or "collect").strip().lower()
        if intent == "cancel":
            session.data = {}
            session.awaiting_confirmation = False
            return {"assistant": "Cancelled. Start again whenever you're ready."}

        for field_name in [
            "title",
            "description",
            "city",
            "venue",
            "address",
            "duration",
            "format",
            "category",
            "event_time",
            "base_price",
            "capacity",
            "image_url",
        ]:
            value = payload.get(field_name)
            if value is not None and value != "":
                session.data[field_name] = value

        missing = self._missing_fields(session.data)
        if missing:
            session.awaiting_confirmation = False
            assistant_reply = payload.get("assistant_reply") or ""
            if not assistant_reply:
                assistant_reply = (
                    "I still need these fields: " + ", ".join(missing) + "."
                )
            return {"assistant": assistant_reply, "missing_fields": missing}

        try:
            event_time, base_price, capacity = self._validate_for_create(session.data)
        except Exception as exc:
            session.awaiting_confirmation = False
            return {
                "assistant": f"Validation failed: {exc}. Please provide corrected values.",
                "missing_fields": ["event_time", "base_price", "capacity"],
            }

        is_confirm = intent in {"confirm", "create"} or (
            session.awaiting_confirmation and user_message.strip().lower() in {"yes", "y", "confirm", "create"}
        )
        if not is_confirm:
            session.awaiting_confirmation = True
            assistant_reply = (payload.get("assistant_reply") or "").strip()
            if assistant_reply:
                return {"assistant": f"{assistant_reply}\nReply 'yes' to create this event."}
            return {
                "assistant": (
                    "I have all details. Reply 'yes' to create this event: "
                    f"{session.data.get('title')} at {session.data.get('venue')}, "
                    f"{session.data.get('city')} on {event_time.isoformat()} "
                    f"for ${base_price} with capacity {capacity}."
                )
            }

        event = {
            "id": db.next_id("events"),
            "title": str(session.data["title"]).strip(),
            "description": str(session.data["description"]).strip(),
            "city": str(session.data["city"]).strip(),
            "venue": str(session.data["venue"]).strip(),
            "address": (str(session.data.get("address") or "").strip() or None),
            "duration": (str(session.data.get("duration") or "").strip() or None),
            "format": (str(session.data.get("format") or "").strip() or None),
            "category": str(session.data["category"]).strip(),
            "image_url": (str(session.data.get("image_url") or "").strip() or None),
            "event_time": event_time,
            "base_price": to_decimal128(base_price),
            "capacity": capacity,
            "host_id": user_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        db.collection("events").insert_one(event)

        session.data = {}
        session.awaiting_confirmation = False

        return {
            "assistant": "Event created successfully.",
            "event_id": event["id"],
        }


event_chat_service = EventChatService()

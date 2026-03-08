from .models import price_with_platform_fee, to_decimal


def user_to_dict(user):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


def event_to_dict(event, fee_percent: float, host=None, seats_left=0):
    host_doc = host or {}
    ticket_price = price_with_platform_fee(event["base_price"], fee_percent)
    return {
        "id": event["id"],
        "title": event["title"],
        "description": event["description"],
        "city": event["city"],
        "venue": event["venue"],
        "address": event.get("address"),
        "duration": event.get("duration"),
        "format": event.get("format"),
        "category": event["category"],
        "image_url": event.get("image_url"),
        "event_time": event["event_time"].isoformat(),
        "base_price": float(to_decimal(event["base_price"])),
        "ticket_price": float(ticket_price),
        "capacity": event["capacity"],
        "seats_left": seats_left,
        "host": {"id": host_doc.get("id"), "name": host_doc.get("name")},
    }


def booking_to_dict(booking):
    return {
        "id": booking["id"],
        "quantity": booking["quantity"],
        "total_paid": float(to_decimal(booking["total_paid"])),
        "status": booking["status"],
        "payment_reference": booking.get("payment_reference"),
        "user_id": booking["user_id"],
        "event_id": booking["event_id"],
        "created_at": booking["created_at"].isoformat(),
    }

from .models import Booking, Event, User


def user_to_dict(user: User):
    return {"id": user.id, "name": user.name, "email": user.email}


def event_to_dict(event: Event, fee_percent: float):
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "city": event.city,
        "venue": event.venue,
        "category": event.category,
        "image_url": event.image_url,
        "event_time": event.event_time.isoformat(),
        "base_price": float(event.base_price),
        "ticket_price": float(event.price_with_platform_fee(fee_percent)),
        "capacity": event.capacity,
        "seats_left": event.seats_left(),
        "host": {"id": event.host.id, "name": event.host.name},
    }


def booking_to_dict(booking: Booking):
    return {
        "id": booking.id,
        "quantity": booking.quantity,
        "total_paid": float(booking.total_paid),
        "status": booking.status,
        "payment_reference": booking.payment_reference,
        "user_id": booking.user_id,
        "event_id": booking.event_id,
        "created_at": booking.created_at.isoformat(),
    }

from datetime import datetime
from decimal import Decimal

from passlib.hash import pbkdf2_sha256

from .extensions import db


class TimestampMixin:
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )


class User(TimestampMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    hosted_events = db.relationship("Event", back_populates="host", lazy=True)
    bookings = db.relationship("Booking", back_populates="user", lazy=True)

    def set_password(self, password: str):
        self.password_hash = pbkdf2_sha256.hash(password)

    def check_password(self, password: str) -> bool:
        return pbkdf2_sha256.verify(password, self.password_hash)


class Event(TimestampMixin, db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=False)
    city = db.Column(db.String(120), nullable=False, index=True)
    venue = db.Column(db.String(180), nullable=False)
    category = db.Column(db.String(80), nullable=False)
    image_url = db.Column(db.Text, nullable=True)
    event_time = db.Column(db.DateTime, nullable=False, index=True)
    base_price = db.Column(db.Numeric(10, 2), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)

    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    host = db.relationship("User", back_populates="hosted_events")

    bookings = db.relationship("Booking", back_populates="event", lazy=True)

    def seats_left(self):
        confirmed = sum(
            booking.quantity for booking in self.bookings if booking.status == "confirmed"
        )
        return max(self.capacity - confirmed, 0)

    def price_with_platform_fee(self, fee_percent: float):
        base = Decimal(self.base_price)
        fee = base * Decimal(fee_percent / 100.0)
        return (base + fee).quantize(Decimal("0.01"))


class Booking(TimestampMixin, db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    quantity = db.Column(db.Integer, nullable=False, default=1)
    total_paid = db.Column(db.Numeric(10, 2), nullable=False)
    status = db.Column(db.String(32), nullable=False, default="pending")
    payment_reference = db.Column(db.String(120), nullable=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    event_id = db.Column(db.Integer, db.ForeignKey("events.id"), nullable=False)

    user = db.relationship("User", back_populates="bookings")
    event = db.relationship("Event", back_populates="bookings")

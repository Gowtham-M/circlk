import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const CATEGORY_ICONS = {
  chess: "♟",
  cooking: "🍳",
  photography: "📸",
  pottery: "🏺",
  music: "🎸",
  art: "🎨",
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name?.toLowerCase()] || "🎉";
}

export default function EventDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [event, setEvent] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [booking, setBooking] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getEvent(id).then((data) => setEvent(data.event)).catch((err) => setError(err.message));
  }, [id]);

  async function handleBook() {
    if (!token) {
      setError("Please login to book this event.");
      return;
    }
    setError("");
    try {
      const data = await api.bookEvent(id, { quantity }, token);
      setBooking(data);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!event) return <p>Loading...</p>;

  const eventDate = new Date(event.event_time);
  const fillPercent = Math.round(((event.capacity - event.seats_left) / event.capacity) * 100);

  return (
    <section className="event-detail-page">
      <Link to="/" className="back-pill">
        ← Back
      </Link>

      <div
        className="detail-hero"
        style={{
          backgroundImage: event.image_url
            ? `linear-gradient(180deg, rgba(26,18,10,0.15), rgba(26,18,10,0.75)), url(${event.image_url})`
            : undefined,
        }}
      >
        <p>
          {getCategoryIcon(event.category)} {event.category} Event
        </p>
        <h1>{event.title}</h1>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          <h2>About this event</h2>
          <p>{event.description}</p>
          <h2>Event Info</h2>
          <div className="detail-grid">
            <article className="card detail-box">
              <label>
                <span>📅</span> Date
              </label>
              <strong className="detail-value">{eventDate.toLocaleDateString()}</strong>
            </article>
            <article className="card detail-box">
              <label>
                <span>⏰</span> Time
              </label>
              <strong className="detail-value">
                {eventDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </strong>
            </article>
            <article className="card detail-box">
              <label>
                <span>📍</span> Venue
              </label>
              <strong className="detail-value">{event.venue}</strong>
            </article>
            <article className="card detail-box">
              <label>
                <span>🧭</span> Area
              </label>
              <strong className="detail-value">{event.city}</strong>
            </article>
            <article className="card detail-box">
              <label>
                <span>💵</span> Price
              </label>
              <strong className="detail-value">${event.ticket_price}</strong>
            </article>
            <article className="card detail-box">
              <label>
                <span>🎟</span> Capacity
              </label>
              <strong className="detail-value">
                {event.capacity - event.seats_left} / {event.capacity}
              </strong>
            </article>
          </div>

          <h2>Reviews</h2>
          <article className="card review-box">
            <p>★★★★★</p>
            <p>Absolutely wonderful evening. Great host and atmosphere.</p>
          </article>
        </div>

        <aside className="card booking-panel">
          <h3>${event.ticket_price}</h3>
          <p>per person</p>
          <div className="booking-line" />
          <p className="booking-meta-line">
            <span>📅</span>
            {eventDate.toLocaleString()}
          </p>
          <p className="booking-meta-line">
            <span>📍</span>
            {event.venue}, {event.city}
          </p>
          <div className="fill-track">
            <div style={{ width: `${fillPercent}%` }} />
          </div>
          <p className="booking-meta-line">
            <span>👥</span>
            {event.capacity - event.seats_left}/{event.capacity} spots filled
          </p>
          <div className="row">
            <input
              type="number"
              min="1"
              max={event.seats_left}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <button type="button" onClick={handleBook}>
              Book Your Spot
            </button>
          </div>
          {error && <p className="error">{error}</p>}

          {booking && (
            <div className="card nested">
              <h4>✅ Booking Confirmed</h4>
              <p>🧾 Booking ID: {booking.booking.id}</p>
              <p>💳 Total Paid: ${booking.booking.total_paid}</p>
              <a href={booking.payment_url} target="_blank" rel="noreferrer">
                Continue to Payment ↗
              </a>
              <img
                src={`data:image/png;base64,${booking.qr_code_base64}`}
                alt="Booking QR Code"
                className="qr"
              />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

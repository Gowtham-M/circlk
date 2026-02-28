import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

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

  return (
    <section className="card">
      <h2>{event.title}</h2>
      {event.image_url && (
        <img src={event.image_url} alt={event.title} className="event-detail-image" />
      )}
      <p>{event.description}</p>
      <p>{event.city} | {event.venue}</p>
      <p>Category: {event.category}</p>
      <p>Date: {new Date(event.event_time).toLocaleString()}</p>
      <p>Price (incl. platform fee): ${event.ticket_price}</p>
      <p>Seats left: {event.seats_left}</p>

      <div className="row">
        <input
          type="number"
          min="1"
          max={event.seats_left}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
        <button type="button" onClick={handleBook}>
          Book Now
        </button>
      </div>
      {error && <p className="error">{error}</p>}

      {booking && (
        <div className="card nested">
          <h3>Booking Confirmed</h3>
          <p>Booking ID: {booking.booking.id}</p>
          <p>Total Paid: ${booking.booking.total_paid}</p>
          <p>
            Payment Portal:{" "}
            <a href={booking.payment_url} target="_blank" rel="noreferrer">
              Continue to Payment
            </a>
          </p>
          <img
            src={`data:image/png;base64,${booking.qr_code_base64}`}
            alt="Booking QR Code"
            className="qr"
          />
        </div>
      )}
    </section>
  );
}

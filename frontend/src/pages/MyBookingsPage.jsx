import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

function monthDayLabel(dateStr) {
  const date = new Date(dateStr);
  return {
    month: date.toLocaleDateString(undefined, { month: "short" }).toUpperCase(),
    day: date.toLocaleDateString(undefined, { day: "2-digit" }),
  };
}

export default function MyBookingsPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [eventsById, setEventsById] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const [bookingData, eventData] = await Promise.all([
          api.myBookings(token),
          api.listEvents(),
        ]);
        setBookings(bookingData.bookings || []);
        const nextMap = {};
        (eventData.events || []).forEach((event) => {
          nextMap[event.id] = event;
        });
        setEventsById(nextMap);
      } catch (err) {
        setError(err.message);
      }
    }
    load();
  }, [token]);

  const visibleBookings = useMemo(() => {
    const now = Date.now();
    return bookings.filter((item) => {
      const event = eventsById[item.event_id];
      const eventTime = event ? new Date(event.event_time).getTime() : 0;
      if (activeTab === "upcoming") return eventTime >= now && item.status === "confirmed";
      if (activeTab === "past") return eventTime < now && item.status === "confirmed";
      return item.status !== "confirmed";
    });
  }, [activeTab, bookings, eventsById]);

  return (
    <section className="bookings-page">
      <div className="page-title-row">
        <div>
          <h1 className="page-title">
            My <span>Bookings</span>
          </h1>
          <p>{bookings.length} total bookings</p>
        </div>
      </div>

      <div className="pill-tabs">
        <button
          type="button"
          className={activeTab === "upcoming" ? "active" : ""}
          onClick={() => setActiveTab("upcoming")}
        >
          Upcoming
        </button>
        <button
          type="button"
          className={activeTab === "past" ? "active" : ""}
          onClick={() => setActiveTab("past")}
        >
          Past
        </button>
        <button
          type="button"
          className={activeTab === "cancelled" ? "active" : ""}
          onClick={() => setActiveTab("cancelled")}
        >
          Cancelled
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="booking-list">
        {visibleBookings.map((booking) => {
          const event = eventsById[booking.event_id];
          const eventTime = event ? new Date(event.event_time) : null;
          const label = monthDayLabel(eventTime || booking.created_at);
          return (
            <article className="booking-row card" key={booking.id}>
              <div className="booking-date">
                <span>{label.month}</span>
                <strong>{label.day}</strong>
              </div>
              <div className="booking-main">
                <h3>{event?.title || `Event #${booking.event_id}`}</h3>
                <p>
                  {eventTime ? eventTime.toLocaleString() : "Time unavailable"} |{" "}
                  {event?.venue || "Venue unavailable"} | ${booking.total_paid}
                </p>
                <small>Ref: {booking.payment_reference}</small>
              </div>
              <div className="booking-state">
                <span>{booking.status}</span>
              </div>
            </article>
          );
        })}
        {!visibleBookings.length && (
          <article className="card">
            <p>No bookings in this category.</p>
          </article>
        )}
      </div>
    </section>
  );
}

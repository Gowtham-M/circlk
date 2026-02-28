import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function DashboardPage() {
  const [city, setCity] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  async function loadEvents(nextCity = city) {
    setError("");
    try {
      const data = await api.listEvents(nextCity);
      setEvents(data.events);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents(city);
    }, 300);

    return () => clearTimeout(timer);
  }, [city]);

  return (
    <div className="layout">
      <section className="dashboard-search-section">
        <input
          className="dashboard-search-input"
          placeholder="Type a city name (e.g. New York)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card dashboard-slider">
        <p className="dashboard-slide-item" style={{ "--slide-index": 0 }}>
          Discover your next standout event
        </p>
        <p className="dashboard-slide-item" style={{ "--slide-index": 1 }}>
          Browse curated happenings around your city
        </p>
        <p className="dashboard-slide-item" style={{ "--slide-index": 2 }}>
          Compare venues quickly and grab seats before they sell out
        </p>
      </section>

      <section className="grid">
        {events.map((event) => (
          <article key={event.id} className="card event-card">
            {event.image_url && (
              <img src={event.image_url} alt={event.title} className="event-card-image" />
            )}
            <h3>{event.title}</h3>
            <p className="event-card-meta">
              {event.city} | {event.venue}
            </p>
            <p>{new Date(event.event_time).toLocaleString()}</p>
            <p>${event.ticket_price} per ticket</p>
            <p>{event.seats_left} seats left</p>
            <Link to={`/events/${event.id}`}>View Details</Link>
          </article>
        ))}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const CATEGORY_ICONS = {
  chess: "♟",
  cooking: "🍳",
  photography: "📸",
  pottery: "🏺",
  music: "🎸",
  art: "🎨",
};

const EVENT_META_ICONS = {
  time: "📅",
  location: "📍",
  price: "💵",
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name?.toLowerCase()] || "🎉";
}

export default function BrowseEventsPage() {
  const [city, setCity] = useState("");
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");

  async function loadEvents(nextCity = city) {
    setError("");
    try {
      const data = await api.listEvents(nextCity);
      setEvents(data.events || []);
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

  const sortedEvents = useMemo(
    () =>
      [...events].sort(
        (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime()
      ),
    [events]
  );

  return (
    <div className="dashboard-page">
      <header className="dashboard-top">
        <div>
          <h1 className="page-title">Browse Events</h1>
          <p>{sortedEvents.length} total events</p>
        </div>
        <input
          className="dashboard-search"
          placeholder="Filter by city..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </header>

      {error && <p className="error">{error}</p>}

      <section>
        <h2>All Events</h2>
        <div className="event-list">
          {sortedEvents.map((event) => (
            <article key={event.id} className="card featured-row">
              <div
                className="featured-media"
                style={{
                  backgroundImage: event.image_url
                    ? `linear-gradient(180deg, rgba(25,14,4,0.1), rgba(25,14,4,0.8)), url(${event.image_url})`
                    : undefined,
                }}
              >
                <span>
                  {getCategoryIcon(event.category || "Event")} {event.category || "Event"}
                </span>
              </div>
              <div className="featured-body">
                <h3>{event.title}</h3>
                <p className="meta-line">
                  <span>{EVENT_META_ICONS.time}</span>
                  {new Date(event.event_time).toLocaleString()}
                </p>
                <p className="meta-line">
                  <span>{EVENT_META_ICONS.location}</span>
                  {event.venue}, {event.city}
                </p>
                <div className="featured-row-meta">
                  <small>
                    <span>{EVENT_META_ICONS.price}</span> ${event.ticket_price} per person
                  </small>
                  <Link to={`/events/${event.id}`}>Book Now</Link>
                </div>
              </div>
            </article>
          ))}
          {!sortedEvents.length && <p>No events available.</p>}
        </div>
      </section>
    </div>
  );
}

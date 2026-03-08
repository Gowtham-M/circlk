import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const CATEGORIES = ["All", "Chess", "Cooking", "Photography", "Pottery", "Music", "Art"];

const CATEGORY_ICONS = {
  all: "🎯",
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
  schedule: "🗓",
};

function getCategoryIcon(name) {
  return CATEGORY_ICONS[name?.toLowerCase()] || "🎉";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [city, setCity] = useState("");
  const [events, setEvents] = useState([]);
  const [category, setCategory] = useState("All");
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

  const filteredEvents =
    category === "All"
      ? events
      : events.filter(
          (event) => event.category?.toLowerCase() === category.toLowerCase()
        );
  const featured = filteredEvents.slice(0, 3);
  const upcoming = filteredEvents.slice(0, 5);
  const uniqueHosts = new Set(events.map((event) => event.host?.id)).size;

  return (
    <div className="dashboard-page">
      <header className="dashboard-top">
        <div>
          <h1 className="page-title">
            Good morning, <span>{user?.name || "Guest"}</span> ☀
          </h1>
          <p>{events.length} events this week</p>
        </div>
        <input
          className="dashboard-search"
          placeholder="Search events by city..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </header>

      <section className="stat-grid">
        <article className="card stat-card">
          <span className="stat-icon">🎟</span>
          <h3>{events.length}</h3>
          <p>Available Events</p>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">✨</span>
          <h3>{featured.length}</h3>
          <p>Featured Now</p>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">👥</span>
          <h3>{uniqueHosts}</h3>
          <p>Active Organisers</p>
        </article>
        <article className="card stat-card">
          <span className="stat-icon">🪑</span>
          <h3>
            {events.length ? Math.round((events.reduce((sum, item) => sum + item.seats_left, 0) / events.length)) : 0}
          </h3>
          <p>Avg Seats Left</p>
        </article>
      </section>

      <section className="dashboard-content">
        <div>
          <div className="pill-tabs">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                className={item === category ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                <span className="pill-icon">{getCategoryIcon(item)}</span>
                {item}
              </button>
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <h2>Featured Events</h2>
          <div className="event-list">
            {featured.map((event) => (
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
          </div>
        </div>

        <aside className="card schedule-panel">
          <div className="schedule-head">
            <h3>Your Schedule</h3>
          </div>
          <div className="schedule-list">
            {upcoming.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="schedule-item">
                <strong>
                  <span className="schedule-icon">{getCategoryIcon(event.category)}</span>
                  {event.title}
                </strong>
                <p>
                  <span>{EVENT_META_ICONS.schedule}</span>
                  {new Date(event.event_time).toLocaleString()}
                </p>
              </Link>
            ))}
            {!upcoming.length && <p>No events available.</p>}
          </div>
        </aside>
      </section>
    </div>
  );
}

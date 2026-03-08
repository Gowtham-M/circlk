import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const initialForm = {
  title: "",
  description: "",
  city: "",
  venue: "",
  address: "",
  category: "Chess",
  date: "",
  time: "",
  duration: "2 hours",
  format: "In-person",
  base_price: "",
  capacity: "",
  image_url: "",
};

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function normalizeEventTime(value) {
  if (!value) return value;
  if (value.endsWith("Z")) return value;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return `${value}:00`;
  return value;
}

const CATEGORIES = [
  { label: "Chess", icon: "♟" },
  { label: "Cooking", icon: "🍳" },
  { label: "Photography", icon: "📷" },
  { label: "Pottery", icon: "🏺" },
  { label: "Music", icon: "🎸" },
  { label: "Wellness", icon: "🧘" },
  { label: "Art", icon: "🎨" },
  { label: "Gaming", icon: "🎮" },
];

const DURATIONS = ["30 mins", "1 hour", "2 hours", "3 hours", "Half-day", "Full-day"];
const FORMATS = ["In-person", "Online", "Hybrid"];

export default function HostEventPage() {
  const { token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  const eventDateTime = form.date && form.time ? `${form.date}T${form.time}` : "";

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    try {
      if (!eventDateTime) {
        throw new Error("Date and time are required.");
      }

      const payload = {
        title: form.title,
        description: form.description,
        city: form.city,
        venue: form.venue,
        address: form.address || undefined,
        duration: form.duration || undefined,
        format: form.format || undefined,
        category: form.category,
        event_time: normalizeEventTime(eventDateTime),
        base_price: Number(form.base_price),
        capacity: parseInt(form.capacity, 10),
        image_url: form.image_url || undefined,
      };
      const data = await api.createEvent(payload, token);
      setCreated(data.event);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    }
  }

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleImageSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("Image must be 3MB or smaller.");
      return;
    }
    try {
      setError("");
      const dataUrl = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, image_url: dataUrl }));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="host-page">
      <header className="host-header">
        <h1 className="page-title">
          Host an <span>Event</span>
        </h1>
        <p>Fill in the details and go live in minutes</p>
      </header>

      <form onSubmit={onSubmit} className="host-form">
        <article className="card host-section">
          <h2 className="host-section-title">
            <span className="host-step">1</span>
            Choose a Category
          </h2>
          <div className="host-category-grid">
            {CATEGORIES.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`host-category-card ${form.category === item.label ? "active" : ""}`}
                onClick={() => updateField("category", item.label)}
              >
                <span className="host-category-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="card host-section">
          <h2 className="host-section-title">
            <span className="host-step">2</span>
            Event Details
          </h2>
          <label className="host-field">
            <span>Event Name *</span>
            <input
              placeholder="e.g. Saturday Blitz Chess Tournament"
              value={form.title}
              onChange={(e) => updateField("title", e.target.value)}
              required
            />
          </label>
          <label className="host-field">
            <span>Description *</span>
            <textarea
              placeholder="Tell attendees what to expect, what to bring, skill level required..."
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              rows={4}
              required
            />
          </label>
          <div className="host-two-col">
            <label className="host-field">
              <span>Date *</span>
              <input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} required />
            </label>
            <label className="host-field">
              <span>Time *</span>
              <input type="time" value={form.time} onChange={(e) => updateField("time", e.target.value)} required />
            </label>
          </div>
          <div className="host-two-col">
            <label className="host-field">
              <span>Duration</span>
              <select value={form.duration} onChange={(e) => updateField("duration", e.target.value)}>
                {DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration}
                  </option>
                ))}
              </select>
            </label>
            <label className="host-field">
              <span>Format</span>
              <select value={form.format} onChange={(e) => updateField("format", e.target.value)}>
                {FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </article>

        <article className="card host-section">
          <h2 className="host-section-title">
            <span className="host-step">3</span>
            Location & Capacity
          </h2>
          <label className="host-field">
            <span>Venue Name</span>
            <input
              placeholder="e.g. Hackney Community Hall"
              value={form.venue}
              onChange={(e) => updateField("venue", e.target.value)}
              required
            />
          </label>
          <label className="host-field">
            <span>Address</span>
            <input
              placeholder="Full address or area"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
            />
          </label>
          <div className="host-two-col">
            <label className="host-field">
              <span>Max Capacity *</span>
              <input
                type="number"
                min="1"
                step="1"
                placeholder="e.g. 20"
                value={form.capacity}
                onChange={(e) => updateField("capacity", e.target.value)}
                required
              />
              <small>How many attendees can you host?</small>
            </label>
            <label className="host-field">
              <span>Price per Person (£)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0 for free"
                value={form.base_price}
                onChange={(e) => updateField("base_price", e.target.value)}
                required
              />
              <small>Enter 0 to list as a free event</small>
            </label>
          </div>
          <label className="host-field">
            <span>City *</span>
            <input
              placeholder="e.g. Bengaluru"
              value={form.city}
              onChange={(e) => updateField("city", e.target.value)}
              required
            />
          </label>
          <label className="host-field">
            <span>Event Banner (Optional)</span>
            <input type="file" accept="image/*" onChange={handleImageSelect} />
          </label>
          {form.image_url && <img src={form.image_url} alt="Selected event preview" className="event-image-preview" />}
        </article>

        {error && <p className="error">{error}</p>}
        {created && <p className="host-success">Event published: {created.title}</p>}

        <div className="host-actions">
          <button type="button" className="host-cancel" onClick={() => setForm(initialForm)}>
            Cancel
          </button>
          <button type="submit" className="host-publish">
            🚀 Publish Event
          </button>
        </div>
      </form>
    </section>
  );
}


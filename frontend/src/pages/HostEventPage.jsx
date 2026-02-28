import { useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

const initialForm = {
  title: "",
  description: "",
  city: "",
  venue: "",
  category: "",
  event_time: "",
  base_price: "",
  capacity: "",
  image_url: ""
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

export default function HostEventPage() {
  const { token } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [created, setCreated] = useState(null);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setCreated(null);
    try {
      const payload = {
        ...form,
        event_time: normalizeEventTime(form.event_time),
        base_price: Number(form.base_price),
        capacity: parseInt(form.capacity, 10)
      };
      const data = await api.createEvent(payload, token);
      setCreated(data.event);
      setForm(initialForm);
    } catch (err) {
      setError(err.message);
    }
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
    <section className="card">
      <h2>Host an Event</h2>
      <p>Platform fee is automatically added to ticket pricing when users book.</p>
      <form onSubmit={onSubmit} className="form">
        <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
        <input placeholder="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} required />
        <input placeholder="Category (e.g. Cooking)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
        <input type="datetime-local" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} required />
        <input type="number" min="0" step="0.01" placeholder="Base ticket price" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} required />
        <input type="number" min="1" step="1" placeholder="Capacity" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} required />
        <input type="file" accept="image/*" onChange={handleImageSelect} />
        {form.image_url && <img src={form.image_url} alt="Selected event preview" className="event-image-preview" />}
        {error && <p className="error">{error}</p>}
        <button type="submit">Publish Event</button>
      </form>

      {created && (
        <div className="card nested">
          <h3>Event Created</h3>
          {created.image_url && <img src={created.image_url} alt={created.title} className="event-image-preview" />}
          <p>{created.title} in {created.city}</p>
          <p>Ticket price with fee: ${created.ticket_price}</p>
        </div>
      )}
    </section>
  );
}

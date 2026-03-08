const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000/api";
const NETWORK_ERROR_MESSAGE = `Cannot reach API at ${API_BASE}. Start backend server and verify VITE_API_BASE.`;

async function safeFetch(url, options) {
  try {
    return await fetch(url, options);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw err;
  }
}

async function request(path, options = {}) {
  const mergedHeaders = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const res = await safeFetch(`${API_BASE}${path}`, {
    ...options,
    headers: mergedHeaders,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function requestForm(path, options = {}) {
  const res = await safeFetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.msg || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (payload) =>
    request("/auth/signup", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  listEvents: (city) => request(`/events${city ? `?city=${encodeURIComponent(city)}` : ""}`),
  getEvent: (id) => request(`/events/${id}`),
  createEvent: (payload, token) =>
    request("/events", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  myBookings: (token) =>
    request("/my/bookings", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  bookEvent: (id, payload, token) =>
    request(`/events/${id}/book`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  chatCreateEventMessage: (payload, token) =>
    request("/events/chat/message", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { Authorization: `Bearer ${token}` },
    }),
  chatUploadEventImage: (sessionId, file, token) => {
    const formData = new FormData();
    formData.append("session_id", sessionId);
    formData.append("image", file);
    return requestForm("/events/chat/upload-image", {
      method: "POST",
      body: formData,
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

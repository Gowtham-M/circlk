import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const rotatingPhrases = [
    "Create events people talk about.",
    "Gather your crowd in minutes.",
    "Bring every idea to life."
  ];

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await signup(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <p className="auth-kicker">Join Circlk</p>
        <h1>One account. Endless nights worth remembering.</h1>
        <div className="phrase-rotator" aria-hidden="true">
          {rotatingPhrases.map((phrase, index) => (
            <span
              className="phrase-item"
              style={{ "--phrase-index": index }}
              key={phrase}
            >
              {phrase}
            </span>
          ))}
        </div>
        <p>Create your profile and start hosting or joining standout events instantly.</p>
      </div>

      <div className="card auth-card">
        <h2>Create Account</h2>
        <form onSubmit={onSubmit} className="form">
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            placeholder="Password (8+ chars)"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Signup</button>
        </form>
      </div>
    </section>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const rotatingPhrases = [
    "Find your city's next big moment.",
    "Host faster, fill seats sooner.",
    "Turn plans into unforgettable nights."
  ];

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(form);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-layout">
      <div className="auth-copy">
        <p className="auth-kicker">Circlk Events</p>
        <h1>Where every plan turns into a packed room.</h1>
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
        <p>Discover local experiences, invite your crew, and never miss what matters.</p>
      </div>

      <div className="card auth-card">
        <h2>Login</h2>
        <form onSubmit={onSubmit} className="form">
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit">Login</button>
        </form>
      </div>
    </section>
  );
}

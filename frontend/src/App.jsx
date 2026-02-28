import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import EventDetailPage from "./pages/EventDetailPage";
import ChatHostEventPage from "./pages/ChatHostEventPage";
import HostEventPage from "./pages/HostEventPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import { useAuth } from "./state/AuthContext";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isChatRoute = location.pathname === "/host-chat";
  return (
    <div>
      <header className="topbar">
        <Link to="/" className="brand">
          Circlk
        </Link>
        <nav className="topnav">
          <Link to="/">Dashboard</Link>
          <Link to="/host">Host Event</Link>
          <Link to="/host-chat">Host By Chat</Link>
          {!user && <Link to="/signup">Signup</Link>}
          {!user && <Link to="/login">Login</Link>}
          {user && <span>{user.name}</span>}
          {user && (
            <button type="button" onClick={logout}>
              Logout
            </button>
          )}
        </nav>
      </header>

      <main className={`container ${isChatRoute ? "container-chat" : ""}`.trim()}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route
            path="/host"
            element={
              <PrivateRoute>
                <HostEventPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/host-chat"
            element={
              <PrivateRoute>
                <ChatHostEventPage />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </main>
    </div>
  );
}

import { Link, NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import BrowseEventsPage from "./pages/BrowseEventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import ChatHostEventPage from "./pages/ChatHostEventPage";
import HostEventPage from "./pages/HostEventPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import { useAuth } from "./state/AuthContext";

function PrivateRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/signup";
  const isChatRoute = location.pathname === "/host-chat";

  if (isAuthRoute) {
    return (
      <main className="auth-screen">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Routes>
      </main>
    );
  }

  return (
    <div className="gather-shell">
      <aside className="gather-sidebar">
        <Link to="/" className="gather-brand">
          gather.
        </Link>
        <div className="gather-nav-block">
          <p>Discover</p>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/browse">Browse Events</NavLink>
          <NavLink to="/bookings">My Bookings</NavLink>
        </div>
        <div className="gather-nav-block">
          <p>Organise</p>
          <NavLink to="/host">Host an Event</NavLink>
          <NavLink to="/host-chat">Host By Chat</NavLink>
        </div>
        <div className="gather-nav-block">
          <p>Account</p>
          {!user && <NavLink to="/signup">Signup</NavLink>}
          {!user && <NavLink to="/login">Login</NavLink>}
          {user && <button onClick={logout}>Logout</button>}
        </div>
        <div className="gather-user">
          <div className="gather-avatar">{(user?.name || "G")[0]}</div>
          <div>
            <h4>{user?.name || "Guest"}</h4>
            <p>{user ? "Organiser & Attendee" : "Browse events"}</p>
          </div>
        </div>
      </aside>

      <main className={`gather-main ${isChatRoute ? "gather-main-chat" : ""}`.trim()}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/browse" element={<BrowseEventsPage />} />
          <Route path="/events/:id" element={<EventDetailPage />} />
          <Route
            path="/bookings"
            element={
              <PrivateRoute>
                <MyBookingsPage />
              </PrivateRoute>
            }
          />
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
        </Routes>
      </main>
    </div>
  );
}

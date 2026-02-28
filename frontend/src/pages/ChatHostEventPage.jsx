import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../state/AuthContext";

function makeSessionId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const assistantIntro =
  "Tell me your event details. I can collect title, description, city, venue, category, datetime, base price, and capacity. Upload an image anytime.";

function makeThread(title = "New Thread") {
  return {
    id: makeSessionId(),
    title,
    messages: [{ role: "assistant", text: assistantIntro }],
    createdEvent: null,
  };
}

export default function ChatHostEventPage() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState(() => {
    const first = makeThread();
    return [first];
  });
  const [activeThreadId, setActiveThreadId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const transcriptRef = useRef(null);
  const composerFormRef = useRef(null);

  useEffect(() => {
    if (!activeThreadId && threads.length > 0) {
      setActiveThreadId(threads[0].id);
    }
  }, [activeThreadId, threads]);

  const activeThread = useMemo(
    () => threads.find((item) => item.id === activeThreadId) || threads[0],
    [threads, activeThreadId]
  );

  const canSend = useMemo(
    () => !loading && !!activeThread && message.trim().length > 0,
    [loading, message, activeThread]
  );

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeThread, loading]);

  function updateActiveThread(mutator) {
    if (!activeThread) return;
    setThreads((prev) =>
      prev.map((item) => (item.id === activeThread.id ? mutator(item) : item))
    );
  }

  function createThread() {
    const next = makeThread();
    setThreads((prev) => [next, ...prev]);
    setActiveThreadId(next.id);
    setMessage("");
    setError("");
  }

  async function sendMessage(e) {
    e.preventDefault();
    if (!canSend) return;
    if (!token) {
      setError("You are not logged in. Please login again.");
      navigate("/login", { replace: true });
      return;
    }
    const outgoing = message.trim();
    setMessage("");
    setError("");
    updateActiveThread((item) => ({
      ...item,
      title:
        item.title === "New Thread" && outgoing
          ? outgoing.slice(0, 36).trim()
          : item.title,
      messages: [...item.messages, { role: "user", text: outgoing }],
    }));

    try {
      setLoading(true);
      const data = await api.chatCreateEventMessage(
        { session_id: activeThread.id, message: outgoing },
        token
      );
      if (data.assistant) {
        updateActiveThread((item) => ({
          ...item,
          messages: [...item.messages, { role: "assistant", text: data.assistant }],
        }));
      }
      if (data.event) {
        updateActiveThread((item) => ({
          ...item,
          createdEvent: data.event,
        }));
      }
    } catch (err) {
      if (err.status === 401) {
        setError("Session expired. Please login again.");
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file || !activeThread) return;
    if (!token) {
      setError("You are not logged in. Please login again.");
      navigate("/login", { replace: true });
      return;
    }
    setError("");
    try {
      const data = await api.chatUploadEventImage(activeThread.id, file, token);
      if (data.assistant) {
        updateActiveThread((item) => ({
          ...item,
          messages: [...item.messages, { role: "assistant", text: data.assistant }],
        }));
      }
    } catch (err) {
      if (err.status === 401) {
        setError("Session expired. Please login again.");
        logout();
        navigate("/login", { replace: true });
        return;
      }
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  }

  function handleComposerKeyDown(e) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    composerFormRef.current?.requestSubmit();
  }

  return (
    <section className="chat-app-shell">
      <aside className="chat-sidebar">
        <button type="button" className="chat-new-thread" onClick={createThread}>
          + New Thread
        </button>
        <div className="thread-list">
          {threads.map((thread) => (
            <button
              type="button"
              key={thread.id}
              className={`thread-item ${thread.id === activeThread?.id ? "active" : ""}`}
              onClick={() => {
                setActiveThreadId(thread.id);
                setError("");
              }}
            >
              {thread.title}
            </button>
          ))}
        </div>
      </aside>

      <div className="chat-shell">
        <div className="chat-header">
          <h2>Host Event By Chat</h2>
          <p>Share event details naturally. Upload image anytime. Reply "yes" to publish.</p>
        </div>

        <div className="chat-transcript" ref={transcriptRef}>
          {(activeThread?.messages || []).map((item, idx) => (
            <div
              key={`${item.role}-${idx}`}
              className={`chat-row ${item.role === "user" ? "is-user" : "is-assistant"}`}
            >
              <div className="chat-bubble">
                {item.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="chat-row is-assistant">
              <div className="chat-bubble">
                Thinking...
              </div>
            </div>
          )}
        </div>

        {error && <p className="error chat-error">{error}</p>}

        {activeThread?.createdEvent && (
          <div className="chat-created card nested">
            <h3>Created Event</h3>
            {activeThread.createdEvent.image_url && (
              <img src={activeThread.createdEvent.image_url} alt={activeThread.createdEvent.title} className="event-image-preview" />
            )}
            <p>{activeThread.createdEvent.title}</p>
            <p>{activeThread.createdEvent.city} | {activeThread.createdEvent.venue}</p>
            <p>{new Date(activeThread.createdEvent.event_time).toLocaleString()}</p>
          </div>
        )}

        <form ref={composerFormRef} onSubmit={sendMessage} className="chat-composer">
          <label className="upload-btn">
            Upload Image
            <input type="file" accept="image/*" onChange={uploadImage} />
          </label>
          <textarea
            placeholder="Describe your event..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            rows={1}
          />
          <button type="submit" disabled={!canSend}>
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </section>
  );
}

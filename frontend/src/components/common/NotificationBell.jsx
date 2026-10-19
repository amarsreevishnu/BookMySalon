import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/notificationBell.css";

const NOTIF_ICONS = {
  BOOKING_CONFIRMED: { icon: "📅", className: "notif-icon-booking" },
  BOOKING_CANCELLED: { icon: "❌", className: "notif-icon-cancel" },
  BOOKING_RESCHEDULED: { icon: "🔄", className: "notif-icon-reschedule" },
  BOOKING_REASSIGNED: { icon: "👤", className: "notif-icon-reassign" },
  PAYMENT_SUCCESS: { icon: "💳", className: "notif-icon-payment" },
  PAYMENT_FAILED: { icon: "⚠️", className: "notif-icon-failed" },
  REFUND_COMPLETED: { icon: "💰", className: "notif-icon-refund" },
  LEAVE_APPROVED: { icon: "✅", className: "notif-icon-leave" },
  LEAVE_REJECTED: { icon: "⛔", className: "notif-icon-cancel" },
  NEW_REVIEW_SALON: { icon: "🌟", className: "notif-icon-review" },
  NEW_REVIEW_WORKER: { icon: "✂️", className: "notif-icon-review" },
  SALON_CREATED: { icon: "🏪", className: "notif-icon-salon" },
  GENERAL: { icon: "🔔", className: "notif-icon-general" },
};

export default function NotificationBell({ theme = "light", className = "" }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all"); // "all" | "unread"
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const containerRef = useRef(null);

  // Fetch unread count lightweight
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await api.get("/notifications/unread-count/");
      if (res.data && typeof res.data.unread_count === "number") {
        setUnreadCount(res.data.unread_count);
      }
    } catch {
      // Quiet fail if network/auth not ready
    }
  }, [isAuthenticated]);

  // Fetch full list
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const res = await api.get("/notifications/?limit=30");
      if (res.data) {
        setNotifications(res.data.notifications || []);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch {
      // Quiet fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // Initial load and periodic polling (every 30 seconds)
  useEffect(() => {
    fetchUnreadCount();

    const interval = setInterval(fetchUnreadCount, 30000);

    const handleFocus = () => {
      fetchUnreadCount();
      if (isOpen) fetchNotifications();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchUnreadCount, fetchNotifications, isOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const toggleDropdown = () => {
    if (!isOpen) {
      fetchNotifications();
    }
    setIsOpen((prev) => !prev);
  };

  const handleMarkAsRead = async (notif, e) => {
    if (e) e.stopPropagation();
    if (notif.is_read) return;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/notifications/${notif.id}/read/`);
    } catch {
      fetchNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);

    try {
      await api.post("/notifications/mark-all-read/");
    } catch {
      fetchNotifications();
    }
  };

  const handleClearRead = async () => {
    setNotifications((prev) => prev.filter((n) => !n.is_read));

    try {
      await api.delete("/notifications/clear-read/");
    } catch {
      fetchNotifications();
    }
  };

  const handleItemClick = (notif) => {
    if (!notif.is_read) {
      handleMarkAsRead(notif);
    }
    setIsOpen(false);

    const link = notif.data?.link;
    if (link) {
      navigate(link);
    }
  };

  const filteredNotifications =
    activeTab === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications;

  const isDark = theme === "dark";

  return (
    <div className={`notif-bell-container ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`notif-bell-btn ${isDark ? "theme-dark" : ""}`}
        onClick={toggleDropdown}
        title="Notifications"
        aria-label="Notifications"
      >
        <svg
          className="notif-bell-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span className="notif-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notif-dropdown">
          {/* Header */}
          <div className="notif-header">
            <div className="notif-title-group">
              <h4 className="notif-title">Notifications</h4>
              {unreadCount > 0 && (
                <span className="notif-unread-pill">{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Segmented Filter Tabs */}
          <div className="notif-tabs">
            <button
              type="button"
              className={`notif-tab ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              className={`notif-tab ${activeTab === "unread" ? "active" : ""}`}
              onClick={() => setActiveTab("unread")}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <ul className="notif-list">
            {loading && notifications.length === 0 ? (
              <li className="notif-empty">
                <span className="notif-empty-desc">Loading notifications...</span>
              </li>
            ) : filteredNotifications.length === 0 ? (
              <li className="notif-empty">
                <div className="notif-empty-icon">🎉</div>
                <div className="notif-empty-title">All caught up!</div>
                <p className="notif-empty-desc">
                  {activeTab === "unread"
                    ? "You have no unread notifications."
                    : "No notifications recorded yet."}
                </p>
              </li>
            ) : (
              filteredNotifications.map((n) => {
                const conf = NOTIF_ICONS[n.notification_type] || NOTIF_ICONS.GENERAL;
                return (
                  <li
                    key={n.id}
                    className={`notif-item ${!n.is_read ? "unread" : ""}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className={`notif-icon-wrap ${conf.className}`}>
                      {conf.icon}
                    </div>

                    <div className="notif-content">
                      <div className="notif-item-top">
                        <h5 className="notif-item-title">{n.title}</h5>
                        <span className="notif-item-time">{n.time_ago}</span>
                      </div>
                      <p className="notif-item-message">{n.message}</p>
                    </div>

                    {!n.is_read && (
                      <span
                        className="notif-unread-dot"
                        title="Unread"
                        onClick={(e) => handleMarkAsRead(n, e)}
                      />
                    )}
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="notif-footer">
              <button
                type="button"
                className="notif-footer-btn"
                onClick={handleClearRead}
              >
                Clear read
              </button>
              <button
                type="button"
                className="notif-footer-btn"
                onClick={() => setIsOpen(false)}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


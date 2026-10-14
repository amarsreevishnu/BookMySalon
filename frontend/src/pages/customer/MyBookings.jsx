import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import "../../styles/booking.css";

const STATUS_COLORS = {
  CONFIRMED: "#2d6a4f",
  PENDING: "#b45309",
  IN_PROGRESS: "#1d4ed8",
  COMPLETED: "#374151",
  CANCELLED: "#9ca3af",
};

function fmt12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [toast, setToast] = useState("");

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  async function fetchBookings() {
    setLoading(true);
    setError("");
    try {
      const r = await api.get("/bookings/my/");
      setBookings(r.data.bookings || []);
    } catch (e) {
      if (e?.response?.status === 401) {
        navigate("/login");
      } else {
        setError("Could not load bookings. Please refresh.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  async function handleCancel(id) {
    if (!window.confirm("Are you sure you want to cancel this booking?")) return;
    setCancellingId(id);
    try {
      await api.patch(`/bookings/${id}/cancel/`);
      showToast("Booking cancelled successfully.");
      fetchBookings();
    } catch (e) {
      showToast(e?.response?.data?.error || "Failed to cancel booking.");
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="bk-page">
      <CustomerHeader />

      {toast && <div className="bk-toast">{toast}</div>}

      <div className="bk-container">
        <div className="bk-mybookings-header">
          <h1>My Bookings</h1>
          <button className="bk-btn-primary" onClick={() => navigate("/salons")}>
            + New Booking
          </button>
        </div>

        {loading && (
          <div className="bk-loading">
            <div className="bk-spinner" />
            <p>Loading your bookings…</p>
          </div>
        )}

        {!loading && error && <div className="bk-alert bk-alert--error">{error}</div>}

        {!loading && !error && bookings.length === 0 && (
          <div className="bk-empty-state">
            <div className="bk-empty-icon">📅</div>
            <h3>No bookings yet</h3>
            <p>Explore our salons and book your first appointment!</p>
            <button className="bk-btn-primary" onClick={() => navigate("/salons")}>
              Explore Salons
            </button>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="bk-mybookings-list">
            {bookings.map((b) => {
              const canCancel = ["PENDING", "CONFIRMED"].includes(b.status);
              return (
                <div key={b.id} className="bk-booking-card">
                  <div className="bk-booking-top">
                    <div>
                      <div className="bk-booking-salon">{b.salon_name}</div>
                      <div className="bk-booking-service">{b.service_name}</div>
                    </div>
                    <span
                      className="bk-status-badge"
                      style={{ background: STATUS_COLORS[b.status] || "#6b7280" }}
                    >
                      {b.status}
                    </span>
                  </div>

                  <div className="bk-booking-details">
                    <div className="bk-bd-row">
                      <span>📅 Date</span>
                      <strong>{b.booking_date}</strong>
                    </div>
                    <div className="bk-bd-row">
                      <span>🕐 Time</span>
                      <strong>
                        {b.start_time ? `${fmt12(b.start_time)} → ${fmt12(b.end_time)}` : b.booking_time}
                      </strong>
                    </div>
                    <div className="bk-bd-row">
                      <span>👤 Stylist</span>
                      <strong>{b.worker_name || "Any Available"}</strong>
                    </div>
                    <div className="bk-bd-row">
                      <span>💰 Amount</span>
                      <strong>₹{Number(b.service_price).toLocaleString("en-IN")}</strong>
                    </div>
                    <div className="bk-bd-row">
                      <span>🔖 Ref</span>
                      <strong>BMS-{b.id}</strong>
                    </div>
                  </div>

                  {canCancel && (
                    <div className="bk-booking-actions">
                      <button
                        className="bk-btn-cancel"
                        disabled={cancellingId === b.id}
                        onClick={() => handleCancel(b.id)}
                      >
                        {cancellingId === b.id ? "Cancelling…" : "Cancel Booking"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CustomerFooter />
    </div>
  );
}


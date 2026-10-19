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

  // Review Modal State
  const [activeReviewBooking, setActiveReviewBooking] = useState(null);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [salonRating, setSalonRating] = useState(5);
  const [hoverSalonRating, setHoverSalonRating] = useState(0);
  const [salonComment, setSalonComment] = useState("");
  const [workerRating, setWorkerRating] = useState(5);
  const [hoverWorkerRating, setHoverWorkerRating] = useState(0);
  const [workerComment, setWorkerComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

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

  function openCreateReviewModal(b) {
    setActiveReviewBooking(b);
    setIsViewOnly(false);
    setSalonRating(5);
    setHoverSalonRating(0);
    setSalonComment("");
    setWorkerRating(5);
    setHoverWorkerRating(0);
    setWorkerComment("");
    setReviewError("");
  }

  function openViewReviewModal(b) {
    setActiveReviewBooking(b);
    setIsViewOnly(true);
    setSalonRating(b.salon_review?.rating || 5);
    setSalonComment(b.salon_review?.comment || "");
    setWorkerRating(b.worker_review?.rating || 5);
    setWorkerComment(b.worker_review?.comment || "");
    setReviewError("");
  }

  function closeReviewModal() {
    setActiveReviewBooking(null);
    setReviewError("");
  }

  async function handleSubmitReview(e) {
    e.preventDefault();
    if (!activeReviewBooking) return;
    setSubmittingReview(true);
    setReviewError("");

    const payload = {
      salon_rating: salonRating,
      salon_comment: salonComment.trim(),
    };

    if (activeReviewBooking.worker) {
      payload.worker_rating = workerRating;
      payload.worker_comment = workerComment.trim();
    }

    try {
      const res = await api.post(`/bookings/${activeReviewBooking.id}/reviews/`, payload);
      showToast(res.data?.message || "Thank you! Your review has been submitted. 🎉");
      closeReviewModal();
      await fetchBookings();
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || "Failed to submit review. Please try again.";
      setReviewError(msg);
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="bk-page">
      <CustomerHeader />

      {toast && <div className="bk-toast">{toast}</div>}

      <div className="bk-container">
        <div className="bk-mybookings-header">
          <h1>My Bookings</h1>
          <button className="bk-btn-primary" onClick={() => navigate("/customer/salons")}>
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
            <button className="bk-btn-primary" onClick={() => navigate("/customer/salons")}>
              Explore Salons
            </button>
          </div>
        )}

        {!loading && !error && bookings.length > 0 && (
          <div className="bk-mybookings-list">
            {bookings.map((b) => {
              const canCancel = ["PENDING", "CONFIRMED"].includes(b.status);
              const isCompleted = b.status === "COMPLETED";
              const isReviewed = Boolean(b.has_salon_review || b.has_worker_review);

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

                  {/* Completed Booking Review Actions */}
                  {isCompleted && (
                    <div className="bk-booking-actions" style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                      {!isReviewed ? (
                        <button
                          type="button"
                          className="bk-btn-review"
                          onClick={() => openCreateReviewModal(b)}
                        >
                          <span>⭐</span> Rate &amp; Review Service
                        </button>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                          <div className="bk-reviewed-badge">
                            <span>✓ Feedback Submitted</span>
                            {b.salon_review && <span>• Salon: {b.salon_review.rating}★</span>}
                            {b.worker_review && <span>• Stylist: {b.worker_review.rating}★</span>}
                          </div>
                          <button
                            type="button"
                            className="bk-btn-view-review"
                            onClick={() => openViewReviewModal(b)}
                          >
                            View Feedback
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {activeReviewBooking && (
        <div className="bk-modal-backdrop" onClick={closeReviewModal}>
          <div className="bk-review-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700, color: "#1e293b" }}>
                  {isViewOnly ? "Your Appointment Feedback" : "Rate & Review Your Experience"}
                </h3>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748b" }}>
                  {activeReviewBooking.salon_name} • {activeReviewBooking.service_name} (BMS-{activeReviewBooking.id})
                </p>
              </div>
              <button
                type="button"
                onClick={closeReviewModal}
                style={{
                  background: "transparent",
                  border: "none",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "4px",
                }}
              >
                ✕
              </button>
            </div>

            {reviewError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "10px", padding: "10px 14px", color: "#b91c1c", fontSize: "0.82rem", fontWeight: 600 }}>
                ⚠️ {reviewError}
              </div>
            )}

            <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* SECTION 1: Salon Rating */}
              <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f2d21" }}>
                    🏛️ Salon Rating &amp; Ambiance
                  </span>
                  <span style={{ fontWeight: 700, color: "#d97706", fontSize: "0.95rem" }}>
                    {salonRating} of 5 Stars
                  </span>
                </div>
                <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#64748b" }}>
                  How satisfied were you with the salon hygiene, hospitality, atmosphere, and amenities?
                </p>

                {/* Stars */}
                <div className="bk-stars-row" style={{ marginBottom: "12px" }}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = (hoverSalonRating || salonRating) >= star;
                    return (
                      <button
                        type="button"
                        key={star}
                        disabled={isViewOnly}
                        className={`bk-star-btn ${isFilled ? "bk-star-btn--filled" : ""}`}
                        onMouseEnter={() => !isViewOnly && setHoverSalonRating(star)}
                        onMouseLeave={() => !isViewOnly && setHoverSalonRating(0)}
                        onClick={() => !isViewOnly && setSalonRating(star)}
                        title={`${star} Star${star > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    );
                  })}
                </div>

                <textarea
                  className="bk-review-textarea"
                  placeholder="Share details of your salon experience (cleanliness, welcome drinks, comfort, wait time)... (optional)"
                  value={salonComment}
                  onChange={(e) => setSalonComment(e.target.value)}
                  disabled={isViewOnly}
                  rows={2}
                />
              </div>

              {/* SECTION 2: Worker / Stylist Rating (if assigned) */}
              {activeReviewBooking.worker && (
                <div style={{ background: "#f8fafc", padding: "16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f2d21" }}>
                      👤 Specialist: {activeReviewBooking.worker_name}
                    </span>
                    <span style={{ fontWeight: 700, color: "#d97706", fontSize: "0.95rem" }}>
                      {workerRating} of 5 Stars
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: "#64748b" }}>
                    How would you rate the specialist's skill, consultation, courtesy, and haircut / treatment?
                  </p>

                  {/* Stars */}
                  <div className="bk-stars-row" style={{ marginBottom: "12px" }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = (hoverWorkerRating || workerRating) >= star;
                      return (
                        <button
                          type="button"
                          key={star}
                          disabled={isViewOnly}
                          className={`bk-star-btn ${isFilled ? "bk-star-btn--filled" : ""}`}
                          onMouseEnter={() => !isViewOnly && setHoverWorkerRating(star)}
                          onMouseLeave={() => !isViewOnly && setHoverWorkerRating(0)}
                          onClick={() => !isViewOnly && setWorkerRating(star)}
                          title={`${star} Star${star > 1 ? "s" : ""}`}
                        >
                          ★
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    className="bk-review-textarea"
                    placeholder={`How was your session with ${activeReviewBooking.worker_name}? Attention to detail, technique, recommendations... (optional)`}
                    value={workerComment}
                    onChange={(e) => setWorkerComment(e.target.value)}
                    disabled={isViewOnly}
                    rows={2}
                  />
                </div>
              )}

              {/* Footer buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="bk-btn-outline"
                  onClick={closeReviewModal}
                >
                  {isViewOnly ? "Close" : "Cancel"}
                </button>
                {!isViewOnly && (
                  <button
                    type="submit"
                    className="bk-btn-primary"
                    disabled={submittingReview}
                  >
                    {submittingReview ? "Submitting…" : "Submit Review →"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomerFooter />
    </div>
  );
}

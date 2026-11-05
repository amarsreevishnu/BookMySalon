import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import ServiceReceiptModal from "../../components/common/ServiceReceiptModal";
import "../../styles/booking.css";

const STATUS_CONFIG = {
  CONFIRMED: {
    bg: "#ecfdf5",
    color: "#065f46",
    border: "#a7f3d0",
    dot: "#10b981",
    label: "Confirmed",
  },
  PENDING: {
    bg: "#fffbeb",
    color: "#92400e",
    border: "#fde68a",
    dot: "#f59e0b",
    label: "Pending",
  },
  IN_PROGRESS: {
    bg: "#eff6ff",
    color: "#1e40af",
    border: "#bfdbfe",
    dot: "#3b82f6",
    label: "In Progress",
  },
  COMPLETED: {
    bg: "#f0fdf4",
    color: "#166534",
    border: "#bbf7d0",
    dot: "#22c55e",
    label: "Completed",
  },
  CANCELLED: {
    bg: "#f3f4f6",
    color: "#4b5563",
    border: "#e5e7eb",
    dot: "#9ca3af",
    label: "Cancelled",
  },
};

function fmt12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function parseDateBadge(dateStr) {
  if (!dateStr) return { month: "APT", day: "•", weekday: "" };
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return {
        month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
        day: String(d.getDate()).padStart(2, "0"),
        weekday: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
      };
    }
  }
  return { month: "APT", day: "•", weekday: "" };
}

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelModalBooking, setCancelModalBooking] = useState(null);
  const [toast, setToast] = useState("");

  // Interactive Filter & Search States
  const [activeTab, setActiveTab] = useState("ALL"); // 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest"); // 'newest' | 'oldest'
  const [expandedCards, setExpandedCards] = useState({});

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

  // Receipt Modal State
  const [activeReceiptBookingId, setActiveReceiptBookingId] = useState(null);

  function openReceiptModal(b) {
    setActiveReceiptBookingId(b.id);
  }

  function closeReceiptModal() {
    setActiveReceiptBookingId(null);
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }

  function toggleExpand(id) {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleCopyRef(refText) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(refText);
      showToast(`Copied ${refText} to clipboard!`);
    }
  }

  async function fetchBookings() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/bookings/my/");
      setBookings(res.data.bookings || []);
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

  function handleCancel(bookingOrId) {
    if (typeof bookingOrId === "object" && bookingOrId !== null) {
      setCancelModalBooking(bookingOrId);
    } else {
      const b = bookings.find((item) => item.id === bookingOrId);
      setCancelModalBooking(b || { id: bookingOrId });
    }
  }

  async function confirmCancel() {
    if (!cancelModalBooking) return;
    const id = cancelModalBooking.id;
    setCancellingId(id);
    try {
      await api.patch(`/bookings/${id}/cancel/`);
      showToast("Booking cancelled successfully.");
      setCancelModalBooking(null);
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

  // Interactive Metrics Counts
  const upcomingCount = useMemo(
    () => bookings.filter((b) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status)).length,
    [bookings]
  );
  const completedCount = useMemo(
    () => bookings.filter((b) => b.status === "COMPLETED").length,
    [bookings]
  );
  const cancelledCount = useMemo(
    () => bookings.filter((b) => b.status === "CANCELLED").length,
    [bookings]
  );
  const totalCount = bookings.length;

  // Filtered & Sorted Bookings List
  const filteredBookings = useMemo(() => {
    let list = [...bookings];

    // Tab filter
    if (activeTab === "UPCOMING") {
      list = list.filter((b) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
    } else if (activeTab === "COMPLETED") {
      list = list.filter((b) => b.status === "COMPLETED");
    } else if (activeTab === "CANCELLED") {
      list = list.filter((b) => b.status === "CANCELLED");
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          (b.salon_name && b.salon_name.toLowerCase().includes(q)) ||
          (b.service_name && b.service_name.toLowerCase().includes(q)) ||
          (b.worker_name && b.worker_name.toLowerCase().includes(q)) ||
          String(b.id).includes(q)
      );
    }

    // Sort order
    list.sort((a, b) => {
      const dateA = new Date(`${a.booking_date}T${a.start_time || "00:00:00"}`).getTime();
      const dateB = new Date(`${b.booking_date}T${b.start_time || "00:00:00"}`).getTime();
      return sortOrder === "oldest" ? dateA - dateB : dateB - dateA;
    });

    return list;
  }, [bookings, activeTab, searchQuery, sortOrder]);

  return (
    <div className="bk-page">
      <CustomerHeader />

      {toast && <div className="bk-toast">{toast}</div>}

      <div className="bk-container" style={{ maxWidth: "980px" }}>
        {/* Header Bar */}
        <div className="bk-mybookings-header">
          <div className="bk-mybookings-title-group">
            <h1>My Appointments</h1>
            <p>View, manage, track, and review your salon reservations.</p>
          </div>
          <button className="bk-btn-primary" onClick={() => navigate("/customer/salons")}>
            <span>+</span> Book New Salon
          </button>
        </div>

        

        {/* Interactive Filter Toolbar & Search */}
        {!loading && bookings.length > 0 && (
          <div className="bk-mb-toolbar">
            {/* Tabs */}
            <div className="bk-mb-tabs">
              <button
                type="button"
                className={`bk-mb-tab-btn ${activeTab === "ALL" ? "active" : ""}`}
                onClick={() => setActiveTab("ALL")}
              >
                <span>All</span>
                <span className="bk-mb-tab-badge">{totalCount}</span>
              </button>
              <button
                type="button"
                className={`bk-mb-tab-btn ${activeTab === "UPCOMING" ? "active" : ""}`}
                onClick={() => setActiveTab("UPCOMING")}
              >
                <span>Upcoming</span>
                <span className="bk-mb-tab-badge">{upcomingCount}</span>
              </button>
              <button
                type="button"
                className={`bk-mb-tab-btn ${activeTab === "COMPLETED" ? "active" : ""}`}
                onClick={() => setActiveTab("COMPLETED")}
              >
                <span>Completed</span>
                <span className="bk-mb-tab-badge">{completedCount}</span>
              </button>
              <button
                type="button"
                className={`bk-mb-tab-btn ${activeTab === "CANCELLED" ? "active" : ""}`}
                onClick={() => setActiveTab("CANCELLED")}
              >
                <span>Cancelled</span>
                <span className="bk-mb-tab-badge">{cancelledCount}</span>
              </button>
            </div>

            {/* Controls Right: Search & Sort */}
            <div className="bk-mb-controls-right">
              <div className="bk-mb-search-box">
                <span className="bk-mb-search-icon">🔍</span>
                <input
                  type="text"
                  className="bk-mb-search-input"
                  placeholder="Search salon, service, stylist..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="bk-mb-clear-search"
                    onClick={() => setSearchQuery("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                className="bk-mb-sort-select"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                aria-label="Sort Bookings"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bk-loading" style={{ padding: "60px 0" }}>
            <div className="bk-spinner" />
            <p>Loading your appointments…</p>
          </div>
        )}

        {/* Error Alert */}
        {!loading && error && <div className="bk-alert bk-alert--error">{error}</div>}

        {/* Global Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="bk-empty-state" style={{ background: "#ffffff", borderRadius: "18px", border: "1px solid #e5ede7", padding: "64px 24px" }}>
            <div className="bk-empty-icon" style={{ fontSize: "3.5rem" }}>📅</div>
            <h3>No appointments booked yet</h3>
            <p style={{ maxWidth: "380px", margin: "8px auto 24px", color: "#627568", fontSize: "0.95rem" }}>
              Discover premier salons in your area, select your preferred specialists, and reserve your slots online with ease!
            </p>
            <button className="bk-btn-primary" onClick={() => navigate("/customer/salons")}>
              Explore Top Salons →
            </button>
          </div>
        )}

        {/* Filtered Empty State (No search/tab matches) */}
        {!loading && !error && bookings.length > 0 && filteredBookings.length === 0 && (
          <div className="bk-empty-state" style={{ background: "#ffffff", borderRadius: "16px", border: "1px dashed #d1ded6", padding: "48px 24px" }}>
            <div className="bk-empty-icon" style={{ fontSize: "2.6rem" }}>🔎</div>
            <h3>No matching appointments found</h3>
            <p style={{ margin: "6px auto 18px", color: "#6b7280", fontSize: "0.9rem" }}>
              {searchQuery
                ? `No bookings match your search for "${searchQuery}".`
                : `You currently have no ${activeTab.toLowerCase()} bookings.`}
            </p>
            <button
              type="button"
              className="bk-btn-outline"
              onClick={() => {
                setSearchQuery("");
                setActiveTab("ALL");
              }}
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Enhanced Interactive Bookings List */}
        {!loading && !error && filteredBookings.length > 0 && (
          <div className="bk-mybookings-list">
            {filteredBookings.map((b) => {
              const canCancel = ["PENDING", "CONFIRMED"].includes(b.status);
              const isCompleted = b.status === "COMPLETED";
              const isReviewed = Boolean(b.has_salon_review || b.has_worker_review);
              const dateMeta = parseDateBadge(b.booking_date);
              const statusCfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.CONFIRMED;
              const isExpanded = Boolean(expandedCards[b.id]);
              const refCode = `BMS-${b.id}`;

              const payableTotal = b.total_amount
                ? Number(b.total_amount)
                : Number(b.service_price || 0);

              const paymentMethodLabel =
                b.payment_method === "ONLINE"
                  ? "💳 Online Paid"
                  : b.payment_method === "WALLET"
                  ? "👛 Wallet"
                  : "🏠 Pay at Salon";

              return (
                <article key={b.id} className="bk-mb-card">
                  <div className="bk-mb-card-main">
                    {/* Top Header Row */}
                    <div className="bk-mb-card-top">
                      <div className="bk-mb-left-block">
                        {/* Calendar Tear-Off Badge */}
                        <div className="bk-mb-date-badge" title={`Appointment on ${b.booking_date}`}>
                          <span className="bk-mb-db-month">{dateMeta.month}</span>
                          <span className="bk-mb-db-day">{dateMeta.day}</span>
                          <span className="bk-mb-db-weekday">{dateMeta.weekday}</span>
                        </div>

                        {/* Salon & Service Title Block */}
                        <div className="bk-mb-info-block">
                          <Link
                            to={`/customer/salons/${b.salon_id || b.salon}`}
                            className="bk-mb-salon-link"
                            title="View salon details & services"
                          >
                            <span>🏪 {b.salon_name}</span>
                            <span style={{ fontSize: "11px", color: "#6b7280" }}>↗</span>
                          </Link>

                          <h3 className="bk-mb-service-title">
                            {b.service_display_name || b.service_name}
                          </h3>

                          {/* Meta Pills */}
                          <div className="bk-mb-meta-badges">
                            {b.duration && (
                              <span className="bk-mb-pill">
                                ⏱️ {b.duration}
                              </span>
                            )}
                            {b.station && (
                              <span className="bk-mb-pill">
                                📍 {b.station}
                              </span>
                            )}
                            <span
                              className="bk-mb-pill copyable"
                              onClick={() => handleCopyRef(refCode)}
                              title="Click to copy booking reference"
                            >
                              🔖 {refCode} <span style={{ fontSize: "10px", color: "#8b9e92" }}>📋</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Block: Status & Price */}
                      <div className="bk-mb-right-block">
                        <span
                          className="bk-mb-status-pill"
                          style={{
                            background: statusCfg.bg,
                            color: statusCfg.color,
                            border: `1px solid ${statusCfg.border}`,
                          }}
                        >
                          <span
                            className="bk-mb-status-dot"
                            style={{ background: statusCfg.dot }}
                          />
                          {statusCfg.label}
                        </span>

                        <div className="bk-mb-price-tag">
                          ₹{payableTotal.toLocaleString("en-IN")}
                        </div>
                        <span className="bk-mb-price-sub">{paymentMethodLabel}</span>
                      </div>
                    </div>

                    {/* Key Details Summary Grid */}
                    <div className="bk-mb-details-grid">
                      <div className="bk-mb-grid-item">
                        <div className="bk-mb-grid-icon">🕐</div>
                        <div className="bk-mb-grid-text">
                          <span className="bk-mb-grid-label">Time Slot</span>
                          <span className="bk-mb-grid-val">
                            {b.start_time ? `${fmt12(b.start_time)} → ${fmt12(b.end_time)}` : b.booking_time}
                          </span>
                        </div>
                      </div>

                      <div className="bk-mb-grid-item">
                        <div className="bk-mb-grid-icon">👤</div>
                        <div className="bk-mb-grid-text">
                          <span className="bk-mb-grid-label">Specialist</span>
                          <span className="bk-mb-grid-val">
                            {b.worker_name || "Any Available Specialist"}
                          </span>
                        </div>
                      </div>

                      <div className="bk-mb-grid-item">
                        <div className="bk-mb-grid-icon">💳</div>
                        <div className="bk-mb-grid-text">
                          <span className="bk-mb-grid-label">Payment Status</span>
                          <span className="bk-mb-grid-val" style={{ textTransform: "capitalize" }}>
                            {b.payment_status?.toLowerCase() || "Pending"}
                          </span>
                        </div>
                      </div>

                      <div className="bk-mb-grid-item">
                        <div className="bk-mb-grid-icon">✂️</div>
                        <div className="bk-mb-grid-text">
                          <span className="bk-mb-grid-label">Service</span>
                          <span className="bk-mb-grid-val">
                            {b.service_name}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Breakdown Toggle Button */}
                    <button
                      type="button"
                      className="bk-mb-expand-toggle"
                      onClick={() => toggleExpand(b.id)}
                      aria-expanded={isExpanded}
                    >
                      <span>{isExpanded ? "▲ Hide Price Breakdown & Notes" : "▼ View Price Breakdown & Notes"}</span>
                    </button>

                    {/* Expandable Breakdown Drawer */}
                    {isExpanded && (
                      <div className="bk-mb-breakdown-drawer">
                        {Array.isArray(b.services_detail) && b.services_detail.length > 0 && (
                          <div style={{ marginBottom: "6px" }}>
                            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>
                              Booked Services
                            </span>
                            {b.services_detail.map((svc, sIdx) => (
                              <div key={sIdx} className="bk-mb-bill-row" style={{ marginTop: "4px" }}>
                                <span>{svc.name} {svc.duration ? `(${svc.duration})` : ""}</span>
                                <span>₹{Number(svc.price).toLocaleString("en-IN")}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="bk-mb-bill-row">
                          <span>Subtotal</span>
                          <span>₹{Number(b.subtotal || b.service_price).toLocaleString("en-IN")}</span>
                        </div>

                        {Number(b.discount_amount || 0) > 0 && (
                          <div className="bk-mb-bill-row discount">
                            <span>Discount ({b.applied_offer_title || b.voucher_code || "Applied"})</span>
                            <span>-₹{Number(b.discount_amount).toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        {Number(b.tax_amount || 0) > 0 && (
                          <div className="bk-mb-bill-row">
                            <span>Taxes &amp; GST</span>
                            <span>+₹{Number(b.tax_amount).toLocaleString("en-IN")}</span>
                          </div>
                        )}

                        <div className="bk-mb-bill-row total">
                          <span>Final Payable Amount</span>
                          <span>₹{payableTotal.toLocaleString("en-IN")}</span>
                        </div>

                        {b.notes && (
                          <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px dashed #e2ece5", fontSize: "0.82rem", color: "#526659" }}>
                            <strong>Client Notes:</strong> &quot;{b.notes}&quot;
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="bk-mb-card-footer">
                    <div className="bk-mb-footer-left">
                      {/* Cancel Booking Button */}
                      {canCancel && (
                        <button
                          type="button"
                          className="bk-mb-btn bk-mb-btn-cancel"
                          disabled={cancellingId === b.id}
                          onClick={() => handleCancel(b)}
                        >
                          <span>✕</span>
                          <span>{cancellingId === b.id ? "Cancelling…" : "Cancel Booking"}</span>
                        </button>
                      )}

                      {/* Official Tax Invoice / Receipt Button */}
                      {b.receipt_available ? (
                        <button
                          type="button"
                          className="bk-mb-btn bk-mb-btn-receipt"
                          onClick={() => openReceiptModal(b)}
                          title="View and download your official tax invoice and receipt"
                        >
                          <span>📄</span>
                          <span>View Receipt</span>
                        </button>
                      ) : isCompleted ? (
                        <span className="bk-receipt-locked-hint" title="Receipt is being finalized">
                          ⏳ Finalizing receipt…
                        </span>
                      ) : (
                        <span
                          className="bk-receipt-locked-hint"
                          title="Receipt available once service is completed and payment confirmed"
                        >
                          🔒 Receipt available after service completion
                        </span>
                      )}
                    </div>

                    <div className="bk-mb-footer-right">
                      {/* Completed Booking Review Actions */}
                      {isCompleted && (
                        <>
                          {!isReviewed ? (
                            <button
                              type="button"
                              className="bk-mb-btn bk-mb-btn-review"
                              onClick={() => openCreateReviewModal(b)}
                            >
                              <span>⭐</span>
                              <span>Rate &amp; Review Service</span>
                            </button>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <div className="bk-mb-reviewed-pill">
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
                        </>
                      )}

                      {/* Book Again Rebook Shortcut for Completed or Cancelled bookings */}
                      {(isCompleted || b.status === "CANCELLED") && (
                        <Link
                          to={`/customer/salons/${b.salon_id || b.salon}`}
                          className="bk-mb-btn bk-mb-btn-rebook"
                          title="Book this salon again"
                        >
                          <span>🔄</span>
                          <span>Book Again</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </article>
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

      {/* Cancellation Confirmation Modal */}
      {cancelModalBooking && (
        <div
          className="bk-modal-backdrop"
          onClick={() => {
            if (!cancellingId) setCancelModalBooking(null);
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "460px",
              width: "100%",
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-modal-title"
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    background: "#fee2e2",
                    color: "#dc2626",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "20px",
                    flexShrink: 0,
                  }}
                >
                  ⚠️
                </div>
                <div>
                  <h3 id="cancel-modal-title" style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#1f2937" }}>
                    Cancel Booking
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: "13px", color: "#6b7280" }}>
                    Are you sure you want to cancel this booking?
                  </p>
                </div>
              </div>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  color: "#9ca3af",
                  fontSize: "18px",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: "6px",
                  lineHeight: 1,
                }}
                disabled={Boolean(cancellingId)}
                onClick={() => setCancelModalBooking(null)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                padding: "12px 14px",
                fontSize: "13px",
                color: "#374151",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {cancelModalBooking.salon_name && (
                <div>
                  <span style={{ color: "#6b7280" }}>Salon: </span>
                  <strong>{cancelModalBooking.salon_name}</strong>
                </div>
              )}
              {cancelModalBooking.service_name && (
                <div>
                  <span style={{ color: "#6b7280" }}>Service: </span>
                  <strong>{cancelModalBooking.service_name}</strong>
                </div>
              )}
              {cancelModalBooking.booking_date && (
                <div>
                  <span style={{ color: "#6b7280" }}>Appointment: </span>
                  <strong>
                    {cancelModalBooking.booking_date}
                    {cancelModalBooking.booking_time ? ` at ${fmt12(cancelModalBooking.booking_time)}` : ""}
                  </strong>
                </div>
              )}
              {cancelModalBooking.total_amount && (
                <div>
                  <span style={{ color: "#6b7280" }}>Total Amount: </span>
                  <strong>₹{cancelModalBooking.total_amount}</strong>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: "13px", color: "#4b5563", lineHeight: 1.5 }}>
              This appointment slot will be released. If you made an online or wallet payment, any eligible refund will be credited directly to your BookMySalon Wallet.
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: "10px",
                marginTop: "4px",
              }}
            >
              <button
                type="button"
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  color: "#374151",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: Boolean(cancellingId) ? "not-allowed" : "pointer",
                }}
                disabled={Boolean(cancellingId)}
                onClick={() => setCancelModalBooking(null)}
              >
                Keep Booking
              </button>
              <button
                type="button"
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid #dc2626",
                  background: "#dc2626",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: Boolean(cancellingId) ? "not-allowed" : "pointer",
                  opacity: Boolean(cancellingId) ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                disabled={Boolean(cancellingId)}
                onClick={confirmCancel}
              >
                {cancellingId ? "Cancelling…" : "Yes, Cancel Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Service Receipt Modal */}
      <ServiceReceiptModal
        isOpen={Boolean(activeReceiptBookingId)}
        bookingId={activeReceiptBookingId}
        onClose={closeReceiptModal}
      />

      <CustomerFooter />
    </div>
  );
}

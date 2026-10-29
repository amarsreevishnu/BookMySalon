import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../api/axios";
import WorkerHeader from "../../components/worker/WorkerHeader";
import WorkerSalonBanner from "../../components/worker/WorkerSalonBanner";
import "../../styles/workerAppointmentDetail.css";
import "../../styles/workerDashboard.css";

const formatINR = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export default function WorkerAppointmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live session timer state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef(null);

  // Remarks state
  const [remarks, setRemarks] = useState("");
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksSavedMsg, setRemarksSavedMsg] = useState(false);

  // Actions loading & confirmation modal
  const [actionLoading, setActionLoading] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [syncError, setSyncError] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  /* ------------------------------------------------------------------------ */
  /* Fetch Appointment Detail from Backend                                    */
  /* ------------------------------------------------------------------------ */
  const fetchAppointmentDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/salons/worker/appointments/${id}/`);
      setAppointment(res.data);
      if (res.data.worker_remarks) {
        setRemarks(res.data.worker_remarks);
      }
      return res.data;
    } catch (err) {
      console.error("Failed to load appointment detail:", err);
      setError(err.response?.data?.error || "Unable to load appointment details.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  /* ------------------------------------------------------------------------ */
  /* Start Service Handler                                                    */
  /* ------------------------------------------------------------------------ */
  const handleStartService = async () => {
    try {
      setActionLoading(true);
      const res = await api.patch(`/salons/worker/bookings/${id}/status/`, {
        status: "IN_PROGRESS",
        worker_remarks: remarks,
      });
      setAppointment(res.data.booking);
      showToast("Service started! Session is now active.");
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to start service.";
      showToast(`Error: ${errMsg}`);
    } finally {
      setActionLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Complete Service Handler                                                 */
  /* ------------------------------------------------------------------------ */
  const handleCompleteService = async () => {
    try {
      setActionLoading(true);
      setSyncError(null);
      const res = await api.patch(`/salons/worker/bookings/${id}/status/`, {
        status: "COMPLETED",
        worker_remarks: remarks,
      });
      setAppointment(res.data.booking);
      setShowCompleteConfirm(false);
      showToast("Service completed! Earnings credited to your wallet.");
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to complete service.";
      setSyncError(errMsg);
      showToast(`Error: ${errMsg}`);
    } finally {
      setActionLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Reconcile Revenue Handler (Retry / Synchronize Missing Earnings)        */
  /* ------------------------------------------------------------------------ */
  const handleReconcileRevenue = async () => {
    try {
      setActionLoading(true);
      setSyncError(null);
      const res = await api.post(`/payments/bookings/${id}/reconcile-revenue/`);
      if (res.data?.booking) {
        setAppointment(res.data.booking);
      } else {
        await fetchAppointmentDetail();
      }
      showToast(res.data?.message || "Revenue successfully synchronized and credited! 🎉");
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to reconcile revenue.";
      setSyncError(errMsg);
      showToast(`Reconciliation error: ${errMsg}`);
    } finally {
      setActionLoading(false);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Save Worker Remarks                                                      */
  /* ------------------------------------------------------------------------ */
  const handleSaveRemarks = async () => {
    try {
      setSavingRemarks(true);
      await api.patch(`/salons/worker/appointments/${id}/`, {
        worker_remarks: remarks,
      });
      setRemarksSavedMsg(true);
      setTimeout(() => setRemarksSavedMsg(false), 3000);
      showToast("Specialist consultation remarks saved.");
    } catch (err) {
      console.error("Failed to save remarks:", err);
      showToast("Could not save remarks.");
    } finally {
      setSavingRemarks(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAppointmentDetail().then((data) => {
      // If user came with autoStart=true and booking is CONFIRMED, start service immediately!
      if (location.state?.autoStart && data && data.status === "CONFIRMED") {
        handleStartService();
      }
    });
  }, [fetchAppointmentDetail, location.state]);

  // Live session timer calculation
  useEffect(() => {
    if (appointment?.status === "IN_PROGRESS") {
      const startTime = appointment.service_started_at
        ? new Date(appointment.service_started_at).getTime()
        : Date.now();

      const updateElapsed = () => {
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - startTime) / 1000));
        setElapsedSeconds(diff);
      };

      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);

      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [appointment?.status, appointment?.service_started_at]);

  const formatTimer = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;
  };

  const cust = appointment?.customer_profile || {
    name: appointment?.client_name || "Customer",
    phone: appointment?.client_phone || "",
    email: appointment?.client_email || "",
    avatar: "",
    total_visits: 1,
    member_since: "Client",
  };

  const isConfirmed = appointment?.status === "CONFIRMED";
  const isInProgress = appointment?.status === "IN_PROGRESS";
  const isCompleted = appointment?.status === "COMPLETED";

  return (
    <div className="wd-container">
      <WorkerHeader activeTab="appointments" />

      <main className="wd-main">
        <WorkerSalonBanner />

        <div className="worker-appt-detail-container">
          
          <div className="worker-detail-top-bar">
            <Link to="/worker/appointments" className="worker-btn-back">
              <span>&larr;</span> Back to Appointments
            </Link>

            <div className="worker-detail-header-badges">
              <span className="worker-booking-id-tag" style={{ fontSize: "0.95rem", padding: "6px 14px" }}>
                {appointment?.booking_id_display || `#BK${id}`}
              </span>

              {isConfirmed && (
                <span className="worker-status-badge confirmed">
                  <span>●</span> Confirmed
                </span>
              )}
              {isInProgress && (
                <span className="worker-status-badge in-progress">
                  <span className="pulse-dot" /> In Progress
                </span>
              )}
              {isCompleted && (
                <span className="worker-status-badge completed">
                  <span>✓</span> Completed
                </span>
              )}
              {appointment?.status === "CANCELLED" && (
                <span className="worker-status-badge cancelled">
                  <span>✕</span> Cancelled
                </span>
              )}
              {appointment?.status === "NO_SHOW" && (
                <span className="worker-status-badge noshow">
                  <span>⏰</span> No Show
                </span>
              )}
            </div>
          </div>

          {/* -------------------------------------------------------------- */}
          {/* Live In-Progress Session Timer Banner                          */}
          {/* -------------------------------------------------------------- */}
          {isInProgress && (
            <section className="worker-live-session-banner">
              <div className="worker-live-banner-left">
                <div className="worker-timer-pulse-icon">✂</div>
                <div className="worker-timer-text-wrap">
                  <div className="worker-timer-tag">
                    <span className="pulse-dot" /> Live Active Session • Station Active
                  </div>
                  <div className="worker-timer-clock">
                    In Service: {formatTimer(elapsedSeconds)}
                  </div>
                </div>
              </div>

              <div className="worker-live-banner-right">
                <button
                  type="button"
                  className="btn-panel-action-complete"
                  onClick={() => setShowCompleteConfirm(true)}
                  disabled={actionLoading}
                >
                  <span>✓</span> Complete Service
                </button>
              </div>
            </section>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Revenue Synchronization Warning / Retry Banner                */}
          {/* -------------------------------------------------------------- */}
          {((isCompleted && appointment?.is_revenue_synced === false) || syncError) && (
            <div
              className="worker-completed-banner"
              style={{
                background: "#fffbeb",
                borderColor: "#fde68a",
                boxShadow: "0 4px 14px rgba(217, 119, 6, 0.12)",
                marginBottom: "20px",
              }}
            >
              <div className="worker-completed-left">
                <div
                  className="worker-completed-icon"
                  style={{ background: "#fef3c7", color: "#d97706" }}
                >
                  ⚠️
                </div>
                <div>
                  <h3 className="worker-completed-title" style={{ color: "#92400e" }}>
                    Revenue Ledger Synchronization Required
                  </h3>
                  <p className="worker-completed-sub" style={{ color: "#b45309" }}>
                    {syncError ||
                      "This completed service has not posted worker commission or owner ledger entry yet."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn-panel-action-complete"
                onClick={handleReconcileRevenue}
                disabled={actionLoading}
                style={{
                  background: "#d97706",
                  borderColor: "#b45309",
                  boxShadow: "0 4px 12px rgba(217, 119, 6, 0.25)",
                }}
              >
                <span>🔄</span> {actionLoading ? "Syncing..." : "Retry Revenue Sync"}
              </button>
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Completed Banner if Finished                                   */}
          {/* -------------------------------------------------------------- */}
          {isCompleted && appointment?.is_revenue_synced !== false && !syncError && (
            <div className="worker-completed-banner">
              <div className="worker-completed-left">
                <div className="worker-completed-icon">✓</div>
                <div>
                  <h3 className="worker-completed-title">Service Successfully Completed</h3>
                  <p className="worker-completed-sub">
                    Commission share has been credited to your worker wallet.
                  </p>
                </div>
              </div>
              <Link to="/worker/revenue" className="btn-worker-action view" style={{ textDecoration: "none" }}>
                <span>💰</span> View in Revenue Hub &rarr;
              </Link>
            </div>
          )}

          {/* Loading / Error States */}
          {loading && (
            <div className="worker-appts-loading">
              <div className="worker-spinner" />
              <span>Loading appointment details...</span>
            </div>
          )}

          {error && (
            <div className="worker-appts-empty">
              <div className="worker-appts-empty-icon">⚠️</div>
              <div className="worker-appts-empty-title">Appointment Not Found</div>
              <div className="worker-appts-empty-sub">{error}</div>
              <div style={{ marginTop: "16px" }}>
                <Link to="/worker/appointments" className="worker-btn-back">
                  Return to Appointments Table
                </Link>
              </div>
            </div>
          )}

          {/* -------------------------------------------------------------- */}
          {/* Main 2-Column Split Details Grid                               */}
          {/* -------------------------------------------------------------- */}
          {!loading && appointment && (
            <div className="worker-detail-grid">
              {/* LEFT COLUMN: Customer & Service Specifications */}
              <div className="worker-detail-col">
                {/* 1. Customer Profile Card */}
                <div className="worker-detail-card">
                  <div className="worker-card-header">
                    <div className="worker-card-title-group">
                      <span className="worker-card-icon">👤</span>
                      <h3 className="worker-card-title">Customer Profile</h3>
                    </div>
                    {cust.total_visits > 1 ? (
                      <span className="worker-client-loyalty-tag">
                        ★ Loyal Client • {cust.total_visits} Visits
                      </span>
                    ) : (
                      <span className="worker-client-loyalty-tag" style={{ background: "#f1f5f9", color: "#475569", borderColor: "#cbd5e1" }}>
                        New Client • 1st Visit
                      </span>
                    )}
                  </div>

                  <div className="worker-customer-hero">
                    <div className="worker-cust-avatar-wrap">
                      {cust.avatar ? (
                        <img src={cust.avatar} alt={cust.name} className="worker-cust-avatar-img" />
                      ) : (
                        <span>{cust.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="worker-cust-meta">
                      <h4 className="worker-cust-fullname">{cust.name}</h4>
                      <div className="worker-cust-badge-row">
                        <span className="worker-member-since-tag">
                          Member since {cust.member_since}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="worker-cust-contact-grid">
                    <div className="worker-contact-item">
                      <span className="worker-contact-label">Contact Phone</span>
                      <span className="worker-contact-val">
                        {cust.phone ? (
                          <a href={`tel:${cust.phone}`}>📞 {cust.phone}</a>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>Not provided</span>
                        )}
                      </span>
                    </div>

                    <div className="worker-contact-item">
                      <span className="worker-contact-label">Email Address</span>
                      <span className="worker-contact-val" style={{ wordBreak: "break-all" }}>
                        {cust.email || <span style={{ color: "#94a3b8" }}>Not provided</span>}
                      </span>
                    </div>
                  </div>

                  {appointment.notes && (
                    <div className="worker-cust-notes-box">
                      <div className="worker-cust-notes-title">Customer Special Instructions</div>
                      <p className="worker-cust-notes-text">{appointment.notes}</p>
                    </div>
                  )}
                </div>

                {/* 2. Service & Station Card */}
                <div className="worker-detail-card">
                  <div className="worker-card-header">
                    <div className="worker-card-title-group">
                      <span className="worker-card-icon">✂</span>
                      <h3 className="worker-card-title">Service &amp; Station Details</h3>
                    </div>
                    <span className="worker-service-duration-badge">
                      ⏱️ {appointment.duration_display || appointment.duration || "45 mins"}
                    </span>
                  </div>

                  <div className="worker-service-highlight-box">
                    <div>
                      <div className="worker-service-main-name">
                        {appointment.service_display_name || appointment.service_name}
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "#64748b", marginTop: "2px" }}>
                        Scheduled with {appointment.worker_name || "Specialist"}
                      </div>
                    </div>
                  </div>

                  <div className="worker-service-info-grid">
                    <div className="worker-service-info-cell">
                      <span className="worker-service-info-label">Assigned Station</span>
                      <span className="worker-service-info-val">
                        🪑 {appointment.station || "Station 01 • Chair #01"}
                      </span>
                    </div>

                    <div className="worker-service-info-cell">
                      <span className="worker-service-info-label">Appointment Date</span>
                      <span className="worker-service-info-val">
                        📅 {appointment.formatted_date || appointment.booking_date}
                      </span>
                    </div>

                    <div className="worker-service-info-cell">
                      <span className="worker-service-info-label">Scheduled Time Slot</span>
                      <span className="worker-service-info-val">
                        🕒 {appointment.formatted_time || appointment.booking_time}
                      </span>
                    </div>

                    <div className="worker-service-info-cell">
                      <span className="worker-service-info-label">Duration</span>
                      <span className="worker-service-info-val">
                        {appointment.duration_display || appointment.duration || "45 mins"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Financial Overview, Worker Remarks, Actions */}
              <div className="worker-detail-col">
                {/* 3. Financial & Billing Overview Card */}
                <div className="worker-detail-card">
                  <div className="worker-card-header">
                    <div className="worker-card-title-group">
                      <span className="worker-card-icon">💳</span>
                      <h3 className="worker-card-title">Billing &amp; Payment Overview</h3>
                    </div>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "4px 10px",
                        borderRadius: "12px",
                        background: appointment.is_fully_paid ? "#ecfdf5" : "#fffbeb",
                        color: appointment.is_fully_paid ? "#059669" : "#b45309",
                        border: appointment.is_fully_paid ? "1px solid #a7f3d0" : "1px solid #fde68a",
                      }}
                    >
                      {appointment.payment_status || "Pending"}
                    </span>
                  </div>

                  <div className="worker-finance-rows">
                    <div className="worker-finance-row">
                      <span>Gross Service Price:</span>
                      <strong>₹{formatINR(appointment.service_price)}</strong>
                    </div>

                    <div className="worker-finance-row">
                      <span>Online Token Advance:</span>
                      <span style={{ color: "#059669", fontWeight: 600 }}>
                        - ₹{formatINR(appointment.advance_amount)}
                      </span>
                    </div>

                    <div className="worker-finance-row">
                      <span>Remaining Balance at Counter:</span>
                      <span style={{ color: Number(appointment.remaining_amount) > 0 ? "#b45309" : "#059669", fontWeight: 700 }}>
                        ₹{formatINR(appointment.remaining_amount)}
                      </span>
                    </div>

                    <div className="worker-finance-row total">
                      <span>Final Total:</span>
                      <span>₹{formatINR(appointment.total_amount ?? appointment.service_price)}</span>
                    </div>
                  </div>

                  <div className="worker-commission-callout">
                    <div className="worker-comm-label">
                      Estimated Specialist Earning (60%):
                    </div>
                    <div className="worker-comm-val">
                      ₹{formatINR((Number(appointment.total_amount ?? appointment.service_price) * 0.6).toFixed(2))}
                    </div>
                  </div>
                </div>

                {/* 4. Worker Remarks & Treatment Notes (The requested feature) */}
                <div className="worker-detail-card worker-remarks-card">
                  <div className="worker-card-header">
                    <div className="worker-card-title-group">
                      <span className="worker-card-icon">📝</span>
                      <h3 className="worker-card-title">Specialist Remarks &amp; Notes</h3>
                    </div>
                    {remarksSavedMsg && (
                      <span style={{ fontSize: "0.8rem", color: "#059669", fontWeight: 700 }}>
                        ✓ Remarks Saved
                      </span>
                    )}
                  </div>

                  <p className="worker-remarks-hint" style={{ margin: 0 }}>
                    Record consultation notes, styling preferences, hair/skin assessment, formula used, or recommendations.
                  </p>

                  <textarea
                    className="worker-remarks-textarea"
                    placeholder="Enter your specialist treatment notes and observations here (e.g., Client requested zero-fade on sides, texture paste applied, scalp healthy)..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    disabled={isCompleted}
                  />

                  <div className="worker-remarks-footer">
                    <span className="worker-remarks-hint">
                      {isCompleted ? "Service completed. Remarks are archived." : "Remarks are auto-saved upon completion."}
                    </span>

                    {!isCompleted && (
                      <button
                        type="button"
                        className="btn-save-remarks"
                        onClick={handleSaveRemarks}
                        disabled={savingRemarks}
                      >
                        {savingRemarks ? "Saving..." : "Save Remarks"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 5. Session Actions Card */}
                {isConfirmed && (
                  <div className="worker-action-panel-card">
                    <h4 className="worker-action-panel-title">Ready to Begin Service?</h4>
                    <p className="worker-action-panel-sub">
                      Seat the client at {appointment.station || "your station"} and press Start Service to activate live session tracking.
                    </p>
                    <button
                      type="button"
                      className="btn-panel-action-start"
                      onClick={handleStartService}
                      disabled={actionLoading}
                    >
                      <span>▶</span> Start Service &amp; Open Session
                    </button>
                  </div>
                )}

                {isInProgress && (
                  <div className="worker-action-panel-card" style={{ borderColor: "#10b981", background: "#f0fdf4" }}>
                    <h4 className="worker-action-panel-title" style={{ color: "#065f46" }}>
                      Service In Progress
                    </h4>
                    <p className="worker-action-panel-sub" style={{ color: "#166534" }}>
                      This session page remains open while treating client. When finished, press Complete Service below.
                    </p>
                    <button
                      type="button"
                      className="btn-panel-action-complete"
                      onClick={() => setShowCompleteConfirm(true)}
                      disabled={actionLoading}
                    >
                      <span>✓</span> Complete Service &amp; Finalize
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ------------------------------------------------------------------ */}
      {/* Complete Service Confirmation Modal                                */}
      {/* ------------------------------------------------------------------ */}
      {showCompleteConfirm && (
        <div className="worker-confirm-modal-overlay" onClick={() => setShowCompleteConfirm(false)}>
          <div className="worker-confirm-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="worker-confirm-icon">✂</div>
            <h3 className="worker-confirm-title">Complete This Service?</h3>
            <p className="worker-confirm-desc">
              Are you sure the service for <strong>{cust.name}</strong> is complete?
              Your commission share will be credited immediately to your wallet.
            </p>

            <div className="worker-confirm-actions">
              <button
                type="button"
                className="btn-confirm-cancel"
                onClick={() => setShowCompleteConfirm(false)}
                disabled={actionLoading}
              >
                Keep In Progress
              </button>
              <button
                type="button"
                className="btn-confirm-proceed"
                onClick={handleCompleteService}
                disabled={actionLoading}
              >
                {actionLoading ? "Completing..." : "Yes, Complete Service"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="worker-toast">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}


import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/workerAppointments.css";

const formatINR = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

export default function WorkerAppointmentsTab() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({
    all: 0,
    today: 0,
    confirmed: 0,
    in_progress: 0,
    completed: 0,
    cancelled: 0,
    no_show: 0,
  });

  // Filters state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all"); // "all" | "today" | "tomorrow" | "week" | "custom"
  const [customDate, setCustomDate] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal & Toast states
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4500);
  };

  /* ------------------------------------------------------------------------ */
  /* Fetch Appointments from Backend                                          */
  /* ------------------------------------------------------------------------ */
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page);
      params.append("page_size", 10);

      if (search.trim()) {
        params.append("search", search.trim());
      }
      if (statusFilter) {
        params.append("status", statusFilter);
      }

      if (dateFilter === "custom" && customDate) {
        params.append("date", customDate);
      } else if (dateFilter && dateFilter !== "all" && dateFilter !== "custom") {
        params.append("date", dateFilter);
      }

      const res = await api.get(`/salons/worker/appointments/?${params.toString()}`);
      setAppointments(res.data.results || []);
      setTotalCount(res.data.count || 0);
      setTotalPages(res.data.total_pages || 1);
      if (res.data.counts) {
        setCounts(res.data.counts);
      }
    } catch (err) {
      console.error("Failed to load worker appointments:", err);
      showToast("Unable to load appointments. Please check connection.");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, dateFilter, customDate]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  /* ------------------------------------------------------------------------ */
  /* Update Service Progress (Start / Complete)                               */
  /* ------------------------------------------------------------------------ */
  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      setActionLoadingId(bookingId);
      const res = await api.patch(`/salons/worker/bookings/${bookingId}/status/`, {
        status: newStatus,
      });

      if (newStatus === "IN_PROGRESS") {
        showToast(`Appointment #BK${bookingId} started. In Service.`);
      } else if (newStatus === "COMPLETED") {
        showToast(`Appointment #BK${bookingId} completed! Earnings credited.`);
      } else {
        showToast(res.data?.message || "Status updated successfully.");
      }

      if (selectedAppt && selectedAppt.id === bookingId) {
        setSelectedAppt(null);
      }

      fetchAppointments();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to update appointment progress.";
      showToast(`Error: ${errMsg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Reconcile Revenue Handler                                                */
  /* ------------------------------------------------------------------------ */
  const handleReconcile = async (bookingId) => {
    try {
      setActionLoadingId(bookingId);
      const res = await api.post(`/payments/bookings/${bookingId}/reconcile-revenue/`);
      showToast(res.data?.message || `Booking #BK${bookingId} revenue successfully synchronized!`);
      if (selectedAppt && selectedAppt.id === bookingId) {
        setSelectedAppt(res.data?.booking || null);
      }
      fetchAppointments();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to reconcile revenue.";
      showToast(`Error: ${errMsg}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  /* ------------------------------------------------------------------------ */
  /* Render Actions dynamically according to booking status                   */
  /* ------------------------------------------------------------------------ */
  const renderActions = (item) => {
    const isUpdating = actionLoadingId === item.id;
    const actions = item.available_actions || ["view"];

    return (
      <div className="worker-actions-cell">
        {/* View Action: Opens Appointment Details Page */}
        <button
          type="button"
          className="btn-worker-action view"
          onClick={() => navigate(`/worker/appointments/${item.id}`)}
          title="View detailed customer profile and booking information"
        >
          <span>👁️</span> View
        </button>

        {/* Confirmed: Start Service -> Navigates to Live Service Page and Auto Starts */}
        {actions.includes("start") && (
          <button
            type="button"
            className="btn-worker-action start"
            onClick={() => navigate(`/worker/appointments/${item.id}`, { state: { autoStart: true } })}
            title="Start service and open active treatment session"
          >
            <span>▶</span> Start Service
          </button>
        )}

        {/* In Progress: Complete Service -> Navigates to Active Session to complete */}
        {actions.includes("complete") && (
          <button
            type="button"
            className="btn-worker-action complete"
            onClick={() => navigate(`/worker/appointments/${item.id}`)}
            title="Open active session to add remarks and complete service"
          >
            <span>✓</span> Complete Service
          </button>
        )}

        {/* Completed but revenue missing: Reconcile action */}
        {actions.includes("reconcile") && (
          <button
            type="button"
            className="btn-worker-action"
            style={{
              background: "#d97706",
              borderColor: "#b45309",
              color: "#ffffff",
              fontWeight: 700,
            }}
            onClick={() => handleReconcile(item.id)}
            disabled={isUpdating}
            title="Synchronize missing earnings to your wallet"
          >
            <span>🔄</span> {isUpdating ? "Syncing..." : "Sync Revenue"}
          </button>
        )}
      </div>
    );
  };

  /* ------------------------------------------------------------------------ */
  /* Helper to format Status Badge                                            */
  /* ------------------------------------------------------------------------ */
  const renderStatusBadge = (status, item = null) => {
    const s = String(status || "").toUpperCase();
    if (s === "CONFIRMED") {
      return (
        <span className="worker-status-badge confirmed">
          <span>●</span> Confirmed
        </span>
      );
    }
    if (s === "IN_PROGRESS") {
      return (
        <span className="worker-status-badge in-progress">
          <span className="pulse-dot" /> In Progress
        </span>
      );
    }
    if (s === "COMPLETED") {
      return (
        <div style={{ display: "inline-flex", flexDirection: "column", gap: "3px" }}>
          <span className="worker-status-badge completed">
            <span>✓</span> Completed
          </span>
          {item && item.is_revenue_synced === false && (
            <span style={{ fontSize: "10px", color: "#d97706", fontWeight: 700 }}>
              ⚠️ Revenue Pending
            </span>
          )}
        </div>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span className="worker-status-badge cancelled">
          <span>✕</span> Cancelled
        </span>
      );
    }
    if (s === "NO_SHOW") {
      return (
        <span className="worker-status-badge noshow" title="Customer did not arrive at appointment time">
          <span>⏰</span> No Show
        </span>
      );
    }
    return <span className="worker-status-badge">{status}</span>;
  };

  return (
    <div className="worker-appointments-container">
      {/* ------------------------------------------------------------------ */}
      {/* 1. Hero Header Banner                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-appts-hero">
        <div className="worker-appts-hero-left">
          <div className="worker-appts-badge-tag">
            <span className="tag-dot" />
            Specialist Station Schedule
          </div>
          <h1 className="worker-appts-hero-title">Appointment Management</h1>
          <p className="worker-appts-hero-sub">
            Track client arrivals, start services on schedule, and finalize completed appointments.
          </p>
        </div>

        <div className="worker-appts-hero-right">
          <button
            type="button"
            className="worker-btn-refresh"
            onClick={fetchAppointments}
            title="Refresh appointments"
          >
            <span>🔄</span> Refresh Table
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Live Counts Bar                                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="worker-status-quick-bar">
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("");
            setPage(1);
          }}
        >
          All Appointments <span className="worker-quick-count-tag">{counts.all}</span>
        </button>
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "CONFIRMED" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("CONFIRMED");
            setPage(1);
          }}
        >
          Confirmed <span className="worker-quick-count-tag">{counts.confirmed}</span>
        </button>
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "IN_PROGRESS" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("IN_PROGRESS");
            setPage(1);
          }}
        >
          In Progress <span className="worker-quick-count-tag">{counts.in_progress}</span>
        </button>
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "COMPLETED" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("COMPLETED");
            setPage(1);
          }}
        >
          Completed <span className="worker-quick-count-tag">{counts.completed}</span>
        </button>
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "CANCELLED" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("CANCELLED");
            setPage(1);
          }}
        >
          Cancelled <span className="worker-quick-count-tag">{counts.cancelled}</span>
        </button>
        <button
          type="button"
          className={`worker-status-quick-pill ${statusFilter === "NO_SHOW" ? "active" : ""}`}
          onClick={() => {
            setStatusFilter("NO_SHOW");
            setPage(1);
          }}
        >
          No Show <span className="worker-quick-count-tag">{counts.no_show}</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Filters Control Card                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-appts-controls-card">
        <div className="worker-controls-row-top">
          <div className="worker-appts-search-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by Booking # (e.g. #BK1024), customer name, phone, service..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="worker-controls-filters-group">
            <select
              className="worker-appts-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="NO_SHOW">No Show</option>
            </select>
          </div>
        </div>

        <div className="worker-controls-row-bottom">
          <div className="worker-date-pills-row">
            <button
              type="button"
              className={`worker-date-pill ${dateFilter === "all" ? "active" : ""}`}
              onClick={() => {
                setDateFilter("all");
                setPage(1);
              }}
            >
              All Dates
            </button>
            <button
              type="button"
              className={`worker-date-pill ${dateFilter === "today" ? "active" : ""}`}
              onClick={() => {
                setDateFilter("today");
                setPage(1);
              }}
            >
              Today ({counts.today})
            </button>
            <button
              type="button"
              className={`worker-date-pill ${dateFilter === "tomorrow" ? "active" : ""}`}
              onClick={() => {
                setDateFilter("tomorrow");
                setPage(1);
              }}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className={`worker-date-pill ${dateFilter === "week" ? "active" : ""}`}
              onClick={() => {
                setDateFilter("week");
                setPage(1);
              }}
            >
              This Week
            </button>
            <button
              type="button"
              className={`worker-date-pill ${dateFilter === "custom" ? "active" : ""}`}
              onClick={() => setDateFilter("custom")}
            >
              Custom Date
            </button>
          </div>

          {dateFilter === "custom" && (
            <div className="worker-custom-date-picker-wrap">
              <span>Date:</span>
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Appointments Table                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="worker-appts-table-card">
        {loading ? (
          <div className="worker-appts-loading">
            <div className="worker-spinner" />
            <span>Loading assigned appointments...</span>
          </div>
        ) : appointments.length === 0 ? (
          <div className="worker-appts-empty">
            <div className="worker-appts-empty-icon">📅</div>
            <div className="worker-appts-empty-title">No appointments found</div>
            <div className="worker-appts-empty-sub">
              {search || statusFilter || dateFilter !== "all"
                ? "Try adjusting your search query, status filter, or selected date."
                : "Appointments assigned to your station will appear here in real-time."}
            </div>
          </div>
        ) : (
          <div className="worker-appts-table-wrap">
            <table className="worker-appts-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Date &amp; Time</th>
                  <th>Duration</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((item) => (
                  <tr key={item.id}>
                    {/* 1. Booking ID */}
                    <td>
                      <span className="worker-booking-id-tag">
                        {item.booking_id_display || `#BK${item.id}`}
                      </span>
                    </td>

                    {/* 2. Customer */}
                    <td>
                      <div className="worker-cust-cell">
                        <span className="worker-cust-name">
                          {item.client_name || "Customer"}
                        </span>
                        {item.client_phone && (
                          <span className="worker-cust-phone">
                            <span>📞</span> {item.client_phone}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Service */}
                    <td>
                      <div className="worker-svc-cell">
                        <span className="worker-svc-title">
                          {item.service_display_name || item.service_name || "Salon Service"}
                        </span>
                        {item.station && (
                          <span className="worker-svc-station">
                            🪑 {item.station}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Date & Time */}
                    <td>
                      <div className="worker-datetime-cell">
                        <span className="worker-dt-date">
                          {item.formatted_date || item.booking_date}
                        </span>
                        <span className="worker-dt-time">
                          🕒 {item.formatted_time || item.booking_time}
                        </span>
                      </div>
                    </td>

                    {/* 5. Duration */}
                    <td>
                      <span className="worker-duration-tag">
                        {item.duration_display || item.duration || "45 mins"}
                      </span>
                    </td>

                    {/* 6. Amount */}
                    <td>
                      <span className="worker-amount-val">
                        ₹{formatINR(item.total_amount ?? item.service_price)}
                      </span>
                    </td>

                    {/* 7. Status */}
                    <td>{renderStatusBadge(item.status, item)}</td>

                    {/* 8. Actions */}
                    <td>{renderActions(item)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* Table Pagination Footer                                          */}
        {/* ---------------------------------------------------------------- */}
        {totalPages > 1 && (
          <div className="worker-appts-footer">
            <div className="worker-appts-count">
              Showing page {page} of {totalPages} ({totalCount} total bookings)
            </div>
            <div className="worker-appts-pagination">
              <button
                type="button"
                className="worker-appts-page-btn"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                &larr; Previous
              </button>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="worker-appts-page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 5. View Details Modal                                              */}
      {/* ------------------------------------------------------------------ */}
      {selectedAppt && (
        <div className="worker-modal-overlay" onClick={() => setSelectedAppt(null)}>
          <div className="worker-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="worker-modal-header">
              <div className="worker-modal-title-row">
                <h3 className="worker-modal-title">
                  Appointment {selectedAppt.booking_id_display || `#BK${selectedAppt.id}`}
                </h3>
                {renderStatusBadge(selectedAppt.status, selectedAppt)}
              </div>
              <button
                type="button"
                className="worker-modal-close-btn"
                onClick={() => setSelectedAppt(null)}
              >
                ✕
              </button>
            </div>

            <div className="worker-modal-body">
              {/* Client Information */}
              <div className="worker-modal-section">
                <div className="worker-modal-sec-title">Client Information</div>
                <div className="worker-modal-info-grid">
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Customer Name</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.client_name || "Customer"}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Contact Phone</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.client_phone || "Not provided"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Service & Schedule */}
              <div className="worker-modal-section">
                <div className="worker-modal-sec-title">Service &amp; Station</div>
                <div className="worker-modal-info-grid">
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Service</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.service_display_name || selectedAppt.service_name}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Duration</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.duration_display || selectedAppt.duration || "45 mins"}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Appointment Date</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.formatted_date || selectedAppt.booking_date}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Scheduled Time</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.formatted_time || selectedAppt.booking_time}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Context */}
              <div className="worker-modal-section">
                <div className="worker-modal-sec-title">Billing &amp; Payment</div>
                <div className="worker-modal-info-grid">
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Total Amount</span>
                    <span className="worker-modal-info-val">
                      ₹{formatINR(selectedAppt.total_amount ?? selectedAppt.service_price)}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Payment Status</span>
                    <span className="worker-modal-info-val">
                      {selectedAppt.payment_status || "Pending"}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Advance Paid</span>
                    <span className="worker-modal-info-val">
                      ₹{formatINR(selectedAppt.advance_amount)}
                    </span>
                  </div>
                  <div className="worker-modal-info-item">
                    <span className="worker-modal-info-label">Remaining Due</span>
                    <span className="worker-modal-info-val">
                      ₹{formatINR(selectedAppt.remaining_amount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedAppt.notes && (
                <div className="worker-modal-section">
                  <div className="worker-modal-sec-title">Booking Notes</div>
                  <div
                    style={{
                      background: "#f8fafc",
                      padding: "12px",
                      borderRadius: "10px",
                      fontSize: "0.88rem",
                      color: "#334155",
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    {selectedAppt.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="worker-modal-footer">
              <button
                type="button"
                className="btn-worker-action view"
                onClick={() => setSelectedAppt(null)}
              >
                Close
              </button>

              {selectedAppt.status === "CONFIRMED" && (
                <button
                  type="button"
                  className="btn-worker-action start"
                  disabled={actionLoadingId === selectedAppt.id}
                  onClick={() => handleUpdateStatus(selectedAppt.id, "IN_PROGRESS")}
                >
                  <span>▶</span> Start Service
                </button>
              )}

              {selectedAppt.status === "IN_PROGRESS" && (
                <button
                  type="button"
                  className="btn-worker-action complete"
                  disabled={actionLoadingId === selectedAppt.id}
                  onClick={() => handleUpdateStatus(selectedAppt.id, "COMPLETED")}
                >
                  <span>✓</span> Complete Service
                </button>
              )}

              {selectedAppt.status === "COMPLETED" && (selectedAppt.is_revenue_synced === false || selectedAppt.available_actions?.includes("reconcile")) && (
                <button
                  type="button"
                  className="btn-worker-action"
                  style={{
                    background: "#d97706",
                    borderColor: "#b45309",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                  disabled={actionLoadingId === selectedAppt.id}
                  onClick={() => handleReconcile(selectedAppt.id)}
                >
                  <span>🔄</span> {actionLoadingId === selectedAppt.id ? "Syncing..." : "Sync Revenue Now"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. Toast Notification                                              */}
      {/* ------------------------------------------------------------------ */}
      {toastMessage && (
        <div className="worker-toast">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/workerLeave.css";
import "../../styles/workerDashboard.css";

const LEAVE_TYPES = [
  { value: "WEEK_OFF", label: "Week Off", isPlanned: true },
  { value: "MONTH_OFF", label: "Month Off", isPlanned: true },
  { value: "PERSONAL", label: "Personal Leave", isPlanned: true },
  { value: "SICK", label: "Sick Leave", isPlanned: false },
  { value: "EMERGENCY", label: "Emergency Leave", isPlanned: false },
];

export default function WorkerLeave() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'pending' | 'approved' | 'history'
  const [toastMessage, setToastMessage] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState("WEEK_OFF");
  const [leaveDate, setLeaveDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Helper date limits
  const { todayStr, minDate7Str, minDate7Formatted } = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const tStr = `${yyyy}-${mm}-${dd}`;

    const d7 = new Date(now);
    d7.setDate(d7.getDate() + 7);
    const y7 = d7.getFullYear();
    const m7 = String(d7.getMonth() + 1).padStart(2, "0");
    const day7 = String(d7.getDate()).padStart(2, "0");
    const d7Str = `${y7}-${m7}-${day7}`;

    const formatted = d7.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return { todayStr: tStr, minDate7Str: d7Str, minDate7Formatted: formatted };
  }, []);

  const selectedTypeInfo = useMemo(() => {
    return LEAVE_TYPES.find((t) => t.value === leaveType) || LEAVE_TYPES[0];
  }, [leaveType]);

  // Fetch leaves
  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/salons/worker/leaves/");
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load worker leaves:", err);
      showToast("Unable to load leaves list.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Handle open modal
  const handleOpenModal = () => {
    setLeaveType("WEEK_OFF");
    setLeaveDate(minDate7Str);
    setLeaveReason("");
    setFormError("");
    setIsModalOpen(true);
  };

  // Switch leave type and adjust minimum date
  const handleTypeChange = (newType) => {
    setLeaveType(newType);
    const target = LEAVE_TYPES.find((t) => t.value === newType);
    if (target?.isPlanned) {
      setLeaveDate(minDate7Str);
    } else {
      setLeaveDate(todayStr);
    }
  };

  // Submit leave application
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!leaveDate) {
      setFormError("Please select a date.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await api.post("/salons/worker/leaves/", {
        date: leaveDate,
        leave_type: leaveType,
        reason: leaveReason.trim() || selectedTypeInfo.label,
      });

      showToast(
        selectedTypeInfo.isPlanned
          ? "Planned leave scheduled and approved!"
          : "Leave request submitted to salon owner for approval."
      );
      setIsModalOpen(false);
      fetchLeaves();
    } catch (err) {
      console.error("Failed to apply for leave:", err);
      const resData = err.response?.data;
      if (resData) {
        if (typeof resData === "string") {
          setFormError(resData);
        } else if (resData.date) {
          setFormError(Array.isArray(resData.date) ? resData.date[0] : resData.date);
        } else if (resData.detail) {
          setFormError(resData.detail);
        } else if (resData.error) {
          setFormError(resData.error);
        } else {
          setFormError("Failed to apply for leave. Please verify the dates.");
        }
      } else {
        setFormError("Server error. Please try again later.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Cancel leave request
  const handleCancelLeave = async (id) => {
    try {
      await api.post(`/salons/worker/leaves/${id}/cancel/`);
      showToast("Leave request cancelled.");
      setCancelConfirmId(null);
      fetchLeaves();
    } catch (err) {
      console.error("Failed to cancel leave:", err);
      showToast("Could not cancel leave. Please try again.");
    }
  };

  // Filter leaves based on active tab
  const filteredLeaves = useMemo(() => {
    if (activeTab === "pending") {
      return leaves.filter((l) => l.status === "PENDING");
    }
    if (activeTab === "approved") {
      return leaves.filter((l) => l.status === "APPROVED");
    }
    if (activeTab === "history") {
      return leaves.filter((l) => l.status === "REJECTED" || l.status === "CANCELLED");
    }
    return leaves;
  }, [leaves, activeTab]);

  // Counts
  const approvedCount = useMemo(() => leaves.filter((l) => l.status === "APPROVED").length, [leaves]);
  const pendingCount = useMemo(() => leaves.filter((l) => l.status === "PENDING").length, [leaves]);

  const formatDateParts = (dateString) => {
    try {
      const [year, month, day] = dateString.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return {
        month: d.toLocaleDateString("en-US", { month: "short" }),
        day: d.getDate(),
        full: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        weekday: d.toLocaleDateString("en-US", { weekday: "long" }),
      };
    } catch {
      return { month: "", day: "", full: dateString, weekday: "" };
    }
  };

  const getLeaveTypeClass = (type) => {
    switch (type) {
      case "WEEK_OFF":
        return "week_off";
      case "MONTH_OFF":
        return "month_off";
      case "PERSONAL":
        return "personal";
      case "SICK":
        return "sick";
      case "EMERGENCY":
        return "emergency";
      default:
        return "week_off";
    }
  };

  return (
    <div className="wl-page-wrapper">
      {/* Top Navigation */}
      <header className="wd-navbar">
        <div className="wd-navbar-inner">
          <div className="wd-navbar-left">
            <Link to="/worker/dashboard" className="wd-brand">
              <span className="wd-brand-logo-icon">🌿</span>
              <div className="wd-brand-text">
                <span className="wd-brand-name">BookMySalon</span>
                <span className="wd-brand-suite">Specialist Suite</span>
              </div>
            </Link>

            <nav className="wd-nav-links">
              <button
                type="button"
                className="wd-nav-tab"
                onClick={() => navigate("/worker/dashboard")}
              >
                Appointments
              </button>
              <button
                type="button"
                className="wd-nav-tab"
                onClick={() => navigate("/worker/calendar")}
              >
                Calendar
              </button>
              <button
                type="button"
                className="wd-nav-tab active"
                onClick={() => navigate("/worker/leave")}
              >
                My Leaves
              </button>
            </nav>
          </div>

          <div className="wd-navbar-right">
            <button
              type="button"
              className="btn-wl-apply"
              onClick={handleOpenModal}
            >
              <span>+ Apply for Leave</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="wl-main-content">
        {/* Breadcrumb */}
        <div className="wl-breadcrumb">
          <Link to="/worker/dashboard" className="wl-breadcrumb-link">
            Specialist Dashboard
          </Link>
          <span>/</span>
          <span className="wl-breadcrumb-current">My Leaves</span>
        </div>

        {/* Header Row */}
        <div className="wl-header-row">
          <div>
            <h1 className="wl-header-title">My Leaves &amp; Schedule</h1>
            <p className="wl-header-subtitle">
              Plan and view your week-offs, monthly leaves, or submit sick and emergency leave requests.
            </p>
          </div>

          <button
            type="button"
            className="btn-wl-apply"
            onClick={handleOpenModal}
          >
            <span>+ Apply for Leave</span>
          </button>
        </div>

        {/* KPI Summary Cards */}
        <div className="wl-kpi-grid">
          <div className="wl-kpi-card">
            <div>
              <div className="wl-kpi-label">Approved Leaves</div>
              <div className="wl-kpi-value">{approvedCount}</div>
            </div>
            <div className="wl-kpi-icon approved">✓</div>
          </div>

          <div className="wl-kpi-card">
            <div>
              <div className="wl-kpi-label">Pending Approval</div>
              <div className="wl-kpi-value">{pendingCount}</div>
            </div>
            <div className="wl-kpi-icon pending">⏳</div>
          </div>

          <div className="wl-kpi-card">
            <div>
              <div className="wl-kpi-label">Total Requests</div>
              <div className="wl-kpi-value">{leaves.length}</div>
            </div>
            <div className="wl-kpi-icon planned">📋</div>
          </div>
        </div>

        {/* Tabs Bar */}
        <div className="wl-tabs-bar">
          <button
            type="button"
            className={`wl-tab-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            All Requests <span className="wl-tab-count">{leaves.length}</span>
          </button>
          <button
            type="button"
            className={`wl-tab-btn ${activeTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            Approved <span className="wl-tab-count">{approvedCount}</span>
          </button>
          <button
            type="button"
            className={`wl-tab-btn ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            Pending <span className="wl-tab-count">{pendingCount}</span>
          </button>
          <button
            type="button"
            className={`wl-tab-btn ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History / Cancelled
          </button>
        </div>

        {/* Leaves Table */}
        <div className="wl-card">
          <div className="wl-table-wrapper">
            {loading ? (
              <div className="wl-empty-state">
                <span className="wl-empty-icon">⏳</span>
                <p className="wl-empty-title">Loading leave requests...</p>
              </div>
            ) : filteredLeaves.length === 0 ? (
              <div className="wl-empty-state">
                <span className="wl-empty-icon">🏖️</span>
                <h3 className="wl-empty-title">No leaves found</h3>
                <p className="wl-empty-desc">
                  You do not have any scheduled leaves or pending requests under this category.
                </p>
                <button
                  type="button"
                  className="btn-wl-apply"
                  onClick={handleOpenModal}
                >
                  <span>+ Apply for Leave</span>
                </button>
              </div>
            ) : (
              <table className="wl-table">
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Date</th>
                    <th style={{ width: "22%" }}>Leave Type</th>
                    <th style={{ width: "25%" }}>Reason / Notes</th>
                    <th style={{ width: "13%" }}>Status</th>
                    <th style={{ width: "10%", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaves.map((l) => {
                    const parts = formatDateParts(l.date);
                    const canCancel =
                      l.status === "PENDING" || (l.status === "APPROVED" && l.date >= todayStr);

                    return (
                      <tr key={l.id}>
                        <td>
                          <div className="wl-date-block">
                            <div className="wl-date-badge">
                              <span className="wl-date-badge-month">{parts.month}</span>
                              <span className="wl-date-badge-day">{parts.day}</span>
                            </div>
                            <div>
                              <div className="wl-date-primary">{parts.full}</div>
                              <div className="wl-date-sub">{parts.weekday}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`wl-type-tag ${getLeaveTypeClass(l.leave_type)}`}>
                            {l.leave_type_display || l.leave_type}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "#334155" }}>
                            {l.reason || "Scheduled day off"}
                          </span>
                        </td>
                        <td>
                          <span className={`wl-status-badge ${l.status.toLowerCase()}`}>
                            {l.status === "APPROVED" && "✓ "}
                            {l.status === "PENDING" && "⏳ "}
                            {l.status === "REJECTED" && "✕ "}
                            {l.status_display || l.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {canCancel && (
                            cancelConfirmId === l.id ? (
                              <div style={{ display: "inline-flex", gap: "6px" }}>
                                <button
                                  type="button"
                                  className="btn-wl-cancel-leave"
                                  style={{ background: "#dc2626", color: "#fff", borderColor: "#dc2626" }}
                                  onClick={() => handleCancelLeave(l.id)}
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  className="btn-wl-cancel-btn"
                                  style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                                  onClick={() => setCancelConfirmId(null)}
                                >
                                  Back
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="btn-wl-cancel-leave"
                                onClick={() => setCancelConfirmId(l.id)}
                              >
                                Cancel
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* Apply Leave Modal */}
      {isModalOpen && (
        <div
          className="wl-modal-backdrop"
          onClick={() => !submitting && setIsModalOpen(false)}
        >
          <div
            className="wl-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wl-modal-header">
              <h3 className="wl-modal-title">Apply for Leave</h3>
              <button
                type="button"
                className="wl-modal-close"
                onClick={() => !submitting && setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="wl-modal-body">
                {formError && (
                  <div className="wl-error-box">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="wl-field-group">
                  <label htmlFor="leave-type-select" className="wl-field-label">
                    Leave Type *
                  </label>
                  <select
                    id="leave-type-select"
                    className="wl-field-select"
                    value={leaveType}
                    onChange={(e) => handleTypeChange(e.target.value)}
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label} {t.isPlanned ? "(7+ days advance)" : "(Immediate / Approval required)"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Policy Notice */}
                {selectedTypeInfo.isPlanned ? (
                  <div className="wl-rule-banner planned">
                    <strong>✓ 7-Day Advance Notice:</strong> Planned leaves (Week Off, Month Off, Personal)
                    must be booked at least 7 days in advance and are automatically approved.
                  </div>
                ) : (
                  <div className="wl-rule-banner emergency">
                    <strong>⚡ Urgent Leave Request:</strong> Sick and Emergency leaves can be requested immediately
                    starting today. Your salon owner will review and confirm approval.
                  </div>
                )}

                <div className="wl-field-group">
                  <label htmlFor="leave-date-input" className="wl-field-label">
                    Date *
                  </label>
                  <input
                    id="leave-date-input"
                    type="date"
                    className="wl-field-input"
                    min={selectedTypeInfo.isPlanned ? minDate7Str : todayStr}
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    required
                  />
                  {selectedTypeInfo.isPlanned && (
                    <small style={{ color: "#64748b", marginTop: "4px", display: "block" }}>
                      Earliest schedulable date is <strong>{minDate7Formatted}</strong>.
                    </small>
                  )}
                </div>

                <div className="wl-field-group">
                  <label htmlFor="leave-reason-input" className="wl-field-label">
                    Reason / Note
                  </label>
                  <textarea
                    id="leave-reason-input"
                    className="wl-field-textarea"
                    placeholder="e.g. Doctor appointment, Family function, Weekly day off"
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <div className="wl-modal-footer">
                <button
                  type="button"
                  className="btn-wl-cancel-btn"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-wl-submit-btn"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Apply Leave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="wl-toast-msg">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerWorkerLeaves.css";

const LEAVE_TYPES = [
  { value: "WEEK_OFF", label: "Week Off", isPlanned: true },
  { value: "MONTH_OFF", label: "Monthly Off", isPlanned: true },
  { value: "PERSONAL", label: "Personal", isPlanned: true },
  { value: "SICK", label: "Sick Leave", isPlanned: false },
  { value: "EMERGENCY", label: "Emergency", isPlanned: false },
];

export default function OwnerWorkerLeaves() {
  const [leaves, setLeaves] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Filters
  const [selectedWorkerId, setSelectedWorkerId] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("all");

  // Approve Inspection Modal State
  const [approveModalLeave, setApproveModalLeave] = useState(null);
  const [approving, setApproving] = useState(false);

  // Reject Modal State
  const [rejectModalLeave, setRejectModalLeave] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState("");

  // Add Leave Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addWorkerId, setAddWorkerId] = useState("");
  const [addLeaveType, setAddLeaveType] = useState("WEEK_OFF");
  const [addDate, setAddDate] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addingSubmitting, setAddingSubmitting] = useState(false);
  const [addFormError, setAddFormError] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Earliest date limits (today & today + 7 days)
  const { todayStr, minDate7Str, minDate7Formatted, thisMonthStr, nextMonthStr } = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const tStr = `${yyyy}-${mm}-${dd}`;
    const tmStr = `${yyyy}-${mm}`;

    const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nmStr = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, "0")}`;

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

    return {
      todayStr: tStr,
      minDate7Str: d7Str,
      minDate7Formatted: formatted,
      thisMonthStr: tmStr,
      nextMonthStr: nmStr,
    };
  }, []);

  // Fetch Workers for dropdowns
  const fetchWorkers = useCallback(async () => {
    try {
      const res = await api.get("/salons/owner/workers/");
      const list = res.data?.workers || (Array.isArray(res.data) ? res.data : []);
      setWorkers(list);
      if (list.length > 0 && !addWorkerId) {
        setAddWorkerId(list[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch workers:", err);
    }
  }, [addWorkerId]);

  // Fetch Leaves
  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedWorkerId !== "all") params.worker_id = selectedWorkerId;
      if (selectedMonth !== "all") params.month = selectedMonth;

      const res = await api.get("/salons/owner/leaves/", { params });
      setLeaves(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load worker leaves:", err);
      showToast("Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkerId, selectedMonth]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // Filter into Pending and Upcoming/History
  const pendingLeaves = useMemo(() => {
    return leaves.filter((l) => l.status === "PENDING");
  }, [leaves]);

  const upcomingLeaves = useMemo(() => {
    return leaves.filter((l) => l.status !== "PENDING");
  }, [leaves]);

  // Open Add Leave Modal
  const handleOpenAddModal = () => {
    if (workers.length > 0) {
      setAddWorkerId(workers[0].id);
    }
    setAddLeaveType("WEEK_OFF");
    setAddDate(minDate7Str);
    setAddReason("Weekly day off");
    setAddFormError("");
    setIsAddModalOpen(true);
  };

  // Change leave type in Add modal
  const handleAddTypeChange = (type) => {
    setAddLeaveType(type);
    const target = LEAVE_TYPES.find((t) => t.value === type);
    if (target?.isPlanned) {
      setAddDate(minDate7Str);
      setAddReason(type === "WEEK_OFF" ? "Weekly day off" : "Scheduled monthly leave");
    } else {
      setAddDate(todayStr);
      setAddReason(type === "SICK" ? "Medical rest" : "Urgent personal matter");
    }
  };

  // Submit Add Leave by Owner
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!addWorkerId) {
      setAddFormError("Please select a worker.");
      return;
    }
    if (!addDate) {
      setAddFormError("Please select a date.");
      return;
    }

    setAddingSubmitting(true);
    setAddFormError("");

    try {
      await api.post("/salons/owner/leaves/", {
        worker: addWorkerId,
        date: addDate,
        leave_type: addLeaveType,
        reason: addReason.trim() || "Owner scheduled leave",
      });

      showToast("Worker leave scheduled successfully.");
      setIsAddModalOpen(false);
      fetchLeaves();
    } catch (err) {
      console.error("Failed to add leave:", err);
      const resData = err.response?.data;
      if (resData) {
        if (typeof resData === "string") {
          setAddFormError(resData);
        } else if (resData.date) {
          setAddFormError(Array.isArray(resData.date) ? resData.date[0] : resData.date);
        } else if (resData.worker) {
          setAddFormError(Array.isArray(resData.worker) ? resData.worker[0] : resData.worker);
        } else if (resData.detail) {
          setAddFormError(resData.detail);
        } else {
          setAddFormError("Failed to add leave. Please check the values.");
        }
      } else {
        setAddFormError("Server error. Please try again.");
      }
    } finally {
      setAddingSubmitting(false);
    }
  };

  // Open Approve Inspection Modal
  const handleOpenApproveModal = (leave) => {
    setApproveModalLeave(leave);
  };

  // Confirm Approval (called from modal)
  const handleConfirmApprove = async () => {
    if (!approveModalLeave) return;
    setApproving(true);
    try {
      await api.post(`/salons/owner/leaves/${approveModalLeave.id}/approve/`);
      showToast(`Leave approved for ${approveModalLeave.worker_name}.`);
      setApproveModalLeave(null);
      fetchLeaves();
    } catch (err) {
      console.error("Failed to approve leave:", err);
      showToast("Could not approve leave request. Please try again.");
    } finally {
      setApproving(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (leave) => {
    setRejectModalLeave(leave);
    setRejectReason("");
    setRejectError("");
  };

  // Confirm Reject Leave with reason
  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectModalLeave) return;
    if (!rejectReason.trim()) {
      setRejectError("Please enter a reason for rejecting this leave.");
      return;
    }

    setRejecting(true);
    setRejectError("");
    try {
      await api.post(`/salons/owner/leaves/${rejectModalLeave.id}/reject/`, {
        rejection_reason: rejectReason.trim(),
      });
      showToast(`Leave request rejected.`);
      setRejectModalLeave(null);
      setRejectReason("");
      fetchLeaves();
    } catch (err) {
      console.error("Failed to reject leave:", err);
      showToast("Could not reject leave request.");
    } finally {
      setRejecting(false);
    }
  };

  // Delete / Remove Leave
  const handleDeleteLeave = async (id) => {
    try {
      await api.delete(`/salons/owner/leaves/${id}/`);
      showToast("Leave record removed.");
      fetchLeaves();
    } catch (err) {
      console.error("Failed to delete leave:", err);
      showToast("Could not delete leave.");
    }
  };

  const formatDateLabel = (dateString) => {
    try {
      const [year, month, day] = dateString.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="owl-page-wrapper">
      <OwnerNavbarHeader
        onNotificationsClick={() => showToast("All system alerts up to date.")}
      />
      <OwnerNavbar activeTab="Worker Leaves" />

      <main className="owl-main-container">
        
        <div className="owl-breadcrumb">
          <Link to="/owner/dashboard" className="owl-breadcrumb-link">
            Owner Dashboard
          </Link>
          <span>/</span>
          <span className="owl-breadcrumb-active">Worker Schedule &amp; Leave</span>
        </div>

        {/* Header Row */}
        <div className="owl-header-row">
          <div>
            <h1 className="owl-header-title">Worker Schedule &amp; Leave</h1>
            <p className="owl-header-subtitle">
              Manage worker availability, week-offs and leave requests.
            </p>
          </div>

          <div className="owl-toolbar">
            {/* Workers Filter */}
            <select
              className="owl-filter-select"
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
            >
              <option value="all">All Workers ▼</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name || w.email}
                </option>
              ))}
            </select>

            {/* Month Filter */}
            <select
              className="owl-filter-select"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            >
              <option value="all">All Months ▼</option>
              <option value={thisMonthStr}>This Month ▼</option>
              <option value={nextMonthStr}>Next Month ▼</option>
            </select>

            {/* Add Leave Button */}
            <button
              type="button"
              className="btn-owl-add-leave"
              onClick={handleOpenAddModal}
            >
              <span>+ Add Leave</span>
            </button>
          </div>
        </div>

        {/* SECTION 1: PENDING LEAVE REQUESTS */}
        <section className="owl-section">
          <div className="owl-section-header">
            <h2 className="owl-section-title">
              PENDING LEAVE REQUESTS
              <span className="owl-pending-badge">
                {pendingLeaves.length} {pendingLeaves.length === 1 ? "Request" : "Requests"}
              </span>
            </h2>
          </div>

          {loading ? (
            <p style={{ color: "#53665a", fontStyle: "italic" }}>Loading leave requests...</p>
          ) : pendingLeaves.length === 0 ? (
            <div style={{
              background: "#ffffff",
              border: "1px dashed #d0e0d6",
              borderRadius: "12px",
              padding: "28px",
              textAlign: "center",
              color: "#53665a",
            }}>
              ✓ No pending leave requests. All worker shifts and leaves are reviewed!
            </div>
          ) : (
            <div className="owl-pending-grid">
              {pendingLeaves.map((leave) => {
                const affectedCount = leave.affected_bookings_count || 0;
                return (
                  <div key={leave.id} className="owl-pending-card">
                    <div>
                      <div className="owl-card-top">
                        <div className="owl-worker-info">
                          {leave.worker_photo ? (
                            <img
                              src={leave.worker_photo}
                              alt={leave.worker_name}
                              className="owl-worker-avatar"
                            />
                          ) : (
                            <div className="owl-worker-avatar-placeholder">
                              👤
                            </div>
                          )}
                          <div>
                            <h3 className="owl-worker-name">{leave.worker_name}</h3>
                            <div className="owl-worker-role">
                              {leave.worker_specialization || "Specialist"}
                            </div>
                          </div>
                        </div>

                        <span className={`owl-type-badge ${leave.leave_type.toLowerCase()}`}>
                          {leave.leave_type_display || leave.leave_type}
                        </span>
                      </div>

                      <div className="owl-card-body">
                        <div className="owl-date-row">
                          <span>📅 {formatDateLabel(leave.date)}</span>
                        </div>

                        {leave.reason && (
                          <div className="owl-reason-quote">
                            &quot;{leave.reason}&quot;
                          </div>
                        )}

                        {affectedCount > 0 ? (
                          <div className="owl-affected-banner warning">
                            <span>⚠️ {affectedCount} {affectedCount === 1 ? "booking affected" : "bookings affected"}</span>
                          </div>
                        ) : (
                          <div className="owl-affected-banner safe">
                            <span>✓ No bookings affected</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="owl-card-actions">
                      <button
                        type="button"
                        className="btn-owl-reject"
                        onClick={() => handleOpenRejectModal(leave)}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn-owl-approve"
                        onClick={() => handleOpenApproveModal(leave)}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 2: UPCOMING WORKER LEAVE */}
        <section className="owl-section">
          <div className="owl-section-header">
            <h2 className="owl-section-title">UPCOMING WORKER LEAVE</h2>
          </div>

          <div className="owl-table-card">
            {upcomingLeaves.length === 0 ? (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "#53665a" }}>
                No scheduled worker leaves recorded for this period. Click <strong>+ Add Leave</strong> to schedule a week-off.
              </div>
            ) : (
              <div className="owl-table-wrapper">
                <table className="owl-table">
                <thead>
                  <tr>
                    <th style={{ width: "26%" }}>Worker</th>
                    <th style={{ width: "18%" }}>Date</th>
                    <th style={{ width: "18%" }}>Leave Type</th>
                    <th style={{ width: "14%" }}>Status</th>
                    <th style={{ width: "24%" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingLeaves.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="owl-worker-cell">
                          {item.worker_photo ? (
                            <img
                              src={item.worker_photo}
                              alt={item.worker_name}
                              className="owl-worker-thumb"
                            />
                          ) : (
                            <span style={{ fontSize: "1.1rem" }}>👤</span>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "#18281e" }}>
                              {item.worker_name}
                            </div>
                            <div style={{ fontSize: "0.76rem", color: "#64748b" }}>
                              {item.worker_specialization}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#18281e" }}>
                          {formatDateLabel(item.date)}
                        </div>
                      </td>
                      <td>
                        <span className={`owl-type-badge ${item.leave_type.toLowerCase()}`}>
                          {item.leave_type_display || item.leave_type}
                        </span>
                      </td>
                      <td>
                        <span className={`owl-status-pill ${item.status.toLowerCase()}`}>
                          {item.status === "APPROVED" && "✓ Approved"}
                          {item.status === "REJECTED" && "✕ Rejected"}
                          {item.status === "CANCELLED" && "— Cancelled"}
                        </span>
                      </td>
                      <td>
                        {item.status === "REJECTED" ? (
                          <div>
                            <span style={{ color: "#991b1b", fontSize: "0.84rem", fontWeight: 600 }}>
                              {item.rejection_reason || "Rejected by owner"}
                            </span>
                            {item.reason && item.rejection_reason && item.reason !== item.rejection_reason && (
                              <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "2px" }}>
                                Requested: {item.reason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#475569", fontSize: "0.84rem" }}>
                            {item.reason || "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* MODAL 1: APPROVE LEAVE CONFIRMATION (CHECK BOOKINGS) */}
      {approveModalLeave && (
        <div
          className="owl-modal-overlay"
          onClick={() => !approving && setApproveModalLeave(null)}
        >
          <div
            className="owl-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="owl-modal-header">
              <h3 className="owl-modal-title">
                Approve {approveModalLeave.leave_type_display || "Leave"}
              </h3>
              <button
                type="button"
                className="owl-modal-close"
                onClick={() => !approving && setApproveModalLeave(null)}
              >
                ✕
              </button>
            </div>

            <div className="owl-modal-body">
              <div className="owl-detail-meta">
                <div className="owl-detail-item">
                  <span className="owl-detail-label">Worker:</span>
                  <span className="owl-detail-val">{approveModalLeave.worker_name}</span>
                </div>
                <div className="owl-detail-item">
                  <span className="owl-detail-label">Date:</span>
                  <span className="owl-detail-val">{formatDateLabel(approveModalLeave.date)}</span>
                </div>
                <div className="owl-detail-item">
                  <span className="owl-detail-label">Reason:</span>
                  <span className="owl-detail-val">
                    {approveModalLeave.reason || "Not specified"}
                  </span>
                </div>
              </div>

              {/* Existing Bookings List */}
              <div className="owl-bookings-section">
                <div className="owl-bookings-title">
                  <span>Existing Bookings:</span>
                  <span style={{ color: "#1e392a" }}>
                    {approveModalLeave.affected_bookings_count || 0}
                  </span>
                </div>

                {approveModalLeave.affected_bookings && approveModalLeave.affected_bookings.length > 0 ? (
                  <div>
                    {approveModalLeave.affected_bookings.map((b) => (
                      <div key={b.id} className="owl-booking-item">
                        <span className="owl-booking-time">{b.booking_time}</span>
                        <span className="owl-booking-client">{b.client_name}</span>
                        <span className="owl-booking-service">{b.service_name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "#065f46", fontSize: "0.85rem", padding: "6px 0" }}>
                    ✓ No active appointments assigned on this date.
                  </div>
                )}
              </div>

              {approveModalLeave.affected_bookings_count > 0 && (
                <div className="owl-affect-warning-box">
                  <span>⚠️</span>
                  <div>
                    <strong>Approving this leave will affect these bookings.</strong>
                    <div style={{ fontSize: "0.78rem", marginTop: "2px" }}>
                      Please reassign these appointments or notify clients accordingly.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="owl-modal-footer">
              <button
                type="button"
                className="btn-owl-cancel-modal"
                onClick={() => setApproveModalLeave(null)}
                disabled={approving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-owl-continue-modal"
                onClick={handleConfirmApprove}
                disabled={approving}
              >
                {approving ? "Approving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: OWNER ADD WORKER LEAVE */}
      {isAddModalOpen && (
        <div
          className="owl-modal-overlay"
          onClick={() => !addingSubmitting && setIsAddModalOpen(false)}
        >
          <div
            className="owl-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="owl-modal-header">
              <h3 className="owl-modal-title">Add Worker Leave</h3>
              <button
                type="button"
                className="owl-modal-close"
                onClick={() => !addingSubmitting && setIsAddModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="owl-modal-body">
                {addFormError && (
                  <div style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    color: "#b91c1c",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    marginBottom: "16px",
                  }}>
                    ⚠️ {addFormError}
                  </div>
                )}

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Worker
                  </label>
                  <select
                    className="owl-filter-select"
                    style={{ width: "100%" }}
                    value={addWorkerId}
                    onChange={(e) => setAddWorkerId(e.target.value)}
                    required
                  >
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.full_name || w.email} ({w.specialization || "Specialist"})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Leave Type
                  </label>
                  <select
                    className="owl-filter-select"
                    style={{ width: "100%" }}
                    value={addLeaveType}
                    onChange={(e) => handleAddTypeChange(e.target.value)}
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Date
                  </label>
                  <input
                    type="date"
                    className="owl-filter-select"
                    style={{ width: "100%" }}
                    min={
                      LEAVE_TYPES.find((t) => t.value === addLeaveType)?.isPlanned
                        ? minDate7Str
                        : todayStr
                    }
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    required
                  />
                  {LEAVE_TYPES.find((t) => t.value === addLeaveType)?.isPlanned && (
                    <small style={{ color: "#065f46", display: "block", marginTop: "5px", fontWeight: 500 }}>
                      ✓ Can schedule 7+ days in advance (Earliest: {minDate7Formatted})
                    </small>
                  )}
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px" }}>
                    Reason
                  </label>
                  <input
                    type="text"
                    className="owl-filter-select"
                    style={{ width: "100%" }}
                    placeholder="e.g. Weekly day off, Annual leave"
                    value={addReason}
                    onChange={(e) => setAddReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="owl-modal-footer">
                <button
                  type="button"
                  className="btn-owl-cancel-modal"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={addingSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-owl-continue-modal"
                  disabled={addingSubmitting}
                >
                  {addingSubmitting ? "Adding..." : "Add Leave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECT LEAVE MODAL (REASON REQUIRED) */}
      {rejectModalLeave && (
        <div
          className="owl-modal-overlay"
          onClick={() => !rejecting && setRejectModalLeave(null)}
        >
          <div
            className="owl-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="owl-modal-header">
              <h3 className="owl-modal-title" style={{ color: "#991b1b" }}>
                Reject Leave Request
              </h3>
              <button
                type="button"
                className="owl-modal-close"
                onClick={() => !rejecting && setRejectModalLeave(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="owl-modal-body">
                {rejectError && (
                  <div
                    style={{
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      color: "#b91c1c",
                      padding: "10px 14px",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      marginBottom: "16px",
                    }}
                  >
                    ⚠️ {rejectError}
                  </div>
                )}

                <div className="owl-detail-meta" style={{ marginBottom: "16px" }}>
                  <div className="owl-detail-item">
                    <span className="owl-detail-label">Worker:</span>
                    <span className="owl-detail-val">{rejectModalLeave.worker_name}</span>
                  </div>
                  <div className="owl-detail-item">
                    <span className="owl-detail-label">Date:</span>
                    <span className="owl-detail-val">{formatDateLabel(rejectModalLeave.date)}</span>
                  </div>
                  <div className="owl-detail-item">
                    <span className="owl-detail-label">Leave Type:</span>
                    <span className="owl-detail-val">
                      {rejectModalLeave.leave_type_display || rejectModalLeave.leave_type}
                    </span>
                  </div>
                  {rejectModalLeave.reason && (
                    <div className="owl-detail-item">
                      <span className="owl-detail-label">Requested Reason:</span>
                      <span className="owl-detail-val">{rejectModalLeave.reason}</span>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "8px" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      marginBottom: "6px",
                      color: "#18281e",
                    }}
                  >
                    Reason for Rejection <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <textarea
                    className="owl-filter-select"
                    rows={3}
                    style={{
                      width: "100%",
                      resize: "vertical",
                      minHeight: "80px",
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                    placeholder="e.g. Salon is fully booked on this day, Staff shortage"
                    value={rejectReason}
                    onChange={(e) => {
                      setRejectReason(e.target.value);
                      if (rejectError) setRejectError("");
                    }}
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="owl-modal-footer">
                <button
                  type="button"
                  className="btn-owl-cancel-modal"
                  onClick={() => setRejectModalLeave(null)}
                  disabled={rejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-owl-continue-modal"
                  style={{ background: "#dc2626", borderColor: "#dc2626" }}
                  disabled={rejecting}
                >
                  {rejecting ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="owl-toast-msg">
          {toastMessage}
        </div>
      )}

      {/* Sticky Salon Details Footer Label */}
      <OwnerStickyFooter />
    </div>
  );
}

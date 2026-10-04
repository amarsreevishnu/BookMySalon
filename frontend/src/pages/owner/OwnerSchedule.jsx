import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import "../../styles/ownerSchedule.css";

export default function OwnerSchedule() {
  const [offDays, setOffDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  // Form state
  const [formDate, setFormDate] = useState("");
  const [formReason, setFormReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Compute earliest allowed date (today + 7 days)
  const { minDateStr, minDateFormatted } = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const str = `${yyyy}-${mm}-${dd}`;
    const formatted = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    return { minDateStr: str, minDateFormatted: formatted };
  }, []);

  // Fetch upcoming off-days
  const fetchOffDays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/salons/owner/off-days/");
      setOffDays(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load off-days:", err);
      showToast("Unable to load scheduled off-days.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOffDays();
  }, [fetchOffDays]);

  // Open modal with default date set to minDateStr
  const handleOpenModal = () => {
    setFormDate(minDateStr);
    setFormReason("");
    setFormError("");
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    if (!submitting) {
      setIsModalOpen(false);
      setFormError("");
    }
  };

  // Submit new off-day
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formDate) {
      setFormError("Please select a date.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await api.post("/salons/owner/off-days/", {
        date: formDate,
        reason: formReason.trim() || "Salon Closed",
      });

      showToast("Off-day scheduled successfully.");
      setIsModalOpen(false);
      fetchOffDays();
    } catch (err) {
      console.error("Failed to add off-day:", err);
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
          setFormError("Failed to save off-day. Please check the date.");
        }
      } else {
        setFormError("Server connection error. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete off-day
  const handleDeleteOffDay = async (id) => {
    try {
      await api.delete(`/salons/owner/off-days/${id}/`);
      showToast("Off-day removed successfully.");
      setDeleteConfirmId(null);
      fetchOffDays();
    } catch (err) {
      console.error("Failed to delete off-day:", err);
      showToast("Could not remove off-day. Please try again.");
    }
  };

  // Helper date formatter
  const formatDateParts = (dateString) => {
    try {
      // Split YYYY-MM-DD to avoid timezone shifting
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

  return (
    <div className="os-page-wrapper">
      {/* Reusable Header & Owner Navbar */}
      <OwnerNavbarHeader
        onNotificationsClick={() => showToast("All system alerts up to date.")}
      />
      <OwnerNavbar activeTab="Schedule" />

      {/* Main Container */}
      <main className="os-main-container">
        {/* Breadcrumb */}
        <div className="os-breadcrumb">
          <Link to="/owner/dashboard" className="os-breadcrumb-item">
            Owner Dashboard
          </Link>
          <span>/</span>
          <span className="os-breadcrumb-item active">Schedule</span>
        </div>

        {/* Header Row */}
        <div className="os-header-row">
          <div>
            <h1 className="os-header-title">Salon Schedule &amp; Off-Days</h1>
            <p className="os-header-subtitle">
              Plan and schedule salon closures in advance. Customers will see these dates as closed and cannot book appointments.
            </p>
          </div>

          <div className="os-header-actions">
            <button
              type="button"
              className="btn-os-add-offday"
              onClick={handleOpenModal}
            >
              <span>+ Add Off Day</span>
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="os-notice-banner">
          <span className="os-notice-icon">💡</span>
          <div>
            <strong>7-Day Advance Notice Policy:</strong> Off-days must be scheduled at least 7 days from today.
            This gives customers a predictable booking window and prevents sudden appointment cancellations.
          </div>
        </div>

        {/* Table Card */}
        <div className="os-card">
          <div className="os-card-header">
            <h2 className="os-card-title">
              Upcoming Off Days
              {offDays.length > 0 && (
                <span className="os-count-badge">{offDays.length}</span>
              )}
            </h2>
          </div>

          <div className="os-table-wrapper">
            {loading ? (
              <div className="os-empty-state">
                <span className="os-empty-icon">⏳</span>
                <p className="os-empty-title">Loading schedule...</p>
              </div>
            ) : offDays.length === 0 ? (
              <div className="os-empty-state">
                <span className="os-empty-icon">📅</span>
                <h3 className="os-empty-title">No upcoming off-days</h3>
                <p className="os-empty-desc">
                  Your salon is currently operating on its standard weekly opening hours.
                  Click below to schedule an upcoming holiday or closure.
                </p>
                <button
                  type="button"
                  className="btn-os-add-offday"
                  onClick={handleOpenModal}
                >
                  <span>+ Add Off Day</span>
                </button>
              </div>
            ) : (
              <table className="os-table">
                <thead>
                  <tr>
                    <th style={{ width: "35%" }}>Date</th>
                    <th style={{ width: "45%" }}>Reason</th>
                    <th style={{ width: "20%", textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {offDays.map((od) => {
                    const parts = formatDateParts(od.date);
                    return (
                      <tr key={od.id}>
                        <td>
                          <div className="os-date-cell">
                            <div className="os-date-box">
                              <span className="os-date-box-month">{parts.month}</span>
                              <span className="os-date-box-day">{parts.day}</span>
                            </div>
                            <div>
                              <div className="os-date-full">{parts.full}</div>
                              <div className="os-date-sub">{parts.weekday}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="os-reason-cell">
                            {od.reason ? (
                              <span className="os-reason-badge">{od.reason}</span>
                            ) : (
                              <span style={{ color: "#829489" }}>Salon Closed</span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {deleteConfirmId === od.id ? (
                            <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                              <button
                                type="button"
                                className="btn-os-delete"
                                style={{ background: "#c53030", color: "#fff", borderColor: "#c53030" }}
                                onClick={() => handleDeleteOffDay(od.id)}
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                className="btn-os-cancel"
                                style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                                onClick={() => setDeleteConfirmId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-os-delete"
                              onClick={() => setDeleteConfirmId(od.id)}
                            >
                              🗑️ Delete
                            </button>
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

      {/* Add Off Day Modal */}
      {isModalOpen && (
        <div className="os-modal-overlay" onClick={handleCloseModal}>
          <div
            className="os-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="os-modal-header">
              <h3 className="os-modal-title">Schedule Salon Off-Day</h3>
              <button
                type="button"
                className="os-modal-close"
                onClick={handleCloseModal}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="os-modal-body">
                {formError && (
                  <div className="os-error-banner">
                    ⚠️ {formError}
                  </div>
                )}

                <div className="os-form-group">
                  <label htmlFor="offday-date" className="os-label">
                    Off-Day Date *
                  </label>
                  <input
                    id="offday-date"
                    type="date"
                    className="os-input"
                    min={minDateStr}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                  />
                  <div className="os-field-note">
                    Earliest schedulable date is <strong>{minDateFormatted}</strong> (at least 7 days ahead).
                  </div>
                </div>

                <div className="os-form-group">
                  <label htmlFor="offday-reason" className="os-label">
                    Reason / Occasion
                  </label>
                  <input
                    id="offday-reason"
                    type="text"
                    className="os-input"
                    placeholder="e.g. Onam Holiday, Salon Maintenance, Renovation"
                    value={formReason}
                    maxLength={200}
                    onChange={(e) => setFormReason(e.target.value)}
                  />
                  <div className="os-field-note">
                    This note will be shown to customers when they view the booking calendar.
                  </div>
                </div>
              </div>

              <div className="os-modal-actions">
                <button
                  type="button"
                  className="btn-os-cancel"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-os-submit"
                  disabled={submitting}
                >
                  {submitting ? "Scheduling..." : "Add Off Day"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="os-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

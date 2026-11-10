import { useState, useMemo } from "react";
import api from "../../api/axios";

const formatLocalDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const normalizeStatus = (status, rawStatus) => {
  const s = String(rawStatus || status || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return s;
};

const getPaymentMethodDisplay = (method) => {
  const m = String(method || "").trim().toUpperCase();
  if (m === "WALLET") {
    return {
      label: "Wallet Payment",
      icon: "👛",
      color: "#4338ca",
      bg: "#eef2ff",
      border: "#c7d2fe",
      description: "Paid via Customer In-App Wallet",
    };
  }
  if (m === "ONLINE" || m === "RAZORPAY") {
    return {
      label: "Online Payment",
      icon: "💳",
      color: "#0369a1",
      bg: "#f0f9ff",
      border: "#bae6fd",
      description: "Prepaid Online (Razorpay)",
    };
  }
  return {
    label: "Pay at Salon",
    icon: "💵",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    description: "In-Salon Settlement (Cash / POS)",
  };
};

const getPageNumbers = (current, total) => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages = [];
  pages.push(1);
  if (current > 3) {
    pages.push("...");
  }
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    if (!pages.includes(i)) pages.push(i);
  }
  if (current < total - 2) {
    pages.push("...");
  }
  if (!pages.includes(total)) {
    pages.push(total);
  }
  return pages;
};

export default function OwnerBookingsTab({
  bookings = [],
  workers = [],
  onUpdateStatus,
  onRefresh,
  isLoading = false,
  pagination = null,
  backendFilters = null,
  backendStats = null,
}) {
  const isBackend = Boolean(pagination && backendFilters);

  // Filters (use backend controlled props if provided, otherwise internal state)
  const [localWorkerFilter, setLocalWorkerFilter] = useState("all");
  const [localStatusFilter, setLocalStatusFilter] = useState("all");
  const [localPaymentMethodFilter, setLocalPaymentMethodFilter] = useState("all");
  const [localDateFilter, setLocalDateFilter] = useState("all");
  const [localSearchQuery, setLocalSearchQuery] = useState("");

  const workerFilter = isBackend ? backendFilters.workerFilter : localWorkerFilter;
  const setWorkerFilter = isBackend ? backendFilters.setWorkerFilter : setLocalWorkerFilter;

  const statusFilter = isBackend ? backendFilters.statusFilter : localStatusFilter;
  const setStatusFilter = isBackend ? backendFilters.setStatusFilter : setLocalStatusFilter;

  const paymentMethodFilter = isBackend ? backendFilters.paymentMethodFilter : localPaymentMethodFilter;
  const setPaymentMethodFilter = isBackend ? backendFilters.setPaymentMethodFilter : setLocalPaymentMethodFilter;

  const dateFilter = isBackend ? backendFilters.dateFilter : localDateFilter;
  const setDateFilter = isBackend ? backendFilters.setDateFilter : setLocalDateFilter;

  const searchQuery = isBackend ? backendFilters.searchQuery : localSearchQuery;
  const setSearchQuery = isBackend ? backendFilters.setSearchQuery : setLocalSearchQuery;

  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Modals state
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancellationReason, setCancellationReason] = useState("");

  // Worker Reassignment Modal State
  const [reassigningBooking, setReassigningBooking] = useState(null);
  const [eligibleWorkers, setEligibleWorkers] = useState([]);
  const [loadingEligibleWorkers, setLoadingEligibleWorkers] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [reassignReason, setReassignReason] = useState("");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [reassignError, setReassignError] = useState("");

  // Dates calculation for filters
  const { todayStr, tomorrowStr, weekEndStr } = useMemo(() => {
    const today = new Date();
    const todayStr = formatLocalDate(today);

    const tom = new Date(today);
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = formatLocalDate(tom);

    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = formatLocalDate(weekEnd);

    return { todayStr, tomorrowStr, weekEndStr };
  }, []);

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Worker filter
      if (workerFilter !== "all") {
        const bWorkerId =
          b.worker_id !== undefined
            ? b.worker_id
            : b.worker && typeof b.worker === "object"
            ? b.worker.id
            : b.worker;
        if (String(bWorkerId) !== String(workerFilter)) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        const norm = normalizeStatus(b.status, b.raw_status);
        if (norm !== statusFilter.toUpperCase()) return false;
      }

      // Payment Method filter
      if (paymentMethodFilter !== "all") {
        const m = String(b.payment_method || "").toUpperCase();
        if (paymentMethodFilter === "ONLINE" && m !== "ONLINE" && m !== "RAZORPAY") return false;
        if (paymentMethodFilter === "WALLET" && m !== "WALLET") return false;
        if (paymentMethodFilter === "PAY_AT_SALON" && m !== "PAY_AT_SALON" && m !== "CASH") return false;
      }

      // Date filter
      if (dateFilter === "today") {
        if (b.booking_date !== todayStr) return false;
      } else if (dateFilter === "tomorrow") {
        if (b.booking_date !== tomorrowStr) return false;
      } else if (dateFilter === "week") {
        if (!b.booking_date || b.booking_date < todayStr || b.booking_date > weekEndStr) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = (b.client_name || "").toLowerCase();
        const clientPhone = (b.client_phone || "").toLowerCase();
        const clientEmail = (b.client_email || "").toLowerCase();
        const service = (b.service || b.service_name || "").toLowerCase();
        const stylist = (b.stylist || b.worker_name || "").toLowerCase();
        const station = (b.station || "").toLowerCase();
        const idMatch = String(b.id || "").includes(q);

        if (
          !clientName.includes(q) &&
          !clientPhone.includes(q) &&
          !clientEmail.includes(q) &&
          !service.includes(q) &&
          !stylist.includes(q) &&
          !station.includes(q) &&
          !idMatch
        ) {
          return false;
        }
      }

      return true;
    });
  }, [
    bookings,
    workerFilter,
    statusFilter,
    paymentMethodFilter,
    dateFilter,
    searchQuery,
    todayStr,
    tomorrowStr,
    weekEndStr,
  ]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = bookings.length;
    let confirmed = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let pending = 0;

    bookings.forEach((b) => {
      const s = normalizeStatus(b.status, b.raw_status);
      if (s === "IN_PROGRESS") inProgress++;
      else if (s === "COMPLETED") completed++;
      else if (s === "CANCELLED") cancelled++;
      else if (s === "PENDING") pending++;
      else confirmed++;
    });

    return { total, confirmed, inProgress, completed, cancelled, pending };
  }, [bookings]);

  const displayedBookings = isBackend ? bookings : filteredBookings;
  const activeStats = isBackend && backendStats ? backendStats : stats;

  const handleActionClick = async (bookingId, newStatus, extraData = {}) => {
    try {
      setActionLoadingId(bookingId);
      if (onUpdateStatus) {
        await onUpdateStatus(bookingId, newStatus, extraData);
      }
      if (selectedBooking && selectedBooking.id === bookingId) {
        setSelectedBooking((prev) =>
          prev ? { ...prev, status: newStatus, raw_status: newStatus } : null
        );
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const confirmCancelAction = async () => {
    if (!cancellingBooking) return;
    try {
      setActionLoadingId(cancellingBooking.id);
      await handleActionClick(cancellingBooking.id, "CANCELLED", {
        reason: cancellationReason.trim() || "Cancelled by Salon Owner",
      });
      setCancellingBooking(null);
      setCancellationReason("");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenReassignModal = async (booking) => {
    if (!booking) return;
    setReassigningBooking(booking);
    setSelectedWorkerId(null);
    setReassignReason("");
    setReassignError("");
    setLoadingEligibleWorkers(true);

    try {
      const res = await api.get(`/salons/owner/bookings/${booking.id}/eligible-workers/`);
      const wList = res.data?.workers || [];
      setEligibleWorkers(wList);
    } catch (err) {
      console.error("Failed to load eligible workers:", err);
      // Fallback to active workers passed via props
      const fallback = (workers || []).map((w) => {
        const wId = w.id !== undefined ? w.id : w.worker_id;
        const isCurr = String(wId) === String(booking.worker_id);
        return {
          id: wId,
          worker_id: wId,
          name: w.name || (w.user ? `${w.user.first_name} ${w.user.last_name}` : "Specialist"),
          specialization: w.specialization || w.role || "Specialist",
          station: w.station || "Station 01",
          avatar: w.avatar || w.profile_photo || "",
          rating: w.rating || 5.0,
          is_current: isCurr,
          is_available: true,
          availability_status: isCurr ? "CURRENT" : "AVAILABLE",
          conflict_reason: isCurr ? "Currently assigned specialist" : "",
          can_assign: !isCurr,
        };
      });
      setEligibleWorkers(fallback);
    } finally {
      setLoadingEligibleWorkers(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassigningBooking || !selectedWorkerId) return;
    setIsSubmittingReassign(true);
    setReassignError("");

    try {
      const res = await api.post(`/salons/owner/bookings/${reassigningBooking.id}/reassign-worker/`, {
        worker_id: selectedWorkerId,
        reason: reassignReason.trim() || "Owner reassignment",
      });

      const updated = res.data?.booking;
      const historyEntry = res.data?.history;
      const chosenWorker = eligibleWorkers.find((w) => w.id === selectedWorkerId);

      // Update selectedBooking in-place if open
      if (selectedBooking && selectedBooking.id === reassigningBooking.id) {
        setSelectedBooking((prev) => ({
          ...prev,
          worker_id: selectedWorkerId,
          stylist: chosenWorker?.name || updated?.worker_name || prev.stylist,
          worker_name: chosenWorker?.name || updated?.worker_name || prev.worker_name,
          worker_photo: chosenWorker?.avatar || chosenWorker?.profile_photo || updated?.worker_photo || prev.worker_photo,
          station: chosenWorker?.station || updated?.station || prev.station,
          history: historyEntry ? [historyEntry, ...(prev.history || [])] : prev.history,
        }));
      }

      setReassigningBooking(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to reassign worker:", err);
      const errMsg = err.response?.data?.error || "Failed to switch assigned worker. Please verify conflicts.";
      setReassignError(errMsg);
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const getStatusBadge = (status, rawStatus) => {
    const s = normalizeStatus(status, rawStatus);
    if (s === "IN_PROGRESS") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#eff6ff",
            color: "#1d4ed8",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: "999px",
            border: "1px solid #bfdbfe",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#2563eb",
              display: "inline-block",
            }}
          />
          ⚡ IN PROGRESS
        </span>
      );
    }
    if (s === "COMPLETED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#eaf7ef",
            color: "#1e824c",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: "999px",
            border: "1px solid #bbf7d0",
          }}
        >
          ✓ COMPLETED
        </span>
      );
    }
    if (s === "CANCELLED") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#fef2f2",
            color: "#dc2626",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: "999px",
            border: "1px solid #fecaca",
          }}
        >
          ✕ CANCELLED
        </span>
      );
    }
    if (s === "PENDING") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#fffbeb",
            color: "#b45309",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: "999px",
            border: "1px solid #fde68a",
          }}
        >
          ⏳ PENDING
        </span>
      );
    }
    if (s === "NO_SHOW") {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            background: "#f3f4f6",
            color: "#4b5563",
            fontSize: "11px",
            fontWeight: 700,
            padding: "4px 9px",
            borderRadius: "999px",
            border: "1px solid #e5e7eb",
          }}
        >
          🚫 NO SHOW
        </span>
      );
    }
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "5px",
          background: "#f0fdf4",
          color: "#166534",
          fontSize: "11px",
          fontWeight: 700,
          padding: "4px 9px",
          borderRadius: "999px",
          border: "1px solid #bbf7d0",
        }}
      >
        ✓ CONFIRMED
      </span>
    );
  };

  const getPaymentStatusBadge = (booking) => {
    const pStatus = String(booking.payment_status || "").trim().toUpperCase();
    const isPaid = pStatus === "PAID" || booking.is_fully_paid;
    const isAdvance = booking.is_advance_paid || pStatus === "PARTIALLY_PAID";
    const isRefunded = pStatus === "REFUNDED";
    const isFailed = pStatus === "FAILED";

    if (isPaid) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#eaf7ef",
            color: "#1e824c",
            border: "1px solid #bbf7d0",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "6px",
          }}
        >
          ✓ PAID
        </span>
      );
    }
    if (isAdvance) {
      const adv = Number(booking.advance_amount || 100);
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "#eff6ff",
              color: "#1d4ed8",
              border: "1px solid #bfdbfe",
              fontSize: "10.5px",
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: "6px",
            }}
          >
            ₹{adv} ADVANCE
          </span>
          {Number(booking.remaining_amount) > 0 &&
            normalizeStatus(booking.status, booking.raw_status) !== "COMPLETED" && (
              <span style={{ fontSize: "10.5px", color: "#b45309", fontWeight: 700 }}>
                Due: ₹{Number(booking.remaining_amount)}
              </span>
            )}
        </div>
      );
    }
    if (isRefunded) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#faf5ff",
            color: "#7e22ce",
            border: "1px solid #e9d5ff",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "6px",
          }}
        >
          ↩ REFUNDED
        </span>
      );
    }
    if (isFailed) {
      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#fef2f2",
            color: "#dc2626",
            border: "1px solid #fecaca",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "6px",
          }}
        >
          ✕ FAILED
        </span>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            background: "#fef3c7",
            color: "#92400e",
            border: "1px solid #fde68a",
            fontSize: "10.5px",
            fontWeight: 700,
            padding: "2px 7px",
            borderRadius: "6px",
          }}
        >
          ⏳ PENDING
        </span>
        <span style={{ fontSize: "10px", color: "#6b7280" }}>
          Collect: ₹{booking.total_amount || booking.service_price || 0}
        </span>
      </div>
    );
  };

  const formatTimeSlot = (booking) => {
    if (booking.start_time && booking.end_time) {
      const startParts = booking.start_time.split(":");
      const endParts = booking.end_time.split(":");
      if (startParts.length >= 2 && endParts.length >= 2) {
        const startH = parseInt(startParts[0], 10);
        const startM = startParts[1];
        const startAmpm = startH >= 12 ? "PM" : "AM";
        const startHour12 = startH % 12 || 12;

        const endH = parseInt(endParts[0], 10);
        const endM = endParts[1];
        const endAmpm = endH >= 12 ? "PM" : "AM";
        const endHour12 = endH % 12 || 12;

        return `${startHour12}:${startM} ${startAmpm} – ${endHour12}:${endM} ${endAmpm}`;
      }
    }
    return booking.booking_time || "Scheduled Slot";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header & Controls Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid var(--studio-border)",
          padding: "20px 24px",
          boxShadow: "var(--studio-shadow-sm)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px",
            marginBottom: "20px",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 800,
                color: "var(--studio-text-main)",
                margin: "0 0 4px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span>📋</span> All Salon Bookings &amp; Staff Operations
            </h1>
            <p style={{ fontSize: "13px", color: "var(--studio-text-muted)", margin: 0 }}>
              Monitor, start, complete, and manage client appointments across all specialists and stations.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onRefresh && (
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={onRefresh}
                disabled={isLoading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  cursor: "pointer",
                }}
              >
                <span>🔄</span>
                <span>{isLoading ? "Refreshing..." : "Refresh Bookings"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Summary Pill Bar */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "20px",
            padding: "12px 16px",
            background: "#f9fafb",
            borderRadius: "12px",
            border: "1px solid #f0f3f1",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Total Bookings:</span>
            <span style={{ background: "#e5e7eb", color: "#1f2937", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {activeStats.total}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Confirmed:</span>
            <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {activeStats.confirmed}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>In Progress:</span>
            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {activeStats.inProgress}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Completed:</span>
            <span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {activeStats.completed}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Cancelled:</span>
            <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {activeStats.cancelled}
            </span>
          </div>
          {activeStats.pending > 0 && (
            <>
              <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
                <span style={{ color: "var(--studio-text-muted)" }}>Pending:</span>
                <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
                  {activeStats.pending}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: "12px",
            alignItems: "center",
          }}
        >
          {/* Worker Filter */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", marginBottom: "4px" }}>
              FILTER BY STYLIST
            </label>
            <select
              value={workerFilter}
              onChange={(e) => setWorkerFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--studio-text-main)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="all">All Specialists ({workers.length})</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name || (w.user ? `${w.user.first_name} ${w.user.last_name || ""}`.trim() : "Specialist")} ({w.station || "Station"})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", marginBottom: "4px" }}>
              FILTER BY STATUS
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--studio-text-main)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="all">All Statuses</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="PENDING">Pending</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", marginBottom: "4px" }}>
              PAYMENT METHOD
            </label>
            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--studio-text-main)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="all">All Payment Methods</option>
              <option value="PAY_AT_SALON">💵 Pay at Salon</option>
              <option value="WALLET">👛 Wallet Payment</option>
              <option value="ONLINE">💳 Online Payment</option>
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", marginBottom: "4px" }}>
              FILTER BY DATE
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--studio-border)",
                background: "#ffffff",
                fontSize: "13px",
                color: "var(--studio-text-main)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="all">All Dates</option>
              <option value="today">Today Only</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This Week (Next 7 Days)</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", marginBottom: "4px" }}>
              SEARCH BOOKINGS
            </label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Client, phone, service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid var(--studio-border)",
                  background: "#f9fafb",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "12px",
                  color: "#9ca3af",
                }}
              >
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "8px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                    color: "#9ca3af",
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bookings Queue / Table Card */}
      <div
        style={{
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid var(--studio-border)",
          boxShadow: "var(--studio-shadow-sm)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--studio-border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>📅</span>
            <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--studio-text-main)" }}>
              Bookings Queue ({isBackend ? (pagination?.totalCount ?? displayedBookings.length) : displayedBookings.length})
            </span>
          </div>

          {(workerFilter !== "all" ||
            statusFilter !== "all" ||
            paymentMethodFilter !== "all" ||
            dateFilter !== "all" ||
            Boolean(searchQuery)) && (
            <button
              type="button"
              onClick={() => {
                if (isBackend && backendFilters?.onResetFilters) {
                  backendFilters.onResetFilters();
                } else {
                  setWorkerFilter("all");
                  setStatusFilter("all");
                  setPaymentMethodFilter("all");
                  setDateFilter("all");
                  setSearchQuery("");
                }
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#2563eb",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {displayedBookings.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--studio-text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--studio-text-main)", margin: "0 0 6px" }}>
              No bookings found
            </h3>
            <p style={{ fontSize: "13px", margin: 0 }}>
              {(!isBackend && bookings.length === 0) || (isBackend && pagination?.totalCount === 0 && !Boolean(searchQuery) && workerFilter === "all" && statusFilter === "all" && paymentMethodFilter === "all" && dateFilter === "all")
                ? "No client bookings recorded yet for this salon."
                : "No bookings match your current filter parameters. Try clearing your filters."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
              <thead>
                <tr style={{ background: "#f8faf9", borderBottom: "1px solid var(--studio-border)" }}>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    CLIENT
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    ASSIGNED SPECIALIST
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    SERVICE &amp; AMOUNT
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    DATE &amp; TIME
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    PAYMENT METHOD &amp; STATUS
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    STATUS
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px", textAlign: "right" }}>
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedBookings.map((b) => {
                  const isUpdating = actionLoadingId === b.id;
                  const rawStatus = normalizeStatus(b.status, b.raw_status);
                  const payMethod = getPaymentMethodDisplay(b.payment_method);
                  const effectivePrice = b.total_amount || b.service_price || 0;

                  return (
                    <tr
                      key={b.id}
                      style={{
                        borderBottom: "1px solid var(--studio-border-subtle)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Client info */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: 700, color: "var(--studio-text-main)" }}>
                            {b.client_name || "Guest Client"}
                          </span>
                          <span style={{ fontSize: "10px", color: "var(--studio-text-muted)", background: "#f3f4f6", padding: "1px 5px", borderRadius: "4px" }}>
                            #{b.id}
                          </span>
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                          {b.client_phone ? (
                            <a href={`tel:${b.client_phone}`} style={{ color: "inherit", textDecoration: "none" }}>
                              📞 {b.client_phone}
                            </a>
                          ) : (
                            "No phone"
                          )}
                        </div>
                        {b.client_email && (
                          <div style={{ fontSize: "11px", color: "var(--studio-text-subtle)", marginTop: "1px" }}>
                            ✉️ {b.client_email}
                          </div>
                        )}
                      </td>

                      {/* Assigned Specialist */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {b.worker_photo ? (
                            <img
                              src={b.worker_photo}
                              alt={b.stylist || b.worker_name}
                              style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "28px",
                                height: "28px",
                                borderRadius: "50%",
                                background: "#eef7f2",
                                color: "#1e392a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "11px",
                              }}
                            >
                              {(b.stylist || b.worker_name || "W").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: "var(--studio-text-main)" }}>
                              {b.stylist || b.worker_name || "Any Available"}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--studio-text-muted)" }}>
                              {b.station || "Station 01"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Service & Price */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--studio-text-main)" }}>
                          {b.service || b.service_name}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                          <strong style={{ color: "#166534" }}>₹{Number(effectivePrice)}</strong>
                          {b.duration && ` • ${b.duration}`}
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontWeight: 600, color: "var(--studio-text-main)" }}>
                          {b.booking_date}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                          {formatTimeSlot(b)}
                        </div>
                      </td>

                      {/* Payment Method & Status */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "13px" }}>{payMethod.icon}</span>
                          <span
                            style={{
                              fontSize: "11.5px",
                              fontWeight: 700,
                              color: payMethod.color,
                            }}
                          >
                            {payMethod.label}
                          </span>
                        </div>
                        {getPaymentStatusBadge(b)}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {getStatusBadge(b.status, b.raw_status)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {/* If COMPLETED: show a VIEW button instead of start/complete button */}
                          {rawStatus === "COMPLETED" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(b)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid #2d5a43",
                                background: "#f0f7f3",
                                color: "#2d5a43",
                                fontSize: "11.5px",
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                              title="View full booking receipt & details"
                            >
                              <span>👁️</span>
                              <span>View</span>
                            </button>
                          ) : rawStatus === "CANCELLED" || rawStatus === "NO_SHOW" ? (
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(b)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                color: "#4b5563",
                                fontSize: "11.5px",
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                              title="View cancellation details"
                            >
                              <span>👁️</span>
                              <span>View</span>
                            </button>
                          ) : rawStatus === "IN_PROGRESS" ? (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "COMPLETED")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 11px",
                                  borderRadius: "7px",
                                  border: "1px solid #2563eb",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: isUpdating ? "wait" : "pointer",
                                  boxShadow: "0 1px 2px rgba(37,99,235,0.2)",
                                }}
                                title="Complete service & finalize settlement"
                              >
                                <span>✓</span>
                                <span>{isUpdating ? "..." : "Complete"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => {
                                  setCancellingBooking(b);
                                  setCancellationReason("");
                                }}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "7px",
                                  border: "1px solid #fecaca",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: isUpdating ? "wait" : "pointer",
                                }}
                                title="Cancel appointment"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #e5e7eb",
                                  background: "#ffffff",
                                  color: "#4b5563",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="View details"
                              >
                                👁️
                              </button>
                            </>
                          ) : (
                            /* PENDING or CONFIRMED: Start, Complete, Cancel, and View */
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "IN_PROGRESS")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 11px",
                                  borderRadius: "7px",
                                  border: "1px solid #16a34a",
                                  background: "#16a34a",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: isUpdating ? "wait" : "pointer",
                                  boxShadow: "0 1px 2px rgba(22,163,74,0.2)",
                                }}
                                title="Seat client and start appointment service"
                              >
                                <span>▶</span>
                                <span>{isUpdating ? "..." : "Start"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "COMPLETED")}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "6px 11px",
                                  borderRadius: "7px",
                                  border: "1px solid #2563eb",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: isUpdating ? "wait" : "pointer",
                                }}
                                title="Mark as completed directly"
                              >
                                <span>✓</span>
                                <span>{isUpdating ? "..." : "Complete"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => {
                                  setCancellingBooking(b);
                                  setCancellationReason("");
                                }}
                                style={{
                                  padding: "6px 9px",
                                  borderRadius: "7px",
                                  border: "1px solid #fecaca",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: isUpdating ? "wait" : "pointer",
                                }}
                                title="Cancel booking"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedBooking(b)}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "7px",
                                  border: "1px solid #e5e7eb",
                                  background: "#ffffff",
                                  color: "#4b5563",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="View details"
                              >
                                👁️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {pagination && pagination.totalCount > 0 && (
          <div className="studio-pagination-bar">
            <div className="studio-pagination-info">
              Showing <strong>{(pagination.currentPage - 1) * pagination.pageSize + 1}</strong> to{" "}
              <strong>{Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}</strong> of{" "}
              <strong>{pagination.totalCount}</strong> bookings
            </div>

            <div className="studio-pagination-controls">
              <div className="studio-pagination-size-select">
                <label htmlFor="studio-bookings-page-size">Per page:</label>
                <select
                  id="studio-bookings-page-size"
                  value={pagination.pageSize}
                  onChange={(e) => pagination.onPageSizeChange(Number(e.target.value))}
                  className="studio-select-compact"
                  disabled={isLoading}
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>

              <div className="studio-pagination-buttons">
                <button
                  type="button"
                  className="studio-pagination-btn"
                  disabled={pagination.currentPage <= 1 || isLoading}
                  onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                  aria-label="Previous Page"
                >
                  ‹ Prev
                </button>

                {getPageNumbers(pagination.currentPage, pagination.totalPages).map((pageNum, idx) => {
                  if (pageNum === "...") {
                    return (
                      <span key={`ellipsis-${idx}`} className="studio-pagination-ellipsis">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={`page-${pageNum}`}
                      type="button"
                      className={`studio-pagination-btn ${
                        pageNum === pagination.currentPage ? "active" : ""
                      }`}
                      disabled={isLoading}
                      onClick={() => pagination.onPageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="studio-pagination-btn"
                  disabled={pagination.currentPage >= pagination.totalPages || isLoading}
                  onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                  aria-label="Next Page"
                >
                  Next ›
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* Booking Details Modal ("View" button)                         */}
      {/* ============================================================ */}
      {selectedBooking && (
        <div className="studio-modal-backdrop" onClick={() => setSelectedBooking(null)}>
          <div
            className="studio-modal-card"
            style={{ maxWidth: "600px", width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="studio-modal-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 className="studio-modal-title">Booking Details</h3>
                  <span
                    style={{
                      background: "#e8f2ec",
                      color: "#1e392a",
                      fontSize: "11.5px",
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    #BK-{String(selectedBooking.id).padStart(4, "0")}
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--studio-text-muted)" }}>
                  Booked for {selectedBooking.booking_date} at {formatTimeSlot(selectedBooking)}
                </p>
              </div>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setSelectedBooking(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="studio-modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Status Banner */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: "#f9fafb",
                  borderRadius: "10px",
                  border: "1px solid #e5e7eb",
                }}
              >
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", display: "block" }}>
                    APPOINTMENT STATUS
                  </span>
                  <div style={{ marginTop: "4px" }}>
                    {getStatusBadge(selectedBooking.status, selectedBooking.raw_status)}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", display: "block" }}>
                    PAYMENT SETTLEMENT
                  </span>
                  <div style={{ marginTop: "4px" }}>
                    {getPaymentStatusBadge(selectedBooking)}
                  </div>
                </div>
              </div>

              {/* Client & Specialist Split Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Client Card */}
                <div style={{ padding: "14px", borderRadius: "10px", background: "#ffffff", border: "1px solid var(--studio-border)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", textTransform: "uppercase" }}>
                    👤 Client Information
                  </span>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--studio-text-main)", marginTop: "6px" }}>
                    {selectedBooking.client_name || "Guest Client"}
                  </div>
                  {selectedBooking.client_phone && (
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>
                      <a href={`tel:${selectedBooking.client_phone}`} style={{ color: "#2563eb", textDecoration: "none" }}>
                        📞 {selectedBooking.client_phone}
                      </a>
                    </div>
                  )}
                  {selectedBooking.client_email && (
                    <div style={{ fontSize: "11.5px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                      ✉️ {selectedBooking.client_email}
                    </div>
                  )}
                </div>

                {/* Specialist Card */}
                {(() => {
                  const normSelectedStatus = normalizeStatus(selectedBooking.status, selectedBooking.raw_status);
                  const canReassignWorker = normSelectedStatus === "PENDING" || normSelectedStatus === "CONFIRMED";

                  return (
                    <div style={{ padding: "14px", borderRadius: "10px", background: "#ffffff", border: "1px solid var(--studio-border)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", textTransform: "uppercase" }}>
                            ✂️ Assigned Specialist
                          </span>
                          {canReassignWorker ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReassignModal(selectedBooking)}
                              style={{
                                background: "#e8f5e9",
                                color: "#1e693b",
                                border: "1px solid #c8e6c9",
                                borderRadius: "6px",
                                padding: "4px 8px",
                                fontSize: "11px",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#1e693b";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#e8f5e9";
                                e.currentTarget.style.color = "#1e693b";
                              }}
                              title="Change assigned worker for this booking"
                            >
                              🔄 Change Worker
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: "10px",
                                fontWeight: 600,
                                color: "#9ca3af",
                                background: "#f3f4f6",
                                padding: "2px 6px",
                                borderRadius: "4px",
                              }}
                              title="Worker can only be switched for Pending or Confirmed bookings"
                            >
                              🔒 Locked ({normSelectedStatus})
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                          {selectedBooking.worker_photo ? (
                            <img
                              src={selectedBooking.worker_photo}
                              alt="Specialist"
                              style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "1px solid var(--studio-border)" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "36px",
                                height: "36px",
                                borderRadius: "50%",
                                background: "#eef7f2",
                                color: "#1e392a",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "13px",
                              }}
                            >
                              {(selectedBooking.stylist || selectedBooking.worker_name || "W").charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--studio-text-main)" }}>
                              {selectedBooking.stylist || selectedBooking.worker_name || "Any Available"}
                            </div>
                            <div style={{ fontSize: "11px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                              {selectedBooking.station || "Station 01"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Service & Schedule Breakdown */}
              <div style={{ padding: "14px", borderRadius: "10px", background: "#ffffff", border: "1px solid var(--studio-border)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", textTransform: "uppercase" }}>
                  💇 Service &amp; Schedule
                </span>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--studio-text-main)" }}>
                      {selectedBooking.service || selectedBooking.service_name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                      Duration: {selectedBooking.duration || "45 mins"} • Station: {selectedBooking.station || "Station 01"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color: "#166534" }}>
                      ₹{Number(selectedBooking.total_amount || selectedBooking.service_price || 0)}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--studio-text-muted)" }}>
                      Standard Rate
                    </div>
                  </div>
                </div>

                {selectedBooking.service_started_at && (
                  <div style={{ marginTop: "10px", padding: "6px 10px", background: "#f0fdf4", borderRadius: "6px", fontSize: "11.5px", color: "#15803d" }}>
                    ⚡ Service started: {new Date(selectedBooking.service_started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>

              {/* Payment Details Card */}
              {(() => {
                const payInfo = getPaymentMethodDisplay(selectedBooking.payment_method);
                const totalAmt = Number(selectedBooking.total_amount || selectedBooking.service_price || 0);
                const advAmt = Number(selectedBooking.advance_amount || 0);
                const remAmt = Number(selectedBooking.remaining_amount || 0);

                return (
                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "10px",
                      background: payInfo.bg,
                      border: `1px solid ${payInfo.border}`,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "16px" }}>{payInfo.icon}</span>
                        <strong style={{ fontSize: "13px", color: payInfo.color }}>{payInfo.label}</strong>
                      </div>
                      <span style={{ fontSize: "11.5px", color: payInfo.color, fontWeight: 600 }}>
                        {payInfo.description}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px", marginTop: "10px", paddingTop: "10px", borderTop: "1px dashed rgba(0,0,0,0.1)" }}>
                      <div>
                        <span style={{ fontSize: "10.5px", color: "var(--studio-text-muted)", display: "block" }}>TOTAL AMOUNT</span>
                        <strong style={{ fontSize: "13px", color: "var(--studio-text-main)" }}>₹{totalAmt}</strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "10.5px", color: "var(--studio-text-muted)", display: "block" }}>ADVANCE PAID</span>
                        <strong style={{ fontSize: "13px", color: advAmt > 0 ? "#1e824c" : "var(--studio-text-main)" }}>
                          ₹{advAmt}
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "10.5px", color: "var(--studio-text-muted)", display: "block" }}>REMAINING DUE</span>
                        <strong style={{ fontSize: "13px", color: remAmt > 0 ? "#b45309" : "#1e824c" }}>
                          ₹{remAmt}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Notes & Worker Remarks */}
              {(selectedBooking.notes || selectedBooking.worker_remarks) && (
                <div style={{ padding: "14px", borderRadius: "10px", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
                  {selectedBooking.notes && (
                    <div style={{ marginBottom: selectedBooking.worker_remarks ? "8px" : 0 }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", display: "block" }}>
                        CLIENT NOTES
                      </span>
                      <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "var(--studio-text-main)" }}>
                        {selectedBooking.notes}
                      </p>
                    </div>
                  )}
                  {selectedBooking.worker_remarks && (
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", display: "block" }}>
                        SPECIALIST CONSULTATION REMARKS
                      </span>
                      <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "var(--studio-text-main)" }}>
                        {selectedBooking.worker_remarks}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Activity & Worker Reassignment History */}
              {Array.isArray(selectedBooking.history) && selectedBooking.history.length > 0 && (
                <div style={{ padding: "14px", borderRadius: "10px", background: "#f8faf9", border: "1px solid var(--studio-border)" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", textTransform: "uppercase", display: "flex", alignItems: "center", gap: "6px" }}>
                    📜 Reassignment &amp; Audit History ({selectedBooking.history.length})
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                    {selectedBooking.history.map((h, idx) => (
                      <div
                        key={h.id || idx}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          fontSize: "12px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                          <span style={{ fontWeight: 700, color: "#166534", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            🔄 Specialist Switched
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--studio-text-muted)" }}>
                            {new Date(h.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div style={{ color: "var(--studio-text-main)", fontSize: "12px" }}>
                          From <strong style={{ color: "#991b1b" }}>{h.previous_worker_display || h.previous_worker_name || "Unassigned"}</strong> ➔ To <strong style={{ color: "#15803d" }}>{h.new_worker_display || h.new_worker_name}</strong>
                        </div>
                        {h.reason && (
                          <div style={{ marginTop: "4px", fontSize: "11.5px", color: "var(--studio-text-muted)", fontStyle: "italic" }}>
                            Note: "{h.reason}"
                          </div>
                        )}
                        <div style={{ marginTop: "3px", fontSize: "10.5px", color: "#6b7280" }}>
                          Updated by: {h.changed_by_name || "Salon Owner"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer / Actions */}
            <div className="studio-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                {/* Actions available in modal if booking is not completed or cancelled */}
                {normalizeStatus(selectedBooking.status, selectedBooking.raw_status) === "IN_PROGRESS" && (
                  <button
                    type="button"
                    disabled={actionLoadingId === selectedBooking.id}
                    onClick={() => handleActionClick(selectedBooking.id, "COMPLETED")}
                    className="btn-modal-submit"
                    style={{ background: "#2563eb", borderColor: "#2563eb", marginRight: "8px" }}
                  >
                    ✓ Complete Appointment
                  </button>
                )}

                {(normalizeStatus(selectedBooking.status, selectedBooking.raw_status) === "CONFIRMED" ||
                  normalizeStatus(selectedBooking.status, selectedBooking.raw_status) === "PENDING") && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedBooking.id}
                      onClick={() => handleActionClick(selectedBooking.id, "IN_PROGRESS")}
                      className="btn-modal-submit"
                      style={{ background: "#16a34a", borderColor: "#16a34a", marginRight: "8px" }}
                    >
                      ▶ Start Appointment
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedBooking.id}
                      onClick={() => handleActionClick(selectedBooking.id, "COMPLETED")}
                      className="btn-modal-submit"
                      style={{ background: "#2563eb", borderColor: "#2563eb", marginRight: "8px" }}
                    >
                      ✓ Complete Directly
                    </button>
                  </>
                )}

                {normalizeStatus(selectedBooking.status, selectedBooking.raw_status) !== "COMPLETED" &&
                  normalizeStatus(selectedBooking.status, selectedBooking.raw_status) !== "CANCELLED" && (
                    <button
                      type="button"
                      disabled={actionLoadingId === selectedBooking.id}
                      onClick={() => {
                        setCancellingBooking(selectedBooking);
                        setCancellationReason("");
                      }}
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1px solid #fecaca",
                        background: "#ffffff",
                        color: "#dc2626",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cancel Booking
                    </button>
                  )}
              </div>

              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setSelectedBooking(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Cancel Confirmation Modal                                    */}
      {/* ============================================================ */}
      {cancellingBooking && (
        <div className="studio-modal-backdrop" onClick={() => setCancellingBooking(null)}>
          <div
            className="studio-modal-card"
            style={{ maxWidth: "480px", width: "90%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="studio-modal-header">
              <h3 className="studio-modal-title" style={{ color: "#dc2626" }}>
                Confirm Cancellation
              </h3>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setCancellingBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="studio-modal-body" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--studio-text-main)", lineHeight: "1.5" }}>
                Are you sure you want to cancel booking <strong>#BK-{cancellingBooking.id}</strong> for{" "}
                <strong>{cancellingBooking.client_name || "Guest Client"}</strong>?
              </p>

              <div style={{ padding: "12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12.5px", color: "#991b1b" }}>
                <div><strong>Service:</strong> {cancellingBooking.service || cancellingBooking.service_name}</div>
                <div><strong>Specialist:</strong> {cancellingBooking.stylist || cancellingBooking.worker_name || "Assigned Stylist"}</div>
                <div><strong>Scheduled:</strong> {cancellingBooking.booking_date} at {formatTimeSlot(cancellingBooking)}</div>
                {(cancellingBooking.is_advance_paid || Number(cancellingBooking.advance_amount) > 0) && (
                  <div style={{ marginTop: "6px", paddingTop: "6px", borderTop: "1px dashed #fca5a5", fontWeight: 600 }}>
                    ℹ️ Advance payment of ₹{Number(cancellingBooking.advance_amount || 100)} will be processed for automatic refund.
                  </div>
                )}
              </div>

              <div className="modal-input-group" style={{ marginTop: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700 }}>
                  Reason for Cancellation (optional):
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client requested reschedule, staff emergency, salon power outage..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--studio-border)",
                    fontSize: "12.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div className="studio-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setCancellingBooking(null)}
              >
                Keep Booking
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                disabled={actionLoadingId === cancellingBooking.id}
                onClick={confirmCancelAction}
              >
                {actionLoadingId === cancellingBooking.id ? "Cancelling..." : "Yes, Cancel Booking"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* Change Assigned Worker Modal                                 */}
      {/* ============================================================ */}
      {reassigningBooking && (
        <div className="studio-modal-backdrop" onClick={() => !isSubmittingReassign && setReassigningBooking(null)}>
          <div
            className="studio-modal-card"
            style={{ maxWidth: "560px", width: "94%" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="studio-modal-header">
              <div>
                <h3 className="studio-modal-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>✂️</span> Change Assigned Worker
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: "12px", color: "var(--studio-text-muted)" }}>
                  Booking #BK-{String(reassigningBooking.id).padStart(4, "0")} • {reassigningBooking.booking_date} at {formatTimeSlot(reassigningBooking)}
                </p>
              </div>
              <button
                type="button"
                className="studio-modal-close-btn"
                disabled={isSubmittingReassign}
                onClick={() => setReassigningBooking(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="studio-modal-body" style={{ maxHeight: "75vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Appointment Context Banner */}
              <div style={{ background: "#f8faf9", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--studio-text-muted)", textTransform: "uppercase" }}>
                    Service
                  </span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534" }}>
                    {reassigningBooking.duration || "45 mins"}
                  </span>
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 700, color: "var(--studio-text-main)" }}>
                  {reassigningBooking.service || reassigningBooking.service_name}
                </div>
                <div style={{ fontSize: "12px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                  Client: <strong>{reassigningBooking.client_name || "Guest Client"}</strong>
                </div>
              </div>

              {/* Current Specialist Card */}
              <div style={{ background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: "10px", padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  {reassigningBooking.worker_photo ? (
                    <img
                      src={reassigningBooking.worker_photo}
                      alt=""
                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f1f5f9", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "13px" }}>
                      {(reassigningBooking.stylist || reassigningBooking.worker_name || "W").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: "11px", color: "var(--studio-text-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                      Currently Assigned
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--studio-text-main)" }}>
                      {reassigningBooking.stylist || reassigningBooking.worker_name || "Any Available"}
                    </div>
                  </div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", background: "#f1f5f9", color: "#475569", borderRadius: "6px" }}>
                  {reassigningBooking.station || "Station 01"}
                </span>
              </div>

              {/* Workers Selection Section */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--studio-text-main)", textTransform: "uppercase" }}>
                    Select New Specialist ({eligibleWorkers.filter((w) => w.can_assign).length} Available)
                  </label>
                  {loadingEligibleWorkers && (
                    <span style={{ fontSize: "11px", color: "#166534", fontWeight: 600 }}>
                      Checking schedules &amp; conflicts...
                    </span>
                  )}
                </div>

                {loadingEligibleWorkers ? (
                  <div style={{ padding: "32px 0", textAlign: "center", color: "var(--studio-text-muted)", fontSize: "13px" }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔄</div>
                    Validating worker working hours, approved leaves, and appointment conflicts...
                  </div>
                ) : eligibleWorkers.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", background: "#f9fafb", borderRadius: "8px", fontSize: "13px", color: "var(--studio-text-muted)" }}>
                    No active workers found in your salon.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto", paddingRight: "4px" }}>
                    {eligibleWorkers.map((w) => {
                      const isSelected = selectedWorkerId === w.id;
                      const isDisabled = !w.can_assign;

                      let statusBadge = null;
                      if (w.is_current) {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#f1f5f9", color: "#475569", padding: "2px 8px", borderRadius: "6px" }}>
                            Current Specialist
                          </span>
                        );
                      } else if (w.availability_status === "AVAILABLE") {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            ● Available
                          </span>
                        );
                      } else if (w.availability_status === "TIME_CONFLICT") {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: "6px", display: "inline-flex", alignItems: "center", gap: "4px" }} title={w.conflict_reason}>
                            ⚠️ Conflict: Booked
                          </span>
                        );
                      } else if (w.availability_status === "ON_LEAVE") {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px" }} title={w.conflict_reason}>
                            🏖️ On Leave
                          </span>
                        );
                      } else if (w.availability_status === "WEEKLY_OFF") {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: "6px" }} title={w.conflict_reason}>
                            🗓️ Weekly Off
                          </span>
                        );
                      } else if (w.availability_status === "NOT_QUALIFIED") {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px" }} title={w.conflict_reason}>
                            🚫 Not Certified
                          </span>
                        );
                      } else {
                        statusBadge = (
                          <span style={{ fontSize: "10.5px", fontWeight: 700, background: "#f3f4f6", color: "#6b7280", padding: "2px 8px", borderRadius: "6px" }} title={w.conflict_reason}>
                            Unavailable
                          </span>
                        );
                      }

                      return (
                        <div
                          key={w.id}
                          onClick={() => {
                            if (!isDisabled) setSelectedWorkerId(w.id);
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            border: `1.5px solid ${isSelected ? "#166534" : isDisabled ? "#e5e7eb" : "var(--studio-border)"}`,
                            background: isSelected ? "#f0fdf4" : isDisabled ? "#fafafa" : "#ffffff",
                            cursor: isDisabled ? "not-allowed" : "pointer",
                            opacity: isDisabled ? 0.6 : 1,
                            transition: "all 0.15s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {/* Radio / Selection Indicator */}
                            <div
                              style={{
                                width: "18px",
                                height: "18px",
                                borderRadius: "50%",
                                border: `2px solid ${isSelected ? "#166534" : "#cbd5e1"}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                background: isSelected ? "#166534" : "#ffffff",
                              }}
                            >
                              {isSelected && (
                                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ffffff" }} />
                              )}
                            </div>

                            {/* Avatar */}
                            {w.avatar || w.profile_photo ? (
                              <img
                                src={w.avatar || w.profile_photo}
                                alt={w.name}
                                style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }}
                              />
                            ) : (
                              <div
                                style={{
                                  width: "36px",
                                  height: "36px",
                                  borderRadius: "50%",
                                  background: "#e8f2ec",
                                  color: "#1e392a",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 700,
                                  fontSize: "13px",
                                }}
                              >
                                {w.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <div style={{ fontWeight: 700, fontSize: "13.5px", color: "var(--studio-text-main)" }}>
                                {w.name}
                              </div>
                              <div style={{ fontSize: "11px", color: "var(--studio-text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                                <span>{w.specialization}</span>
                                <span>•</span>
                                <span>{w.station}</span>
                                {w.rating && <span>• ⭐ {w.rating}</span>}
                              </div>
                              {w.conflict_reason && !w.is_current && (
                                <div style={{ fontSize: "10.5px", color: "#b91c1c", marginTop: "2px" }}>
                                  ⚠️ {w.conflict_reason}
                                </div>
                              )}
                            </div>
                          </div>

                          <div>{statusBadge}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Optional Reason / Notes */}
              <div className="modal-input-group" style={{ marginTop: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "var(--studio-text-main)" }}>
                  Reason for Reassignment (Optional):
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  {[
                    "Client requested specific specialist",
                    "Original specialist unavailable",
                    "Shift & station rebalancing",
                    "VIP client allocation",
                  ].map((quickReason) => (
                    <button
                      key={quickReason}
                      type="button"
                      onClick={() => setReassignReason(quickReason)}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "14px",
                        border: "1px solid #e2e8f0",
                        background: reassignReason === quickReason ? "#e8f5e9" : "#f8fafc",
                        color: reassignReason === quickReason ? "#1e693b" : "#475569",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {quickReason}
                    </button>
                  ))}
                </div>
                <textarea
                  rows={2}
                  placeholder="Additional notes for booking history and worker notifications..."
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid var(--studio-border)",
                    fontSize: "12.5px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Error banner */}
              {reassignError && (
                <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: "12.5px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span>⚠️</span>
                  <span>{reassignError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="studio-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                disabled={isSubmittingReassign}
                onClick={() => setReassigningBooking(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                disabled={!selectedWorkerId || isSubmittingReassign}
                onClick={handleConfirmReassign}
                style={{
                  background: !selectedWorkerId ? "#9ca3af" : "#166534",
                  borderColor: !selectedWorkerId ? "#9ca3af" : "#166534",
                  cursor: !selectedWorkerId || isSubmittingReassign ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {isSubmittingReassign ? "Updating Assigned Worker..." : "✓ Confirm Worker Change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

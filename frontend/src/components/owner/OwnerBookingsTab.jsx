import { useState, useMemo } from "react";

const formatLocalDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function OwnerBookingsTab({
  bookings = [],
  workers = [],
  onUpdateStatus,
  onRefresh,
  isLoading = false,
}) {
  const [workerFilter, setWorkerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Today / Tomorrow / Week dates string calculation
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

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Worker filter
      if (workerFilter !== "all") {
        if (String(b.worker_id) !== String(workerFilter)) return false;
      }

      // Status filter
      if (statusFilter !== "all") {
        if (String(b.status).toUpperCase() !== String(statusFilter).toUpperCase()) return false;
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
        const service = (b.service || b.service_name || "").toLowerCase();
        const stylist = (b.stylist || b.worker_name || "").toLowerCase();
        const station = (b.station || "").toLowerCase();
        const idMatch = String(b.id || "").includes(q);

        if (
          !clientName.includes(q) &&
          !clientPhone.includes(q) &&
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
  }, [bookings, workerFilter, statusFilter, dateFilter, searchQuery, todayStr, tomorrowStr, weekEndStr]);

  // Statistics calculation for the quick summary bar
  const stats = useMemo(() => {
    const total = bookings.length;
    let confirmed = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;

    bookings.forEach((b) => {
      const s = String(b.status || "").toUpperCase();
      if (s === "CONFIRMED" || s === "PENDING") confirmed++;
      else if (s === "IN_PROGRESS") inProgress++;
      else if (s === "COMPLETED") completed++;
      else if (s === "CANCELLED") cancelled++;
    });

    return { total, confirmed, inProgress, completed, cancelled };
  }, [bookings]);

  const handleActionClick = async (bookingId, newStatus) => {
    try {
      setActionLoadingId(bookingId);
      if (onUpdateStatus) {
        await onUpdateStatus(bookingId, newStatus);
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = String(status || "").toUpperCase();
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
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb", display: "inline-block" }} />
          IN PROGRESS
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
        CONFIRMED
      </span>
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
              <span>📋</span> All Salon Bookings
            </h1>
            <p style={{ fontSize: "13px", color: "var(--studio-text-muted)", margin: 0 }}>
              Live appointments across all salon stylists, stations, and dates.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {onRefresh && (
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={onRefresh}
                disabled={isLoading}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px" }}
              >
                <span>🔄</span>
                <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
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
              {stats.total}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Confirmed:</span>
            <span style={{ background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {stats.confirmed}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>In Progress:</span>
            <span style={{ background: "#dbeafe", color: "#1e40af", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {stats.inProgress}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Completed:</span>
            <span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {stats.completed}
            </span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "#e5e7eb", margin: "auto 4px" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 600 }}>
            <span style={{ color: "var(--studio-text-muted)" }}>Cancelled:</span>
            <span style={{ background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: "999px", fontWeight: 700 }}>
              {stats.cancelled}
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
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
              <option value="all">All Stylists ({workers.length})</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.full_name || (w.user ? `${w.user.first_name} ${w.user.last_name || ""}`.trim() : "Stylist")} ({w.station || "Station"})
                </option>
              ))}
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

      {/* Bookings List / Table */}
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
              Bookings Queue ({filteredBookings.length})
            </span>
          </div>

          {(workerFilter !== "all" || statusFilter !== "all" || dateFilter !== "all" || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                setWorkerFilter("all");
                setStatusFilter("all");
                setDateFilter("all");
                setSearchQuery("");
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

        {filteredBookings.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--studio-text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔍</div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--studio-text-main)", margin: "0 0 6px" }}>
              No bookings found
            </h3>
            <p style={{ fontSize: "13px", margin: 0 }}>
              {bookings.length === 0
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
                    ASSIGNED WORKER
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    SERVICE &amp; PRICE
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    DATE &amp; TIME
                  </th>
                  <th style={{ padding: "12px 18px", fontWeight: 700, color: "var(--studio-text-muted)", fontSize: "11px", letterSpacing: "0.5px" }}>
                    PAYMENT
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
                {filteredBookings.map((b) => {
                  const isUpdating = actionLoadingId === b.id;
                  const rawStatus = String(b.status || "").toUpperCase();

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
                        <div style={{ fontWeight: 700, color: "var(--studio-text-main)" }}>
                          {b.client_name || "Guest Client"}
                        </div>
                        <div style={{ fontSize: "11.5px", color: "var(--studio-text-muted)", marginTop: "2px" }}>
                          {b.client_phone || "No phone"}
                        </div>
                        {b.client_email && (
                          <div style={{ fontSize: "11px", color: "var(--studio-text-subtle)" }}>
                            {b.client_email}
                          </div>
                        )}
                      </td>

                      {/* Assigned Worker */}
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
                          <strong style={{ color: "#166534" }}>{b.price || `₹${b.service_price}`}</strong>
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

                      {/* Payment */}
                      <td style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--studio-text-main)" }}>
                          {b.payment_method === "ONLINE" || b.payment_method === "RAZORPAY"
                            ? "Online Payment"
                            : "Pay at Salon"}
                        </div>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: "2px",
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "4px",
                            background:
                              b.payment_status === "PAID"
                                ? "#eaf7ef"
                                : b.is_advance_paid
                                ? "#eff6ff"
                                : "#fef3c7",
                            color:
                              b.payment_status === "PAID"
                                ? "#1e824c"
                                : b.is_advance_paid
                                ? "#1d4ed8"
                                : "#92400e",
                          }}
                        >
                          {b.payment_status === "PAID"
                            ? "PAID"
                            : b.is_advance_paid
                            ? `₹${Number(b.advance_amount || 100)} ADVANCE`
                            : "PENDING"}
                        </span>
                        {b.is_advance_paid && Number(b.remaining_amount) > 0 && b.status !== "COMPLETED" && (
                          <div style={{ fontSize: "10.5px", color: "#b45309", fontWeight: 700, marginTop: "2px" }}>
                            Due: ₹{Number(b.remaining_amount)}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 18px" }}>
                        {getStatusBadge(b.status)}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 18px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          {(rawStatus === "CONFIRMED" || rawStatus === "PENDING") && (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "IN_PROGRESS")}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #16a34a",
                                  background: "#16a34a",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                {isUpdating ? "..." : "🪑 Seat Client"}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "COMPLETED")}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #2563eb",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="Mark as completed directly"
                              >
                                {isUpdating ? "..." : "✓ Complete"}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "CANCELLED")}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecaca",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="Cancel booking"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {rawStatus === "IN_PROGRESS" && (
                            <>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "COMPLETED")}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "6px",
                                  border: "1px solid #2563eb",
                                  background: "#2563eb",
                                  color: "#ffffff",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                {isUpdating ? "..." : "✓ Complete"}
                              </button>
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleActionClick(b.id, "CANCELLED")}
                                style={{
                                  padding: "6px 8px",
                                  borderRadius: "6px",
                                  border: "1px solid #fecaca",
                                  background: "#ffffff",
                                  color: "#dc2626",
                                  fontSize: "11.5px",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                                title="Cancel booking"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {rawStatus === "COMPLETED" && (
                            <span style={{ fontSize: "11px", color: "var(--studio-text-subtle)", fontWeight: 600 }}>
                              Completed
                            </span>
                          )}

                          {rawStatus === "CANCELLED" && (
                            <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: 600 }}>
                              Cancelled
                            </span>
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
      </div>
    </div>
  );
}


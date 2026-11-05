import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/adminBookings.css";

const STATUS_OPTIONS = [
  { key: "ALL", label: "All Statuses" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "PENDING", label: "Pending" },
];

const PAYMENT_STATUS_OPTIONS = [
  { key: "ALL", label: "All Payments" },
  { key: "PAID", label: "Paid" },
  { key: "PENDING", label: "Pending Payment" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "FAILED", label: "Failed" },
];

const DATE_RANGE_OPTIONS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
];

export default function AdminBookingsManagement() {
  // Global Platform Metrics
  const [stats, setStats] = useState({
    total_bookings: 0,
    completed_bookings: 0,
    confirmed_bookings: 0,
    in_progress_bookings: 0,
    cancelled_bookings: 0,
    pending_bookings: 0,
    total_revenue: "0.00",
    today_bookings: 0,
    total_salons: 0,
    salons_with_bookings: 0,
  });

  // Salons Directory (Left Panel)
  const [salons, setSalons] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [salonSearch, setSalonSearch] = useState("");
  const [salonStatusFilter, setSalonStatusFilter] = useState("ALL");
  const [selectedSalon, setSelectedSalon] = useState(null); // null = "Entire Platform"

  // Bookings History (Right Panel)
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [totalBookingsCount, setTotalBookingsCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filters & Sorting for History
  const [bookingSearch, setBookingSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [dateRangeFilter, setDateRangeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Inspect Modal & Toast State
  const [inspectBooking, setInspectBooking] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedText, setCopiedText] = useState(null);

  const showToast = (text) => {
    setToastMessage(text);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleCopy = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // 1. Fetch Global Platform Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/bookings/admin/stats/");
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error("Error fetching admin bookings stats:", err);
    }
  }, []);

  // 2. Fetch Salons Summary Breakdown
  const fetchSalonsSummary = useCallback(async () => {
    setSalonsLoading(true);
    try {
      const params = {};
      if (salonSearch.trim()) params.search = salonSearch.trim();
      if (salonStatusFilter !== "ALL") params.status = salonStatusFilter;

      const res = await api.get("/bookings/admin/salons-summary/", { params });
      if (Array.isArray(res.data)) {
        setSalons(res.data);
        // If a salon was selected, update its reference with newest aggregated numbers
        if (selectedSalon) {
          const fresh = res.data.find((s) => s.id === selectedSalon.id);
          if (fresh) setSelectedSalon(fresh);
        }
      }
    } catch (err) {
      console.error("Error fetching salons summary:", err);
    } finally {
      setSalonsLoading(false);
    }
  }, [salonSearch, salonStatusFilter, selectedSalon?.id]);

  // 3. Fetch Bookings History
  const fetchBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const params = {
        page: currentPage,
        page_size: pageSize,
        sort_by: sortBy,
      };
      if (selectedSalon?.id) params.salon_id = selectedSalon.id;
      if (statusFilter !== "ALL") params.status = statusFilter;
      if (paymentStatusFilter !== "ALL") params.payment_status = paymentStatusFilter;
      if (dateRangeFilter !== "all") params.date_range = dateRangeFilter;
      if (bookingSearch.trim()) params.search = bookingSearch.trim();

      const res = await api.get("/bookings/admin/bookings/", { params });
      if (res.data) {
        setBookings(res.data.results || []);
        setTotalBookingsCount(res.data.count || 0);
        setTotalPages(res.data.total_pages || 1);
      }
    } catch (err) {
      console.error("Error fetching admin bookings history:", err);
    } finally {
      setBookingsLoading(false);
    }
  }, [
    currentPage,
    pageSize,
    selectedSalon?.id,
    statusFilter,
    paymentStatusFilter,
    dateRangeFilter,
    sortBy,
    bookingSearch,
  ]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchSalonsSummary();
  }, [fetchSalonsSummary]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Select Salon Handler
  const handleSelectSalon = (salon) => {
    if (selectedSalon?.id === salon.id) {
      setSelectedSalon(null);
    } else {
      setSelectedSalon(salon);
    }
    setCurrentPage(1);
  };

  const handleClearSelection = () => {
    setSelectedSalon(null);
    setCurrentPage(1);
  };

  // Helper formatting
  const formatINR = (val) => {
    const num = Number(val || 0);
    return `₹${num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  const getStatusClass = (st) => {
    switch (st) {
      case "COMPLETED": return "completed";
      case "CONFIRMED": return "confirmed";
      case "IN_PROGRESS": return "in_progress";
      case "CANCELLED": return "cancelled";
      case "PENDING": return "pending";
      default: return "no_show";
    }
  };

  const getPaymentClass = (pStatus) => {
    switch (pStatus) {
      case "PAID": return "paid";
      case "REFUNDED": return "refunded";
      case "FAILED": return "failed";
      default: return "pending";
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!bookings.length) {
      alert("No bookings available in the current view to export.");
      return;
    }

    const headers = [
      "Booking ID",
      "Salon Name",
      "Salon City",
      "Customer Name",
      "Customer Phone",
      "Customer Email",
      "Service",
      "Specialist",
      "Booking Date",
      "Time Slot",
      "Subtotal (₹)",
      "Discount (₹)",
      "Tax (₹)",
      "Total Amount (₹)",
      "Payment Method",
      "Payment Status",
      "Booking Status",
      "Razorpay Order ID",
      "Razorpay Payment ID",
      "Receipt Number",
      "Cancellation Reason",
      "Created At",
    ];

    const rows = bookings.map((b) => [
      `"${b.formatted_booking_id || `BK${b.id}`}"`,
      `"${(b.salon_name || "").replace(/"/g, '""')}"`,
      `"${(b.salon_city || "").replace(/"/g, '""')}"`,
      `"${(b.customer_name || b.client_name || "").replace(/"/g, '""')}"`,
      `"${b.customer_phone || b.client_phone || ""}"`,
      `"${b.customer_email || b.client_email || ""}"`,
      `"${(b.service_display_name || b.service_name || "").replace(/"/g, '""')}"`,
      `"${(b.worker_name || "").replace(/"/g, '""')}"`,
      `"${b.booking_date || ""}"`,
      `"${b.booking_time || ""}"`,
      `"${b.subtotal || "0.00"}"`,
      `"${b.discount_amount || "0.00"}"`,
      `"${b.tax_amount || "0.00"}"`,
      `"${b.total_amount || "0.00"}"`,
      `"${b.payment_method || ""}"`,
      `"${b.payment_status || ""}"`,
      `"${b.status || ""}"`,
      `"${b.razorpay_order_id || ""}"`,
      `"${b.razorpay_payment_id || ""}"`,
      `"${b.receipt_number || ""}"`,
      `"${(b.cancellation_details?.reason || "").replace(/"/g, '""')}"`,
      `"${b.created_at || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    const salonTag = selectedSalon ? selectedSalon.name.toLowerCase().replace(/[^a-z0-9]/g, "-") : "all-salons";
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `bookmysalon-bookings-${salonTag}-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Bookings report exported successfully!");
  };

  // Active details to show in the overview card (selected salon or entire platform)
  const activeMetrics = useMemo(() => {
    if (selectedSalon) {
      const total = selectedSalon.total_bookings || 0;
      const completed = selectedSalon.completed_bookings || 0;
      const cancelled = selectedSalon.cancelled_bookings || 0;
      const active = (selectedSalon.confirmed_bookings || 0) + (selectedSalon.in_progress_bookings || 0);
      const revenue = selectedSalon.total_revenue || "0.00";
      return {
        isSingleSalon: true,
        title: selectedSalon.name,
        city: selectedSalon.city || "Kerala",
        address: selectedSalon.address || "",
        phone: selectedSalon.phone || "",
        email: selectedSalon.email || "",
        ownerName: selectedSalon.owner_name || "Owner",
        ownerEmail: selectedSalon.owner_email || "",
        approvalStatus: selectedSalon.approval_status || "APPROVED",
        coverImage: selectedSalon.cover_image,
        totalBookings: total,
        completedBookings: completed,
        activeBookings: active,
        cancelledBookings: cancelled,
        totalRevenue: revenue,
        completedRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        cancelledRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
      };
    }

    const total = stats.total_bookings || 0;
    const completed = stats.completed_bookings || 0;
    const cancelled = stats.cancelled_bookings || 0;
    const active = (stats.confirmed_bookings || 0) + (stats.in_progress_bookings || 0);
    return {
      isSingleSalon: false,
      title: "Entire Platform (All Partner Salons)",
      city: "All Locations",
      address: "Platform Aggregate",
      phone: "",
      email: "",
      ownerName: "Platform Root Operator",
      ownerEmail: "admin@bookmysalon.com",
      approvalStatus: "ACTIVE",
      coverImage: null,
      totalBookings: total,
      completedBookings: completed,
      activeBookings: active,
      cancelledBookings: cancelled,
      totalRevenue: stats.total_revenue || "0.00",
      completedRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      cancelledRate: total > 0 ? Math.round((cancelled / total) * 100) : 0,
    };
  }, [selectedSalon, stats]);

  return (
    <div className="abm-page">
      <AdminSidebar bookingsCount={stats.total_bookings} />

      <main className="abm-main">
        {/* Header Bar */}
        <header className="abm-header">
          <nav className="abm-breadcrumb" aria-label="Breadcrumb">
            <Link to="/admin/dashboard">Dashboard</Link>
            <span className="abm-breadcrumb-separator">/</span>
            <span className="abm-breadcrumb-current">Booking Management & History</span>
          </nav>

          <div className="abm-header-row">
            <div className="abm-title-group">
              <h1>Booking Management & History</h1>
              <p>
                Platform-wide appointment monitoring, salon breakdown, payments audit, and cancellation tracking.
              </p>
            </div>

            <div className="abm-header-actions">
              {/* <button
                type="button"
                className="abm-btn-action export"
                onClick={handleExportCSV}
                title="Export current filtered view to CSV file"
              >
                📥 Export CSV
              </button> */}
              <button
                type="button"
                className="abm-btn-action refresh"
                onClick={() => {
                  fetchStats();
                  fetchSalonsSummary();
                  fetchBookings();
                  showToast("Bookings directory refreshed.");
                }}
              >
                🔄 Refresh
              </button>
              <NotificationBell />
            </div>
          </div>
        </header>

        {/* Global Platform Statistics Grid */}
        <section className="abm-stats-grid" aria-label="Platform Statistics Overview">
          <div className="abm-stat-card">
            <div className="abm-stat-icon total">📅</div>
            <div className="abm-stat-info">
              <span className="abm-stat-label">Total Bookings</span>
              <span className="abm-stat-val">{stats.total_bookings}</span>
              <span className="abm-stat-sub">Across {stats.salons_with_bookings} partner salons</span>
            </div>
          </div>

          <div className="abm-stat-card">
            <div className="abm-stat-icon completed">✅</div>
            <div className="abm-stat-info">
              <span className="abm-stat-label">Completed</span>
              <span className="abm-stat-val">{stats.completed_bookings}</span>
              <span className="abm-stat-sub">
                {stats.total_bookings > 0
                  ? `${Math.round((stats.completed_bookings / stats.total_bookings) * 100)}% completion rate`
                  : "0% completed"}
              </span>
            </div>
          </div>

          <div className="abm-stat-card">
            <div className="abm-stat-icon active">⚡</div>
            <div className="abm-stat-info">
              <span className="abm-stat-label">Active / Confirmed</span>
              <span className="abm-stat-val">
                {stats.confirmed_bookings + stats.in_progress_bookings}
              </span>
              <span className="abm-stat-sub">{stats.in_progress_bookings} in progress right now</span>
            </div>
          </div>

          <div className="abm-stat-card">
            <div className="abm-stat-icon cancelled">❌</div>
            <div className="abm-stat-info">
              <span className="abm-stat-label">Cancelled</span>
              <span className="abm-stat-val">{stats.cancelled_bookings}</span>
              <span className="abm-stat-sub">
                {stats.total_bookings > 0
                  ? `${Math.round((stats.cancelled_bookings / stats.total_bookings) * 100)}% cancellation rate`
                  : "0% cancelled"}
              </span>
            </div>
          </div>

          <div className="abm-stat-card">
            <div className="abm-stat-icon revenue">💰</div>
            <div className="abm-stat-info">
              <span className="abm-stat-label">Gross Revenue</span>
              <span className="abm-stat-val">{formatINR(stats.total_revenue)}</span>
              <span className="abm-stat-sub">{stats.today_bookings} scheduled today</span>
            </div>
          </div>
        </section>

        {/* MAIN TWO-COLUMN WORKSPACE (Modeled directly after Review Page) */}
        <div className="abm-workspace">
          {/* Left Column: Registered Salons List */}
          <aside className="abm-salons-panel" aria-label="Registered Salons Directory">
            <div className="abm-panel-header">
              <h2>Registered Salons</h2>
              <span className="abm-panel-badge">{salons.length} Salons</span>
            </div>

            {/* Salon Search Bar */}
            <div className="abm-salon-search-wrap">
              <span className="abm-search-icon">🔍</span>
              <input
                type="text"
                className="abm-salon-search-input"
                placeholder="Filter salons by name or city..."
                value={salonSearch}
                onChange={(e) => setSalonSearch(e.target.value)}
              />
            </div>

            {/* Status Filter Chips */}
            <div className="abm-salon-filter-chips">
              {["ALL", "APPROVED", "PENDING", "BLOCKED"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`abm-chip ${salonStatusFilter === st ? "active" : ""}`}
                  onClick={() => setSalonStatusFilter(st)}
                >
                  {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            {/* All Salons Platform View Button */}
            <button
              type="button"
              className={`abm-all-salons-btn ${selectedSalon === null ? "active" : ""}`}
              onClick={handleClearSelection}
            >
              <div className="abm-all-salons-info">
                <span style={{ fontSize: "16px" }}>🌐</span>
                <span>Entire Platform (All Salons)</span>
              </div>
              <span className="abm-panel-badge">{stats.total_bookings}</span>
            </button>

            {/* Salons Cards List */}
            <div className="abm-salons-list">
              {salonsLoading ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#6a8875", fontSize: "12.5px" }}>
                  Loading partner salons...
                </div>
              ) : salons.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#6a8875", fontSize: "12.5px" }}>
                  No salons found matching &quot;{salonSearch}&quot;
                </div>
              ) : (
                salons.map((s) => {
                  const isSelected = selectedSalon?.id === s.id;
                  const statusClass = s.approval_status?.toLowerCase() || "approved";

                  return (
                    <div
                      key={s.id}
                      className={`abm-salon-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectSalon(s)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") handleSelectSalon(s);
                      }}
                    >
                      <div className="abm-salon-thumb">
                        {s.cover_image ? (
                          <img
                            src={resolveImageUrl(s.cover_image)}
                            alt={s.name}
                            className="abm-salon-thumb-img"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <span>🏪</span>
                        )}
                      </div>

                      <div className="abm-salon-meta">
                        <div className="abm-salon-meta-header">
                          <span className="abm-salon-name" title={s.name}>
                            {s.name}
                          </span>
                          <span className={`abm-status-pill ${statusClass}`}>
                            {s.approval_status}
                          </span>
                        </div>

                        <div className="abm-salon-location">
                          📍 {s.city || "Venue"} • {s.owner_name || "Owner"}
                        </div>

                        <div className="abm-salon-badges-row">
                          <span className="abm-badge-pill total" title="Total Bookings">
                            📅 {s.total_bookings}
                          </span>
                          <span className="abm-badge-pill completed" title="Completed Bookings">
                            ✓ {s.completed_bookings}
                          </span>
                          <span className="abm-badge-pill cancelled" title="Cancelled Bookings">
                            ✕ {s.cancelled_bookings}
                          </span>
                          <span className="abm-badge-pill revenue" title="Total Revenue">
                            {formatINR(s.total_revenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Right Column: Selected Salon Complete Details + Booking History */}
          <section className="abm-history-desk" aria-label="Selected Salon Details and Booking History">
            {/* 1. Complete Details & Metrics Overview Banner for Selected Salon */}
            <div className="abm-salon-details-card">
              <div className="abm-details-card-header">
                <div className="abm-details-header-left">
                  <div className="abm-details-venue-avatar">
                    {activeMetrics.coverImage ? (
                      <img
                        src={resolveImageUrl(activeMetrics.coverImage)}
                        alt={activeMetrics.title}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    ) : (
                      <span>{activeMetrics.isSingleSalon ? "🏪" : "🌐"}</span>
                    )}
                  </div>

                  <div className="abm-details-venue-info">
                    <h2>{activeMetrics.title}</h2>
                    <p>
                      <span>📍 {activeMetrics.city}</span>
                      {activeMetrics.address && <span>• {activeMetrics.address}</span>}
                      {activeMetrics.phone && <span>• 📞 {activeMetrics.phone}</span>}
                      <span>• 👤 Owner: {activeMetrics.ownerName}</span>
                    </p>
                  </div>
                </div>

                {activeMetrics.isSingleSalon && (
                  <button
                    type="button"
                    className="btn-reset-selection"
                    onClick={handleClearSelection}
                    title="Reset to view all salons platform-wide"
                  >
                    ✕ View All Salons
                  </button>
                )}
              </div>

              {/* Complete Metrics Breakdown (Total Booking, Completed, Active, Cancelled, Total Amount) */}
              <div className="abm-venue-metrics-grid">
                <div className="abm-venue-metric-box total">
                  <span className="abm-metric-box-label">Total Bookings</span>
                  <span className="abm-metric-box-val">{activeMetrics.totalBookings}</span>
                  <span className="abm-metric-box-sub">Lifetime appointments</span>
                </div>

                <div className="abm-venue-metric-box completed">
                  <span className="abm-metric-box-label">Completed</span>
                  <span className="abm-metric-box-val" style={{ color: "#16a34a" }}>
                    {activeMetrics.completedBookings}
                  </span>
                  <span className="abm-metric-box-sub">{activeMetrics.completedRate}% fulfillment</span>
                </div>

                <div className="abm-venue-metric-box active">
                  <span className="abm-metric-box-label">Active / Confirmed</span>
                  <span className="abm-metric-box-val" style={{ color: "#0284c7" }}>
                    {activeMetrics.activeBookings}
                  </span>
                  <span className="abm-metric-box-sub">Upcoming & in-progress</span>
                </div>

                <div className="abm-venue-metric-box cancelled">
                  <span className="abm-metric-box-label">Cancelled</span>
                  <span className="abm-metric-box-val" style={{ color: "#dc2626" }}>
                    {activeMetrics.cancelledBookings}
                  </span>
                  <span className="abm-metric-box-sub">{activeMetrics.cancelledRate}% cancellation</span>
                </div>

                <div className="abm-venue-metric-box revenue">
                  <span className="abm-metric-box-label">Total Amount</span>
                  <span className="abm-metric-box-val" style={{ color: "#b45309" }}>
                    {formatINR(activeMetrics.totalRevenue)}
                  </span>
                  <span className="abm-metric-box-sub">Settled booking volume</span>
                </div>
              </div>
            </div>

            {/* 2. Complete Booking History Ledger */}
            <div className="abm-history-panel">
              <div className="abm-history-toolbar">
                <div className="abm-toolbar-title">
                  <h3>
                    {activeMetrics.isSingleSalon
                      ? `${activeMetrics.title} — Booking History`
                      : "Platform Booking History"}
                  </h3>
                  <span className="abm-panel-badge">{totalBookingsCount} Records</span>
                </div>

                {/* Filters Toolbar */}
                <div className="abm-history-filters-wrap">
                  <div className="abm-salon-search-wrap" style={{ width: "220px", maxWidth: "100%" }}>
                    <span className="abm-search-icon">🔍</span>
                    <input
                      type="text"
                      className="abm-salon-search-input"
                      placeholder="Search ID, client, service..."
                      value={bookingSearch}
                      onChange={(e) => {
                        setBookingSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>

                  <select
                    className="abm-filter-select"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="abm-filter-select"
                    value={paymentStatusFilter}
                    onChange={(e) => {
                      setPaymentStatusFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="abm-filter-select"
                    value={dateRangeFilter}
                    onChange={(e) => {
                      setDateRangeFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    {DATE_RANGE_OPTIONS.map((opt) => (
                      <option key={opt.key} value={opt.key}>
                        {opt.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="abm-filter-select"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="amount_desc">Amount (High to Low)</option>
                    <option value="amount_asc">Amount (Low to High)</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="abm-table-wrap">
                <table className="abm-table" aria-label="Bookings History Ledger">
                  <thead>
                    <tr>
                      <th>Booking ID</th>
                      <th>Customer</th>
                      <th>Service</th>
                      <th>Specialist</th>
                      <th>Date & Slot</th>
                      <th>Amount</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookingsLoading ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "40px", color: "#6a8875" }}>
                          Loading appointment history...
                        </td>
                      </tr>
                    ) : bookings.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: "center", padding: "48px 20px", color: "#6a8875" }}>
                          <div style={{ fontSize: "2rem", marginBottom: "8px" }}>📋</div>
                          <strong>No booking records found</strong>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12.5px" }}>
                            Try adjusting your filters, date range, or search keyword.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      bookings.map((b) => {
                        const formattedId = b.formatted_booking_id || `BK${b.id}`;
                        return (
                          <tr key={b.id} onClick={() => setInspectBooking(b)}>
                            <td>
                              <span className="booking-id-tag">{formattedId}</span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <strong style={{ color: "#172a1d" }}>
                                  {b.customer_name || b.client_name || "Customer"}
                                </strong>
                                <span style={{ fontSize: "11px", color: "#6a8875" }}>
                                  {b.customer_phone || b.client_phone || b.customer_email || "Walk-in"}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span style={{ fontWeight: 600, color: "#173623" }}>
                                {b.service_display_name || b.service_name}
                              </span>
                            </td>
                            <td>
                              <span style={{ fontSize: "12px", color: "#4b6654" }}>
                                {b.worker_name || "Any Available"}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", fontSize: "12px" }}>
                                <strong style={{ color: "#173623" }}>{b.booking_date}</strong>
                                <span style={{ color: "#6a8875" }}>{b.booking_time}</span>
                              </div>
                            </td>
                            <td>
                              <strong style={{ color: "#173623", fontSize: "13.5px" }}>
                                {formatINR(b.total_amount)}
                              </strong>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <span className={`payment-pill ${getPaymentClass(b.payment_status)}`}>
                                  {b.payment_status || "PENDING"}
                                </span>
                                <span style={{ fontSize: "10.5px", color: "#7b9986" }}>
                                  {b.payment_method === "PAY_AT_SALON"
                                    ? "Pay at Salon"
                                    : b.payment_method === "ONLINE"
                                    ? "Online Payment"
                                    : b.payment_method === "WALLET"
                                    ? "Wallet"
                                    : b.payment_method}
                                </span>
                              </div>
                            </td>
                            <td>
                              <span className={`status-badge ${getStatusClass(b.status)}`}>
                                {b.status === "COMPLETED" && "✓ "}
                                {b.status === "CANCELLED" && "✕ "}
                                {b.status}
                              </span>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-inspect"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInspectBooking(b);
                                }}
                              >
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="abm-pagination">
                  <div className="abm-pagination-info">
                    Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> (
                    {totalBookingsCount} total bookings)
                  </div>

                  <div className="abm-pagination-controls">
                    <button
                      type="button"
                      className="btn-page"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, padding: "0 8px" }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="btn-page"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Inspect Booking Audit Modal (Read-Only) */}
        {inspectBooking && (
          <div className="abm-modal-overlay" onClick={() => setInspectBooking(null)}>
            <div className="abm-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="abm-modal-header">
                <div className="abm-modal-header-left">
                  <span className="booking-id-tag">
                    {inspectBooking.formatted_booking_id || `BK${inspectBooking.id}`}
                  </span>
                  <h3>{inspectBooking.salon_name}</h3>
                  <span className={`status-badge ${getStatusClass(inspectBooking.status)}`}>
                    {inspectBooking.status}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-modal-close"
                  onClick={() => setInspectBooking(null)}
                  title="Close Modal"
                >
                  ✕
                </button>
              </div>

              <div className="abm-modal-body">
                {/* Super Admin Read-Only Notice */}
                <div className="modal-readonly-notice">
                  <span>🛡️</span>
                  <span>
                    <strong>Super Admin Read-Only Audit Ledger:</strong> Monitoring booking, payments, and cancellations. No modifications are made to booking records from this view.
                  </span>
                </div>

                {/* Cancellation & Refund Alert (if cancelled) */}
                {inspectBooking.status === "CANCELLED" && (
                  <div className="cancellation-callout">
                    <h4>⚠️ Booking Cancelled</h4>
                    <p>
                      <strong>Reason:</strong> {inspectBooking.cancellation_details?.reason || "Cancelled by client/staff"}
                    </p>
                    {inspectBooking.refund_details?.is_refunded && (
                      <p style={{ marginTop: "6px" }}>
                        <strong>Refund Status:</strong> Full refund of {formatINR(inspectBooking.refund_details?.refund_amount)} processed.
                      </p>
                    )}
                  </div>
                )}

                {/* Section A: Customer & Venue */}
                <div className="modal-section-block">
                  <div className="modal-section-title">
                    <span>👤</span> Customer & Salon Venue
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-detail-item">
                      <span className="detail-label">Customer Name</span>
                      <span className="detail-value">
                        {inspectBooking.customer_name || inspectBooking.client_name || "Client"}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Contact Phone</span>
                      <span className="detail-value">
                        {inspectBooking.customer_phone || inspectBooking.client_phone || "Not provided"}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Email Address</span>
                      <span className="detail-value">
                        {inspectBooking.customer_email || inspectBooking.client_email || "Not provided"}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Salon Partner</span>
                      <span className="detail-value">{inspectBooking.salon_name}</span>
                      <span style={{ fontSize: "11px", color: "#6a8875" }}>
                        {inspectBooking.salon_city} • Owner: {inspectBooking.salon_owner_name || "Partner"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section B: Appointment Schedule */}
                <div className="modal-section-block">
                  <div className="modal-section-title">
                    <span>⏰</span> Appointment Schedule
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-detail-item">
                      <span className="detail-label">Booking Date</span>
                      <span className="detail-value">{inspectBooking.booking_date}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Time Slot</span>
                      <span className="detail-value">{inspectBooking.booking_time}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Assigned Specialist</span>
                      <span className="detail-value">
                        {inspectBooking.worker_name || "Any Available Specialist"}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Duration & Station</span>
                      <span className="detail-value">
                        {inspectBooking.duration || "45 mins"} ({inspectBooking.station || "Station 01"})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section C: Services Selected */}
                <div className="modal-section-block">
                  <div className="modal-section-title">
                    <span>✂️</span> Services Ordered ({inspectBooking.services_detail?.length || 1})
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {Array.isArray(inspectBooking.services_detail) && inspectBooking.services_detail.length > 0 ? (
                      inspectBooking.services_detail.map((s, idx) => (
                        <div
                          key={s.id || idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 12px",
                            background: "#f0f5f2",
                            borderRadius: "8px",
                            fontSize: "13px",
                          }}
                        >
                          <div>
                            <strong>{s.name}</strong>
                            {s.category && (
                              <span style={{ fontSize: "11.5px", color: "#6a8875", marginLeft: "8px" }}>
                                ({s.category})
                              </span>
                            )}
                          </div>
                          <div style={{ fontWeight: 700, color: "#173623" }}>
                            {formatINR(s.price)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          background: "#f0f5f2",
                          borderRadius: "8px",
                        }}
                      >
                        <strong>{inspectBooking.service_name}</strong>
                        <strong style={{ color: "#173623" }}>{formatINR(inspectBooking.service_price)}</strong>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section D: Financial & Payment Audit */}
                <div className="modal-section-block">
                  <div className="modal-section-title">
                    <span>💳</span> Financial & Payment Ledger
                  </div>
                  <div className="modal-grid-2">
                    <div className="modal-detail-item">
                      <span className="detail-label">Subtotal</span>
                      <span className="detail-value">{formatINR(inspectBooking.subtotal || inspectBooking.service_price)}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Tax (GST & Hygiene)</span>
                      <span className="detail-value">{formatINR(inspectBooking.tax_amount)}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Discount / Promo Applied</span>
                      <span className="detail-value" style={{ color: Number(inspectBooking.discount_amount) > 0 ? "#15803d" : "#173623" }}>
                        -{formatINR(inspectBooking.discount_amount)}
                        {inspectBooking.applied_offer_title && ` (${inspectBooking.applied_offer_title})`}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Final Payable Total</span>
                      <span className="detail-value" style={{ fontSize: "16px", color: "#15803d" }}>
                        {formatINR(inspectBooking.total_amount)}
                      </span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Payment Method</span>
                      <span className="detail-value">{inspectBooking.payment_method}</span>
                    </div>

                    <div className="modal-detail-item">
                      <span className="detail-label">Payment Status</span>
                      <span className={`payment-pill ${getPaymentClass(inspectBooking.payment_status)}`}>
                        {inspectBooking.payment_status}
                      </span>
                    </div>

                    {inspectBooking.razorpay_order_id && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Razorpay Order ID</span>
                        <div className="copyable-row">
                          <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                            {inspectBooking.razorpay_order_id}
                          </span>
                          <button
                            type="button"
                            className="btn-copy-chip"
                            onClick={() => handleCopy(inspectBooking.razorpay_order_id, "Order ID")}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {inspectBooking.razorpay_payment_id && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Razorpay Payment ID</span>
                        <div className="copyable-row">
                          <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                            {inspectBooking.razorpay_payment_id}
                          </span>
                          <button
                            type="button"
                            className="btn-copy-chip"
                            onClick={() => handleCopy(inspectBooking.razorpay_payment_id, "Payment ID")}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {inspectBooking.receipt_number && (
                      <div className="modal-detail-item">
                        <span className="detail-label">Tax Invoice / Receipt No.</span>
                        <div className="copyable-row">
                          <span className="detail-value" style={{ fontFamily: "monospace", fontSize: "12px", color: "#15803d" }}>
                            {inspectBooking.receipt_number}
                          </span>
                          <button
                            type="button"
                            className="btn-copy-chip"
                            onClick={() => handleCopy(inspectBooking.receipt_number, "Receipt Number")}
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section E: Notes & Remarks */}
                {(inspectBooking.notes || inspectBooking.worker_remarks) && (
                  <div className="modal-section-block">
                    <div className="modal-section-title">
                      <span>📝</span> Notes & Remarks
                    </div>
                    {inspectBooking.notes && (
                      <p style={{ margin: "0 0 8px 0", fontSize: "13px" }}>
                        <strong>Customer Notes:</strong> {inspectBooking.notes}
                      </p>
                    )}
                    {inspectBooking.worker_remarks && (
                      <p style={{ margin: 0, fontSize: "13px" }}>
                        <strong>Specialist Remarks:</strong> {inspectBooking.worker_remarks}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="abm-modal-footer">
                <button
                  type="button"
                  className="abm-btn-action refresh"
                  onClick={() => setInspectBooking(null)}
                >
                  Close Audit View
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="abm-toast-notice">
            <span>✓</span> {toastMessage}
          </div>
        )}
      </main>
    </div>
  );
}

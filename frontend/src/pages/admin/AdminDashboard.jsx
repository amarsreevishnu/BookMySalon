import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { resolveImageUrl } from "../../utils/imageUtils";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import "../../styles/adminDashboard.css";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const searchInputRef = useRef(null);

  // Live Stats State
  const [stats, setStats] = useState({
    registered_users: 0,
    active_salons: 0,
    pending_salons: 0,
    rejected_salons: 0,
    total_salons: 0,
  });

  const [bookingStats, setBookingStats] = useState({
    total_bookings: 0,
    completed_bookings: 0,
    confirmed_bookings: 0,
    in_progress_bookings: 0,
    cancelled_bookings: 0,
    pending_bookings: 0,
    total_revenue: "0.00",
    today_bookings: 0,
  });

  const [serviceStats, setServiceStats] = useState({
    totalCategories: 0,
    totalServices: 0,
    totalOfferings: 0,
  });

  const [reviewStats, setReviewStats] = useState({
    totalReviews: 0,
    avgRating: 0,
    fiveStars: 0,
    visibleReviews: 0,
  });

  const [supportStats, setSupportStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    urgentTickets: 0,
  });

  const [subscriptionStats, setSubscriptionStats] = useState({
    wallet_balance: "0.00",
    total_revenue: "0.00",
    active_trials_count: 0,
    active_paid_count: 0,
    expiring_soon_count: 0,
    expired_count: 0,
  });

  const [offerStats, setOfferStats] = useState({
    total_offers: 0,
    active_offers: 0,
    hidden_offers: 0,
  });

  // Salons Queue Data & Filters
  const [salons, setSalons] = useState([]);
  const [loadingSalons, setLoadingSalons] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING"); // ALL, PENDING, APPROVED, REJECTED
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, name_asc, city_asc

  // Modal / Action State
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [modalTab, setModalTab] = useState("overview"); // overview, schedule, services, compliance
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [hoveredMonth, setHoveredMonth] = useState(null);

  // Global keyboard shortcut ('/' to focus search)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch Real Stats & Salons from Backend
  const fetchDashboardData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const [
        statsRes,
        salonsRes,
        servicesRes,
        reviewsRes,
        supportRes,
        subsRes,
        bookingsRes,
        offersRes,
      ] = await Promise.allSettled([
        api.get("/salons/admin/stats/", config),
        api.get("/salons/admin/salons/?status=all", config),
        api.get("/services/admin/stats/", config),
        api.get("/reviews/admin/stats/", config),
        api.get("/support/admin/stats/", config),
        api.get("/subscriptions/admin/stats/", config),
        api.get("/bookings/admin/stats/", config),
        api.get("/offers/admin/stats/", config),
      ]);

      if (statsRes.status === "fulfilled" && statsRes.value?.data) {
        setStats((prev) => ({ ...prev, ...statsRes.value.data }));
      }

      if (salonsRes.status === "fulfilled" && salonsRes.value?.data) {
        setSalons(salonsRes.value.data);
      }

      if (bookingsRes.status === "fulfilled" && bookingsRes.value?.data) {
        setBookingStats((prev) => ({ ...prev, ...bookingsRes.value.data }));
      }

      if (servicesRes.status === "fulfilled" && servicesRes.value?.data) {
        const sData = servicesRes.value.data;
        setServiceStats({
          totalCategories: sData.categories?.total || 0,
          totalServices: sData.services?.total || 0,
          totalOfferings: sData.salon_offerings?.total || 0,
        });
      }

      if (reviewsRes.status === "fulfilled" && reviewsRes.value?.data) {
        const rData = reviewsRes.value.data;
        setReviewStats({
          totalReviews: rData.total_reviews || 0,
          avgRating: rData.average_platform_rating || 0,
          fiveStars: rData.five_star_reviews || 0,
          visibleReviews: rData.visible_reviews || 0,
        });
      }

      if (supportRes.status === "fulfilled" && supportRes.value?.data) {
        const supData = supportRes.value.data;
        setSupportStats({
          totalTickets: supData.total_tickets || 0,
          openTickets: supData.open_tickets || 0,
          urgentTickets: supData.urgent_tickets || 0,
        });
      }

      if (subsRes.status === "fulfilled" && subsRes.value?.data) {
        setSubscriptionStats(subsRes.value.data);
      }

      if (offersRes.status === "fulfilled" && offersRes.value?.data) {
        const oData = offersRes.value.data;
        setOfferStats({
          total_offers: oData.total_offers || 0,
          active_offers: oData.active_offers || 0,
          hidden_offers: oData.hidden_offers || 0,
        });
      }

      const now = new Date();
      setLastUpdated(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );

      if (isManualRefresh) {
        setToastMessage("✓ Platform metrics refreshed successfully.");
      }
    } catch (err) {
      console.error("Failed to load admin dashboard data:", err);
      if (err.response?.status === 401) {
        setToastMessage("Session expired. Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
      }
    } finally {
      setLoadingSalons(false);
      setIsRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Extract unique categories & cities for interactive filter dropdowns
  const availableCategories = useMemo(() => {
    const set = new Set();
    salons.forEach((s) => {
      if (s.category) set.add(s.category.trim());
    });
    return Array.from(set).sort();
  }, [salons]);

  const availableCities = useMemo(() => {
    const set = new Set();
    salons.forEach((s) => {
      if (s.city) set.add(s.city.trim());
    });
    return Array.from(set).sort();
  }, [salons]);

  // Filter & sort salons based on tab, search, category, city, and sort order
  const filteredSalons = useMemo(() => {
    let result = salons.filter((s) => {
      const matchesTab =
        activeTab === "ALL" ||
        s.approval_status?.toUpperCase() === activeTab.toUpperCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.category?.toLowerCase().includes(q);

      const matchesCategory =
        !selectedCategory ||
        s.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesCity =
        !selectedCity ||
        s.city?.toLowerCase() === selectedCity.toLowerCase();

      return matchesTab && matchesSearch && matchesCategory && matchesCity;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === "name_asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "city_asc") {
        return (a.city || "").localeCompare(b.city || "");
      }
      return 0;
    });

    return result;
  }, [salons, activeTab, searchQuery, selectedCategory, selectedCity, sortBy]);

  const pendingCount = useMemo(
    () => salons.filter((s) => s.approval_status === "PENDING").length,
    [salons]
  );
  const approvedCount = useMemo(
    () => salons.filter((s) => s.approval_status === "APPROVED").length,
    [salons]
  );
  const rejectedCount = useMemo(
    () => salons.filter((s) => s.approval_status === "REJECTED").length,
    [salons]
  );

  // Dynamic regional hubs computed from real salon directory
  const regionalHubs = useMemo(() => {
    if (!salons || salons.length === 0) return [];
    const counts = {};
    salons.forEach((s) => {
      const city = s.city?.trim() || "Unspecified";
      counts[city] = (counts[city] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([city, count]) => ({
        city,
        count: `${count} Salon${count > 1 ? "s" : ""}`,
        share: `${((count / salons.length) * 100).toFixed(1)}%`,
        shareNum: Math.round((count / salons.length) * 100),
        rawCount: count,
      }))
      .sort((a, b) => b.rawCount - a.rawCount)
      .slice(0, 5);
  }, [salons]);

  // Dynamic monthly registration growth from real salon dates
  const monthlySalonGrowth = useMemo(() => {
    if (!salons || salons.length === 0) return [];
    const monthsMap = {};
    const sorted = [...salons]
      .filter((s) => s.created_at)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    sorted.forEach((s) => {
      const d = new Date(s.created_at);
      const key = d.toLocaleString("default", { month: "short", year: "2-digit" });
      monthsMap[key] = (monthsMap[key] || 0) + 1;
    });

    const entries = Object.entries(monthsMap);
    if (entries.length === 0) return [];
    const maxVal = Math.max(...entries.map(([, v]) => v), 1);
    return entries.map(([month, count]) => ({
      month,
      count,
      heightPct: Math.max(Math.round((count / maxVal) * 100), 16),
      pctOfTotal: Math.round((count / salons.length) * 100),
    }));
  }, [salons]);

  // Handle clicking a regional hub to filter the approvals table
  const handleHubClick = (city) => {
    setSelectedCity(city);
    setActiveTab("ALL");
    const queue = document.getElementById("approvals-queue");
    if (queue) queue.scrollIntoView({ behavior: "smooth" });
    setToastMessage(`Filtered salon directory by city: ${city}`);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setSelectedCity("");
    setActiveTab("ALL");
  };

  // Handle Salon Decision (Approve or Reject)
  const handleDecision = async (salonId, status, notes = "") => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const payload = {
        approval_status: status,
        admin_notes: notes,
      };

      const res = await api.post(`/salons/admin/${salonId}/decision/`, payload, config);

      if (res.status === 200) {
        const updatedSalon = res.data.salon;
        setSalons((prev) =>
          prev.map((s) => (s.id === salonId ? { ...s, ...updatedSalon } : s))
        );

        if (status === "APPROVED") {
          const passNotice = res.data.temp_password
            ? `Credentials generated and emailed to ${updatedSalon.email}.`
            : `Notification sent to ${updatedSalon.email}.`;
          setToastMessage(`✓ ${updatedSalon.name} APPROVED! ${passNotice}`);
        } else {
          setToastMessage(`✕ ${updatedSalon.name} REJECTED. Notice emailed.`);
        }

        setSelectedSalon(null);
        setShowRejectInput(false);
        setRejectionReason("");
        setModalTab("overview");

        fetchDashboardData();
      }
    } catch (err) {
      alert("Failed to update salon status: " + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // Export Salon Directory to CSV
  const handleExportData = () => {
    if (!salons || salons.length === 0) {
      alert("No salon records available to export.");
      return;
    }

    const headers = [
      "ID",
      "Salon Name",
      "Category",
      "City",
      "State",
      "Email",
      "Phone",
      "Approval Status",
      "Registered Date",
    ];

    const rows = salons.map((s) => [
      s.id,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${(s.category || "").replace(/"/g, '""')}"`,
      `"${(s.city || "").replace(/"/g, '""')}"`,
      `"${(s.state || "").replace(/"/g, '""')}"`,
      `"${(s.email || "").replace(/"/g, '""')}"`,
      `"${(s.phone || "").replace(/"/g, '""')}"`,
      s.approval_status || "PENDING",
      s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `BookMySalon_Directory_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setToastMessage("✓ Exported salon directory to CSV successfully.");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const hasActiveFilters = Boolean(
    searchQuery || selectedCategory || selectedCity || activeTab !== "PENDING"
  );

  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#153822",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
            zIndex: 9999,
            fontSize: "13px",
            fontWeight: "500",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontSize: "14px",
              cursor: "pointer",
              padding: "2px 6px",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <AdminSidebar
        pendingCount={pendingCount}
        salonsCount={salons.length || stats.total_salons}
        usersCount={stats.registered_users}
        bookingsCount={bookingStats.total_bookings}
        activeTab={activeTab}
        onSelectPendingTab={() => {
          setActiveTab("PENDING");
          setSelectedCity("");
          setSelectedCategory("");
          const queue = document.getElementById("approvals-queue");
          if (queue) queue.scrollIntoView({ behavior: "smooth" });
        }}
        onLogout={handleLogout}
      />

      {/* Main Workspace */}
      <main className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="admin-search-wrap">
            <span className="admin-search-icon">🔍</span>
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across salons, owners, locations, categories... (Press '/' to focus)"
              className="admin-search-input"
            />
            {searchQuery ? (
              <button
                type="button"
                className="admin-search-clear-btn"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                ✕
              </button>
            ) : (
              <span className="admin-search-shortcut">/</span>
            )}
          </div>

          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              title={lastUpdated ? `Last updated at ${lastUpdated}` : "Refresh live data"}
            >
              <span className={`admin-refresh-icon ${isRefreshing ? "spinning" : ""}`}>
                🔄
              </span>
              <span>{isRefreshing ? "Refreshing..." : "Refresh Live Data"}</span>
            </button>

            <div className="admin-live-pill">
              <span className="admin-system-dot" />
              <span className="admin-region-text">All Systems Operational</span>
            </div>

            <NotificationBell />
          </div>
        </header>

        {/* Page Body Content */}
        <div className="admin-content-container">
          {/* Title Row */}
          <div className="admin-title-row">
            <div>
              <h1>Super Admin Command Center</h1>
              <p>
                Real-time salon operations, booking oversight, platform wallet, compliance audit, and credentials dispatch.
              </p>
            </div>

            <div className="admin-header-buttons">
              {/* <button
                type="button"
                className="admin-export-btn"
                onClick={handleExportData}
                title="Export registered salon directory to CSV"
              >
                📥 Export Salons CSV
              </button> */}
            </div>
          </div>
          

          {/* Interactive KPI Metrics Grid (8 Modules) */}
          <div className="admin-metrics-grid">
            {/* Bookings Card */}
            <Link to="/admin/bookings" className="admin-metric-card" title="Click to open Bookings Management">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Total Bookings</span>
                <span className="admin-metric-icon">📅</span>
              </div>
              <div className="admin-metric-value">{bookingStats.total_bookings}</div>
              <div className="admin-metric-sub">
                <span>
                  <strong>+{bookingStats.today_bookings}</strong> today · ₹
                  {Number(bookingStats.total_revenue || 0).toLocaleString("en-IN")} vol
                </span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Salons Card */}
            <Link to="/admin/salons" className="admin-metric-card" title="Click to view Salons Directory">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Active Salons</span>
                <span className="admin-metric-icon">🏪</span>
              </div>
              <div className="admin-metric-value">
                {approvedCount || stats.active_salons}
              </div>
              <div className="admin-metric-sub">
                <span>
                  {salons.length} Total · <strong>{pendingCount} Pending</strong>
                </span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Users Card */}
            <Link to="/admin/users" className="admin-metric-card" title="Click to view Registered Users">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Registered Users</span>
                <span className="admin-metric-icon">👥</span>
              </div>
              <div className="admin-metric-value">{stats.registered_users}</div>
              <div className="admin-metric-sub">
                <span>Verified Customer Accounts</span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Platform Wallet & Subscriptions Card */}
            <Link
              to="/admin/subscriptions"
              className="admin-metric-card highlight"
              title="Click to view Platform Wallet & Subscriptions"
            >
              <div className="admin-metric-header">
                <span className="admin-metric-label">Platform Wallet</span>
                <span className="admin-metric-icon">💳</span>
              </div>
              <div className="admin-metric-value">
                ₹{Number(subscriptionStats.wallet_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <div className="admin-metric-sub">
                <span>
                  {subscriptionStats.active_trials_count} Trials · {subscriptionStats.active_paid_count} Paid
                </span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Catalog Services Card */}
            <Link to="/admin/services" className="admin-metric-card" title="Click to manage Catalog Services">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Catalog Services</span>
                <span className="admin-metric-icon">✂️</span>
              </div>
              <div className="admin-metric-value">{serviceStats.totalServices}</div>
              <div className="admin-metric-sub">
                <span>Across {serviceStats.totalCategories} Categories</span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Customer Reviews Card */}
            <Link to="/admin/reviews" className="admin-metric-card" title="Click to inspect Customer Reviews">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Customer Reviews</span>
                <span className="admin-metric-icon">⭐</span>
              </div>
              <div className="admin-metric-value">{reviewStats.totalReviews}</div>
              <div className="admin-metric-sub">
                <span>
                  {reviewStats.avgRating ? `${reviewStats.avgRating} ★ Platform Rating` : "Verified Feedback"}
                </span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Offers & Deals Card */}
            <Link to="/admin/offers" className="admin-metric-card" title="Click to manage Platform Offers">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Platform Offers</span>
                <span className="admin-metric-icon">🏷️</span>
              </div>
              <div className="admin-metric-value">{offerStats.total_offers}</div>
              <div className="admin-metric-sub">
                <span>{offerStats.active_offers} Active Deals Listed</span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>

            {/* Support Helpdesk Card */}
            <Link to="/admin/support" className="admin-metric-card" title="Click to open Support Helpdesk">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Support Helpdesk</span>
                <span className="admin-metric-icon">🎧</span>
              </div>
              <div className="admin-metric-value">{supportStats.totalTickets}</div>
              <div className="admin-metric-sub">
                <span>
                  {supportStats.urgentTickets > 0 ? (
                    <strong style={{ color: "#dc2626" }}>
                      {supportStats.urgentTickets} Urgent · {supportStats.openTickets} Open
                    </strong>
                  ) : (
                    `${supportStats.openTickets} Open Tickets`
                  )}
                </span>
                <span className="admin-metric-arrow">→</span>
              </div>
            </Link>
          </div>

          {/* Priority Salon Approvals & Verification Queue */}
          <div className="admin-queue-card" id="approvals-queue">
            <div className="admin-queue-header">
              <div className="admin-queue-title-row">
                <div className="admin-queue-title-left">
                  <h2>Priority Salon Approvals & Verification Queue</h2>
                  {pendingCount > 0 && (
                    <span className="admin-queue-urgent-pill">
                      ⏳ {pendingCount} Awaiting Review
                    </span>
                  )}
                </div>

                <Link
                  to="/admin/salons"
                  className="admin-btn-view"
                  style={{ textDecoration: "none" }}
                >
                  Manage Full Directory →
                </Link>
              </div>

              <p className="admin-queue-desc">
                Review submitted salon dossiers, verify licensing compliance, inspect service menus, and dispatch platform credentials.
              </p>

             
              
            </div>

            {/* Active Filters Tag Strip */}
            {hasActiveFilters && (
              <div className="admin-active-filters-row">
                <span>Active Filters:</span>
                {activeTab !== "ALL" && (
                  <span className="admin-active-filter-tag">
                    Status: {activeTab}
                    <button type="button" onClick={() => setActiveTab("ALL")}>
                      ✕
                    </button>
                  </span>
                )}
                {selectedCategory && (
                  <span className="admin-active-filter-tag">
                    Category: {selectedCategory}
                    <button type="button" onClick={() => setSelectedCategory("")}>
                      ✕
                    </button>
                  </span>
                )}
                {selectedCity && (
                  <span className="admin-active-filter-tag">
                    City: {selectedCity}
                    <button type="button" onClick={() => setSelectedCity("")}>
                      ✕
                    </button>
                  </span>
                )}
                {searchQuery && (
                  <span className="admin-active-filter-tag">
                    Query: "{searchQuery}"
                    <button type="button" onClick={() => setSearchQuery("")}>
                      ✕
                    </button>
                  </span>
                )}
                <button
                  type="button"
                  className="admin-clear-filters-link"
                  onClick={handleClearFilters}
                >
                  Clear all filters
                </button>
              </div>
            )}

            {/* Salons Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Salon / Specialization</th>
                    <th>Owner / Contact</th>
                    <th>Compliance Status</th>
                    <th>Submission Date</th>
                    <th>Review & Decisions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSalons ? (
                    <tr>
                      <td colSpan={5} className="admin-empty-table">
                        <span className="admin-refresh-icon spinning" style={{ fontSize: "20px", display: "inline-block" }}>
                          🔄
                        </span>
                        <div style={{ marginTop: 8 }}>Loading salon verification queue...</div>
                      </td>
                    </tr>
                  ) : filteredSalons.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-empty-table">
                        <div style={{ fontSize: "24px", marginBottom: 6 }}>🔍</div>
                        <div style={{ fontWeight: 600, color: "#172a1e" }}>
                          No salons found matching the active filter criteria.
                        </div>
                        <div style={{ fontSize: "12px", color: "#6a7d71", marginTop: 4 }}>
                          Try clearing filters or switching to another status tab.
                        </div>
                        <button
                          type="button"
                          className="admin-btn-view"
                          onClick={handleClearFilters}
                          style={{ marginTop: 12 }}
                        >
                          Reset Filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredSalons.map((salon) => (
                      <tr key={salon.id}>
                        {/* Salon / Specialty */}
                        <td>
                          <div className="admin-salon-cell">
                            <div className="admin-salon-thumb">
                              <img
                                src={resolveImageUrl(
                                  salon.cover_image || (salon.images && salon.images[0])
                                )}
                                alt={salon.name}
                                onError={(e) => {
                                  e.target.src =
                                    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=150&q=80";
                                }}
                              />
                            </div>
                            <div className="admin-salon-details">
                              <span className="admin-salon-name">{salon.name}</span>
                              <span className="admin-salon-location">
                                📍 {salon.address ? `${salon.address.slice(0, 28)}... ` : ""}
                                <strong>{salon.city}</strong>
                              </span>
                              <span className="admin-category-tag">
                                {salon.category || "Hair & Styling"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Owner / Applicant */}
                        <td>
                          <div className="admin-owner-cell">
                            <span className="admin-owner-name">
                              {salon.owner_email || salon.email || "Applicant"}
                            </span>
                            <span className="admin-owner-email">{salon.email}</span>
                            <span className="admin-owner-phone">📞 {salon.phone || "Not provided"}</span>
                          </div>
                        </td>

                        {/* Compliance Status */}
                        <td>
                          {salon.approval_status === "APPROVED" ? (
                            <span className="admin-compliance-badge verified">
                              ✓ Verified & Active
                            </span>
                          ) : salon.approval_status === "REJECTED" ? (
                            <span className="admin-compliance-badge rejected">
                              ✕ Application Rejected
                            </span>
                          ) : (
                            <span className="admin-compliance-badge pending">
                              ⏳ Docs Awaiting Audit
                            </span>
                          )}
                        </td>

                        {/* Submitted Date */}
                        <td>
                          <div style={{ fontSize: "12px", color: "#3d5244", fontWeight: 600 }}>
                            {salon.created_at
                              ? new Date(salon.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Recent"}
                          </div>
                          <div style={{ fontSize: "11px", color: "#809487" }}>
                            {salon.created_at
                              ? new Date(salon.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Recent submission"}
                          </div>
                        </td>

                        {/* Action / Decision */}
                        <td>
                          <div className="admin-actions-group">
                            {salon.approval_status === "PENDING" ? (
                              <>
                                <button
                                  type="button"
                                  className="admin-btn-approve"
                                  onClick={() => {
                                    setSelectedSalon(salon);
                                    setModalTab("overview");
                                    setShowRejectInput(false);
                                  }}
                                  disabled={isProcessing}
                                  title="Inspect full application and decide"
                                >
                                  Review & Audit
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-reject"
                                  onClick={() => {
                                    setSelectedSalon(salon);
                                    setModalTab("compliance");
                                    setShowRejectInput(true);
                                  }}
                                  disabled={isProcessing}
                                  title="Reject application with notes"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="admin-btn-view"
                                onClick={() => {
                                  setSelectedSalon(salon);
                                  setModalTab("overview");
                                  setShowRejectInput(false);
                                }}
                              >
                                View Dossier
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Network Growth & Regional Hubs Grid */}
          <div className="admin-analytics-row">
            {/* Salon Network Growth Bar Chart */}
            <div className="admin-chart-card">
              <div className="admin-chart-header">
                <div>
                  <h3>Salon Network Growth</h3>
                  <span style={{ fontSize: "11px", color: "#74887b" }}>
                    Verified Salon Registrations by Onboarding Period
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px", alignItems: "center" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 10, height: 10, background: "#234d34", borderRadius: 2 }} />
                    Salons Onboarded
                  </span>
                </div>
              </div>

              {/* Chart Interactive Bars */}
              <div className="admin-chart-mock-bars">
                {monthlySalonGrowth.length > 0 ? (
                  monthlySalonGrowth.map((m) => (
                    <div
                      className="admin-chart-bar-group"
                      key={m.month}
                      onMouseEnter={() => setHoveredMonth(m)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    >
                      {hoveredMonth?.month === m.month && (
                        <div className="admin-chart-tooltip">
                          {m.month}: {m.count} Salon{m.count > 1 ? "s" : ""} ({m.pctOfTotal}% of total)
                        </div>
                      )}
                      <div className="admin-chart-bar-wrap">
                        <div
                          className="admin-chart-bar"
                          style={{ height: `${m.heightPct}%`, minHeight: "16px" }}
                        />
                      </div>
                      <span className="admin-chart-bar-label">{m.month}</span>
                    </div>
                  ))
                ) : (
                  <div style={{ fontSize: "12px", color: "#74887b", textAlign: "center", padding: "40px 0", width: "100%" }}>
                    No onboarding history recorded yet.
                  </div>
                )}
              </div>

              <div style={{ fontSize: "11px", color: "#54685b", display: "flex", alignItems: "center", gap: 6 }}>
                <span>💡</span>
                <span>
                  <strong>Network Footprint:</strong> {salons.length} registered salon{salons.length === 1 ? "" : "s"} onboarded across {regionalHubs.length} regional market{regionalHubs.length === 1 ? "" : "s"}.
                </span>
              </div>
            </div>

            {/* Regional Salon Hubs (Interactive click-to-filter) */}
            <div className="admin-hubs-card">
              <div>
                <h3>Regional Salon Hubs</h3>
                <div className="admin-hubs-subtitle">
                  Click any city to filter the approvals queue
                </div>

                <div>
                  {regionalHubs.length > 0 ? (
                    regionalHubs.map((hub) => (
                      <div
                        className="admin-hub-row"
                        key={hub.city}
                        onClick={() => handleHubClick(hub.city)}
                        title={`Click to filter queue by ${hub.city}`}
                      >
                        <div style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                          <div className="admin-hub-name">
                            <span>📍</span>
                            <span>{hub.city}</span>
                          </div>
                          <div className="admin-hub-bar-wrap">
                            <div
                              className="admin-hub-bar-fill"
                              style={{ width: `${hub.shareNum}%` }}
                            />
                          </div>
                        </div>
                        <div className="admin-hub-val">
                          <div>{hub.count}</div>
                          <div style={{ fontSize: "10px", color: "#7b8f82", fontWeight: 500 }}>
                            {hub.share}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ fontSize: "12px", color: "#7b8f82", padding: "20px 0", textAlign: "center" }}>
                      No regional salons registered yet.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid #edf2ee", fontSize: "11px", color: "#6a7d71" }}>
                <span>⚡ Tip: Click any city above to quickly isolate salons in that market.</span>
              </div>
            </div>
          </div>

          
        </div>
      </main>

      {/* Review & Approve / Reject Modal (Tabbed Dossier) */}
      {selectedSalon && (
        <div className="admin-modal-backdrop" onClick={(e) => {
          if (e.target.classList.contains("admin-modal-backdrop")) {
            setSelectedSalon(null);
            setShowRejectInput(false);
          }
        }}>
          <div className="admin-review-modal">
            {/* Modal Header */}
            <div className="admin-modal-header">
              <div>
                <h3>Salon Dossier Inspection</h3>
                <span style={{ fontSize: "11px", color: "#6a7d71" }}>
                  Venue #{selectedSalon.id} · {selectedSalon.name} · Submitted by {selectedSalon.email}
                </span>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => {
                  setSelectedSalon(null);
                  setShowRejectInput(false);
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Tab Navigation Bar */}
            <div className="admin-modal-tabs">
              <button
                type="button"
                className={`admin-modal-tab-btn ${modalTab === "overview" ? "active" : ""}`}
                onClick={() => setModalTab("overview")}
              >
                Overview & Venue
              </button>
              <button
                type="button"
                className={`admin-modal-tab-btn ${modalTab === "schedule" ? "active" : ""}`}
                onClick={() => setModalTab("schedule")}
              >
                Operating Hours
              </button>
              <button
                type="button"
                className={`admin-modal-tab-btn ${modalTab === "services" ? "active" : ""}`}
                onClick={() => setModalTab("services")}
              >
                Services Menu ({Array.isArray(selectedSalon.services) ? selectedSalon.services.length : 0})
              </button>
              <button
                type="button"
                className={`admin-modal-tab-btn ${modalTab === "compliance" ? "active" : ""}`}
                onClick={() => setModalTab("compliance")}
              >
                Compliance & Actions
              </button>
            </div>

            {/* Modal Body with Active Tab Content */}
            <div className="admin-modal-body">
              {/* TAB 1: OVERVIEW & VENUE */}
              {modalTab === "overview" && (
                <>
                  {/* Hero Cover */}
                  <div className="admin-modal-hero">
                    <img
                      src={resolveImageUrl(
                        selectedSalon.cover_image || (selectedSalon.images && selectedSalon.images[0])
                      )}
                      alt={selectedSalon.name}
                      onError={(e) => {
                        e.target.src =
                          "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";
                      }}
                    />
                    <span className="admin-modal-hero-badge">
                      Status: {selectedSalon.approval_status}
                    </span>
                  </div>

                  {/* Photo Gallery Strip */}
                  {Array.isArray(selectedSalon.images) && selectedSalon.images.length > 0 && (
                    <div>
                      <div className="admin-modal-info-label" style={{ marginBottom: 6 }}>
                        Photo Gallery ({selectedSalon.images.length} photos)
                      </div>
                      <div className="admin-gallery-strip">
                        {selectedSalon.images.map((imgUrl, idx) => (
                          <img
                            key={idx}
                            src={resolveImageUrl(imgUrl)}
                            alt={`Gallery photo ${idx + 1}`}
                            className="admin-gallery-thumb"
                            onClick={() => window.open(resolveImageUrl(imgUrl), "_blank")}
                            title="Click to view full photo in new tab"
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Core Information Cards */}
                  <div className="admin-modal-grid-2">
                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">Salon Title & Specialization</div>
                      <div className="admin-modal-info-value">{selectedSalon.name}</div>
                      <div style={{ fontSize: "11px", color: "#667a6e", marginTop: 4 }}>
                        Category: <strong>{selectedSalon.category || "General"}</strong>
                      </div>
                      <div style={{ fontSize: "11px", color: "#667a6e", marginTop: 2 }}>
                        Platform ID: <code>#{selectedSalon.id}</code>
                      </div>
                    </div>

                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">Contact & Owner Details</div>
                      <div className="admin-modal-info-value">📞 {selectedSalon.phone || "No phone"}</div>
                      <div style={{ fontSize: "11px", color: "#667a6e", marginTop: 4 }}>
                        ✉️ {selectedSalon.email}
                      </div>
                      <div style={{ fontSize: "11px", marginTop: 6 }}>
                        <strong>Owner Account:</strong>{" "}
                        {selectedSalon.owner ? (
                          <span style={{ color: "#065f46", fontWeight: "600" }}>
                            Linked (User ID #{selectedSalon.owner})
                          </span>
                        ) : (
                          <span style={{ color: "#b45309", fontWeight: "600" }}>
                            Pending Account Dispatch
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">Physical Address</div>
                      <div className="admin-modal-info-value">
                        {selectedSalon.address ? `${selectedSalon.address}, ` : ""}
                        <strong>{selectedSalon.city}</strong>
                      </div>
                      <div style={{ fontSize: "11px", color: "#667a6e", marginTop: 4 }}>
                        {selectedSalon.state ? `${selectedSalon.state}, ` : ""}PIN: {selectedSalon.pincode || "N/A"}
                      </div>
                    </div>

                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">GPS Geolocation & Map</div>
                      <div className="admin-modal-info-value">
                        {selectedSalon.latitude && selectedSalon.longitude
                          ? `${selectedSalon.latitude}° N, ${selectedSalon.longitude}° E`
                          : "Coordinates not specified"}
                      </div>
                      {selectedSalon.latitude && selectedSalon.longitude && (
                        <div style={{ marginTop: 6 }}>
                          <a
                            href={`https://maps.google.com/?q=${selectedSalon.latitude},${selectedSalon.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "#234d34", fontWeight: "700", fontSize: "11px", textDecoration: "underline" }}
                          >
                            📍 View on Google Maps ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedSalon.description && (
                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">About & Ambience</div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#364c3e", lineHeight: 1.6 }}>
                        {selectedSalon.description}
                      </p>
                    </div>
                  )}

                  {/* Amenities */}
                  {selectedSalon.amenities && selectedSalon.amenities.length > 0 && (
                    <div className="admin-modal-info-card">
                      <div className="admin-modal-info-label">
                        Configured Amenities ({selectedSalon.amenities.length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                        {selectedSalon.amenities.map((a, i) => (
                          <span
                            key={i}
                            style={{
                              fontSize: "11px",
                              background: "#eef6f0",
                              color: "#1e4d30",
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontWeight: "600",
                            }}
                          >
                            ✓ {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: OPERATING SCHEDULE */}
              {modalTab === "schedule" && (
                <div>
                  <div className="admin-modal-info-label" style={{ marginBottom: 10 }}>
                    Weekly Operating Schedule (Mon - Sun)
                  </div>
                  {selectedSalon.opening_hours?.days &&
                  Array.isArray(selectedSalon.opening_hours.days) &&
                  selectedSalon.opening_hours.days.length > 0 ? (
                    <div className="admin-schedule-grid">
                      {selectedSalon.opening_hours.days.map((day) => (
                        <div
                          key={day.day}
                          className={`admin-day-chip ${day.isOpen ? "open" : "closed"}`}
                        >
                          <div className="admin-day-name">{day.day.slice(0, 3)}</div>
                          <div className="admin-day-hours">
                            {day.isOpen
                              ? `${day.openTime || "09:00"} - ${day.closeTime || "20:00"}`
                              : "Closed"}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: "12px", color: "#61796b" }}>
                      No operating schedule configured. Default salon hours (09:00 AM - 09:00 PM) will apply.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 3: SERVICES & PRICING MENU */}
              {modalTab === "services" && (
                <div>
                  <div className="admin-modal-info-label" style={{ marginBottom: 10 }}>
                    Services & Pricing Menu ({Array.isArray(selectedSalon.services) ? selectedSalon.services.length : 0} configured)
                  </div>
                  {Array.isArray(selectedSalon.services) && selectedSalon.services.length > 0 ? (
                    <div className="admin-services-table-wrap">
                      <table className="admin-services-table">
                        <thead>
                          <tr>
                            <th>Service Name</th>
                            <th>Category</th>
                            <th>Duration</th>
                            <th style={{ textAlign: "right" }}>Price (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSalon.services.map((srv, idx) => (
                            <tr key={srv.id || idx}>
                              <td style={{ fontWeight: "600", color: "#172a1d" }}>{srv.name}</td>
                              <td style={{ color: "#546e5f" }}>{srv.category || selectedSalon.category}</td>
                              <td style={{ color: "#6c8577" }}>{srv.duration || "30 mins"}</td>
                              <td style={{ textAlign: "right" }}>
                                <span className="admin-service-price-pill">
                                  {String(srv.price).startsWith("₹") ? srv.price : `₹${srv.price}`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#728779", fontStyle: "italic", padding: "16px 0" }}>
                      No custom services configured yet. The salon owner will manage services after onboarding approval.
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: COMPLIANCE & DECISION */}
              {modalTab === "compliance" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Previous Admin Notes if present */}
                  {selectedSalon.admin_notes && (
                    <div className="admin-modal-notes-box">
                      <strong>Previous Admin Feedback / Notes:</strong> {selectedSalon.admin_notes}
                    </div>
                  )}

                  {/* Rejection input or credentials dispatch */}
                  {showRejectInput ? (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: 16 }}>
                      <div style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b", marginBottom: 6 }}>
                        Reason for Application Rejection (emailed directly to applicant):
                      </div>
                      <textarea
                        rows={3}
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g. Incomplete business address or trade license documents missing..."
                        style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "6px",
                          border: "1px solid #f87171",
                          fontSize: "12px",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ) : (
                    <div className="admin-modal-credentials-box">
                      <strong>Credentials Dispatch Protocol:</strong>
                      <div style={{ marginTop: 4 }}>
                        Upon clicking <strong>Confirm & Dispatch Credentials</strong>, an Owner account will be automatically provisioned for <strong>{selectedSalon.email}</strong>, a secure temporary password will be generated, and login instructions will be dispatched to their inbox.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="admin-modal-footer">
              <div style={{ fontSize: "11px", color: "#7a8e80" }}>
                {selectedSalon.updated_at
                  ? `Last updated: ${new Date(selectedSalon.updated_at).toLocaleString()}`
                  : `Salon ID #${selectedSalon.id}`}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  className="admin-btn-view"
                  onClick={() => {
                    setSelectedSalon(null);
                    setShowRejectInput(false);
                  }}
                >
                  Close
                </button>

                {showRejectInput ? (
                  <button
                    type="button"
                    className="admin-btn-reject"
                    style={{ background: "#b91c1c", color: "#ffffff", border: "none" }}
                    onClick={() => handleDecision(selectedSalon.id, "REJECTED", rejectionReason)}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Rejecting..." : "Confirm Rejection & Send Notice"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className="admin-btn-reject"
                      onClick={() => {
                        setShowRejectInput(true);
                        setModalTab("compliance");
                      }}
                      disabled={isProcessing}
                    >
                      Reject Application
                    </button>
                    <button
                      type="button"
                      className="admin-btn-approve"
                      onClick={() => handleDecision(selectedSalon.id, "APPROVED")}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : "✓ Confirm & Dispatch Credentials"}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

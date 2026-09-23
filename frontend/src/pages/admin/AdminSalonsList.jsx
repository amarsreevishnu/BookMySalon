import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { resolveImageUrl } from "../../utils/imageUtils";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "../../styles/adminSalonsList.css";

const CATEGORIES = [
  "All",
  "Hair & Styling",
  "Skin & Facial",
  "Nail Bar",
  "Spa & Massage",
  "Bridal Studio",
  "Men's Grooming",
  "Tattoo & Piercing",
  "Holistic Wellness",
];

const REJECTION_PRESETS = [
  "Incomplete or unclear street address details.",
  "Low-resolution or non-representative salon photos.",
  "Contact phone number could not be verified.",
  "Regulatory or salon trade licensing verification required.",
  "Duplicate salon profile already registered.",
];

export default function AdminSalonsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { logout } = useAuth();
  const searchInputRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const tabParam = searchParams.get("tab")?.toUpperCase();

  // State
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(
    tabParam && ["ALL", "PENDING", "APPROVED", "BLOCKED", "REJECTED"].includes(tabParam)
      ? tabParam
      : "ALL"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    if (tabParam && ["ALL", "PENDING", "APPROVED", "BLOCKED", "REJECTED"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);
  const [sortBy, setSortBy] = useState("newest"); // newest, oldest, name-asc, name-desc, city
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

  // Modals & Action States
  const [inspectingSalon, setInspectingSalon] = useState(null);
  const [rejectDialogSalon, setRejectDialogSalon] = useState(null);
  const [blockConfirmSalon, setBlockConfirmSalon] = useState(null);
  const [selectedPresetReason, setSelectedPresetReason] = useState("");
  const [customRejectReason, setCustomRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); 

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, categoryFilter, sortBy, pageSize]);

  // Keyboard shortcuts ('/' to search, 'Escape' to dismiss modals)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        if (blockConfirmSalon) {
          setBlockConfirmSalon(null);
        } else if (rejectDialogSalon) {
          setRejectDialogSalon(null);
        } else if (inspectingSalon) {
          setInspectingSalon(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [blockConfirmSalon, rejectDialogSalon, inspectingSalon]);

  // Fetch Salons from Backend
  const fetchSalons = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await api.get("/salons/admin/salons/?status=all", config);
      if (res.data) {
        setSalons(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error("Failed to fetch salons list:", err);
      if (err.response?.status === 401) {
        showToast("⚠️ Session expired or unauthorized. Redirecting to login...", 3000);
        setTimeout(() => navigate("/login"), 1500);
      } else {
        showToast("⚠️ Failed to load salons from server. Please refresh.", 4000);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalons();
  }, []);

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? "" : prev));
    }, duration);
  };

  // Status Counts
  const totalCount = salons.length;
  const pendingCount = salons.filter((s) => s.approval_status === "PENDING").length;
  const approvedCount = salons.filter((s) => s.approval_status === "APPROVED").length;
  const blockedCount = salons.filter((s) => s.approval_status === "BLOCKED").length;
  const rejectedCount = salons.filter((s) => s.approval_status === "REJECTED").length;

  // Filtered & Sorted Salons
  const filteredSalons = salons
    .filter((s) => {
      // Status tab filter
      if (activeTab !== "ALL" && s.approval_status?.toUpperCase() !== activeTab.toUpperCase()) {
        return false;
      }
      // Category filter
      if (categoryFilter !== "All" && s.category?.toLowerCase() !== categoryFilter.toLowerCase()) {
        return false;
      }
      // Search query
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matches =
          s.name?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.phone?.includes(q) ||
          s.category?.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      if (sortBy === "oldest") {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0);
      }
      if (sortBy === "name-asc") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (sortBy === "name-desc") {
        return (b.name || "").localeCompare(a.name || "");
      }
      if (sortBy === "city") {
        return (a.city || "").localeCompare(b.city || "");
      }
      return 0;
    });

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredSalons.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredSalons.length);
  const paginatedSalons = filteredSalons.slice(startIndex, endIndex);

  // Helper for generating page numbers with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validCurrentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (validCurrentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [
      1,
      "...",
      validCurrentPage - 1,
      validCurrentPage,
      validCurrentPage + 1,
      "...",
      totalPages,
    ];
  };

  // Reusable Pagination Bar Component
  const renderPaginationBar = () => {
    if (filteredSalons.length === 0) return null;
    return (
      <div className="asl-pagination-bar">
        <div className="asl-pagination-info">
          Showing <strong>{filteredSalons.length === 0 ? 0 : startIndex + 1}</strong> to{" "}
          <strong>{endIndex}</strong> of <strong>{filteredSalons.length}</strong> salons
        </div>

        <div className="asl-pagination-controls">
          <div className="asl-pagination-size-select">
            <label htmlFor="salon-page-size">Per page:</label>
            <select
              id="salon-page-size"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="asl-select-compact"
            >
              <option value={6}>6</option>
              <option value={8}>8</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="asl-pagination-buttons">
            <button
              type="button"
              className="asl-pagination-btn"
              disabled={validCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              aria-label="Previous Page"
            >
              ‹ Prev
            </button>

            {getPageNumbers().map((pageNum, idx) => {
              if (pageNum === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="asl-pagination-ellipsis">
                    …
                  </span>
                );
              }
              return (
                <button
                  key={pageNum}
                  type="button"
                  className={`asl-pagination-btn ${
                    pageNum === validCurrentPage ? "active" : ""
                  }`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              type="button"
              className="asl-pagination-btn"
              disabled={validCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              aria-label="Next Page"
            >
              Next ›
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Handle Salon Decision (Approve / Reject / Block / Pending)
  const handleDecision = async (salonId, targetStatus, adminNotes = "") => {
    setIsProcessing(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const payload = {
        approval_status: targetStatus,
        admin_notes: adminNotes,
      };

      const res = await api.post(`/salons/admin/${salonId}/decision/`, payload, config);

      if (res.status === 200) {
        const updated = res.data.salon;
        setSalons((prev) =>
          prev.map((s) => (s.id === salonId ? { ...s, ...updated } : s))
        );

        if (inspectingSalon && inspectingSalon.id === salonId) {
          setInspectingSalon((prev) => ({ ...prev, ...updated }));
        }

        if (targetStatus === "APPROVED") {
          const wasBlocked = salons.find((s) => s.id === salonId)?.approval_status === "BLOCKED";
          if (wasBlocked) {
            showToast(`✅ ${updated.name} has been unblocked and reactivated!`);
          } else {
            const credsNotice = res.data.temp_password
              ? `(Credentials: ${res.data.temp_password}) emailed to ${updated.email}`
              : `Email sent to ${updated.email}`;
            showToast(`✓ ${updated.name} APPROVED! ${credsNotice}`);
          }
        } else if (targetStatus === "REJECTED") {
          showToast(`✕ ${updated.name} REJECTED. Notice sent to owner.`);
        } else if (targetStatus === "BLOCKED") {
          showToast(`🚫 ${updated.name} BLOCKED. Venue hidden from customer explore.`);
        } else {
          showToast(`↺ ${updated.name} reset to PENDING.`);
        }

        setRejectDialogSalon(null);
        setSelectedPresetReason("");
        setCustomRejectReason("");
      }
    } catch (err) {
      alert("Failed to update status: " + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Salon Block / Unblock Toggle: opens confirmation modal before block
  const handleInitiateBlock = (salon) => {
    if (!salon) return;
    if (salon.approval_status === "APPROVED") {
      setBlockConfirmSalon(salon);
    } else if (salon.approval_status === "BLOCKED") {
      handleDecision(salon.id, "APPROVED");
    }
  };

  const handleToggleBlock = handleInitiateBlock;

  // Export Data to CSV
  const handleExportCSV = () => {
    if (!filteredSalons.length) {
      alert("No salons available to export.");
      return;
    }
    const headers = [
      "ID",
      "Name",
      "Category",
      "Status",
      "City",
      "Address",
      "Email",
      "Phone",
      "Services_Count",
      "Created_At",
    ];
    const rows = filteredSalons.map((s) => [
      s.id,
      `"${(s.name || "").replace(/"/g, '""')}"`,
      `"${s.category || ""}"`,
      s.approval_status || "PENDING",
      `"${s.city || ""}"`,
      `"${(s.address || "").replace(/"/g, '""')}"`,
      `"${s.email || ""}"`,
      `"${s.phone || ""}"`,
      Array.isArray(s.services) ? s.services.length : 0,
      s.created_at ? new Date(s.created_at).toISOString().slice(0, 10) : "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `bookmysalon-salons-${activeTab.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="asl-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#1e3a29",
            color: "#ffffff",
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.22)",
            zIndex: 9999,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <AdminSidebar
        pendingCount={pendingCount}
        salonsCount={totalCount}
        activeTab={activeTab}
        onSelectPendingTab={() => {
          setActiveTab("PENDING");
          setSearchParams({ tab: "pending" });
        }}
        onSelectSalonsTab={() => {
          setActiveTab("ALL");
          setSearchParams({});
        }}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="asl-main">
        {/* Top Sticky Bar */}
        <header className="asl-topbar">
          <div className="asl-topbar-title">
            <span className="asl-breadcrumb">Super Admin /</span>
            <h1>Salons Directory & Approvals</h1>
          </div>

          <div className="asl-topbar-actions">
            <button
              type="button"
              className="asl-btn-outline"
              onClick={fetchSalons}
              title="Refresh directory"
            >
              <span>🔄</span> Refresh
            </button>
            <button
              type="button"
              className="asl-btn-outline"
              onClick={handleExportCSV}
              title="Export visible list to CSV"
            >
              <span>📥</span> Export CSV
            </button>
            <Link to="/salon-application" className="asl-btn-primary">
              <span>+</span> Onboard New Salon
            </Link>
          </div>
        </header>

        {/* Body Content */}
        <div className="asl-body">
          {/* KPI Summary Cards */}
          <section className="asl-metrics-grid" aria-label="Directory metrics">
            <div
              className={`asl-metric-card ${activeTab === "ALL" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("ALL")}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">All Salons</span>
                <div className="asl-metric-icon blue">🏪</div>
              </div>
              <div className="asl-metric-value">{totalCount}</div>
              <div className="asl-metric-subtext">Total venue profiles in system</div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "PENDING" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("PENDING")}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Pending Verification</span>
                <div className="asl-metric-icon amber">⏳</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#b45309" }}>
                {pendingCount}
              </div>
              <div className="asl-metric-subtext">
                {pendingCount > 0 ? "Requires administrative decision" : "Queue is clear"}
              </div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "APPROVED" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("APPROVED")}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Approved & Active</span>
                <div className="asl-metric-icon green">✓</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#047857" }}>
                {approvedCount}
              </div>
              <div className="asl-metric-subtext">Publicly listed & accepting bookings</div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "BLOCKED" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("BLOCKED")}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Blocked Venues</span>
                <div className="asl-metric-icon slate">🚫</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#475569" }}>
                {blockedCount}
              </div>
              <div className="asl-metric-subtext">Hidden from customer explore</div>
            </div>

            <div
              className={`asl-metric-card ${activeTab === "REJECTED" ? "active-tab" : ""}`}
              onClick={() => setActiveTab("REJECTED")}
            >
              <div className="asl-metric-top">
                <span className="asl-metric-label">Rejected Applications</span>
                <div className="asl-metric-icon rose">✕</div>
              </div>
              <div className="asl-metric-value" style={{ color: "#b91c1c" }}>
                {rejectedCount}
              </div>
              <div className="asl-metric-subtext">Denied with administrative feedback</div>
            </div>
          </section>

          {/* Filtering & Controls Toolbar */}
          <section className="asl-toolbar">
            <div className="asl-toolbar-top">
              {/* Status Tabs */}
              <div className="asl-tabs" role="tablist">
                <button
                  type="button"
                  className={`asl-tab-btn ${activeTab === "ALL" ? "active" : ""}`}
                  onClick={() => setActiveTab("ALL")}
                >
                  All Salons
                  <span className="asl-tab-count">{totalCount}</span>
                </button>
                <button
                  type="button"
                  className={`asl-tab-btn ${activeTab === "PENDING" ? "active" : ""}`}
                  onClick={() => setActiveTab("PENDING")}
                >
                  Pending Reviews
                  <span className={`asl-tab-count ${pendingCount > 0 ? "urgent" : ""}`}>
                    {pendingCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={`asl-tab-btn ${activeTab === "APPROVED" ? "active" : ""}`}
                  onClick={() => setActiveTab("APPROVED")}
                >
                  Approved
                  <span className="asl-tab-count">{approvedCount}</span>
                </button>
                <button
                  type="button"
                  className={`asl-tab-btn ${activeTab === "BLOCKED" ? "active" : ""}`}
                  onClick={() => setActiveTab("BLOCKED")}
                >
                  Blocked
                  <span className="asl-tab-count">{blockedCount}</span>
                </button>
                <button
                  type="button"
                  className={`asl-tab-btn ${activeTab === "REJECTED" ? "active" : ""}`}
                  onClick={() => setActiveTab("REJECTED")}
                >
                  Rejected
                  <span className="asl-tab-count">{rejectedCount}</span>
                </button>
              </div>

              {/* View Switcher */}
              <div className="asl-view-toggle">
                <button
                  type="button"
                  className={`asl-toggle-btn ${viewMode === "table" ? "active" : ""}`}
                  onClick={() => setViewMode("table")}
                  title="Table view"
                >
                  ☰ Table
                </button>
                <button
                  type="button"
                  className={`asl-toggle-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Card grid view"
                >
                  ▦ Cards
                </button>
              </div>
            </div>

            {/* Search, Category, Sorting Row */}
            <div className="asl-toolbar-filters">
              <div className="asl-search-wrap">
                <span className="asl-search-icon">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="asl-search-input"
                  placeholder="Search salons by name, city, phone, email... (Press / to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="asl-search-clear"
                    onClick={() => setSearchQuery("")}
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="asl-filter-group">
                <select
                  className="asl-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      Category: {c}
                    </option>
                  ))}
                </select>

                <select
                  className="asl-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="newest">Sort: Newest First</option>
                  <option value="oldest">Sort: Oldest First</option>
                  <option value="name-asc">Sort: Name (A to Z)</option>
                  <option value="name-desc">Sort: Name (Z to A)</option>
                  <option value="city">Sort: City</option>
                </select>
              </div>
            </div>
          </section>

          {/* Directory Content Display */}
          {loading ? (
            <div className="asl-empty-state">
              <div className="asl-empty-icon">⏳</div>
              <h4>Loading salons directory...</h4>
              <p>Fetching real-time venue records from BookMySalon database.</p>
            </div>
          ) : filteredSalons.length === 0 ? (
            <div className="asl-empty-state">
              <div className="asl-empty-icon">🔍</div>
              <h4>No salons match the selected filters</h4>
              <p>
                Try changing status tabs, clearing search criteria, or selecting a different
                category.
              </p>
              <button
                type="button"
                className="asl-btn-outline"
                style={{ marginTop: "14px" }}
                onClick={() => {
                  setActiveTab("ALL");
                  setCategoryFilter("All");
                  setSearchQuery("");
                }}
              >
                Reset All Filters
              </button>
            </div>
          ) : viewMode === "table" ? (
            /* Table View */
            <div className="asl-table-card">
              <div className="asl-table-wrap">
                <table className="asl-table">
                  <thead>
                    <tr>
                      <th>Salon Venue</th>
                      <th>Location & Contact</th>
                      <th>Services & Pricing</th>
                      <th>Operating Schedule</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedSalons.map((salon) => {
                      const servicesList = Array.isArray(salon.services) ? salon.services : [];
                      const minPrice =
                        servicesList.length > 0
                          ? Math.min(
                              ...servicesList
                                .map((s) => Number(String(s.price).replace(/[^\d.]/g, "")) || 0)
                                .filter((n) => n > 0)
                            )
                          : null;

                      const coverSrc = resolveImageUrl(
                        salon.cover_image || (salon.images && salon.images[0]) || ""
                      );

                      return (
                        <tr key={salon.id}>
                          {/* Salon Cell */}
                          <td>
                            <div className="asl-salon-cell">
                              <img
                                src={coverSrc}
                                alt={salon.name}
                                className="asl-salon-thumb"
                                onError={(e) => {
                                  e.target.src =
                                    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=150&q=80";
                                }}
                              />
                              <div className="asl-salon-meta">
                                <span className="asl-salon-name">{salon.name}</span>
                                <span className="asl-salon-category">
                                  {salon.category || "General"}
                                </span>
                                <span className="asl-salon-id-badge">
                                  ID #{salon.id} • Registered{" "}
                                  {salon.created_at
                                    ? new Date(salon.created_at).toLocaleDateString()
                                    : "Recently"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Contact Cell */}
                          <td>
                            <div className="asl-contact-cell">
                              <span className="asl-contact-city">
                                📍 {salon.city || "Bangalore"}, {salon.state || "Karnataka"}
                              </span>
                              <span className="asl-contact-sub">
                                📞 {salon.phone || "No phone"}
                              </span>
                              <span className="asl-contact-sub">
                                ✉️ {salon.email || "No email"}
                              </span>
                            </div>
                          </td>

                          {/* Services Cell */}
                          <td>
                            <div className="asl-services-cell">
                              <span className="asl-services-badge">
                                ✂️ {servicesList.length} Services
                              </span>
                              <span className="asl-services-sample">
                                {minPrice ? `From ₹${minPrice}` : "Prices unlisted"}
                                {servicesList[0] ? ` • ${servicesList[0].name}` : ""}
                              </span>
                            </div>
                          </td>

                          {/* Schedule Cell */}
                          <td>
                            <div style={{ fontSize: "12px", color: "#475e50" }}>
                              {salon.opening_hours?.days ? (
                                <>
                                  <div style={{ fontWeight: "600" }}>
                                    {salon.opening_hours.days.filter((d) => d.isOpen).length} Days
                                    Open / Wk
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#788f80" }}>
                                    Standard 09:00 - 20:00
                                  </div>
                                </>
                              ) : (
                                <span>Mon - Sat 09:00 - 20:00</span>
                              )}
                            </div>
                          </td>

                          {/* Status Cell */}
                          <td>
                            {salon.approval_status === "APPROVED" ? (
                              <span className="asl-status-badge approved">
                                <span>✓</span> Approved
                              </span>
                            ) : salon.approval_status === "BLOCKED" ? (
                              <span className="asl-status-badge blocked">
                                <span>🚫</span> Blocked
                              </span>
                            ) : salon.approval_status === "REJECTED" ? (
                              <span className="asl-status-badge rejected">
                                <span>✕</span> Rejected
                              </span>
                            ) : (
                              <span className="asl-status-badge pending">
                                <span className="asl-pulse-dot" /> Pending Review
                              </span>
                            )}
                          </td>

                          {/* Actions Cell */}
                          <td style={{ textAlign: "right" }}>
                            <div
                              className="asl-actions-group"
                              style={{ justifyContent: "flex-end" }}
                            >
                              {/* Pending Salons: Review & Approve + View */}
                              {salon.approval_status === "PENDING" && (
                                <>
                                  <button
                                    type="button"
                                    className="asl-action-btn review"
                                    onClick={() => setInspectingSalon(salon)}
                                    title="Review full salon application to Approve or Reject"
                                  >
                                    📋 Review & Approve
                                  </button>
                                  <button
                                    type="button"
                                    className="asl-action-btn view"
                                    onClick={() => setInspectingSalon(salon)}
                                    title="View full salon details"
                                  >
                                    👁️ View Details
                                  </button>
                                </>
                              )}

                              {/* Approved Salons: View + Block */}
                              {salon.approval_status === "APPROVED" && (
                                <>
                                  <button
                                    type="button"
                                    className="asl-action-btn view"
                                    onClick={() => setInspectingSalon(salon)}
                                    title="View full salon details"
                                  >
                                    👁️ View Details
                                  </button>
                                  <button
                                    type="button"
                                    className="asl-action-btn block"
                                    onClick={() => handleToggleBlock(salon)}
                                    disabled={isProcessing}
                                    title="Block salon from customer explore and bookings"
                                  >
                                    🚫 Block
                                  </button>
                                </>
                              )}

                              {/* Blocked Salons: View + Unblock */}
                              {salon.approval_status === "BLOCKED" && (
                                <>
                                  <button
                                    type="button"
                                    className="asl-action-btn view"
                                    onClick={() => setInspectingSalon(salon)}
                                    title="View full salon details"
                                  >
                                    👁️ View Details
                                  </button>
                                  <button
                                    type="button"
                                    className="asl-action-btn unblock"
                                    onClick={() => handleToggleBlock(salon)}
                                    disabled={isProcessing}
                                    title="Unblock and restore to public explore"
                                  >
                                    ✓ Unblock
                                  </button>
                                </>
                              )}

                              {/* Rejected Salons: View only */}
                              {salon.approval_status === "REJECTED" && (
                                <button
                                  type="button"
                                  className="asl-action-btn view"
                                  onClick={() => setInspectingSalon(salon)}
                                  title="View rejected salon details and feedback"
                                >
                                  👁️ View Details
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {renderPaginationBar()}
            </div>
          ) : (
            /* Grid Cards View */
            <>
              <div className="asl-grid-cards">
                {paginatedSalons.map((salon) => {
                const servicesList = Array.isArray(salon.services) ? salon.services : [];
                const coverSrc = resolveImageUrl(
                  salon.cover_image || (salon.images && salon.images[0]) || ""
                );
                return (
                  <div className="asl-card-item" key={salon.id}>
                    <div className="asl-card-cover-wrap">
                      <img
                        src={coverSrc}
                        alt={salon.name}
                        className="asl-card-cover"
                        onError={(e) => {
                          e.target.src =
                            "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=400&q=80";
                        }}
                      />
                      <div className="asl-card-status-badge">
                        {salon.approval_status === "APPROVED" ? (
                          <span className="asl-status-badge approved">✓ Approved</span>
                        ) : salon.approval_status === "BLOCKED" ? (
                          <span className="asl-status-badge blocked">🚫 Blocked</span>
                        ) : salon.approval_status === "REJECTED" ? (
                          <span className="asl-status-badge rejected">✕ Rejected</span>
                        ) : (
                          <span className="asl-status-badge pending">
                            <span className="asl-pulse-dot" /> Pending
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="asl-card-body">
                      <div className="asl-card-header-row">
                        <h4 className="asl-card-name">{salon.name}</h4>
                      </div>

                      <div className="asl-card-meta-row">
                        <div className="asl-card-meta-item">
                          <span>🏷️</span>
                          <span style={{ fontWeight: "600" }}>{salon.category || "General"}</span>
                        </div>
                        <div className="asl-card-meta-item">
                          <span>📍</span>
                          <span>
                            {salon.city || "Bangalore"}, {salon.state || "Karnataka"}
                          </span>
                        </div>
                        <div className="asl-card-meta-item">
                          <span>📞</span>
                          <span>{salon.phone || "No phone"}</span>
                        </div>
                        <div className="asl-card-meta-item">
                          <span>✉️</span>
                          <span>{salon.email || "No email"}</span>
                        </div>
                      </div>

                      <div className="asl-card-services-summary">
                        <strong>✂️ {servicesList.length} Services</strong>
                        <div style={{ color: "#6e8576", fontSize: "11px", marginTop: "2px" }}>
                          {servicesList.slice(0, 2).map((s) => s.name).join(", ") || "No services added"}
                        </div>
                      </div>

                      <div className="asl-card-actions">
                        {/* Pending Salons: Review & Approve + View */}
                        {salon.approval_status === "PENDING" && (
                          <>
                            <button
                              type="button"
                              className="asl-action-btn review"
                              onClick={() => setInspectingSalon(salon)}
                              title="Review full salon application to Approve or Reject"
                            >
                              📋 Review & Approve
                            </button>
                            <button
                              type="button"
                              className="asl-action-btn view"
                              onClick={() => setInspectingSalon(salon)}
                              title="View full salon details"
                            >
                              👁️ View Details
                            </button>
                          </>
                        )}

                        {/* Approved Salons: View + Block */}
                        {salon.approval_status === "APPROVED" && (
                          <>
                            <button
                              type="button"
                              className="asl-action-btn view"
                              onClick={() => setInspectingSalon(salon)}
                              title="View full salon details"
                            >
                              👁️ View Details
                            </button>
                            <button
                              type="button"
                              className="asl-action-btn block"
                              onClick={() => handleToggleBlock(salon)}
                              disabled={isProcessing}
                              title="Block salon from customer explore and bookings"
                            >
                              🚫 Block
                            </button>
                          </>
                        )}

                        {/* Blocked Salons: View + Unblock */}
                        {salon.approval_status === "BLOCKED" && (
                          <>
                            <button
                              type="button"
                              className="asl-action-btn view"
                              onClick={() => setInspectingSalon(salon)}
                              title="View full salon details"
                            >
                              👁️ View Details
                            </button>
                            <button
                              type="button"
                              className="asl-action-btn unblock"
                              onClick={() => handleToggleBlock(salon)}
                              disabled={isProcessing}
                              title="Unblock and restore to public explore"
                            >
                              ✓ Unblock
                            </button>
                          </>
                        )}

                        {/* Rejected Salons: View only */}
                        {salon.approval_status === "REJECTED" && (
                          <button
                            type="button"
                            className="asl-action-btn view"
                            onClick={() => setInspectingSalon(salon)}
                            title="View rejected salon details and feedback"
                          >
                            👁️ View Details
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
              {filteredSalons.length > 0 && (
                <div className="asl-pagination-card">
                  {renderPaginationBar()}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* --------------------------------------------------------------------------
          Rich Details Inspection Modal ("Other Details")
          -------------------------------------------------------------------------- */}
      {inspectingSalon && (
        <div className="asl-modal-backdrop" onClick={() => setInspectingSalon(null)}>
          <div className="asl-modal-panel" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="asl-modal-header">
              <div className="asl-modal-header-left">
                <h3>{inspectingSalon.name}</h3>
                <span className="asl-salon-category">{inspectingSalon.category}</span>
                {inspectingSalon.approval_status === "APPROVED" ? (
                  <span className="asl-status-badge approved">✓ Approved</span>
                ) : inspectingSalon.approval_status === "BLOCKED" ? (
                  <span className="asl-status-badge blocked">🚫 Blocked</span>
                ) : inspectingSalon.approval_status === "REJECTED" ? (
                  <span className="asl-status-badge rejected">✕ Rejected</span>
                ) : (
                  <span className="asl-status-badge pending">
                    <span className="asl-pulse-dot" /> Pending Review
                  </span>
                )}
              </div>
              <button
                type="button"
                className="asl-modal-close-btn"
                onClick={() => setInspectingSalon(null)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="asl-modal-body">
              {/* Hero Banner Image */}
              <div className="asl-modal-hero">
                <img
                  src={resolveImageUrl(
                    inspectingSalon.cover_image ||
                      (inspectingSalon.images && inspectingSalon.images[0]) ||
                      ""
                  )}
                  alt={inspectingSalon.name}
                  onError={(e) => {
                    e.target.src =
                      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";
                  }}
                />
                <span className="asl-modal-hero-badge">
                  Venue Code #{inspectingSalon.id} • Registered{" "}
                  {inspectingSalon.created_at
                    ? new Date(inspectingSalon.created_at).toLocaleDateString()
                    : "Recently"}
                </span>
              </div>

              {/* Gallery Thumbnails Strip */}
              {Array.isArray(inspectingSalon.images) && inspectingSalon.images.length > 0 && (
                <div>
                  <div className="asl-info-box-label">
                    Photo Gallery ({inspectingSalon.images.length} photos)
                  </div>
                  <div className="asl-gallery-strip">
                    {inspectingSalon.images.map((imgUrl, idx) => (
                      <img
                        key={idx}
                        src={resolveImageUrl(imgUrl)}
                        alt={`Gallery ${idx + 1}`}
                        className="asl-gallery-thumb"
                        onClick={() => window.open(resolveImageUrl(imgUrl), "_blank")}
                        title="Click to view full size in new tab"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Grid 2: Owner & Location */}
              <div className="asl-info-grid-2">
                {/* Contact & Owner Info */}
                <div className="asl-info-box">
                  <div className="asl-info-box-label">Owner & Contact Information</div>
                  <div className="asl-info-box-val">📞 {inspectingSalon.phone}</div>
                  <div className="asl-info-box-sub">✉️ {inspectingSalon.email}</div>
                  <div className="asl-info-box-sub" style={{ marginTop: "8px" }}>
                    <strong>Owner Account:</strong>{" "}
                    {inspectingSalon.owner ? (
                      <span style={{ color: "#065f46" }}>Linked (User ID #{inspectingSalon.owner})</span>
                    ) : (
                      <span style={{ color: "#b45309" }}>Pending Account Dispatch</span>
                    )}
                  </div>
                </div>

                {/* Physical Location & Geolocation */}
                <div className="asl-info-box">
                  <div className="asl-info-box-label">Physical Address & Coordinates</div>
                  <div className="asl-info-box-val">
                    {inspectingSalon.address}, {inspectingSalon.city}
                  </div>
                  <div className="asl-info-box-sub">
                    {inspectingSalon.state || "Karnataka"}, PIN: {inspectingSalon.pincode || "N/A"}
                  </div>
                  {inspectingSalon.latitude && inspectingSalon.longitude && (
                    <div style={{ marginTop: "6px" }}>
                      <a
                        href={`https://maps.google.com/?q=${inspectingSalon.latitude},${inspectingSalon.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#234d34", fontWeight: "700", fontSize: "11px" }}
                      >
                        📍 View on Google Maps ({inspectingSalon.latitude}, {inspectingSalon.longitude}) ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Operating Hours Mon-Sun */}
              <div>
                <div className="asl-info-box-label">Weekly Operating Schedule</div>
                {inspectingSalon.opening_hours?.days &&
                Array.isArray(inspectingSalon.opening_hours.days) ? (
                  <div className="asl-schedule-grid">
                    {inspectingSalon.opening_hours.days.map((day) => (
                      <div
                        key={day.day}
                        className={`asl-day-chip ${day.isOpen ? "open" : "closed"}`}
                      >
                        <div className="asl-day-name">{day.day.slice(0, 3)}</div>
                        <div className="asl-day-hours">
                          {day.isOpen ? `${day.openTime || "09:00"} - ${day.closeTime || "20:00"}` : "Closed"}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "13px", color: "#61796b" }}>
                    Standard Business Schedule: Monday to Saturday, 09:00 AM – 08:00 PM.
                  </p>
                )}
              </div>

              {/* Services & Pricing Menu */}
              <div>
                <div className="asl-info-box-label">
                  Services & Pricing Menu (
                  {Array.isArray(inspectingSalon.services) ? inspectingSalon.services.length : 0} configured)
                </div>
                {Array.isArray(inspectingSalon.services) && inspectingSalon.services.length > 0 ? (
                  <div className="asl-services-table-wrap">
                    <table className="asl-services-table">
                      <thead>
                        <tr>
                          <th>Service Name</th>
                          <th>Category</th>
                          <th>Duration</th>
                          <th style={{ textAlign: "right" }}>Price (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectingSalon.services.map((srv, idx) => (
                          <tr key={srv.id || idx}>
                            <td style={{ fontWeight: "600", color: "#172a1d" }}>{srv.name}</td>
                            <td style={{ color: "#546e5f" }}>{srv.category || inspectingSalon.category}</td>
                            <td style={{ color: "#6c8577" }}>{srv.duration || "30 mins"}</td>
                            <td style={{ textAlign: "right" }}>
                              <span className="asl-service-price-pill">
                                {String(srv.price).startsWith("₹") ? srv.price : `₹${srv.price}`}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: "13px", color: "#728779" }}>
                    No custom pricing services configured for this salon.
                  </div>
                )}
              </div>

              {/* Facilities & Amenities */}
              {Array.isArray(inspectingSalon.amenities) && inspectingSalon.amenities.length > 0 && (
                <div>
                  <div className="asl-info-box-label">
                    Facilities & Amenities ({inspectingSalon.amenities.length})
                  </div>
                  <div className="asl-amenities-wrap">
                    {inspectingSalon.amenities.map((am, idx) => (
                      <span key={idx} className="asl-amenity-chip">
                        ✨ {am}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Description & Ambience */}
              {inspectingSalon.description && (
                <div>
                  <div className="asl-info-box-label">Salon Description & Ambience</div>
                  <div
                    style={{
                      background: "#f7faf8",
                      border: "1px solid #e3ebe5",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      fontSize: "13px",
                      lineHeight: "1.6",
                      color: "#284030",
                    }}
                  >
                    {inspectingSalon.description}
                  </div>
                </div>
              )}

              {/* Admin Audit & Notes */}
              {inspectingSalon.admin_notes && (
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    fontSize: "13px",
                    color: "#92400e",
                  }}
                >
                  <strong>Admin Feedback Notes:</strong> {inspectingSalon.admin_notes}
                </div>
              )}
            </div>

            {/* Modal Footer Decisions */}
            <div className="asl-modal-footer">
              <div className="asl-modal-footer-left">
                Last updated:{" "}
                {inspectingSalon.updated_at
                  ? new Date(inspectingSalon.updated_at).toLocaleString()
                  : "N/A"}
              </div>

              <div className="asl-modal-footer-actions">
                {/* Pending: Approve or Reject */}
                {inspectingSalon.approval_status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      className="asl-btn-primary"
                      onClick={() => handleDecision(inspectingSalon.id, "APPROVED")}
                      disabled={isProcessing}
                    >
                      ✓ Approve & Email Credentials
                    </button>
                    <button
                      type="button"
                      className="asl-action-btn reject"
                      style={{ padding: "8px 16px" }}
                      onClick={() => {
                        setRejectDialogSalon(inspectingSalon);
                      }}
                      disabled={isProcessing}
                    >
                      ✕ Reject Application
                    </button>
                  </>
                )}

                {/* Approved: Block */}
                {inspectingSalon.approval_status === "APPROVED" && (
                  <button
                    type="button"
                    className="asl-action-btn block"
                    style={{ padding: "8px 16px" }}
                    onClick={() => handleToggleBlock(inspectingSalon)}
                    disabled={isProcessing}
                  >
                    🚫 Block Salon
                  </button>
                )}

                {/* Blocked: Unblock */}
                {inspectingSalon.approval_status === "BLOCKED" && (
                  <button
                    type="button"
                    className="asl-action-btn unblock"
                    style={{ padding: "8px 16px" }}
                    onClick={() => handleToggleBlock(inspectingSalon)}
                    disabled={isProcessing}
                  >
                    ✓ Unblock / Reactivate Salon
                  </button>
                )}

                {/* Rejected: Status Notice */}
                {inspectingSalon.approval_status === "REJECTED" && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#991b1b",
                      fontStyle: "italic",
                      paddingRight: "10px",
                    }}
                  >
                    Application currently rejected. Awaiting applicant resubmission.
                  </span>
                )}

                <button
                  type="button"
                  className="asl-btn-outline"
                  onClick={() => setInspectingSalon(null)}
                  disabled={isProcessing}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          Rejection Reason Dialog Modal
          -------------------------------------------------------------------------- */}
      {rejectDialogSalon && (
        <div className="asl-modal-backdrop" onClick={() => setRejectDialogSalon(null)}>
          <div className="asl-dialog-panel" onClick={(e) => e.stopPropagation()}>
            <div className="asl-dialog-header">
              <h3>Reject Salon Application</h3>
              <p>
                Provide a clear reason for rejecting <strong>{rejectDialogSalon.name}</strong>.
                This feedback will be emailed to <strong>{rejectDialogSalon.email}</strong>.
              </p>
            </div>

            <div className="asl-rejection-presets">
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#61796b" }}>
                SELECT QUICK REASON:
              </span>
              {REJECTION_PRESETS.map((preset) => (
                <label key={preset} className="asl-preset-radio">
                  <input
                    type="radio"
                    name="rejectionPreset"
                    checked={selectedPresetReason === preset}
                    onChange={() => setSelectedPresetReason(preset)}
                  />
                  <span>{preset}</span>
                </label>
              ))}
              <label className="asl-preset-radio">
                <input
                  type="radio"
                  name="rejectionPreset"
                  checked={selectedPresetReason === "Custom"}
                  onChange={() => setSelectedPresetReason("Custom")}
                />
                <span>Custom feedback note</span>
              </label>
            </div>

            {(selectedPresetReason === "Custom" || !selectedPresetReason) && (
              <textarea
                className="asl-textarea"
                placeholder="Enter detailed instructions on what the salon owner must correct or update..."
                value={customRejectReason}
                onChange={(e) => setCustomRejectReason(e.target.value)}
              />
            )}

            <div className="asl-dialog-actions">
              <button
                type="button"
                className="asl-btn-outline"
                onClick={() => setRejectDialogSalon(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="asl-action-btn reject"
                style={{ padding: "8px 16px" }}
                disabled={isProcessing}
                onClick={() => {
                  const finalReason =
                    selectedPresetReason === "Custom" || !selectedPresetReason
                      ? customRejectReason.trim()
                      : selectedPresetReason;
                  if (!finalReason) {
                    alert("Please select or enter a rejection reason.");
                    return;
                  }
                  handleDecision(rejectDialogSalon.id, "REJECTED", finalReason);
                }}
              >
                {isProcessing ? "Processing..." : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          Block Salon Confirmation Modal Dialog (Yes or Cancel)
          -------------------------------------------------------------------------- */}
      {blockConfirmSalon && (
        <div
          className="asl-modal-backdrop"
          onClick={() => !isProcessing && setBlockConfirmSalon(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Block Salon Modal"
          style={{ zIndex: 100000 }}
        >
          <div
            className="asl-dialog-panel"
            style={{ maxWidth: 460 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "#fee2e2",
                  color: "#dc2626",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  flexShrink: 0,
                }}
              >
                <span>⚠️</span>
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#172a1d",
                  }}
                >
                  Block Salon Venue?
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "#556c5e",
                    lineHeight: 1.5,
                  }}
                >
                  Are you sure you want to block{" "}
                  <strong style={{ color: "#172a1d" }}>
                    {blockConfirmSalon.name}
                  </strong>{" "}
                  (<code>ID #{blockConfirmSalon.id}</code>)?
                  <br />
                  <br />
                  This venue will be immediately hidden from public customer search, explore, and online appointment bookings.
                </p>
              </div>
            </div>

            <div className="asl-dialog-actions" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="asl-btn-outline"
                disabled={isProcessing}
                onClick={() => setBlockConfirmSalon(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="asl-btn-danger"
                disabled={isProcessing}
                onClick={async () => {
                  const salonToBlock = blockConfirmSalon;
                  setBlockConfirmSalon(null);
                  await handleDecision(salonToBlock.id, "BLOCKED");
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 18px",
                  borderRadius: 8,
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <span>🚫</span>
                <span>{isProcessing ? "Blocking..." : "Yes, Block Salon"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}


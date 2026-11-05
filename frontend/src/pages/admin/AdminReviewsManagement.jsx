import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "../../styles/adminReviews.css";

const PRESET_HIDE_REASONS = [
  "Contains inappropriate, offensive, or abusive language",
  "Spam, commercial advertisement, or fake review",
  "Disputed booking factual claims under formal investigation",
  "Violates platform community conduct and review standards",
  "Contains private sensitive personal or confidential information",
  "Customer or salon requested removal with verified cause",
];

export default function AdminReviewsManagement() {
  // Global Platform Statistics
  const [stats, setStats] = useState({
    total_reviews: 0,
    visible_reviews: 0,
    hidden_reviews: 0,
    average_platform_rating: 5.0,
    five_star_reviews: 0,
    four_star_reviews: 0,
    three_star_reviews: 0,
    two_star_reviews: 0,
    one_star_reviews: 0,
    total_salons: 0,
    salons_with_reviews: 0,
  });

  // Salons Directory List (Left Panel)
  const [salons, setSalons] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [salonSearch, setSalonSearch] = useState("");
  const [salonStatusFilter, setSalonStatusFilter] = useState("ALL");
  const [selectedSalon, setSelectedSalon] = useState(null); // null means "All Salons"

  // Reviews Data (Right Panel)
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Filters & Sorting for Reviews
  const [reviewSearch, setReviewSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [salonStatusParam, setSalonStatusParam] = useState("ALL");
  const [hiddenFilter, setHiddenFilter] = useState("all"); // 'all' | 'false' | 'true'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dateType, setDateType] = useState("created"); // 'created' | 'appointment'
  const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'oldest' | 'highest_rated' | 'lowest_rated' | 'appointment_newest' | 'appointment_oldest'

  // Modals
  const [hideModalReview, setHideModalReview] = useState(null);
  const [hideReasonPreset, setHideReasonPreset] = useState(PRESET_HIDE_REASONS[0]);
  const [hideCustomReason, setHideCustomReason] = useState("");
  const [unhideModalReview, setUnhideModalReview] = useState(null);
  const [unhideReason, setUnhideReason] = useState("");
  const [auditModalReview, setAuditModalReview] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch Platform Statistics
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/reviews/admin/stats/");
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching admin review stats:", err);
    }
  }, []);

  // Fetch Salons Summary
  const fetchSalons = useCallback(async () => {
    setSalonsLoading(true);
    try {
      const params = {};
      if (salonSearch) params.search = salonSearch;
      if (salonStatusFilter && salonStatusFilter !== "ALL") params.status = salonStatusFilter;

      const res = await api.get("/reviews/admin/salons/", { params });
      setSalons(res.data?.salons || []);
    } catch (err) {
      console.error("Error fetching admin salons summary:", err);
    } finally {
      setSalonsLoading(false);
    }
  }, [salonSearch, salonStatusFilter]);

  // Fetch Reviews
  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const params = {};
      if (selectedSalon) {
        params.salon_id = selectedSalon.id;
      }
      if (reviewSearch) {
        params.search = reviewSearch;
      }
      if (ratingFilter && ratingFilter !== "all") {
        params.rating = ratingFilter;
      }
      if (salonStatusParam && salonStatusParam !== "ALL") {
        params.status = salonStatusParam;
      }
      if (hiddenFilter && hiddenFilter !== "all") {
        params.is_hidden = hiddenFilter;
      }
      if (startDate) {
        params.start_date = startDate;
      }
      if (endDate) {
        params.end_date = endDate;
      }
      if (dateType) {
        params.date_type = dateType;
      }
      if (sortBy) {
        params.sort = sortBy;
      }

      const res = await api.get("/reviews/admin/reviews/", { params });
      setReviews(res.data?.reviews || []);
    } catch (err) {
      console.error("Error fetching admin reviews list:", err);
    } finally {
      setReviewsLoading(false);
    }
  }, [
    selectedSalon,
    reviewSearch,
    ratingFilter,
    salonStatusParam,
    hiddenFilter,
    startDate,
    endDate,
    dateType,
    sortBy,
  ]);

  // Initial loading
  useEffect(() => {
    fetchStats();
    fetchSalons();
  }, [fetchStats, fetchSalons]);

  // Fetch reviews whenever filters change
  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Handle Moderation Hide Action
  const handleConfirmHide = async () => {
    if (!hideModalReview) return;
    const finalReason = hideCustomReason.trim() || hideReasonPreset;
    setActionLoading(true);
    try {
      const res = await api.post(`/reviews/admin/reviews/${hideModalReview.id}/moderate/`, {
        action: "hide",
        reason: finalReason,
      });
      showToast(res.data?.message || "Review has been hidden from public display.", "success");
      setHideModalReview(null);
      setHideCustomReason("");
      // Refresh current views
      fetchReviews();
      fetchStats();
      fetchSalons();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to hide review.";
      showToast(errMsg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Moderation Unhide Action
  const handleConfirmUnhide = async () => {
    if (!unhideModalReview) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/reviews/admin/reviews/${unhideModalReview.id}/moderate/`, {
        action: "unhide",
        reason: unhideReason.trim() || "Restored by super admin",
      });
      showToast(res.data?.message || "Review has been restored to public display.", "success");
      setUnhideModalReview(null);
      setUnhideReason("");
      // Refresh
      fetchReviews();
      fetchStats();
      fetchSalons();
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.detail || "Failed to unhide review.";
      showToast(errMsg, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Helper to render star icons
  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} style={{ color: i <= rating ? "#f59e0b" : "#cbd5e1" }}>
          ★
        </span>
      );
    }
    return <span className="arm-stars">{stars}</span>;
  };

  // Reset all filters
  const handleClearFilters = () => {
    setReviewSearch("");
    setRatingFilter("all");
    setSalonStatusParam("ALL");
    setHiddenFilter("all");
    setStartDate("");
    setEndDate("");
    setDateType("created");
    setSortBy("newest");
  };

  // Active filter count calculation
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (reviewSearch) count++;
    if (ratingFilter !== "all") count++;
    if (salonStatusParam !== "ALL") count++;
    if (hiddenFilter !== "all") count++;
    if (startDate || endDate) count++;
    if (sortBy !== "newest") count++;
    return count;
  }, [reviewSearch, ratingFilter, salonStatusParam, hiddenFilter, startDate, endDate, sortBy]);

  return (
    <div className="arm-layout">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Main Content Area */}
      <main className="arm-main" aria-label="Reviews and Ratings Management Desk">
        {/* Header Bar */}
        <header className="arm-header">
          <nav className="arm-breadcrumb" aria-label="Breadcrumb">
            <Link to="/admin/dashboard">Dashboard</Link>
            <span className="arm-breadcrumb-separator">/</span>
            <span className="arm-breadcrumb-current">Reviews & Ratings</span>
          </nav>

          <div className="arm-header-row">
            <div className="arm-title-group">
              <h1>Reviews & Ratings Management</h1>
              <p>
                Platform-wide inspection, performance tracking, and verified customer review moderation.
              </p>
            </div>

            <div className="arm-header-actions">
              <button
                type="button"
                className="arm-btn-refresh"
                onClick={() => {
                  fetchStats();
                  fetchSalons();
                  fetchReviews();
                  showToast("Reviews and salon directory refreshed.");
                }}
              >
                <span>🔄</span>
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        </header>

        {/* Toast Alert */}
        {toastMessage && (
          <div
            style={{
              position: "fixed",
              bottom: "24px",
              right: "24px",
              zIndex: 999,
              background: toastMessage.type === "error" ? "#991b1b" : "#166534",
              color: "#ffffff",
              padding: "12px 20px",
              borderRadius: "10px",
              boxShadow: "0 10px 15px -3px rgba(0,0,0,0.2)",
              fontSize: "14px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              animation: "arm-modal-in 0.2s ease-out",
            }}
          >
            <span>{toastMessage.type === "error" ? "⚠️" : "✓"}</span>
            <span>{toastMessage.text}</span>
          </div>
        )}

        <div className="arm-content">
          {/* Top Platform Statistics Grid */}
          <section className="arm-stats-grid" aria-label="Platform Statistics Overview">
            {/* Total Platform Reviews */}
            <div className="arm-stat-card">
              <div className="arm-stat-icon total">💬</div>
              <div className="arm-stat-info">
                <span className="arm-stat-label">Total Reviews</span>
                <span className="arm-stat-val">{stats.total_reviews}</span>
                <span className="arm-stat-sub">
                  Across {stats.salons_with_reviews || stats.total_salons} salons
                </span>
              </div>
            </div>

            {/* Average Platform Rating */}
            <div className="arm-stat-card">
              <div className="arm-stat-icon rating">⭐</div>
              <div className="arm-stat-info">
                <span className="arm-stat-label">Platform Average</span>
                <span className="arm-stat-val">
                  {stats.average_platform_rating}
                  <span style={{ fontSize: "14px", color: "#f59e0b" }}>★</span>
                </span>
                <span className="arm-stat-sub">Active public average</span>
              </div>
            </div>

            {/* 5-Star Reviews */}
            <div className="arm-stat-card">
              <div className="arm-stat-icon five-star">🌟</div>
              <div className="arm-stat-info">
                <span className="arm-stat-label">5-Star Reviews</span>
                <span className="arm-stat-val">{stats.five_star_reviews}</span>
                <span className="arm-stat-sub">
                  {stats.visible_reviews > 0
                    ? `${Math.round((stats.five_star_reviews / stats.visible_reviews) * 100)}% of visible`
                    : "0% of total"}
                </span>
              </div>
            </div>

            {/* 1-Star Reviews */}
            <div className="arm-stat-card">
              <div className="arm-stat-icon one-star">⚠️</div>
              <div className="arm-stat-info">
                <span className="arm-stat-label">1-Star Reviews</span>
                <span className="arm-stat-val">{stats.one_star_reviews}</span>
                <span className="arm-stat-sub">
                  {stats.visible_reviews > 0
                    ? `${Math.round((stats.one_star_reviews / stats.visible_reviews) * 100)}% of visible`
                    : "0% of total"}
                </span>
              </div>
            </div>

            {/* Moderated / Hidden Reviews */}
            <div className="arm-stat-card">
              <div className="arm-stat-icon hidden">🛡️</div>
              <div className="arm-stat-info">
                <span className="arm-stat-label">Hidden / Moderated</span>
                <span className="arm-stat-val">{stats.hidden_reviews}</span>
                <span className="arm-stat-sub">Excluded from ratings</span>
              </div>
            </div>
          </section>

          {/* Main Two-Column Workspace */}
          <div className="arm-workspace">
            {/* Left Column: Registered Salons Directory */}
            <aside className="arm-salons-panel" aria-label="Registered Salons Directory">
              <div className="arm-panel-header">
                <h2>Registered Salons</h2>
                <span className="arm-panel-badge">{salons.length} Salons</span>
              </div>

              {/* Salon Search Input */}
              <div className="arm-salon-search-wrap">
                <span className="arm-search-icon">🔍</span>
                <input
                  type="text"
                  className="arm-salon-search-input"
                  placeholder="Filter salons by name or city..."
                  value={salonSearch}
                  onChange={(e) => setSalonSearch(e.target.value)}
                />
              </div>

              {/* Salon Approval Status Chips */}
              <div className="arm-salon-filter-chips">
                {["ALL", "APPROVED", "PENDING", "SUSPENDED", "REJECTED"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`arm-chip ${salonStatusFilter === st ? "active" : ""}`}
                    onClick={() => setSalonStatusFilter(st)}
                  >
                    {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>

              {/* All Salons Platform View Button */}
              <button
                type="button"
                className={`arm-all-salons-btn ${selectedSalon === null ? "active" : ""}`}
                onClick={() => setSelectedSalon(null)}
              >
                <div className="arm-all-salons-info">
                  <span style={{ fontSize: "16px" }}>🌐</span>
                  <span>Entire Platform (All Salons)</span>
                </div>
                <span className="arm-panel-badge">{stats.total_reviews}</span>
              </button>

              {/* Salons List */}
              <div className="arm-salons-list">
                {salonsLoading ? (
                  <div className="arm-loading-state" style={{ padding: "30px 0" }}>
                    <div className="arm-spinner" style={{ width: "24px", height: "24px" }} />
                    <span style={{ fontSize: "12px" }}>Loading salons...</span>
                  </div>
                ) : salons.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#7a9081", fontSize: "12px" }}>
                    No salons found matching &quot;{salonSearch}&quot;
                  </div>
                ) : (
                  salons.filter((s) => s.approval_status === "APPROVED").map((s) => {
                    const isSelected = selectedSalon?.id === s.id;
                    const statusClass = s.approval_status?.toLowerCase() || "approved";

                    return (
                      <div
                        key={s.id}
                        className={`arm-salon-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedSalon(s)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setSelectedSalon(s);
                        }}
                      >
                        <div className="arm-salon-thumb">
                          {s.cover_image ? (
                            <img
                              src={s.cover_image}
                              alt={s.name}
                              className="arm-salon-thumb-img"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            "🏪"
                          )}
                        </div>

                        <div className="arm-salon-meta">
                          <div className="arm-salon-meta-header">
                            <span className="arm-salon-name" title={s.name}>
                              {s.name}
                            </span>
                            <span className={`arm-status-pill ${statusClass}`}>
                              {s.approval_status}
                            </span>
                          </div>

                          <div className="arm-salon-location">
                            {s.city ? `📍 ${s.city}` : "Location not set"} • {s.owner_name}
                          </div>

                          <div className="arm-salon-rating-row">
                            <span className="arm-rating-badge">
                              ★ {s.average_rating ? Number(s.average_rating).toFixed(1) : "5.0"}
                            </span>
                            <span className="arm-reviews-count-badge">
                              {s.total_reviews} {s.total_reviews === 1 ? "review" : "reviews"}
                            </span>
                            {s.hidden_reviews_count > 0 && (
                              <span className="arm-hidden-alert-badge">
                                🛡️ {s.hidden_reviews_count} hidden
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Column: Reviews Desk */}
            <section className="arm-reviews-panel" aria-label="Customer Reviews Desk">
              {/* Context Banner */}
              <div className="arm-context-banner">
                <div className="arm-context-left">
                  <div className="arm-context-icon">
                    {selectedSalon ? "🏪" : "🌐"}
                  </div>
                  <div>
                    <h2 className="arm-context-title">
                      {selectedSalon
                        ? selectedSalon.name
                        : "Platform-wide Customer Reviews"}
                    </h2>
                    <p className="arm-context-sub">
                      {selectedSalon ? (
                        <>
                          Average Rating:{" "}
                          <strong>
                            ★ {Number(selectedSalon.average_rating || 5.0).toFixed(1)}
                          </strong>{" "}
                          • {selectedSalon.visible_reviews_count || 0} public reviews
                          {selectedSalon.hidden_reviews_count > 0
                            ? ` • ${selectedSalon.hidden_reviews_count} hidden`
                            : ""}
                          {selectedSalon.city ? ` • ${selectedSalon.city}` : ""}
                        </>
                      ) : (
                        `Viewing all customer feedback across registered salons (${reviews.length} shown)`
                      )}
                    </p>
                  </div>
                </div>

                <div className="arm-context-right">
                  {selectedSalon && (
                    <button
                      type="button"
                      className="arm-chip"
                      onClick={() => setSelectedSalon(null)}
                      title="Clear salon filter to show platform-wide reviews"
                    >
                      ✕ View All Salons
                    </button>
                  )}
                </div>
              </div>

              {/* Filters Toolbar */}
              <div className="arm-filters-toolbar">
                <div className="arm-filter-row-top">
                  {/* Search Input */}
                  <div className="arm-input-group">
                    <label className="arm-input-label" htmlFor="arm-search-input">Search Feedback or Customer</label>
                    <input
                      id="arm-search-input"
                      type="text"
                      className="arm-input"
                      placeholder="Search customer name, email, or written comment..."
                      value={reviewSearch}
                      onChange={(e) => setReviewSearch(e.target.value)}
                    />
                  </div>

                  {/* Rating Filter */}
                  <div className="arm-input-group">
                    <label className="arm-input-label" htmlFor="arm-rating-select">Star Rating</label>
                    <select
                      id="arm-rating-select"
                      className="arm-select"
                      value={ratingFilter}
                      onChange={(e) => setRatingFilter(e.target.value)}
                    >
                      <option value="all">All Stars (1 - 5 ★)</option>
                      <option value="5">5 Stars Only (★★★★★)</option>
                      <option value="4">4 Stars Only (★★★★☆)</option>
                      <option value="3">3 Stars Only (★★★☆☆)</option>
                      <option value="2">2 Stars Only (★★☆☆☆)</option>
                      <option value="1">1 Star Only (★☆☆☆☆)</option>
                    </select>
                  </div>

                  {/* Moderation Visibility Filter */}
                  <div className="arm-input-group">
                    <label className="arm-input-label" htmlFor="arm-visibility-select">Moderation Status</label>
                    <select
                      id="arm-visibility-select"
                      className="arm-select"
                      value={hiddenFilter}
                      onChange={(e) => setHiddenFilter(e.target.value)}
                    >
                      <option value="all">All (Visible &amp; Hidden)</option>
                      <option value="false">Publicly Visible Only</option>
                      <option value="true">Hidden / Moderated Only</option>
                    </select>
                  </div>
                </div>

                <div className="arm-filter-row-bottom">
                  {/* Date Filter & Toggle */}
                  <div className="arm-date-group">
                    <span>Date:</span>
                    <select
                      className="arm-select"
                      style={{ padding: "4px 8px", fontSize: "12px", width: "auto" }}
                      value={dateType}
                      onChange={(e) => setDateType(e.target.value)}
                    >
                      <option value="created">Review Submitted</option>
                      <option value="appointment">Appointment Date</option>
                    </select>
                    <input
                      type="date"
                      className="arm-date-input"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      title="From Date"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      className="arm-date-input"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      title="To Date"
                    />
                  </div>

                  {/* Sort Options */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div className="arm-date-group">
                      <span>Sort:</span>
                      <select
                        className="arm-select"
                        style={{ padding: "4px 8px", fontSize: "12px" }}
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                      >
                        <option value="newest">Newest Reviews First</option>
                        <option value="oldest">Oldest Reviews First</option>
                        <option value="highest_rated">Highest Rated (5★ to 1★)</option>
                        <option value="lowest_rated">Lowest Rated (1★ to 5★)</option>
                        <option value="appointment_newest">Appointment Date (Newest)</option>
                        <option value="appointment_oldest">Appointment Date (Oldest)</option>
                      </select>
                    </div>

                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        className="arm-clear-btn"
                        onClick={handleClearFilters}
                      >
                        Clear Filters ({activeFiltersCount})
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Reviews List Feed */}
              <div className="arm-reviews-container">
                {reviewsLoading ? (
                  <div className="arm-loading-state">
                    <div className="arm-spinner" />
                    <span>Loading verified customer reviews...</span>
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="arm-empty-state">
                    <div className="arm-empty-icon">💬</div>
                    <h3>No Reviews Found</h3>
                    <p>
                      {selectedSalon
                        ? `No customer reviews found for ${selectedSalon.name} matching your active filters.`
                        : "No reviews match the specified criteria. Try clearing or relaxing search and date filters."}
                    </p>
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        className="arm-btn-refresh"
                        onClick={handleClearFilters}
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                ) : (
                  reviews.map((rev) => {
                    const submissionDate = rev.created_at
                      ? new Date(rev.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Recently";

                    const appointmentDate = rev.appointment_date || "Completed";
                    const appointmentTime = rev.appointment_time || "";
                    const avatarLetter = (rev.customer_name || rev.customer_email || "C")[0].toUpperCase();

                    return (
                      <article
                        key={rev.id}
                        className={`arm-review-card ${rev.is_hidden ? "is-hidden" : ""}`}
                      >
                        {/* Header: Customer info & Badges */}
                        <div className="arm-review-header">
                          <div className="arm-customer-box">
                            <div className="arm-avatar">
                              {rev.customer_photo ? (
                                <img
                                  src={rev.customer_photo}
                                  alt={rev.customer_name}
                                  className="arm-avatar-img"
                                  onError={(e) => {
                                    e.target.style.display = "none";
                                  }}
                                />
                              ) : (
                                avatarLetter
                              )}
                            </div>

                            <div className="arm-customer-info">
                              <h3 className="arm-customer-name">
                                {rev.customer_name}
                              </h3>
                              <span className="arm-customer-email">
                                {rev.customer_email}
                              </span>
                            </div>
                          </div>

                          <div className="arm-review-badges">
                            <div style={{ display: "flex", alignItems: "center" }}>
                              {renderStars(rev.rating)}
                              <span className="arm-rating-num">{rev.rating}.0</span>
                            </div>

                            <span
                              className={`arm-visibility-tag ${rev.is_hidden ? "hidden" : "visible"}`}
                            >
                              {rev.is_hidden ? "🛡️ Hidden by Admin" : "✓ Public"}
                            </span>
                          </div>
                        </div>

                        {/* Appointment Details Bar */}
                        <div className="arm-appointment-bar">
                          <div className="arm-apt-item">
                            <span>🏪 Salon:</span>
                            <strong>{rev.salon_name}</strong>
                          </div>
                          {rev.service_name && (
                            <div className="arm-apt-item">
                              <span>✂️ Service:</span>
                              <strong>{rev.service_name}</strong>
                            </div>
                          )}
                          <div className="arm-apt-item">
                            <span>📅 Appointment:</span>
                            <strong>
                              {appointmentDate} {appointmentTime ? `at ${appointmentTime}` : ""}
                            </strong>
                          </div>
                          {rev.booking_reference && (
                            <div className="arm-apt-item">
                              <span>Ref:</span>
                              <code>{rev.booking_reference}</code>
                            </div>
                          )}
                          {rev.booking_total > 0 && (
                            <div className="arm-apt-item">
                              <span>Amount:</span>
                              <strong>₹{rev.booking_total}</strong>
                            </div>
                          )}
                        </div>

                        {/* Written Feedback / Comment */}
                        <p className={`arm-review-comment ${!rev.comment ? "empty" : ""}`}>
                          {rev.comment ? `"${rev.comment}"` : "No written comment provided by client."}
                        </p>

                        {/* Moderation Details Banner (if Hidden) */}
                        {rev.is_hidden && (
                          <div className="arm-moderation-banner">
                            <span className="arm-mod-icon">🛡️</span>
                            <div className="arm-mod-details">
                              <span className="arm-mod-reason">
                                Moderated: {rev.moderation_reason || "Hidden by admin"}
                              </span>
                              <span className="arm-mod-meta">
                                Hidden by {rev.hidden_by_name || "Super Admin"} on{" "}
                                {rev.hidden_at
                                  ? new Date(rev.hidden_at).toLocaleDateString("en-US", {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "record"}
                                . This review is strictly excluded from public rating aggregations.
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Footer: Timestamps & Actions */}
                        <div className="arm-review-footer">
                          <div className="arm-timestamps">
                            <span>Submitted: {submissionDate}</span>
                            <span>•</span>
                            <span>Review ID #{rev.id}</span>
                          </div>

                          <div className="arm-action-buttons">
                            {/* Moderation Hide / Unhide Action */}
                            {rev.is_hidden ? (
                              <button
                                type="button"
                                className="arm-btn-action unhide"
                                onClick={() => setUnhideModalReview(rev)}
                              >
                                <span>👁️</span>
                                <span>Restore Review</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="arm-btn-action hide"
                                onClick={() => {
                                  setHideModalReview(rev);
                                  setHideReasonPreset(PRESET_HIDE_REASONS[0]);
                                  setHideCustomReason("");
                                }}
                              >
                                <span>🚫</span>
                                <span>Hide Review</span>
                              </button>
                            )}

                            {/* Audit Trail Button */}
                            {Array.isArray(rev.moderation_history) &&
                              rev.moderation_history.length > 0 && (
                                <button
                                  type="button"
                                  className="arm-btn-action audit"
                                  onClick={() => setAuditModalReview(rev)}
                                  title="View audit trail of moderation actions"
                                >
                                  <span>📜</span>
                                  <span>Audit Trail ({rev.moderation_history.length})</span>
                                </button>
                              )}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Hide Review Confirmation Modal */}
      {hideModalReview && (
        <div className="arm-modal-backdrop" onClick={() => setHideModalReview(null)}>
          <div
            className="arm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="arm-hide-modal-title"
          >
            <div className="arm-modal-header">
              <h3 id="arm-hide-modal-title">Hide Review #{hideModalReview.id}</h3>
              <button
                type="button"
                className="arm-modal-close"
                onClick={() => setHideModalReview(null)}
              >
                ✕
              </button>
            </div>

            <div className="arm-modal-body">
              <div className="arm-modal-review-snippet">
                <strong>{hideModalReview.customer_name}</strong> rated{" "}
                <strong>{hideModalReview.salon_name}</strong> {hideModalReview.rating}★
                <div style={{ marginTop: "4px", color: "#617668", fontStyle: "italic" }}>
                  &quot;{hideModalReview.comment || "No comment"}&quot;
                </div>
              </div>

              <div className="arm-input-group">
                <label className="arm-input-label" htmlFor="arm-reason-preset-select">Reason for Moderation</label>
                <select
                  id="arm-reason-preset-select"
                  className="arm-select"
                  value={hideReasonPreset}
                  onChange={(e) => setHideReasonPreset(e.target.value)}
                >
                  {PRESET_HIDE_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                  <option value="custom">Other / Custom explanation</option>
                </select>
              </div>

              <div className="arm-input-group">
                <label className="arm-input-label" htmlFor="arm-custom-reason-textarea">Additional Notes (Optional)</label>
                <textarea
                  id="arm-custom-reason-textarea"
                  className="arm-input"
                  style={{ minHeight: "72px", resize: "vertical" }}
                  placeholder="Enter specific audit details or notes explaining this action..."
                  value={hideCustomReason}
                  onChange={(e) => setHideCustomReason(e.target.value)}
                />
              </div>

              <div className="arm-modal-notice">
                🛡️ <strong>Public Rating Exclusion:</strong> Hiding this review will immediately
                remove it from public salon view and exclude its star rating from the salon&apos;s
                public average rating. The review remains saved in the database with an audit log.
              </div>
            </div>

            <div className="arm-modal-footer">
              <button
                type="button"
                className="arm-btn-cancel"
                onClick={() => setHideModalReview(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="arm-btn-confirm"
                onClick={handleConfirmHide}
                disabled={actionLoading}
              >
                {actionLoading ? "Hiding..." : "Confirm & Hide Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unhide / Restore Review Modal */}
      {unhideModalReview && (
        <div className="arm-modal-backdrop" onClick={() => setUnhideModalReview(null)}>
          <div
            className="arm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="arm-unhide-modal-title"
          >
            <div className="arm-modal-header">
              <h3 id="arm-unhide-modal-title">Restore Review #{unhideModalReview.id}</h3>
              <button
                type="button"
                className="arm-modal-close"
                onClick={() => setUnhideModalReview(null)}
              >
                ✕
              </button>
            </div>

            <div className="arm-modal-body">
              <div className="arm-modal-review-snippet">
                <strong>{unhideModalReview.customer_name}</strong> ({unhideModalReview.rating}★ for{" "}
                {unhideModalReview.salon_name})
                <div style={{ marginTop: "4px", color: "#617668", fontStyle: "italic" }}>
                  &quot;{unhideModalReview.comment || "No comment"}&quot;
                </div>
              </div>

              <p style={{ margin: 0, fontSize: "13px", color: "#3e5245", lineHeight: 1.5 }}>
                Restoring this review will return it to public visibility and include its rating in
                the salon&apos;s public average score calculation.
              </p>

              <div className="arm-input-group">
                <label className="arm-input-label" htmlFor="arm-unhide-reason-input">Reason for Restoring (Optional)</label>
                <input
                  id="arm-unhide-reason-input"
                  type="text"
                  className="arm-input"
                  placeholder="e.g. Cleared after investigation / Reviewer verified"
                  value={unhideReason}
                  onChange={(e) => setUnhideReason(e.target.value)}
                />
              </div>
            </div>

            <div className="arm-modal-footer">
              <button
                type="button"
                className="arm-btn-cancel"
                onClick={() => setUnhideModalReview(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="arm-btn-confirm unhide"
                onClick={handleConfirmUnhide}
                disabled={actionLoading}
              >
                {actionLoading ? "Restoring..." : "Restore to Public"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moderation Audit Trail Modal */}
      {auditModalReview && (
        <div className="arm-modal-backdrop" onClick={() => setAuditModalReview(null)}>
          <div
            className="arm-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="arm-audit-modal-title"
          >
            <div className="arm-modal-header">
              <h3 id="arm-audit-modal-title">Audit Trail for Review #{auditModalReview.id}</h3>
              <button
                type="button"
                className="arm-modal-close"
                onClick={() => setAuditModalReview(null)}
              >
                ✕
              </button>
            </div>

            <div className="arm-modal-body">
              <div className="arm-modal-review-snippet">
                Customer: <strong>{auditModalReview.customer_name}</strong> • Salon:{" "}
                <strong>{auditModalReview.salon_name}</strong> • Rating: {auditModalReview.rating}★
              </div>

              <div className="arm-audit-timeline">
                {Array.isArray(auditModalReview.moderation_history) &&
                  auditModalReview.moderation_history.map((event, idx) => {
                    const isHiddenAction = event.action === "HIDDEN";
                    const eventDate = event.timestamp
                      ? new Date(event.timestamp).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Earlier";

                    return (
                      <div
                        key={idx}
                        className={`arm-audit-item ${isHiddenAction ? "hidden" : "unhidden"}`}
                      >
                        <div className="arm-audit-dot" />
                        <span className="arm-audit-action">
                          {isHiddenAction ? "🚫 Review Hidden" : "👁️ Review Restored"}
                        </span>
                        <span className="arm-audit-meta">
                          By {event.admin_name || "Admin"} on {eventDate}
                        </span>
                        {event.reason && (
                          <div className="arm-audit-reason">&quot;{event.reason}&quot;</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="arm-modal-footer">
              <button
                type="button"
                className="arm-btn-cancel"
                onClick={() => setAuditModalReview(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState, useEffect, useCallback, useMemo } from "react";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import AnalyticsFilterBar from "../../components/admin/analytics/AnalyticsFilterBar";
import AnalyticsKpiCard from "../../components/admin/analytics/AnalyticsKpiCard";
import AnalyticsLineChart from "../../components/admin/analytics/AnalyticsLineChart";
import AnalyticsBarChart from "../../components/admin/analytics/AnalyticsBarChart";
import AnalyticsDonutChart from "../../components/admin/analytics/AnalyticsDonutChart";
import "../../styles/adminAnalytics.css";

const ANALYTICS_SECTIONS = [
  { key: "overview", label: "Platform Overview", icon: "🌐" },
  { key: "users", label: "User Analytics", icon: "👥" },
  { key: "salons", label: "Salon Analytics", icon: "🏪" },
  { key: "bookings", label: "Booking Analytics", icon: "📅" },
  { key: "revenue", label: "Revenue Analytics", icon: "💳" },
  { key: "reviews", label: "Review Analytics", icon: "⭐" },
  { key: "offers", label: "Offer Analytics", icon: "🏷️" },
  { key: "subscriptions", label: "Subscription Analytics", icon: "📑" },
  { key: "support", label: "Support Ticket Analytics", icon: "🎫" },
];

export default function AdminAnalyticsDashboard() {
  const [selectedSection, setSelectedSection] = useState("overview");
  const [timeframe, setTimeframe] = useState("30d");
  const [customRange, setCustomRange] = useState({ start: "", end: "" });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch full analytics dataset from backend
  const fetchAnalytics = useCallback(
    async (isSilent = false) => {
      if (isSilent) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const params = { timeframe };
        if (timeframe === "custom" && customRange.start && customRange.end) {
          params.start_date = customRange.start;
          params.end_date = customRange.end;
        }

        const res = await api.get("/salons/admin/analytics/", { params });
        setData(res.data);
      } catch (err) {
        console.error("Failed to load analytics data:", err);
        setError(
          err.response?.data?.detail ||
            err.message ||
            "Unable to load analytics data. Please check your network connection."
        );
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeframe, customRange]
  );

  // Initial load & when timeframe / customRange changes
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Handle Preset Selection
  const handleSelectTimeframe = (preset) => {
    setTimeframe(preset);
  };

  // Handle Custom Range Application
  const handleApplyCustomRange = (start, end) => {
    setCustomRange({ start, end });
    setTimeframe("custom");
  };

  // Safe Extraction Helpers
  const overview = data?.overview || {};
  const overviewCharts = data?.overview_charts || {};
  const userStats = data?.user_analytics || {};
  const salonStats = data?.salon_analytics || {};
  const bookingStats = data?.booking_analytics || {};
  const revenueStats = data?.revenue_analytics || {};
  const reviewStats = data?.review_analytics || {};
  const offerStats = data?.offer_analytics || {};
  const subStats = data?.subscription_analytics || {};
  const supportStats = data?.support_analytics || {};
  const timeframeMeta = data?.timeframe || null;

  const getVal = (item, fallback = 0) => {
    if (item === undefined || item === null) return fallback;
    if (typeof item === "number") return item;
    if (typeof item === "string") {
      const parsed = Number(item);
      return !isNaN(parsed) && item.trim() !== "" ? parsed : item;
    }
    if (typeof item === "object") {
      if ("value" in item && item.value !== undefined && item.value !== null) {
        return getVal(item.value, fallback);
      }
      if ("count" in item && item.count !== undefined && item.count !== null) {
        return getVal(item.count, fallback);
      }
      if ("total" in item && item.total !== undefined && item.total !== null) {
        return getVal(item.total, fallback);
      }
      if ("amount" in item && item.amount !== undefined && item.amount !== null) {
        return getVal(item.amount, fallback);
      }
      return fallback;
    }
    return fallback;
  };

  const getGrowth = (item, fallback = 0) => {
    if (item === undefined || item === null) return fallback;
    if (typeof item === "number") return item;
    if (typeof item === "object" && "growth" in item) {
      const g = Number(item.growth);
      return isNaN(g) ? fallback : g;
    }
    const parsed = Number(item);
    return isNaN(parsed) ? fallback : parsed;
  };

  const periodLabel =
    timeframeMeta?.period_label || overview?.period_label || "vs. previous period";

  // Helper for star rating rendering
  const renderStars = (rating) => {
    const rounded = Math.round(Number(rating) || 0);
    return (
      <span className="analytics-stars-row" title={`${rating || 0} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < rounded ? "★" : "☆"}</span>
        ))}
      </span>
    );
  };

  // Export CSV summary for current active view
  const handleExportCSV = () => {
    if (!data) return;
    const tf = data.timeframe || {};

    const rows = [
      ["BookMySalon - Super Admin Platform Analytics Summary"],
      ["Generated At", new Date().toISOString()],
      [
        "Active Section",
        ANALYTICS_SECTIONS.find((s) => s.key === selectedSection)?.label ||
          selectedSection,
      ],
      ["Timeframe", tf.selected || timeframe],
      ["Period Range", `${tf.start_date || ""} to ${tf.end_date || ""}`],
      [],
    ];

    if (selectedSection === "overview") {
      rows.push(
        ["--- Platform Overview (7 Core Summary Cards) ---"],
        ["Metric", "Value", "Growth vs. Previous Period"],
        [
          "Total Platform Revenue",
          `₹${getVal(overview.total_revenue, overview.platform_revenue)}`,
          `${getGrowth(overview.total_revenue, overview.revenue_growth)}%`,
        ],
        [
          "Total Bookings",
          getVal(overview.total_bookings),
          `${getGrowth(overview.total_bookings)}%`,
        ],
        [
          "Total Salons",
          getVal(overview.total_salons),
          `${getGrowth(overview.total_salons)}%`,
        ],
        [
          "Total Customers (Customers only)",
          getVal(overview.total_customers),
          `${getGrowth(overview.total_customers)}%`,
        ],
        [
          "Total Reviews",
          getVal(overview.total_reviews),
          `${getGrowth(overview.total_reviews)}%`,
        ],
        [
          "Total Offers",
          getVal(overview.total_offers),
          `${getGrowth(overview.total_offers)}%`,
        ],
        [
          "Total Support Tickets",
          getVal(overview.total_support_tickets),
          `${getGrowth(overview.total_support_tickets)}%`,
        ]
      );
    } else if (selectedSection === "users") {
      rows.push(
        ["--- User Analytics ---"],
        ["Metric", "Value"],
        ["Total Customers", userStats.total_customers || 0],
        ["New Customers (In Period)", userStats.new_customers || 0],
        ["Active Customers", userStats.active_customers || 0],
        ["Blocked Customers", userStats.blocked_customers || 0],
        ["Customer Growth Rate", `${userStats.customer_growth_pct || 0}%`],
        ["Retention Rate", `${userStats.retention_rate_pct || 0}%`]
      );
    } else if (selectedSection === "salons") {
      rows.push(
        ["--- Salon Analytics ---"],
        ["Metric", "Value"],
        ["Total Salons", salonStats.total_salons || 0],
        ["Approved Salons", salonStats.approved_salons || 0],
        ["Pending Salons", salonStats.pending_salons || 0],
        ["Rejected Salons", salonStats.rejected_salons || 0],
        ["Blocked Salons", salonStats.blocked_salons || 0],
        ["Active Subscribed Salons", salonStats.active_salons || 0],
        ["Expired Subscription Salons", salonStats.expired_subs_salons || 0]
      );
    } else if (selectedSection === "bookings") {
      rows.push(
        ["--- Booking Analytics ---"],
        ["Metric", "Value"],
        ["Total Bookings", bookingStats.total_bookings || 0],
        ["Completed Bookings", bookingStats.completed_bookings || 0],
        ["Confirmed Bookings", bookingStats.confirmed_bookings || 0],
        ["Pending Bookings", bookingStats.pending_bookings || 0],
        ["Cancelled Bookings", bookingStats.cancelled_bookings || 0],
        ["No-Show Bookings", bookingStats.no_show_bookings || 0],
        ["Cancellation Rate", `${bookingStats.cancellation_rate_pct || 0}%`]
      );
    } else if (selectedSection === "revenue") {
      rows.push(
        ["--- Revenue Analytics (Platform Subscriptions Only) ---"],
        ["Metric", "Value"],
        ["Gross Subscription Revenue", `₹${revenueStats.gross_subscription_revenue || 0}`],
        ["Net Subscription Revenue", `₹${revenueStats.net_subscription_revenue || 0}`],
        ["Monthly Subscription Revenue", `₹${revenueStats.monthly_subscription_revenue || 0}`],
        ["Yearly Subscription Revenue", `₹${revenueStats.yearly_subscription_revenue || 0}`],
        ["Total Refund Amounts", `₹${revenueStats.refund_amounts || 0}`],
        ["Revenue Growth Rate", `${revenueStats.revenue_growth_pct || 0}%`]
      );
    } else if (selectedSection === "reviews") {
      rows.push(
        ["--- Review Analytics ---"],
        ["Metric", "Value"],
        ["Total Reviews", reviewStats.total_reviews || 0],
        ["Average Platform Rating", `${reviewStats.avg_rating || 0} / 5.0`],
        ["Visible Reviews", reviewStats.visible_reviews || 0],
        ["Hidden Reviews", reviewStats.hidden_reviews || 0]
      );
    } else if (selectedSection === "offers") {
      rows.push(
        ["--- Offer Analytics ---"],
        ["Metric", "Value"],
        ["Total Offers", offerStats.total_offers || 0],
        ["Active Offers", offerStats.active_offers || 0],
        ["Expired Offers", offerStats.expired_offers || 0],
        ["Total Redemptions", offerStats.total_redemptions || 0]
      );
    } else if (selectedSection === "subscriptions") {
      rows.push(
        ["--- Subscription Analytics ---"],
        ["Metric", "Value"],
        ["Total Active Subscriptions", subStats.total_active_subscriptions || 0],
        ["Upcoming Renewals (14 Days)", subStats.upcoming_renewals_count || 0],
        ["Renewal Rate", `${subStats.renewal_rate_pct || 0}%`],
        ["Free Trial Subscriptions", subStats.free_trial_subscriptions || 0],
        ["Expired Subscriptions", subStats.expired_subscriptions || 0],
        ["Cancelled Subscriptions", subStats.cancelled_subscriptions || 0]
      );
    } else if (selectedSection === "support") {
      rows.push(
        ["--- Support Ticket Analytics ---"],
        ["Metric", "Value"],
        ["Total Support Tickets", supportStats.total_tickets || 0],
        ["Open Tickets", supportStats.open_tickets || 0],
        ["In-Progress Tickets", supportStats.in_progress_tickets || 0],
        ["Pending Tickets", supportStats.pending_tickets || 0],
        ["Resolved Tickets", supportStats.resolved_tickets || 0],
        ["Urgent Complaints", supportStats.urgent_tickets || 0]
      );
    }

    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows.map((e) => e.map((cell) => `"${cell}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `BookMySalon_${selectedSection}_${tf.selected || timeframe}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Chart series configurations
  const overviewRevenueSeries = useMemo(
    () => [
      {
        key: "revenue",
        label: "Subscription Revenue",
        color: "#216a3e",
        prefix: "₹",
      },
    ],
    []
  );

  const overviewBookingSeries = useMemo(
    () => [{ key: "count", label: "Bookings", color: "#0284c7", prefix: "" }],
    []
  );

  const bookingTrendSeries = useMemo(
    () => [
      { key: "total", label: "Total Bookings", color: "#216a3e", prefix: "" },
      { key: "completed", label: "Completed", color: "#166534", prefix: "" },
      { key: "cancelled", label: "Cancelled", color: "#dc2626", prefix: "" },
    ],
    []
  );

  const userTrendSeries = useMemo(
    () => [
      { key: "count", label: "New Customers", color: "#216a3e", prefix: "" },
    ],
    []
  );

  const revenueTrendSeries = useMemo(
    () => [
      {
        key: "revenue",
        label: "Subscription Revenue",
        color: "#216a3e",
        prefix: "₹",
      },
    ],
    []
  );

  return (
    <div className="admin-analytics-page">
      {/* Super Admin Reusable Sidebar */}
      <AdminSidebar activeTab="analytics" />

      {/* Main Content Workspace */}
      <main className="admin-analytics-main">
        {/* Topbar */}
        <header className="admin-analytics-topbar">
          <div className="admin-analytics-topbar-left">
            <span className="admin-analytics-breadcrumb">
              Super Admin / <strong>Analytics Dashboard</strong>
            </span>
          </div>

          <div className="admin-analytics-topbar-right">
            <div className="admin-live-status-pill">
              <span className="admin-live-pulse-dot" />
              <span>Real-Time Engine</span>
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Dashboard Container */}
        <div className="admin-analytics-container">
          {/* Header Row with Heading & Section Dropdown Selector */}
          <div className="admin-analytics-header-row">
            <div className="admin-analytics-heading-wrap">
              <h1>Platform Analytics & Performance</h1>
              <p>
                Comprehensive growth metrics, subscription revenue oversight,
                booking patterns, and user activity.
              </p>
            </div>

            {/* Dropdown Section Selector */}
            <div className="analytics-section-selector-container">
              <label
                htmlFor="analytics-section-select"
                className="analytics-section-selector-label"
              >
                Analytics Section:
              </label>
              <div className="analytics-section-selector-box">
                <span className="analytics-section-icon">
                  {
                    ANALYTICS_SECTIONS.find((s) => s.key === selectedSection)
                      ?.icon
                  }
                </span>
                <select
                  id="analytics-section-select"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="analytics-section-select"
                  aria-label="Select Analytics Section"
                >
                  {ANALYTICS_SECTIONS.map((sec) => (
                    <option key={sec.key} value={sec.key}>
                      {sec.label}
                    </option>
                  ))}
                </select>
                <span className="analytics-select-arrow">▼</span>
              </div>
            </div>
          </div>

          {/* Date Filter Bar */}
          <AnalyticsFilterBar
            timeframe={timeframe}
            onSelectTimeframe={handleSelectTimeframe}
            customRange={customRange}
            onApplyCustomRange={handleApplyCustomRange}
            isRefreshing={isRefreshing}
            onRefresh={() => fetchAnalytics(true)}
            onExport={handleExportCSV}
            periodMeta={timeframeMeta}
          />

          {/* Error Banner */}
          {error && (
            <div className="analytics-error-banner" role="alert">
              <span>⚠️ {error}</span>
              <button type="button" onClick={() => fetchAnalytics(false)}>
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {loading ? (
            <div className="analytics-section">
              <div className="analytics-kpi-grid cols-7">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div
                    key={`skel-kpi-${i}`}
                    className="analytics-skeleton analytics-skeleton-card"
                  />
                ))}
              </div>
              <div className="analytics-grid-2col" style={{ marginTop: "20px" }}>
                <div className="analytics-skeleton analytics-skeleton-chart" />
                <div className="analytics-skeleton analytics-skeleton-chart" />
              </div>
            </div>
          ) : (
            <>
              {/* =========================================================
                  1. PLATFORM OVERVIEW (DEFAULT SELECTION)
                  - ONLY 7 summary cards
                  - Followed by 7 platform-wide overview charts
                  ========================================================= */}
              {selectedSection === "overview" && (
                <section
                  className="analytics-section"
                  aria-labelledby="overview-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="overview-heading" className="analytics-section-title">
                      <span>🌐</span> Platform Overview
                    </h2>
                    <span className="analytics-section-badge">
                      7 Core Platform Metrics
                    </span>
                  </div>

                  {/* ONLY THE 7 SUMMARY CARDS */}
                  <div className="analytics-kpi-grid cols-7">
                    {/* 1. Total Platform Revenue */}
                    <AnalyticsKpiCard
                      title="Total Platform Revenue"
                      value={getVal(
                        overview.total_revenue,
                        overview.platform_revenue || 0
                      )}
                      prefix="₹"
                      growth={getGrowth(
                        overview.total_revenue,
                        overview.revenue_growth
                      )}
                      periodLabel={periodLabel}
                      icon="💰"
                      variant="revenue"
                      subtext="Actual subscription income collected"
                    />

                    {/* 2. Total Bookings */}
                    <AnalyticsKpiCard
                      title="Total Bookings"
                      value={getVal(overview.total_bookings)}
                      growth={getGrowth(overview.total_bookings)}
                      periodLabel={periodLabel}
                      icon="📅"
                      subtext="All salon appointment reservations"
                    />

                    {/* 3. Total Salons */}
                    <AnalyticsKpiCard
                      title="Total Salons"
                      value={getVal(overview.total_salons)}
                      growth={getGrowth(overview.total_salons)}
                      periodLabel={periodLabel}
                      icon="🏪"
                      subtext="All registered salon partners"
                    />

                    {/* 4. Total Customers (CUSTOMERS ONLY) */}
                    <AnalyticsKpiCard
                      title="Total Customers"
                      value={getVal(overview.total_customers)}
                      growth={getGrowth(overview.total_customers)}
                      periodLabel={periodLabel}
                      icon="👥"
                      variant="highlight"
                      subtext="Verified client consumer profiles"
                    />

                    {/* 5. Total Reviews */}
                    <AnalyticsKpiCard
                      title="Total Reviews"
                      value={getVal(overview.total_reviews)}
                      growth={getGrowth(overview.total_reviews)}
                      periodLabel={periodLabel}
                      icon="⭐"
                      subtext="Customer feedback and ratings"
                    />

                    {/* 6. Total Offers */}
                    <AnalyticsKpiCard
                      title="Total Offers"
                      value={getVal(overview.total_offers)}
                      growth={getGrowth(overview.total_offers)}
                      periodLabel={periodLabel}
                      icon="🏷️"
                      subtext="Promotions and discount deals"
                    />

                    {/* 7. Total Support Tickets */}
                    <AnalyticsKpiCard
                      title="Total Support Tickets"
                      value={getVal(overview.total_support_tickets)}
                      growth={getGrowth(overview.total_support_tickets)}
                      periodLabel={periodLabel}
                      icon="🎫"
                      subtext="Inquiries and support tickets"
                    />
                  </div>

                  {/* PLATFORM OVERVIEW CHARTS */}
                  <div
                    className="analytics-grid-2col"
                    style={{ marginTop: "12px" }}
                  >
                    {/* 1. Monthly platform revenue trends */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Platform Revenue Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            Platform subscription income trajectory
                          </p>
                        </div>
                      </div>
                      <AnalyticsLineChart
                        data={overviewCharts.revenue_trends || []}
                        xKey="label"
                        series={overviewRevenueSeries}
                        height={240}
                        emptyMessage="No revenue recorded in this period"
                      />
                    </div>

                    {/* 2. Monthly booking trends */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Booking Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            Platform-wide appointment volume trajectory
                          </p>
                        </div>
                      </div>
                      <AnalyticsLineChart
                        data={overviewCharts.booking_trends || []}
                        xKey="label"
                        series={overviewBookingSeries}
                        height={240}
                        emptyMessage="No booking activity during this range"
                      />
                    </div>
                  </div>

                  <div className="analytics-grid-2col">
                    {/* 3. Salon registration growth */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Salon Registration Growth
                          </h3>
                          <p className="analytics-card-subtitle">
                            New salon partners onboarding per month
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={overviewCharts.salon_growth || []}
                        xKey="label"
                        yKey="count"
                        unit="salons"
                        color="#216a3e"
                        highlightColor="#0f2e1c"
                        height={230}
                        emptyMessage="No salon onboarding records"
                      />
                    </div>

                    {/* 4. Customer registration growth */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Customer Registration Growth
                          </h3>
                          <p className="analytics-card-subtitle">
                            New customer consumer accounts joined per month
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={overviewCharts.customer_growth || []}
                        xKey="label"
                        yKey="count"
                        unit="customers"
                        color="#166534"
                        highlightColor="#052e16"
                        height={230}
                        emptyMessage="No customer registrations recorded"
                      />
                    </div>
                  </div>

                  <div className="analytics-grid-split">
                    {/* 5. Review trends & 6. Offer usage statistics */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px",
                      }}
                    >
                      {/* Review trends */}
                      <div className="analytics-card">
                        <div className="analytics-card-header">
                          <div>
                            <h3 className="analytics-card-title">
                              Review Trends
                            </h3>
                            <p className="analytics-card-subtitle">
                              Monthly customer feedback submission volume
                            </p>
                          </div>
                        </div>
                        <AnalyticsBarChart
                          data={overviewCharts.review_trends || []}
                          xKey="label"
                          yKey="count"
                          unit="reviews"
                          color="#f59e0b"
                          highlightColor="#b45309"
                          height={200}
                          emptyMessage="No reviews submitted yet"
                        />
                      </div>

                      {/* Offer usage statistics */}
                      <div className="analytics-card">
                        <div className="analytics-card-header">
                          <div>
                            <h3 className="analytics-card-title">
                              Offer Usage Statistics
                            </h3>
                            <p className="analytics-card-subtitle">
                              Monthly discount and coupon redemptions
                            </p>
                          </div>
                        </div>
                        <AnalyticsBarChart
                          data={overviewCharts.offer_usage || []}
                          xKey="label"
                          yKey="count"
                          unit="redemptions"
                          color="#9333ea"
                          highlightColor="#6b21a8"
                          height={200}
                          emptyMessage="No offer redemptions recorded"
                        />
                      </div>
                    </div>

                    {/* 7. Support ticket status distribution */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Support Ticket Status Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Overview of active tickets by state
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={overviewCharts.ticket_distribution || []}
                        centerLabel="Total Tickets"
                        size={190}
                        emptyMessage="No support tickets registered"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  2. USER ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "users" && (
                <section
                  className="analytics-section"
                  aria-labelledby="users-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="users-heading" className="analytics-section-title">
                      <span>👥</span> User Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Customer Demographics & Retention
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Customers"
                      value={userStats.total_customers || 0}
                      icon="👥"
                      variant="highlight"
                      subtext="Registered customer consumer accounts"
                    />
                    <AnalyticsKpiCard
                      title="New Customers"
                      value={userStats.new_customers || 0}
                      growth={userStats.customer_growth_pct}
                      periodLabel={periodLabel}
                      icon="✨"
                      subtext="Joined in selected timeframe"
                    />
                    <AnalyticsKpiCard
                      title="Active Customers"
                      value={userStats.active_customers || 0}
                      icon="🟢"
                      subtext="Healthy active platform accounts"
                    />
                    <AnalyticsKpiCard
                      title="Blocked Customers"
                      value={userStats.blocked_customers || 0}
                      icon="🚫"
                      subtext="Suspended customer accounts"
                    />
                    <AnalyticsKpiCard
                      title="Customer Growth"
                      value={userStats.customer_growth_pct || 0}
                      suffix="%"
                      icon="📈"
                      subtext="Growth vs previous timeframe"
                    />
                    <AnalyticsKpiCard
                      title="Customer Retention Rate"
                      value={
                        userStats.retention_rate_pct ??
                        userStats.retention_rate ??
                        0
                      }
                      suffix="%"
                      icon="🔁"
                      variant="highlight"
                      subtext="Customers with 2+ bookings"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Customer Registration Trends Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Customer Registration Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            Monthly customer onboarding trajectory
                          </p>
                        </div>
                      </div>
                      <AnalyticsLineChart
                        data={userStats.registration_trends || []}
                        xKey="label"
                        series={userTrendSeries}
                        height={260}
                        emptyMessage="No customer registrations in this timeframe"
                      />
                    </div>

                    {/* Active vs Blocked Customer Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Active vs Blocked Customer Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Account compliance & status breakdown
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={userStats.active_vs_blocked_distribution || []}
                        centerLabel="Customers"
                        size={180}
                        emptyMessage="No customer accounts found"
                      />

                      <div className="analytics-stat-callout">
                        <span className="analytics-stat-callout-title">
                          Retention Rate
                        </span>
                        <span className="analytics-stat-callout-val">
                          {userStats.retention_rate_pct || 0}% Repeat Clients
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Most Active Customers Table */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Most Active Customers
                        </h3>
                        <p className="analytics-card-subtitle">
                          Top booking platform patrons
                        </p>
                      </div>
                    </div>

                    <div
                      className="analytics-table-wrapper"
                      style={{ maxHeight: "360px", overflowY: "auto" }}
                    >
                      {(userStats.most_active_customers || []).length === 0 ? (
                        <div className="analytics-table-empty">
                          <p>No customer booking records found</p>
                        </div>
                      ) : (
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th># Rank</th>
                              <th>Customer</th>
                              <th>Bookings</th>
                              <th>Total Spent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userStats.most_active_customers.map((c, idx) => (
                              <tr key={`top-cust-${c.id || idx}`}>
                                <td>
                                  <span
                                    className={`analytics-rank-badge rank-${
                                      idx + 1
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td>
                                  <div className="bold-cell">
                                    {c.name || "Customer"}
                                  </div>
                                  <div className="sub-cell">{c.email}</div>
                                </td>
                                <td>
                                  <span className="analytics-count-pill">
                                    {c.booking_count || c.bookings_count}
                                  </span>
                                </td>
                                <td className="revenue-cell">
                                  ₹
                                  {Number(
                                    c.total_spent || c.total_spend || 0
                                  ).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  3. SALON ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "salons" && (
                <section
                  className="analytics-section"
                  aria-labelledby="salons-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="salons-heading" className="analytics-section-title">
                      <span>🏪</span> Salon Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Onboarding, Compliance & Rankings
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Salons"
                      value={salonStats.total_salons || 0}
                      icon="🏪"
                      subtext="All salons across platform"
                    />
                    <AnalyticsKpiCard
                      title="Approved Salons"
                      value={
                        salonStats.approved_salons ?? salonStats.approved ?? 0
                      }
                      icon="✅"
                      variant="highlight"
                      subtext="Verified & active partners"
                    />
                    <AnalyticsKpiCard
                      title="Pending Salons"
                      value={
                        salonStats.pending_salons ?? salonStats.pending ?? 0
                      }
                      icon="⏳"
                      subtext="Awaiting audit & approval"
                    />
                    <AnalyticsKpiCard
                      title="Rejected Salons"
                      value={
                        salonStats.rejected_salons ?? salonStats.rejected ?? 0
                      }
                      icon="✕"
                      subtext="Declined applications"
                    />
                    <AnalyticsKpiCard
                      title="Blocked Salons"
                      value={
                        salonStats.blocked_salons ?? salonStats.blocked ?? 0
                      }
                      icon="🚫"
                      subtext="Suspended salon partners"
                    />
                    <AnalyticsKpiCard
                      title="Active Subscribed Salons"
                      value={
                        salonStats.active_salons ??
                        salonStats.active_subscriptions ??
                        0
                      }
                      icon="💳"
                      variant="highlight"
                      subtext="With current valid plans"
                    />
                    <AnalyticsKpiCard
                      title="Expired Subscription Salons"
                      value={
                        salonStats.expired_subs_salons ??
                        salonStats.expired_subscriptions ??
                        0
                      }
                      icon="⚠️"
                      subtext="Needs subscription renewal"
                    />
                  </div>

                  <div className="analytics-grid-2col">
                    {/* Salon Approval Status Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Salon Approval Status Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Compliance standing breakdown
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={
                          salonStats.approval_status_distribution ||
                          salonStats.status_distribution ||
                          []
                        }
                        centerLabel="Salons"
                        size={180}
                        emptyMessage="No salons in database"
                      />
                    </div>

                    {/* Monthly Salon Registration Trends Bar Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Salon Registration Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            New applications submitted per month
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={salonStats.registration_trends || []}
                        xKey="label"
                        yKey="count"
                        unit="salons"
                        color="#216a3e"
                        highlightColor="#144326"
                        height={220}
                        emptyMessage="No salon registrations recorded"
                      />
                    </div>
                  </div>

                  {/* Top 5 Salons Table */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Top 5 Salons by Booking Count
                        </h3>
                        <p className="analytics-card-subtitle">
                          Highest volume salons across platform
                        </p>
                      </div>
                    </div>
                    <div className="analytics-table-wrapper">
                      {(salonStats.top_salons || []).length === 0 ? (
                        <div className="analytics-table-empty">
                          <p>No salon booking records available</p>
                        </div>
                      ) : (
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th># Rank</th>
                              <th>Salon Name</th>
                              <th>Location</th>
                              <th>Total Bookings</th>
                              <th>Completed</th>
                              <th>Total Booking Volume</th>
                            </tr>
                          </thead>
                          <tbody>
                            {salonStats.top_salons.map((s, idx) => (
                              <tr key={`top-s-${s.id || idx}`}>
                                <td>
                                  <span
                                    className={`analytics-rank-badge rank-${
                                      idx + 1
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                </td>
                                <td className="bold-cell">{s.name}</td>
                                <td>📍 {s.city || "—"}</td>
                                <td>
                                  <span className="analytics-count-pill">
                                    {s.booking_count || s.bookings_count}
                                  </span>
                                </td>
                                <td>
                                  <span className="analytics-status-pill success">
                                    {s.completed_count}
                                  </span>
                                </td>
                                <td className="revenue-cell">
                                  ₹
                                  {Number(
                                    s.revenue || s.booking_revenue || 0
                                  ).toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  4. BOOKING ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "bookings" && (
                <section
                  className="analytics-section"
                  aria-labelledby="bookings-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="bookings-heading" className="analytics-section-title">
                      <span>📅</span> Booking Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Appointment Volumes & Peak Patterns
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Bookings"
                      value={bookingStats.total_bookings || 0}
                      icon="📋"
                      subtext="Appointments booked in period"
                    />
                    <AnalyticsKpiCard
                      title="Completed Bookings"
                      value={
                        bookingStats.completed_bookings ??
                        bookingStats.completed ??
                        0
                      }
                      icon="✅"
                      variant="highlight"
                      subtext="Fulfilled salon appointments"
                    />
                    <AnalyticsKpiCard
                      title="Confirmed Bookings"
                      value={
                        bookingStats.confirmed_bookings ??
                        bookingStats.confirmed ??
                        0
                      }
                      icon="📌"
                      subtext="Upcoming scheduled appointments"
                    />
                    <AnalyticsKpiCard
                      title="Pending Bookings"
                      value={
                        bookingStats.pending_bookings ??
                        bookingStats.pending ??
                        0
                      }
                      icon="⏳"
                      subtext="Awaiting salon confirmation"
                    />
                    <AnalyticsKpiCard
                      title="Cancelled Bookings"
                      value={
                        bookingStats.cancelled_bookings ??
                        bookingStats.cancelled ??
                        0
                      }
                      icon="❌"
                      subtext="Customer or salon cancellations"
                    />
                    <AnalyticsKpiCard
                      title="No-Show Bookings"
                      value={
                        bookingStats.no_show_bookings ??
                        bookingStats.no_show ??
                        0
                      }
                      icon="🚫"
                      subtext="Client missed appointments"
                    />
                    <AnalyticsKpiCard
                      title="Cancellation Rate"
                      value={
                        bookingStats.cancellation_rate_pct ??
                        bookingStats.cancellation_rate ??
                        0
                      }
                      suffix="%"
                      icon="📉"
                      subtext="Proportion of cancelled bookings"
                    />
                  </div>

                  {/* Booking Trends Line Chart */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Booking Volume Trajectory
                        </h3>
                        <p className="analytics-card-subtitle">
                          Daily/Weekly booking trends showing total volume,
                          completed, and cancellations
                        </p>
                      </div>
                    </div>
                    <AnalyticsLineChart
                      data={bookingStats.trends || []}
                      xKey="label"
                      series={bookingTrendSeries}
                      height={260}
                      emptyMessage="No booking activity during this range"
                    />
                  </div>

                  {/* Peak Booking Times & Status Distribution */}
                  <div className="analytics-grid-2col">
                    {/* Peak Booking Days */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Peak Booking Days
                          </h3>
                          <p className="analytics-card-subtitle">
                            Traffic volume by day of the week
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={bookingStats.peak_days || []}
                        xKey="label"
                        yKey="count"
                        unit="bookings"
                        color="#216a3e"
                        highlightColor="#0f2e1c"
                        height={220}
                      />
                    </div>

                    {/* Peak Booking Hours */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Peak Booking Hours
                          </h3>
                          <p className="analytics-card-subtitle">
                            Hourly traffic distribution (08:00–21:00)
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={bookingStats.peak_hours || []}
                        xKey="label"
                        yKey="count"
                        unit="bookings"
                        color="#2d7a4c"
                        highlightColor="#123d24"
                        height={220}
                      />
                    </div>
                  </div>

                  {/* Booking Status Donut */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Booking Status Distribution
                        </h3>
                        <p className="analytics-card-subtitle">
                          Breakdown by appointment state
                        </p>
                      </div>
                    </div>
                    <AnalyticsDonutChart
                      data={bookingStats.status_distribution || []}
                      centerLabel="Total Bookings"
                      size={190}
                      emptyMessage="No bookings in this period"
                    />
                  </div>
                </section>
              )}

              {/* =========================================================
                  5. REVENUE ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "revenue" && (
                <section
                  className="analytics-section"
                  aria-labelledby="revenue-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="revenue-heading" className="analytics-section-title">
                      <span>💳</span> Revenue Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Platform Subscription Income Only
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Net Subscription Revenue"
                      value={revenueStats.net_subscription_revenue || 0}
                      prefix="₹"
                      growth={
                        revenueStats.revenue_growth_pct ??
                        revenueStats.revenue_growth
                      }
                      periodLabel={periodLabel}
                      icon="💵"
                      variant="revenue"
                      subtext="Actual revenue after deducting refunds"
                    />

                    <AnalyticsKpiCard
                      title="Total Gross Revenue"
                      value={
                        revenueStats.total_subscription_revenue ??
                        revenueStats.gross_subscription_revenue ??
                        0
                      }
                      prefix="₹"
                      icon="💰"
                      subtext="Total subscription payments received"
                    />

                    <AnalyticsKpiCard
                      title="Monthly Plan Revenue"
                      value={revenueStats.monthly_subscription_revenue || 0}
                      prefix="₹"
                      icon="📆"
                      subtext="Revenue from 1-month subscriptions"
                    />

                    <AnalyticsKpiCard
                      title="Yearly Plan Revenue"
                      value={revenueStats.yearly_subscription_revenue || 0}
                      prefix="₹"
                      icon="⭐"
                      subtext="Revenue from annual subscriptions"
                    />

                    <AnalyticsKpiCard
                      title="Total Refund Amounts"
                      value={
                        revenueStats.refund_amounts ??
                        revenueStats.refund_amount ??
                        0
                      }
                      prefix="₹"
                      icon="↩️"
                      subtext="Processed refunds and adjustments"
                    />

                    <AnalyticsKpiCard
                      title="Revenue Growth Rate"
                      value={
                        revenueStats.revenue_growth_pct ??
                        revenueStats.revenue_growth ??
                        0
                      }
                      suffix="%"
                      icon="📈"
                      variant="highlight"
                      subtext="Period-over-period platform growth"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Revenue Growth Trend Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Subscription Revenue Trend
                          </h3>
                          <p className="analytics-card-subtitle">
                            Income trajectory from subscription plans
                          </p>
                        </div>
                      </div>
                      <AnalyticsLineChart
                        data={
                          revenueStats.monthly_trends ||
                          revenueStats.monthly_trend ||
                          []
                        }
                        xKey="label"
                        series={revenueTrendSeries}
                        height={260}
                        emptyMessage="No revenue recorded in the selected period"
                      />
                    </div>

                    {/* Revenue by Subscription Plan Breakdown */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Revenue by Subscription Plan
                          </h3>
                          <p className="analytics-card-subtitle">
                            Tier contribution breakdown
                          </p>
                        </div>
                      </div>

                      <div
                        className="analytics-donut-legend"
                        style={{ marginTop: "12px" }}
                      >
                        {(revenueStats.revenue_by_plan || []).length === 0 ? (
                          <p className="analytics-table-empty">
                            No plan revenue recorded yet
                          </p>
                        ) : (
                          revenueStats.revenue_by_plan.map((p, idx) => (
                            <div
                              key={`plan-rev-${idx}`}
                              className="analytics-donut-legend-item"
                              style={{ padding: "10px 12px" }}
                            >
                              <span
                                className="analytics-donut-legend-dot"
                                style={{
                                  backgroundColor:
                                    idx === 0
                                      ? "#216a3e"
                                      : idx === 1
                                      ? "#0284c7"
                                      : idx === 2
                                      ? "#9333ea"
                                      : "#f59e0b",
                                }}
                              />
                              <div style={{ flex: 1 }}>
                                <strong
                                  style={{
                                    fontSize: "13px",
                                    color: "#153822",
                                  }}
                                >
                                  {p.name || p.plan_name}
                                </strong>
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#607968",
                                  }}
                                >
                                  {p.count || p.subscribers} subscriber
                                  {(p.count || p.subscribers) === 1 ? "" : "s"}
                                </div>
                              </div>
                              <span
                                style={{
                                  fontWeight: 700,
                                  color: "#16482a",
                                  fontSize: "14px",
                                }}
                              >
                                ₹
                                {Number(p.revenue || 0).toLocaleString(
                                  "en-IN",
                                  { minimumFractionDigits: 2 }
                                )}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  6. REVIEW ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "reviews" && (
                <section
                  className="analytics-section"
                  aria-labelledby="reviews-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="reviews-heading" className="analytics-section-title">
                      <span>⭐</span> Review Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Customer Feedback & Rating Quality
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Reviews"
                      value={reviewStats.total_reviews || 0}
                      icon="⭐"
                      subtext="All customer feedback submissions"
                    />
                    <AnalyticsKpiCard
                      title="Average Rating"
                      value={`${reviewStats.avg_rating || 0} / 5.0`}
                      icon="🌟"
                      variant="highlight"
                      subtext="Overall platform rating score"
                    />
                    <AnalyticsKpiCard
                      title="Visible Reviews"
                      value={reviewStats.visible_reviews || 0}
                      icon="👁️"
                      subtext="Publicly published reviews"
                    />
                    <AnalyticsKpiCard
                      title="Hidden / Flagged"
                      value={reviewStats.hidden_reviews || 0}
                      icon="🔒"
                      subtext="Moderated or hidden reviews"
                    />
                    <AnalyticsKpiCard
                      title="Reviews in Period"
                      value={reviewStats.period_reviews || 0}
                      icon="📅"
                      subtext="Submitted in active timeframe"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Rating Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Rating Distribution (5★ to 1★)
                          </h3>
                          <p className="analytics-card-subtitle">
                            Breakdown of customer star ratings
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={reviewStats.rating_distribution || []}
                        centerLabel="Reviews"
                        size={180}
                        emptyMessage="No ratings recorded yet"
                      />
                    </div>

                    {/* Monthly Review Trends Bar Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Review Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            Review submissions over time
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={reviewStats.review_trends || []}
                        xKey="label"
                        yKey="count"
                        unit="reviews"
                        color="#f59e0b"
                        highlightColor="#b45309"
                        height={240}
                        emptyMessage="No review trends available"
                      />
                    </div>
                  </div>

                  {/* Top-Rated vs Low-Rated Salons Comparison */}
                  <div className="analytics-grid-2col">
                    {/* Top-Rated Salons */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Top-Rated Salons
                          </h3>
                          <p className="analytics-card-subtitle">
                            Salons with highest customer satisfaction
                          </p>
                        </div>
                      </div>
                      <div className="analytics-table-wrapper">
                        {(reviewStats.top_rated_salons || []).length === 0 ? (
                          <div className="analytics-table-empty">
                            <p>No reviewed salons found</p>
                          </div>
                        ) : (
                          <table className="analytics-table">
                            <thead>
                              <tr>
                                <th>Salon</th>
                                <th>Location</th>
                                <th>Rating</th>
                                <th>Reviews</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reviewStats.top_rated_salons.map((s, idx) => (
                                <tr key={`top-rated-${s.id || idx}`}>
                                  <td className="bold-cell">{s.name}</td>
                                  <td>📍 {s.city || "—"}</td>
                                  <td>
                                    <span className="analytics-rating-pill high">
                                      ★ {s.avg_rating}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="analytics-count-pill">
                                      {s.review_count}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>

                    {/* Low-Rated Salons */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Low-Rated Salons (&lt; 3.5★)
                          </h3>
                          <p className="analytics-card-subtitle">
                            Salons requiring quality monitoring & audit
                          </p>
                        </div>
                      </div>
                      <div className="analytics-table-wrapper">
                        {(reviewStats.low_rated_salons || []).length === 0 ? (
                          <div className="analytics-table-empty">
                            <p>No low-rated salons — all partners performing well!</p>
                          </div>
                        ) : (
                          <table className="analytics-table">
                            <thead>
                              <tr>
                                <th>Salon</th>
                                <th>Location</th>
                                <th>Rating</th>
                                <th>Reviews</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reviewStats.low_rated_salons.map((s, idx) => (
                                <tr key={`low-rated-${s.id || idx}`}>
                                  <td className="bold-cell">{s.name}</td>
                                  <td>📍 {s.city || "—"}</td>
                                  <td>
                                    <span className="analytics-rating-pill low">
                                      ★ {s.avg_rating}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="analytics-count-pill">
                                      {s.review_count}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent Customer Reviews Feed */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Recent Customer Reviews
                        </h3>
                        <p className="analytics-card-subtitle">
                          Latest feedback received across all salons
                        </p>
                      </div>
                    </div>

                    <div className="analytics-reviews-feed">
                      {(reviewStats.recent_reviews || []).length === 0 ? (
                        <div className="analytics-table-empty">
                          <p>No recent customer reviews</p>
                        </div>
                      ) : (
                        reviewStats.recent_reviews.map((r, idx) => (
                          <div
                            key={`review-card-${r.id || idx}`}
                            className="analytics-review-card"
                          >
                            <div className="analytics-review-header">
                              <div>
                                <span className="analytics-review-customer">
                                  {r.customer_name}
                                </span>
                                <span className="analytics-review-salon">
                                  {" "}
                                  • on {r.salon_name}
                                </span>
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                }}
                              >
                                {renderStars(r.rating)}
                                <span
                                  className={`analytics-status-pill ${
                                    r.is_hidden ? "danger" : "success"
                                  }`}
                                >
                                  {r.is_hidden ? "Hidden" : "Visible"}
                                </span>
                              </div>
                            </div>
                            <p className="analytics-review-comment">
                              "{r.comment}"
                            </p>
                            <span className="analytics-review-date">
                              📅 {r.created_at}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  7. OFFER ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "offers" && (
                <section
                  className="analytics-section"
                  aria-labelledby="offers-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="offers-heading" className="analytics-section-title">
                      <span>🏷️</span> Offer Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Promotions & Redemption Volume
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Offers"
                      value={offerStats.total_offers || 0}
                      icon="🏷️"
                      subtext="All campaign offers created"
                    />
                    <AnalyticsKpiCard
                      title="Active Offers"
                      value={offerStats.active_offers || 0}
                      icon="✅"
                      variant="highlight"
                      subtext="Currently running deals"
                    />
                    <AnalyticsKpiCard
                      title="Expired / Inactive"
                      value={offerStats.expired_offers || 0}
                      icon="⏳"
                      subtext="Concluded promotional deals"
                    />
                    <AnalyticsKpiCard
                      title="Total Redemptions"
                      value={offerStats.total_redemptions || 0}
                      icon="🎟️"
                      variant="highlight"
                      subtext="All-time coupon usages"
                    />
                    <AnalyticsKpiCard
                      title="Redemptions in Period"
                      value={offerStats.period_redemptions || 0}
                      icon="📅"
                      subtext="Redeemed in active timeframe"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Offer Type Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Offer Type Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Percentage & Flat discount offerings
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={offerStats.offer_type_distribution || []}
                        centerLabel="Offers"
                        size={180}
                        emptyMessage="No offer categories found"
                      />
                    </div>

                    {/* Monthly Redemptions Trends Bar Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Offer Redemptions
                          </h3>
                          <p className="analytics-card-subtitle">
                            Customer usage volume trajectory
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={offerStats.usage_trends || []}
                        xKey="label"
                        yKey="count"
                        unit="redemptions"
                        color="#9333ea"
                        highlightColor="#6b21a8"
                        height={240}
                        emptyMessage="No offer redemptions recorded"
                      />
                    </div>
                  </div>

                  {/* Most-Used Offers Table */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Most-Used Offers & Performance
                        </h3>
                        <p className="analytics-card-subtitle">
                          Campaigns driving the most client conversions
                        </p>
                      </div>
                    </div>
                    <div className="analytics-table-wrapper">
                      {(offerStats.most_used_offers || []).length === 0 ? (
                        <div className="analytics-table-empty">
                          <p>No offer records available</p>
                        </div>
                      ) : (
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>Offer Title</th>
                              <th>Salon Partner</th>
                              <th>Coupon Code</th>
                              <th>Discount</th>
                              <th>Usage Count</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {offerStats.most_used_offers.map((o, idx) => (
                              <tr key={`offer-row-${o.id || idx}`}>
                                <td className="bold-cell">{o.title}</td>
                                <td>{o.salon_name}</td>
                                <td>
                                  <span className="analytics-code-badge">
                                    {o.code}
                                  </span>
                                </td>
                                <td className="revenue-cell">{o.discount}</td>
                                <td>
                                  <span className="analytics-count-pill">
                                    {o.usage_count}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`analytics-status-pill ${
                                      o.is_active ? "success" : "danger"
                                    }`}
                                  >
                                    {o.is_active ? "Active" : "Expired"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  8. SUBSCRIPTION ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "subscriptions" && (
                <section
                  className="analytics-section"
                  aria-labelledby="subscriptions-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2
                      id="subscriptions-heading"
                      className="analytics-section-title"
                    >
                      <span>📑</span> Subscription Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Platform Tier Health & Renewals
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Active Subscriptions"
                      value={
                        subStats.total_active_subscriptions ??
                        subStats.total_active ??
                        0
                      }
                      icon="💳"
                      variant="highlight"
                      subtext="Salons on paid or trial plans"
                    />
                    <AnalyticsKpiCard
                      title="Upcoming Renewals (14 Days)"
                      value={
                        subStats.upcoming_renewals_count ??
                        subStats.upcoming_renewals ??
                        0
                      }
                      icon="⏰"
                      subtext="Salons approaching renewal"
                    />
                    <AnalyticsKpiCard
                      title="Subscription Renewal Rate"
                      value={
                        subStats.renewal_rate_pct ??
                        subStats.renewal_rate ??
                        0
                      }
                      suffix="%"
                      icon="🔄"
                      variant="highlight"
                      subtext="Salons renewing their plan"
                    />
                    <AnalyticsKpiCard
                      title="Active Free Trials"
                      value={
                        subStats.free_trial_subscriptions ??
                        subStats.free_trials ??
                        0
                      }
                      icon="🎁"
                      subtext="Salons in trial onboarding"
                    />
                    <AnalyticsKpiCard
                      title="Expired Subscriptions"
                      value={subStats.expired_subscriptions || 0}
                      icon="⚠️"
                      subtext="Lapsed salon accounts"
                    />
                    <AnalyticsKpiCard
                      title="Cancelled Subscriptions"
                      value={subStats.cancelled_subscriptions || 0}
                      icon="✕"
                      subtext="Discontinued tier memberships"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Subscription Plan Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Subscription Tier Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Active salons across package plans
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={subStats.plan_distribution || []}
                        centerLabel="Subscriptions"
                        size={180}
                        emptyMessage="No active subscriptions found"
                      />
                    </div>

                    {/* Plan Breakdown Summary */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Membership Status Breakdown
                          </h3>
                          <p className="analytics-card-subtitle">
                            Summary counts by package term
                          </p>
                        </div>
                      </div>

                      <div
                        className="analytics-donut-legend"
                        style={{ marginTop: "12px" }}
                      >
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#216a3e" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Monthly Plan Subscribers
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.monthly_subscribers || 0}
                          </span>
                        </div>
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#0284c7" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Quarterly Plan Subscribers
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.quarterly_subscribers || 0}
                          </span>
                        </div>
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#9333ea" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Yearly Plan Subscribers
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.yearly_subscribers || 0}
                          </span>
                        </div>
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#f59e0b" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Custom Tier Subscribers
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.custom_subscribers || 0}
                          </span>
                        </div>
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#ef4444" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Expired Subscriptions
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.expired_subscriptions || 0}
                          </span>
                        </div>
                        <div
                          className="analytics-donut-legend-item"
                          style={{ padding: "8px 12px" }}
                        >
                          <span
                            className="analytics-donut-legend-dot"
                            style={{ backgroundColor: "#6b7280" }}
                          />
                          <span className="analytics-donut-legend-name">
                            Cancelled Subscriptions
                          </span>
                          <span className="analytics-donut-legend-count">
                            {subStats.cancelled_subscriptions || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* =========================================================
                  9. SUPPORT TICKET ANALYTICS SECTION
                  ========================================================= */}
              {selectedSection === "support" && (
                <section
                  className="analytics-section"
                  aria-labelledby="support-heading"
                >
                  <div className="analytics-section-title-wrap">
                    <h2 id="support-heading" className="analytics-section-title">
                      <span>🎫</span> Support Ticket Analytics
                    </h2>
                    <span className="analytics-section-badge">
                      Customer & Merchant Inquiries
                    </span>
                  </div>

                  <div className="analytics-kpi-grid">
                    <AnalyticsKpiCard
                      title="Total Support Tickets"
                      value={supportStats.total_tickets || 0}
                      icon="🎫"
                      subtext="All customer & salon tickets"
                    />
                    <AnalyticsKpiCard
                      title="Open Tickets"
                      value={supportStats.open_tickets || 0}
                      icon="⏳"
                      subtext="Awaiting initial response"
                    />
                    <AnalyticsKpiCard
                      title="In-Progress Tickets"
                      value={supportStats.in_progress_tickets || 0}
                      icon="🛠️"
                      subtext="Currently being worked on"
                    />
                    <AnalyticsKpiCard
                      title="Pending Resolution"
                      value={supportStats.pending_tickets || 0}
                      icon="⌛"
                      subtext="Open, waiting, or in progress"
                    />
                    <AnalyticsKpiCard
                      title="Resolved Tickets"
                      value={supportStats.resolved_tickets || 0}
                      icon="✅"
                      variant="highlight"
                      subtext="Successfully resolved tickets"
                    />
                    <AnalyticsKpiCard
                      title="Urgent Complaints"
                      value={supportStats.urgent_tickets || 0}
                      icon="🚨"
                      variant={
                        supportStats.urgent_tickets > 0 ? "highlight" : "default"
                      }
                      subtext="High-priority tickets"
                    />
                  </div>

                  <div className="analytics-grid-split">
                    {/* Support Priority Distribution Donut */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Support Ticket Priority Distribution
                          </h3>
                          <p className="analytics-card-subtitle">
                            Tickets categorized by severity
                          </p>
                        </div>
                      </div>
                      <AnalyticsDonutChart
                        data={supportStats.priority_distribution || []}
                        centerLabel="Priority"
                        size={180}
                        emptyMessage="No tickets recorded"
                      />
                    </div>

                    {/* Monthly Ticket Trends Bar Chart */}
                    <div className="analytics-card">
                      <div className="analytics-card-header">
                        <div>
                          <h3 className="analytics-card-title">
                            Monthly Ticket Creation Trends
                          </h3>
                          <p className="analytics-card-subtitle">
                            Inquiry intake volume over time
                          </p>
                        </div>
                      </div>
                      <AnalyticsBarChart
                        data={supportStats.ticket_trends || []}
                        xKey="label"
                        yKey="count"
                        unit="tickets"
                        color="#216a3e"
                        highlightColor="#0f2e1c"
                        height={240}
                        emptyMessage="No ticket trends available"
                      />
                    </div>
                  </div>

                  {/* Recent Support Tickets Table */}
                  <div className="analytics-card">
                    <div className="analytics-card-header">
                      <div>
                        <h3 className="analytics-card-title">
                          Recent Support Tickets
                        </h3>
                        <p className="analytics-card-subtitle">
                          Latest issues submitted by clients and salons
                        </p>
                      </div>
                    </div>

                    <div className="analytics-table-wrapper">
                      {(supportStats.recent_tickets || []).length === 0 ? (
                        <div className="analytics-table-empty">
                          <p>No support tickets found</p>
                        </div>
                      ) : (
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>Ticket #</th>
                              <th>Salon / User</th>
                              <th>Subject</th>
                              <th>Category</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {supportStats.recent_tickets.map((t, idx) => (
                              <tr key={`tkt-row-${t.id || idx}`}>
                                <td className="mono-cell">
                                  <strong>{t.ticket_number}</strong>
                                </td>
                                <td>
                                  <div className="bold-cell">
                                    {t.salon_name}
                                  </div>
                                  <div className="sub-cell">
                                    by {t.created_by}
                                  </div>
                                </td>
                                <td className="bold-cell">{t.subject}</td>
                                <td>{t.category}</td>
                                <td>
                                  <span
                                    className={`analytics-priority-pill ${String(
                                      t.priority || ""
                                    ).toLowerCase()}`}
                                  >
                                    {t.priority}
                                  </span>
                                </td>
                                <td>
                                  <span
                                    className={`analytics-status-pill ${
                                      t.status === "Resolved" ||
                                      t.status === "Closed"
                                      ? "success"
                                      : t.status === "In Progress"
                                      ? "warning"
                                      : "danger"
                                    }`}
                                  >
                                    {t.status}
                                  </span>
                                </td>
                                <td>{t.created_at}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

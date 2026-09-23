import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { resolveImageUrl } from "../../utils/imageUtils";
import AdminSidebar from "../../components/admin/AdminSidebar";
import "../../styles/adminDashboard.css";

const REGIONAL_HUBS = [
  { city: "Bangalore Metropolitan", count: "128 Salons", share: "30.5%" },
  { city: "Mumbai Urban", count: "94 Salons", share: "22.4%" },
  { city: "Delhi NCR", count: "82 Salons", share: "19.5%" },
  { city: "Hyderabad Deccan", count: "52 Salons", share: "12.4%" },
  { city: "Thiruvananthapuram", count: "64 Salons", share: "15.2%" },
];

const MONTHLY_REVENUE = [
  { month: "Jan", gmv: 40, commission: 20 },
  { month: "Feb", gmv: 50, commission: 25 },
  { month: "Mar", gmv: 55, commission: 28 },
  { month: "Apr", gmv: 65, commission: 32 },
  { month: "May", gmv: 75, commission: 38 },
  { month: "Jun", gmv: 90, commission: 45 },
  { month: "Jul", gmv: 110, commission: 55 },
  { month: "Aug", gmv: 130, commission: 65 },
  { month: "Sep", gmv: 150, commission: 78 },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const searchInputRef = useRef(null);

  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  // Dashboard Stats
  const [stats, setStats] = useState({
    registered_users: 12450,
    active_salons: 420,
    pending_salons: 0,
    rejected_salons: 0,
    total_salons: 420,
    month_bookings: 1280,
    completed_sessions: 32500,
    platform_gmv: "₹45,20,000",
  });

  // Salons Queue Data
  const [salons, setSalons] = useState([]);
  const [loadingSalons, setLoadingSalons] = useState(true);
  const [activeTab, setActiveTab] = useState("PENDING"); // ALL, PENDING, APPROVED, REJECTED
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Action State
  const [selectedSalon, setSelectedSalon] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

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

  // Fetch Stats & Salons from Backend
  const fetchDashboardData = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      // 1. Fetch Stats
      try {
        const statsRes = await api.get("/salons/admin/stats/", config);
        if (statsRes.data) {
          setStats((prev) => ({ ...prev, ...statsRes.data }));
        }
      } catch {
        // Fallback silently if stats endpoint fails
      }

      // 2. Fetch Salons
      setLoadingSalons(true);
      const salonsRes = await api.get("/salons/admin/salons/?status=all", config);
      if (salonsRes.data) {
        setSalons(salonsRes.data);
      }
    } catch (err) {
      console.error("Failed to load admin dashboard data:", err);
      if (err.response?.status === 401) {
        setToastMessage("Session expired. Redirecting to login...");
        setTimeout(() => navigate("/login"), 1500);
      }
    } finally {
      setLoadingSalons(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter salons based on tab and search
  const filteredSalons = salons.filter((s) => {
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

    return matchesTab && matchesSearch;
  });

  const pendingCount = salons.filter((s) => s.approval_status === "PENDING").length;
  const approvedCount = salons.filter((s) => s.approval_status === "APPROVED").length;
  const rejectedCount = salons.filter((s) => s.approval_status === "REJECTED").length;

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
            ? `Credentials generated (Password: ${res.data.temp_password}) and emailed to ${updatedSalon.email}.`
            : `Notification sent to ${updatedSalon.email}.`;
          setToastMessage(`✓ ${updatedSalon.name} APPROVED! ${passNotice}`);
        } else {
          setToastMessage(`✕ ${updatedSalon.name} REJECTED. Notice emailed.`);
        }

        setSelectedSalon(null);
        setShowRejectInput(false);
        setRejectionReason("");

        // Refresh stats
        fetchDashboardData();
      }
    } catch (err) {
      alert("Failed to update salon status: " + (err.response?.data?.error || err.message));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportData = () => {
    const jsonStr = JSON.stringify(salons, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmysalon-salons-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#1e3a29",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
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
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <AdminSidebar
        pendingCount={pendingCount}
        salonsCount={salons.length || stats.total_salons}
        usersCount={stats.registered_users}
        bookingsCount={stats.month_bookings}
        activeTab={activeTab}
        onSelectPendingTab={() => {
          setActiveTab("PENDING");
          const queue = document.getElementById("approvals-queue");
          if (queue) queue.scrollIntoView({ behavior: "smooth" });
        }}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
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
              placeholder="Search across salons, owners, locations, audit logs... (Press '/' to focus)"
              className="admin-search-input"
            />
            <span className="admin-search-shortcut">/</span>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-live-pill">
              <span className="admin-system-dot" />
              <span>System Online 99.98%</span>
            </div>
            <span className="admin-region-text">Region: US-East-1</span>

            <button
              type="button"
              className="admin-notif-btn"
              title="Pending Approvals"
              onClick={() => setActiveTab("PENDING")}
            >
              🔔
              {pendingCount > 0 && <span className="admin-notif-dot" />}
            </button>

            <Link
              to="/"
              style={{
                fontSize: "12px",
                color: "#285438",
                fontWeight: "600",
                textDecoration: "none",
                background: "#edf5ef",
                padding: "6px 12px",
                borderRadius: "6px",
              }}
            >
              View Client Site ↗
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <div className="admin-content-container">
          {/* Breadcrumb & Title */}
          <div className="admin-breadcrumb">
            Platform Operations &gt; Super Admin Authority &gt; Executive Dashboard
          </div>

          <div className="admin-title-row">
            <div>
              <h1>Master Platform Control Center</h1>
              <p>
                Real-time salon operations, compliance governance, commission liquidation, and platform security.
              </p>
            </div>

            <div className="admin-header-buttons">
              <button
                type="button"
                className="admin-export-btn"
                onClick={handleExportData}
              >
                📥 Export All Data
              </button>
              <button
                type="button"
                className="admin-emergency-btn"
                onClick={() => alert("Platform lockdown feature enabled in production mode.")}
              >
                ⚠️ Emergency Lock Down
              </button>
            </div>
          </div>

          {/* 5 Stat Cards */}
          <div className="admin-metrics-grid">
            <div className="admin-metric-card">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Registered Users</span>
                <span className="admin-metric-icon">👥</span>
              </div>
              <div className="admin-metric-value">{stats.registered_users}</div>
              <div className="admin-metric-sub">
                <span className="admin-trend-up">↑ +18.4%</span> MoM Growth
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Active Salons</span>
                <span className="admin-metric-icon">🏪</span>
              </div>
              <div className="admin-metric-value">
                {approvedCount || stats.active_salons}
              </div>
              <div className="admin-metric-sub">
                {salons.length} Total · {pendingCount} Pending
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Month's Bookings</span>
                <span className="admin-metric-icon">📅</span>
              </div>
              <div className="admin-metric-value">{stats.month_bookings}</div>
              <div className="admin-metric-sub">
                <span className="admin-trend-up">89%</span> Success Rate
              </div>
            </div>

            <div className="admin-metric-card">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Completed Sessions</span>
                <span className="admin-metric-icon">✅</span>
              </div>
              <div className="admin-metric-value">{stats.completed_sessions}</div>
              <div className="admin-metric-sub">
                <span className="admin-trend-up">↑ +12.8%</span> vs Last Month
              </div>
            </div>

            <div className="admin-metric-card highlight">
              <div className="admin-metric-header">
                <span className="admin-metric-label">Platform GMV</span>
                <span className="admin-metric-icon">💎</span>
              </div>
              <div className="admin-metric-value">{stats.platform_gmv}</div>
              <div className="admin-metric-sub">Take Rate: 12.5% avg</div>
            </div>
          </div>

          {/* 3 Pipeline Alert Cards */}
          <div className="admin-pipeline-grid">
            <div className="admin-pipeline-card">
              <div className="admin-pipeline-top">
                <div className="admin-pipeline-title-group">
                  <span>🚀</span>
                  <span className="admin-pipeline-title">New Salon Pipeline</span>
                </div>
                <span className="admin-badge">On Track</span>
              </div>
              <p className="admin-pipeline-desc">
                {pendingCount + 42} new partner applications logged this cycle. Average time to verification reduced to 4.2 hours.
              </p>
              <div className="admin-pipeline-meta">
                <span>Target: 50/wk</span>
                <span>91% of Monthly Goal</span>
              </div>
            </div>

            <div className="admin-pipeline-card urgent">
              <div className="admin-pipeline-top">
                <div className="admin-pipeline-title-group">
                  <span>🚨</span>
                  <span className="admin-pipeline-title">Urgent Scrutiny Approvals</span>
                </div>
                <span className="admin-badge critical">
                  {pendingCount} Critical
                </span>
              </div>
              <p className="admin-pipeline-desc">
                High-priority salon venues awaiting background audit and platform credentials dispatch.
              </p>
              <div className="admin-pipeline-meta">
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#b91c1c",
                    fontWeight: "700",
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => {
                    setActiveTab("PENDING");
                    const queue = document.getElementById("approvals-queue");
                    if (queue) queue.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Inspect Priority Queue →
                </button>
              </div>
            </div>

            <div className="admin-pipeline-card">
              <div className="admin-pipeline-top">
                <div className="admin-pipeline-title-group">
                  <span>⏰</span>
                  <span className="admin-pipeline-title">Today's Appointments</span>
                </div>
                <span className="admin-badge warning">450 Scheduled</span>
              </div>
              <p className="admin-pipeline-desc">
                Live synchronization across registered venues. Peak slot demand expected around 4:30 PM today.
              </p>
              <div className="admin-pipeline-meta">
                <span>Upcoming: 180</span>
                <span>In-Service: 210</span>
                <span>Done: 60</span>
              </div>
            </div>
          </div>

          {/* Priority Salon Approvals Queue (Main Operational Table) */}
          <div className="admin-queue-card" id="approvals-queue">
            <div className="admin-queue-header">
              <div className="admin-queue-title-wrap">
                <div className="admin-queue-title-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <h2>Priority Salon Approvals Queue</h2>
                    {pendingCount > 0 && (
                      <span className="admin-queue-urgent-pill">
                        {pendingCount} Pending Review
                      </span>
                    )}
                  </div>
                  <Link
                    to="/admin/salons"
                    className="admin-btn-view"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 14px",
                      borderRadius: "8px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "rgba(35,77,52,0.08)",
                      color: "#234d34",
                      textDecoration: "none",
                      border: "1px solid rgba(35,77,52,0.2)",
                    }}
                  >
                    Manage Full Directory →
                  </Link>
                </div>
                <p className="admin-queue-desc">
                  Applications waiting for Super Admin inspection, background verification, compliance check, and platform credentials dispatch.
                </p>
              </div>

              <div className="admin-queue-controls">
                <div className="admin-tab-pills">
                  <button
                    type="button"
                    className={`admin-tab-pill ${activeTab === "PENDING" ? "active" : ""}`}
                    onClick={() => setActiveTab("PENDING")}
                  >
                    Pending Approval ({pendingCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-pill ${activeTab === "APPROVED" ? "active" : ""}`}
                    onClick={() => setActiveTab("APPROVED")}
                  >
                    Approved ({approvedCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-pill ${activeTab === "REJECTED" ? "active" : ""}`}
                    onClick={() => setActiveTab("REJECTED")}
                  >
                    Rejected ({rejectedCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-tab-pill ${activeTab === "ALL" ? "active" : ""}`}
                    onClick={() => setActiveTab("ALL")}
                  >
                    All ({salons.length})
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Salon / Specialty</th>
                    <th>Owner / Applicant</th>
                    <th>Compliance Status</th>
                    <th>Submitted</th>
                    <th>Action / Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingSalons ? (
                    <tr>
                      <td colSpan={5} className="admin-empty-table">
                        Loading salon verification queue...
                      </td>
                    </tr>
                  ) : filteredSalons.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-empty-table">
                        No salons found matching the current tab and filter criteria.
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
                              />
                            </div>
                            <div className="admin-salon-details">
                              <span className="admin-salon-name">{salon.name}</span>
                              <span className="admin-salon-location">
                                📍 {salon.address ? `${salon.address.slice(0, 30)}...` : ""}{" "}
                                {salon.city}
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
                            <span className="admin-owner-phone">{salon.phone}</span>
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

                        {/* Submitted */}
                        <td>
                          <div style={{ fontSize: "12px", color: "#3d5244" }}>
                            {salon.created_at
                              ? new Date(salon.created_at).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                              : "Recent"}
                          </div>
                          <div style={{ fontSize: "10px", color: "#809487" }}>
                            {salon.created_at
                              ? new Date(salon.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Just now"}
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
                                  onClick={() => setSelectedSalon(salon)}
                                  disabled={isProcessing}
                                >
                                  Review & Approve
                                </button>
                                <button
                                  type="button"
                                  className="admin-btn-reject"
                                  onClick={() => {
                                    setSelectedSalon(salon);
                                    setShowRejectInput(true);
                                  }}
                                  disabled={isProcessing}
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="admin-btn-view"
                                onClick={() => setSelectedSalon(salon)}
                              >
                                View Details
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

          {/* Revenue Chart & Regional Hubs Grid */}
          <div className="admin-analytics-row">
            <div className="admin-chart-card">
              <div className="admin-chart-header">
                <div>
                  <h3>Platform Revenue & Take-Rate Yield</h3>
                  <span style={{ fontSize: "11px", color: "#74887b" }}>
                    Gross Merchandise Value vs Realized Take-Rate Commission
                  </span>
                </div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, background: "#bdd7c6", borderRadius: 2 }} />
                    GMV Volume
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ width: 8, height: 8, background: "#254d35", borderRadius: 2 }} />
                    Take-Rate Commission
                  </span>
                </div>
              </div>

              {/* Chart Mock Bars */}
              <div className="admin-chart-mock-bars">
                {MONTHLY_REVENUE.map((m) => (
                  <div className="admin-chart-bar-group" key={m.month}>
                    <div
                      style={{
                        display: "flex",
                        gap: "3px",
                        alignItems: "flex-end",
                        height: "130px",
                      }}
                    >
                      <div
                        className="admin-chart-bar light"
                        style={{ height: `${(m.gmv / 160) * 100}%` }}
                        title={`GMV: ₹${m.gmv}K`}
                      />
                      <div
                        className="admin-chart-bar"
                        style={{ height: `${(m.commission / 160) * 100}%` }}
                        title={`Take-Rate: ₹${m.commission}K`}
                      />
                    </div>
                    <span className="admin-chart-bar-label">{m.month}</span>
                  </div>
                ))}
              </div>

              <div style={{ fontSize: "11px", color: "#54685b" }}>
                💡 <strong>Yield Summary:</strong> Fixed 12.5% take rate generated consistent returns across all partner tiers in Q3.
              </div>
            </div>

            {/* Regional Hubs */}
            <div className="admin-hubs-card">
              <h3>Regional Salon Hubs</h3>
              <div>
                {REGIONAL_HUBS.map((hub) => (
                  <div className="admin-hub-row" key={hub.city}>
                    <div>
                      <div className="admin-hub-name">{hub.city}</div>
                      <span style={{ fontSize: "11px", color: "#7b8f82" }}>
                        Market Share: {hub.share}
                      </span>
                    </div>
                    <span className="admin-hub-val">{hub.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Platform System Health Infrastructure */}
          <div className="admin-health-section">
            <div className="admin-health-header">
              <h3>Platform System Health & Core Infrastructure</h3>
              <span
                style={{
                  fontSize: "11px",
                  color: "#166534",
                  fontWeight: "700",
                  background: "#eef7f1",
                  padding: "4px 10px",
                  borderRadius: "6px",
                }}
              >
                ● 100% Platform Operational
              </span>
            </div>

            <div className="admin-health-grid">
              <div className="admin-health-box">
                <div className="admin-health-top">
                  <span className="admin-health-title">Edge API & GraphQL</span>
                  <span className="admin-health-pill">99.98%</span>
                </div>
                <div className="admin-health-desc">
                  Average latency 42ms across US-East-1 & AP-South-1.
                </div>
              </div>

              <div className="admin-health-box">
                <div className="admin-health-top">
                  <span className="admin-health-title">Payment Webhooks</span>
                  <span className="admin-health-pill">Optimal</span>
                </div>
                <div className="admin-health-desc">
                  Stripe & UPI settlement pipeline connected.
                </div>
              </div>

              <div className="admin-health-box">
                <div className="admin-health-top">
                  <span className="admin-health-title">Commission Logic</span>
                  <span className="admin-health-pill">Active</span>
                </div>
                <div className="admin-health-desc">
                  Automated payout protocol operating smoothly.
                </div>
              </div>

              <div className="admin-health-box">
                <div className="admin-health-top">
                  <span className="admin-health-title">Twilio & Meta API</span>
                  <span className="admin-health-pill">99.95%</span>
                </div>
                <div className="admin-health-desc">
                  WhatsApp slot notifications & SMS OTP gateway active.
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Review & Approve / Reject Modal */}
      {selectedSalon && (
        <div className="admin-modal-backdrop">
          <div className="admin-review-modal" style={{ maxWidth: "800px" }}>
            <div className="admin-modal-header">
              <div>
                <h3>Salon Application Inspection</h3>
                <span style={{ fontSize: "11px", color: "#6a7d71" }}>
                  ID #{selectedSalon.id} · Submitted by {selectedSalon.email}
                  {selectedSalon.created_at && (
                    <> • Registered {new Date(selectedSalon.created_at).toLocaleDateString()}</>
                  )}
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

            <div className="admin-modal-body">
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
                        title="Click to view full size in new tab"
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
                    Venue ID: <code>#{selectedSalon.id}</code>
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
                    {selectedSalon.address}, {selectedSalon.city}
                  </div>
                  <div style={{ fontSize: "11px", color: "#667a6e", marginTop: 4 }}>
                    {selectedSalon.state || "Karnataka"}, PIN: {selectedSalon.pincode || "N/A"}
                  </div>
                </div>

                <div className="admin-modal-info-card">
                  <div className="admin-modal-info-label">GPS Geolocation & Map</div>
                  <div className="admin-modal-info-value">
                    {selectedSalon.latitude || "12.9716"}° N, {selectedSalon.longitude || "77.5946"}° E
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

              {/* Weekly Operating Schedule */}
              <div>
                <div className="admin-modal-info-label" style={{ marginBottom: 6 }}>
                  Weekly Operating Schedule
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
                    Standard Business Schedule: Monday to Saturday, 09:00 AM – 08:00 PM (Default).
                  </p>
                )}
              </div>

              {/* Services & Pricing Menu */}
              <div>
                <div className="admin-modal-info-label" style={{ marginBottom: 6 }}>
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
                  <div style={{ fontSize: "12px", color: "#728779", fontStyle: "italic" }}>
                    No custom pricing services configured for this salon.
                  </div>
                )}
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

              {/* Previous Admin Notes if present */}
              {selectedSalon.admin_notes && (
                <div className="admin-modal-notes-box">
                  <strong>Previous Admin Feedback / Notes:</strong> {selectedSalon.admin_notes}
                </div>
              )}

              {/* Rejection input if triggered */}
              {showRejectInput ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: 14 }}>
                  <div style={{ fontSize: "12px", fontWeight: "700", color: "#991b1b", marginBottom: 6 }}>
                    Reason for Rejection (will be emailed to the applicant):
                  </div>
                  <textarea
                    rows={3}
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Incomplete trade license documentation or invalid contact phone..."
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      border: "1px solid #f87171",
                      fontSize: "12px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ) : (
                /* Credentials Dispatch Preview Box */
                <div className="admin-modal-credentials-box">
                  <strong>Credentials Dispatch Protocol:</strong>
                  <div style={{ marginTop: 4 }}>
                    Upon clicking <strong>Approve</strong>, an Owner account will be provisioned for <strong>{selectedSalon.email}</strong>, a temporary secure password will be generated, and login instructions will be dispatched directly to their inbox.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="admin-modal-footer">
              <div style={{ fontSize: "11px", color: "#7a8e80" }}>
                {selectedSalon.updated_at
                  ? `Last updated: ${new Date(selectedSalon.updated_at).toLocaleString()}`
                  : `Venue ID #${selectedSalon.id}`}
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
                      onClick={() => setShowRejectInput(true)}
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


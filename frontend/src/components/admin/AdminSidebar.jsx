import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import "../../styles/adminSidebar.css";

export default function AdminSidebar({
  pendingCount: propPendingCount,
  salonsCount: propSalonsCount,
  usersCount: propUsersCount,
  bookingsCount: propBookingsCount,
  activeTab,
  onSelectPendingTab,
  onSelectSalonsTab,
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  const [stats, setStats] = useState({
    total_salons: 0,
    pending_approvals: 0,
    registered_users: 0,
    month_bookings: 0,
  });

  // Current logged in user info (auth user or local storage fallback)
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentUser = authUser || storedUser;

  // Auto-fetch platform stats if counts are not passed from parent
  useEffect(() => {
    if (propPendingCount === undefined || propSalonsCount === undefined) {
      const fetchAdminStats = async () => {
        try {
          const token = localStorage.getItem("access_token");
          const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
          const res = await api.get("/salons/admin/stats/", config);
          if (res.data) {
            setStats(res.data);
          }
        } catch {
          // Keep silent fallback
        }
      };
      fetchAdminStats();
    }
  }, [propPendingCount, propSalonsCount]);

  const effectivePendingCount =
    propPendingCount !== undefined ? propPendingCount : stats.pending_approvals || 0;
  const effectiveSalonsCount =
    propSalonsCount !== undefined ? propSalonsCount : stats.total_salons || 0;
  const effectiveUsersCount =
    propUsersCount !== undefined ? propUsersCount : stats.registered_users || 0;
  const effectiveBookingsCount =
    propBookingsCount !== undefined ? propBookingsCount : stats.month_bookings || 0;

  // Active state calculations
  const isDashboardActive =
    (location.pathname === "/admin/dashboard" || location.pathname === "/admin") &&
    activeTab !== "PENDING";

  const isSalonsActive =
    location.pathname.startsWith("/admin/salons") &&
    activeTab !== "PENDING" &&
    !location.search.toLowerCase().includes("tab=pending");

  const isPendingActive =
    activeTab === "PENDING" ||
    (location.pathname.startsWith("/admin/salons") &&
      location.search.toLowerCase().includes("tab=pending"));

  const isUsersActive = location.pathname.startsWith("/admin/users");

  const isNewFormActive = location.pathname === "/salon-application";

  const handlePendingClick = () => {
    if (onSelectPendingTab) {
      onSelectPendingTab();
    } else {
      navigate("/admin/salons?tab=pending");
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      logout();
      navigate("/login");
    }
  };

  return (
    <aside className="admin-sidebar" aria-label="Admin Navigation Sidebar">
      {/* Brand Header */}
      <Link to="/admin/dashboard" className="admin-brand-header">
        <div className="admin-brand-icon">B</div>
        <div className="admin-brand-info">
          <h2>BookMySalon</h2>
          <span className="admin-brand-domain">admin.bookmysalon.com</span>
        </div>
      </Link>

      {/* Super Admin Profile Snippet */}
      <div className="admin-profile-card">
        <div className="admin-avatar">
          {currentUser.first_name?.[0] || currentUser.email?.[0] || "A"}
        </div>
        <div className="admin-profile-meta">
          <div className="admin-name">
            {currentUser.first_name || currentUser.name || currentUser.email?.split("@")[0] || "Super Admin"}
          </div>
          <span className="admin-role-badge">Root Operator</span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="admin-nav-menu">
        <Link
          to="/admin/dashboard"
          className={`admin-nav-item ${isDashboardActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>📊</span>
            <span>Dashboard</span>
          </div>
        </Link>

        <Link
          to="/admin/salons"
          className={`admin-nav-item ${isSalonsActive ? "active" : ""}`}
          onClick={() => {
            if (onSelectSalonsTab) onSelectSalonsTab();
          }}
        >
          <div className="admin-nav-left">
            <span>🏪</span>
            <span>Salons Directory</span>
          </div>
          {effectiveSalonsCount > 0 && (
            <span className="admin-nav-badge">{effectiveSalonsCount}</span>
          )}
        </Link>

        <button
          type="button"
          className={`admin-nav-item ${isPendingActive ? "active" : ""}`}
          onClick={handlePendingClick}
        >
          <div className="admin-nav-left">
            <span>⚡</span>
            <span>Salon Approvals</span>
          </div>
          {effectivePendingCount > 0 ? (
            <span className="admin-nav-badge urgent">
              {effectivePendingCount} Urgent
            </span>
          ) : (
            <span className="admin-nav-badge">0</span>
          )}
        </button>

        <Link
          to="/admin/users"
          className={`admin-nav-item ${isUsersActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>👥</span>
            <span>Users</span>
          </div>
          {effectiveUsersCount > 0 && (
            <span className="admin-nav-badge">{effectiveUsersCount}</span>
          )}
        </Link>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>📅</span>
            <span>Bookings</span>
          </div>
          {effectiveBookingsCount > 0 && (
            <span className="admin-nav-badge">{effectiveBookingsCount}</span>
          )}
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>✂️</span>
            <span>Services</span>
          </div>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>💰</span>
            <span>Earnings</span>
          </div>
          <span className="admin-nav-badge">₹45K</span>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>📈</span>
            <span>Analytics</span>
          </div>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>⭐</span>
            <span>Reviews</span>
          </div>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>🏷️</span>
            <span>Offers</span>
          </div>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>🛡️</span>
            <span>Security</span>
          </div>
        </button>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>⚙️</span>
            <span>Settings</span>
          </div>
        </button>
      </nav>

      {/* Sidebar Footer */}
      <div className="admin-sidebar-footer">
        <div className="admin-system-status-btn" title="All backend services healthy">
          <span className="admin-system-dot" />
          <span>All Systems Operational</span>
        </div>
        <div className="admin-system-version">Version v3.2.1 • US-East-1</div>
        <button
          type="button"
          className="admin-logout-btn"
          onClick={handleLogout}
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

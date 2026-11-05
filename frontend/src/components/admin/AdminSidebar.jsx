import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import "../../styles/adminSidebar.css";

import logo from "../../assets/logo.png"

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
          const [res, srvRes, offRes, subsRes, bkRes] = await Promise.all([
            api.get("/salons/admin/stats/", config).catch(() => null),
            api.get("/services/admin/stats/", config).catch(() => null),
            api.get("/offers/admin/stats/", config).catch(() => null),
            api.get("/subscriptions/admin/stats/", config).catch(() => null),
            api.get("/bookings/admin/stats/", config).catch(() => null),
          ]);
          setStats((prev) => ({
            ...prev,
            ...(res?.data || {}),
            total_services: srvRes?.data?.services?.total || 0,
            total_offers: offRes?.data?.total_offers ?? offRes?.data?.stats?.total_offers ?? 0,
            subs_wallet_balance: subsRes?.data?.wallet_balance || "0.00",
            active_trials: subsRes?.data?.active_trials_count || 0,
            month_bookings: bkRes?.data?.total_bookings ?? res?.data?.month_bookings ?? 0,
          }));
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
    location.pathname === "/admin/dashboard" || location.pathname === "/admin";

  const isSalonsActive =
    location.pathname.startsWith("/admin/salons") &&
    activeTab !== "PENDING" &&
    !location.search.toLowerCase().includes("tab=pending");

  const isPendingActive =
    (location.pathname.startsWith("/admin/salons") &&
      (activeTab === "PENDING" ||
        location.search.toLowerCase().includes("tab=pending")));

  const isUsersActive = location.pathname.startsWith("/admin/users");
  const isBookingsActive = location.pathname.startsWith("/admin/bookings");
  const isServicesActive = location.pathname.startsWith("/admin/services");
  const isReviewsActive = location.pathname.startsWith("/admin/reviews");
  const isOffersActive = location.pathname.startsWith("/admin/offers");
  const isSubscriptionsActive = location.pathname.startsWith("/admin/subscriptions");
  const isSupportActive =
    location.pathname.startsWith("/admin/support") ||
    location.pathname.startsWith("/admin/tickets");
  const isProfileActive = location.pathname.startsWith("/admin/profile");

  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/support/admin/unread-count/")
      .then((res) => {
        if (isMounted) {
          setUnreadSupportCount(
            (res.data?.unread_count || 0) + (res.data?.open_tickets_count || 0)
          );
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

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
        <div className="admin-brand-icon"><img src={logo} alt="BookMySalon Logo" /></div>
        <div className="admin-brand-info">
          <h2>BookMySalon</h2>
          <span className="admin-brand-domain">🛡️ Root Operator </span>
        </div>
      </Link>

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

        <Link
          to="/admin/bookings"
          className={`admin-nav-item ${isBookingsActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>📅</span>
            <span>Bookings</span>
          </div>
          {effectiveBookingsCount > 0 && (
            <span className="admin-nav-badge">{effectiveBookingsCount}</span>
          )}
        </Link>

        <Link
          to="/admin/services"
          className={`admin-nav-item ${isServicesActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>✂️</span>
            <span>Services Catalog</span>
          </div>
          {Number(stats.total_services) > 0 && (
            <span className="admin-nav-badge">{stats.total_services}</span>
          )}
        </Link>

        <Link
          to="/admin/subscriptions"
          className={`admin-nav-item ${isSubscriptionsActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>💳</span>
            <span>Subscriptions</span>
          </div>
          {Number(stats.subs_wallet_balance || 0) > 0 ? (
            <span className="admin-nav-badge">₹{Number(stats.subs_wallet_balance).toLocaleString("en-IN")}</span>
          ) : Number(stats.active_trials || 0) > 0 ? (
            <span className="admin-nav-badge">{stats.active_trials} Trials</span>
          ) : null}
        </Link>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>📈</span>
            <span>Analytics</span>
          </div>
        </button>

        <Link
          to="/admin/reviews"
          className={`admin-nav-item ${isReviewsActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>⭐</span>
            <span>Reviews</span>
          </div>
        </Link>

        <Link
          to="/admin/offers"
          className={`admin-nav-item ${isOffersActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>🏷️</span>
            <span>Offers</span>
          </div>
          {Number(stats.total_offers) > 0 && (
            <span className="admin-nav-badge">{stats.total_offers}</span>
          )}
        </Link>

        <Link
          to="/admin/support"
          className={`admin-nav-item ${isSupportActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>🎫</span>
            <span>Support Tickets</span>
          </div>
          {unreadSupportCount > 0 && (
            <span className="admin-nav-badge urgent">{unreadSupportCount}</span>
          )}
        </Link>

        <Link
          to="/admin/profile"
          className={`admin-nav-item ${isProfileActive ? "active" : ""}`}
        >
          <div className="admin-nav-left">
            <span>⚙️</span>
            <span>Settings</span>
          </div>
        </Link>

        <button type="button" className="admin-nav-item">
          <div className="admin-nav-left">
            <span>🛡️</span>
            <span>Security</span>
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

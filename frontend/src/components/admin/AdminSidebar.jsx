import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import { ADMIN_NAV_ITEMS } from "./adminNavConfig";
import logo from "../../assets/logo.png";
import "../../styles/adminSidebar.css";

// Module-level stats cache with 30-second TTL to avoid redundant API spam across pages
let cachedAdminStats = null;
let lastStatsFetchTime = 0;
const STATS_CACHE_TTL = 30000;

export default function AdminSidebar({
  pendingCount: propPendingCount,
  salonsCount: propSalonsCount,
  usersCount: propUsersCount,
  bookingsCount: propBookingsCount,
  servicesCount: propServicesCount,
  offersCount: propOffersCount,
  reviewsCount: propReviewsCount,
  supportCount: propSupportCount,
  activeTab,
  onSelectPendingTab,
  onSelectSalonsTab,
  onLogout,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, logout } = useAuth();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState(() => cachedAdminStats || {
    total_salons: 0,
    pending_approvals: 0,
    registered_users: 0,
    month_bookings: 0,
    total_services: 0,
    total_offers: 0,
    subs_wallet_balance: "0.00",
    active_trials: 0,
    unread_support: 0,
  });

  // Automatically close mobile menu when navigating to another route
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  // Fetch full dynamic platform stats if counts are needed or cache expired
  const fetchAdminStats = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedAdminStats && now - lastStatsFetchTime < STATS_CACHE_TTL) {
      setStats(cachedAdminStats);
      return;
    }

    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const [res, srvRes, offRes, subsRes, bkRes, supRes] = await Promise.all([
        api.get("/salons/admin/stats/", config).catch(() => null),
        api.get("/services/admin/stats/", config).catch(() => null),
        api.get("/offers/admin/stats/", config).catch(() => null),
        api.get("/subscriptions/admin/stats/", config).catch(() => null),
        api.get("/bookings/admin/stats/", config).catch(() => null),
        api.get("/support/admin/unread-count/", config).catch(() => null),
      ]);

      const updated = {
        total_salons: res?.data?.total_salons || 0,
        pending_approvals: res?.data?.pending_approvals || 0,
        registered_users: res?.data?.registered_users || 0,
        month_bookings: bkRes?.data?.total_bookings ?? res?.data?.month_bookings ?? 0,
        total_services: srvRes?.data?.services?.total || 0,
        total_offers: offRes?.data?.total_offers ?? offRes?.data?.stats?.total_offers ?? 0,
        subs_wallet_balance: subsRes?.data?.wallet_balance || "0.00",
        active_trials: subsRes?.data?.active_trials_count || 0,
        unread_support: (supRes?.data?.unread_count || 0) + (supRes?.data?.open_tickets_count || 0),
      };

      cachedAdminStats = updated;
      lastStatsFetchTime = now;
      setStats(updated);
    } catch {
      // Graceful silent fallback
    }
  }, []);

  useEffect(() => {
    fetchAdminStats();

    // Listen to real-time events that invalidate counts
    const handleStatsUpdated = () => fetchAdminStats(true);
    window.addEventListener("bm-admin-stats-updated", handleStatsUpdated);
    window.addEventListener("bm-salon-approved", handleStatsUpdated);

    return () => {
      window.removeEventListener("bm-admin-stats-updated", handleStatsUpdated);
      window.removeEventListener("bm-salon-approved", handleStatsUpdated);
    };
  }, [fetchAdminStats]);

  // Resolve effective badges from props or fetched stats
  const effectiveCounts = useMemo(() => {
    return {
      pendingCount: propPendingCount !== undefined ? propPendingCount : stats.pending_approvals || 0,
      salonsCount: propSalonsCount !== undefined ? propSalonsCount : stats.total_salons || 0,
      usersCount: propUsersCount !== undefined ? propUsersCount : stats.registered_users || 0,
      bookingsCount: propBookingsCount !== undefined ? propBookingsCount : stats.month_bookings || 0,
      servicesCount: propServicesCount !== undefined ? propServicesCount : stats.total_services || 0,
      offersCount: propOffersCount !== undefined ? propOffersCount : stats.total_offers || 0,
      reviewsCount: propReviewsCount !== undefined ? propReviewsCount : 0,
      supportCount: propSupportCount !== undefined ? propSupportCount : stats.unread_support || 0,
    };
  }, [
    propPendingCount,
    propSalonsCount,
    propUsersCount,
    propBookingsCount,
    propServicesCount,
    propOffersCount,
    propReviewsCount,
    propSupportCount,
    stats,
  ]);

  // Dynamic active state determination based on current route and optional activeTab prop
  const isItemActive = useCallback(
    (item) => {
      const currentPath = location.pathname;
      const currentSearch = location.search.toLowerCase();
      const currentHash = location.hash.toLowerCase();
      const upperActiveTab = (activeTab || "").toUpperCase();

      switch (item.key) {
        case "dashboard":
          return (
            (currentPath === "/admin/dashboard" || currentPath === "/admin") &&
            currentHash !== "#analytics" &&
            upperActiveTab !== "ANALYTICS" &&
            upperActiveTab !== "PENDING"
          );

        case "salons":
          return (
            currentPath.startsWith("/admin/salons") &&
            !currentSearch.includes("tab=pending") &&
            upperActiveTab !== "PENDING"
          );

        case "approvals":
          return (
            (currentPath.startsWith("/admin/salons") && currentSearch.includes("tab=pending")) ||
            upperActiveTab === "PENDING"
          );

        case "users":
          return currentPath.startsWith("/admin/users") || upperActiveTab === "USERS";

        case "bookings":
          return currentPath.startsWith("/admin/bookings") || upperActiveTab === "BOOKINGS";

        case "services":
          return currentPath.startsWith("/admin/services") || upperActiveTab === "SERVICES";

        case "subscriptions":
          return currentPath.startsWith("/admin/subscriptions") || upperActiveTab === "SUBSCRIPTIONS";

        case "analytics":
          return (
            currentPath.startsWith("/admin/analytics") ||
            currentHash === "#analytics" ||
            upperActiveTab === "ANALYTICS"
          );

        case "reviews":
          return currentPath.startsWith("/admin/reviews") || upperActiveTab === "REVIEWS";

        case "offers":
          return currentPath.startsWith("/admin/offers") || upperActiveTab === "OFFERS";

        case "support":
          return (
            currentPath.startsWith("/admin/support") ||
            currentPath.startsWith("/admin/tickets") ||
            upperActiveTab === "SUPPORT"
          );

        case "settings":
          return (
            currentPath.startsWith("/admin/profile") &&
            !currentSearch.includes("tab=security") &&
            upperActiveTab !== "SECURITY"
          );

        case "security":
          return (
            currentPath.startsWith("/admin/profile") &&
            (currentSearch.includes("tab=security") || upperActiveTab === "SECURITY")
          );

        default:
          return false;
      }
    },
    [location.pathname, location.search, location.hash, activeTab]
  );

  // Dynamic navigation click handler
  const handleItemClick = (e, item) => {
    setIsMobileMenuOpen(false);

    if (item.key === "approvals" && onSelectPendingTab) {
      e.preventDefault();
      onSelectPendingTab();
      return;
    }

    if (item.key === "salons" && onSelectSalonsTab) {
      onSelectSalonsTab();
      return;
    }
  };

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      logout();
      navigate("/login");
    }
  };

  // Helper to render badges based on config and counts
  const renderBadge = (item) => {
    if (item.badgeFormatter) {
      const formatted = item.badgeFormatter(stats);
      if (formatted) {
        return <span className="admin-nav-badge">{formatted}</span>;
      }
      return null;
    }

    if (!item.badgeKey) return null;

    const count = effectiveCounts[item.badgeKey];

    if (item.key === "approvals") {
      if (count > 0) {
        return <span className="admin-nav-badge urgent">{count} Urgent</span>;
      }
      return <span className="admin-nav-badge">0</span>;
    }

    if (item.isUrgent && count > 0) {
      return <span className="admin-nav-badge urgent">{count}</span>;
    }

    if (typeof count === "number" && count > 0) {
      return <span className="admin-nav-badge">{count}</span>;
    }

    return null;
  };

  return (
    <aside
      className={`admin-sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}
      aria-label="Super Admin Navigation Sidebar"
    >
      {/* Brand Header & Responsive Mobile Toggle */}
      <div className="admin-brand-header-wrap">
        <Link
          to="/admin/dashboard"
          className="admin-brand-header"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div className="admin-brand-icon">
            <img src={logo} alt="BookMySalon Logo" />
          </div>
          <div className="admin-brand-info">
            <h2>BookMySalon</h2>
            <span className="admin-brand-domain">🛡️ Root Operator</span>
          </div>
        </Link>

        <button
          type="button"
          className="admin-mobile-toggle-btn"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="admin-nav-menu" aria-label="Main Admin Navigation">
        {ADMIN_NAV_ITEMS.map((item) => {
          const active = isItemActive(item);

          return (
            <Link
              key={item.key}
              to={item.path}
              className={`admin-nav-item ${active ? "active" : ""}`}
              onClick={(e) => handleItemClick(e, item)}
              title={item.label}
            >
              <div className="admin-nav-left">
                <span className="admin-nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </div>
              {renderBadge(item)}
            </Link>
          );
        })}
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
          title="Sign out of Super Admin"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

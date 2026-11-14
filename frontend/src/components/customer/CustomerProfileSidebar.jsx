import { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { selectUserAvatar } from "../../features/auth/authSlice";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/customerProfile.css";

export default function CustomerProfileSidebar({
  activeNav = "profile",
  onNavChange,
  profile: propProfile,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const reduxAvatar = useSelector(selectUserAvatar);

  const [profileData, setProfileData] = useState(propProfile || null);
  const [stats, setStats] = useState({
    total_bookings_count: propProfile?.stats?.total_bookings_count ?? 0,
    saved_places_count: propProfile?.stats?.saved_places_count ?? 0,
    wallet_balance: propProfile?.stats?.wallet_balance ?? 0,
    reviews_count: propProfile?.stats?.reviews_count ?? 0,
  });
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Sync prop changes if parent updates profile
  useEffect(() => {
    if (propProfile) {
      setProfileData(propProfile);
      if (propProfile.stats) {
        setStats({
          total_bookings_count: propProfile.stats.total_bookings_count ?? 0,
          saved_places_count: propProfile.stats.saved_places_count ?? 0,
          wallet_balance: propProfile.stats.wallet_balance ?? 0,
          reviews_count: propProfile.stats.reviews_count ?? 0,
        });
      }
    }
  }, [propProfile]);

  // Fetch full dynamic profile and stats if not provided
  const fetchSidebarProfile = useCallback(async () => {
    try {
      const res = await api.get("/accounts/customer/profile/");
      const data = res.data;
      setProfileData(data);
      if (data?.stats) {
        setStats({
          total_bookings_count: data.stats.total_bookings_count ?? 0,
          saved_places_count: data.stats.saved_places_count ?? 0,
          wallet_balance: data.stats.wallet_balance ?? 0,
          reviews_count: data.stats.reviews_count ?? 0,
        });
      }
    } catch {
      // Graceful fallback to auth user
    }
  }, []);

  useEffect(() => {
    if (propProfile === undefined) {
      fetchSidebarProfile();
    }
  }, [propProfile, fetchSidebarProfile]);

  // Real-time synchronization via custom events
  useEffect(() => {
    const handleFavoritesUpdated = (e) => {
      if (e?.detail) {
        const delta = e.detail.isFavorite ? 1 : -1;
        setStats((prev) => ({
          ...prev,
          saved_places_count: Math.max(0, (prev.saved_places_count || 0) + delta),
        }));
      } else {
        fetchSidebarProfile();
      }
    };

    const handleWalletUpdated = (e) => {
      if (e?.detail && typeof e.detail.balance === "number") {
        setStats((prev) => ({
          ...prev,
          wallet_balance: e.detail.balance,
        }));
      } else {
        fetchSidebarProfile();
      }
    };

    const handleBookingChanged = () => {
      fetchSidebarProfile();
    };

    const handleProfileUpdated = (e) => {
      if (e?.detail) {
        setProfileData(e.detail);
        if (e.detail.stats) {
          setStats((prev) => ({
            ...prev,
            ...e.detail.stats,
          }));
        }
      } else {
        fetchSidebarProfile();
      }
    };

    window.addEventListener("bm-favorites-updated", handleFavoritesUpdated);
    window.addEventListener("bm-wallet-updated", handleWalletUpdated);
    window.addEventListener("bm-booking-created", handleBookingChanged);
    window.addEventListener("bm-booking-cancelled", handleBookingChanged);
    window.addEventListener("bm-profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("bm-favorites-updated", handleFavoritesUpdated);
      window.removeEventListener("bm-wallet-updated", handleWalletUpdated);
      window.removeEventListener("bm-booking-created", handleBookingChanged);
      window.removeEventListener("bm-booking-cancelled", handleBookingChanged);
      window.removeEventListener("bm-profile-updated", handleProfileUpdated);
    };
  }, [fetchSidebarProfile]);

  // Navigation click handler
  const handleNavigate = (key, path) => {
    if (onNavChange) {
      onNavChange(key, path);
    } else {
      navigate(path);
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate("/login");
  };

  // Derive dynamic user details
  const currentFullName =
    profileData?.full_name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.email?.split("@")[0] ||
    "Mindful Client";

  const userInitial = currentFullName.charAt(0).toUpperCase();

  const userAvatarUrl =
    profileData?.avatar || reduxAvatar || user?.avatar || "";

  const userEmail = profileData?.email || user?.email || "";

  // Dynamic active check
  const isProfileActive =
    activeNav === "profile" &&
    (location.pathname === "/customer/profile" &&
      (!location.search || location.search.includes("tab=profile")));

  const isBookingsActive =
    activeNav === "bookings" ||
    location.pathname === "/customer/my-bookings" ||
    (location.pathname === "/customer/profile" && location.search.includes("tab=bookings"));

  const isFavoritesActive =
    activeNav === "favorites" ||
    location.pathname === "/customer/favorites" ||
    location.pathname === "/customer/saved-salons" ||
    (location.pathname === "/customer/profile" && location.search.includes("tab=favorites"));

  const isWalletActive =
    activeNav === "wallet" || location.pathname === "/customer/wallet";

  const isReviewsActive =
    activeNav === "reviews" ||
    (location.pathname === "/customer/profile" && location.search.includes("tab=reviews"));

  const isSettingsActive =
    activeNav === "settings" ||
    (location.pathname === "/customer/profile" && location.search.includes("tab=settings"));

  return (
    <>
      <aside className="profile-sidebar" aria-label="Customer Profile Sidebar">
        {/* Dynamic User Identity Card */}
        <div className="sidebar-identity-card">
          <div className="sidebar-avatar-wrap">
            {userAvatarUrl ? (
              <img
                src={resolveImageUrl(userAvatarUrl)}
                alt={currentFullName}
                className="sidebar-avatar-img"
              />
            ) : (
              <div className="sidebar-avatar-placeholder">{userInitial}</div>
            )}
            <span className="sidebar-verified-dot" title="Verified Customer Account" />
          </div>

          <h2 className="sidebar-user-name">{currentFullName}</h2>
          <p className="sidebar-user-email">{userEmail}</p>

          <div className="sidebar-verified-badge">
            <span className="dot">●</span>
            <span>Verified Customer</span>
          </div>
        </div>

        {/* Dynamic Navigation Menu Card */}
        <div className="sidebar-nav-card">
          <nav className="sidebar-nav-list">
            {/* 1. Personal Information */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isProfileActive ? "active" : ""}`}
              onClick={() => handleNavigate("profile", "/customer/profile")}
              title="Personal Information & Preferences"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">👤</span>
                <span>Personal Information</span>
              </div>
              {isProfileActive && <span className="sidebar-active-arrow">›</span>}
            </button>

            {/* 2. My Bookings */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isBookingsActive ? "active" : ""}`}
              onClick={() => handleNavigate("bookings", "/customer/my-bookings")}
              title="View all bookings"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">📅</span>
                <span>My Bookings</span>
              </div>
              <span className="sidebar-nav-badge">
                {stats.total_bookings_count}
              </span>
            </button>

            {/* 3. Favorites */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isFavoritesActive ? "active" : ""}`}
              onClick={() => handleNavigate("favorites", "/customer/favorites")}
              title="View saved and favorite salons"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">🤍</span>
                <span>Favorites</span>
              </div>
              <span className="sidebar-nav-badge">
                {stats.saved_places_count}
              </span>
            </button>

            {/* 4. My Wallet */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isWalletActive ? "active" : ""}`}
              onClick={() => handleNavigate("wallet", "/customer/wallet")}
              title="Wallet balance and top-up"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">👛</span>
                <span>My Wallet</span>
              </div>
              <span
                className="sidebar-nav-badge"
                style={{
                  background: "#ecfdf5",
                  color: "#0f766e",
                  fontWeight: 700,
                  fontSize: "11px",
                }}
              >
                ₹{Number(stats.wallet_balance || 0).toLocaleString("en-IN", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </span>
            </button>

            {/* 5. Reviews */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isReviewsActive ? "active" : ""}`}
              onClick={() => handleNavigate("reviews", "/customer/profile?tab=reviews")}
              title="Feedback & reviews"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">⭐</span>
                <span>Reviews</span>
              </div>
              <span className="sidebar-nav-badge">
                {stats.reviews_count}
              </span>
            </button>

            {/* 6. Settings */}
            <button
              type="button"
              className={`sidebar-nav-btn ${isSettingsActive ? "active" : ""}`}
              onClick={() => handleNavigate("settings", "/customer/profile?tab=settings")}
              title="Account Security & Password"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">⚙️</span>
                <span>Settings</span>
              </div>
              {isSettingsActive && <span className="sidebar-active-arrow">›</span>}
            </button>

            <div className="sidebar-nav-divider" />

            {/* 7. Sign Out */}
            <button
              type="button"
              className="sidebar-nav-btn sidebar-nav-logout"
              onClick={() => setShowLogoutModal(true)}
              title="Sign out of BookMySalon"
            >
              <div className="sidebar-nav-btn-left">
                <span className="sidebar-nav-icon">🚪</span>
                <span>Sign Out</span>
              </div>
            </button>
          </nav>
        </div>
      </aside>

      {/* Reusable Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="profile-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="profile-modal-window"
            style={{ maxWidth: "420px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="profile-modal-header">
              <h3>Confirm Sign Out</h3>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowLogoutModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--profile-text-muted)",
                  margin: 0,
                  lineHeight: "1.5",
                }}
              >
                Are you sure you want to end your current customer session on this device?
              </p>
            </div>

            <div className="profile-modal-footer">
              <button
                type="button"
                className="btn-form-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-signout-red"
                onClick={handleLogout}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

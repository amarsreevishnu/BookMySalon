import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useAuth } from "../../hooks/useAuth";
import useFavorites from "../../hooks/useFavorites";
import { selectUserAvatar } from "../../features/auth/authSlice";
import { resolveImageUrl } from "../../utils/imageUtils";
import NotificationBell from "../common/NotificationBell";
import "../../styles/customerHeader.css";

import "../../styles/salonsExplore.css";

import logo from "../../assets/logo.png";

function CustomerHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { favoritesCount } = useFavorites();
  const reduxAvatar = useSelector(selectUserAvatar);
  const userAvatar = reduxAvatar || user?.avatar || "";

  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const userMenuRef = useRef(null);

  // Scroll detection for floating island shrink & glassmorphism elevation
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userDropdownOpen]);

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/login");
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const userName = user?.first_name || (user?.email ? user.email.split("@")[0] : "Guest");
  const userFullName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || userName;
  const userEmail = user?.email || "customer@bookmysalon.com";
  const userPhone = user?.phone || user?.phone_number || "Not provided";
  const userInitial = (user?.first_name || user?.email || "V")[0].toUpperCase();

  return (
    <>
      <div className={`dashboard-header-wrapper ${isScrolled ? "is-scrolled" : ""}`}>
        <header className="dashboard-header" role="banner">
          <div className="dashboard-header-inner">
            {/* Brand Logo & Title */}
            <Link to="/customer/home" className="dashboard-brand-group">
              <div className="dashboard-brand-icon">
                <img src={logo} alt="BookMySalon Logo" />
              </div>

              <div className="dashboard-brand-titles">
                <span className="dashboard-brand-name">BookMySalon</span>
                <span className="dashboard-brand-sub">ORGANIC WELLNESS</span>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="dashboard-nav-links" aria-label="Main navigation">
              <Link to="/customer/home" className="dashboard-nav-link">
                Home
              </Link>
              <Link to="/customer/salons" className="dashboard-nav-link">
                Find Salons
              </Link>
              <Link to="/customer/my-bookings" className="dashboard-nav-link">
                Bookings
              </Link>
              <Link to="/customer/wallet" className="dashboard-nav-link">
                Wallet
              </Link>
              <Link to="/customer/saved-salons" className="dashboard-nav-link">
                Favorites
                {favoritesCount > 0 && (
                  <span className="dashboard-fav-badge">{favoritesCount}</span>
                )}
              </Link>
            </nav>

            {/* Header Right Actions */}
            <div className="dashboard-header-right">
              {/* Notification Bell */}
              <div className="dashboard-notification-wrapper" title="Notifications">
                <NotificationBell />
              </div>

              {/* User Chip & Dropdown Menu */}
              <div className="dashboard-user-menu-wrapper" ref={userMenuRef}>
                <button
                  type="button"
                  className={`dashboard-user-chip ${userDropdownOpen ? "dropdown-active" : ""}`}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  title="Account menu & profile"
                  aria-expanded={userDropdownOpen}
                >
                  <div className="dashboard-avatar-wrapper">
                    {userAvatar ? (
                      <img
                        className="dashboard-avatar-img"
                        src={resolveImageUrl(userAvatar)}
                        alt={userFullName}
                      />
                    ) : (
                      <span className="dashboard-avatar-initial">{userInitial}</span>
                    )}
                  </div>

                  <div className="dashboard-user-info">
                    <span className="dashboard-user-name">{userName}</span>
                    <span className="dashboard-user-badge">Wellness Member</span>
                  </div>

                  <span className={`dashboard-user-caret ${userDropdownOpen ? "open" : ""}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="dashboard-dropdown">
                    <div className="dashboard-dropdown-header">
                      <div className="dashboard-dropdown-avatar">
                        {userAvatar ? (
                          <img
                            src={resolveImageUrl(userAvatar)}
                            alt={userFullName}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                          />
                        ) : (
                          userInitial
                        )}
                      </div>
                      <div className="dashboard-dropdown-details">
                        <span className="dashboard-dropdown-name">{userFullName}</span>
                        <span className="dashboard-dropdown-email">{userEmail}</span>
                        <span className="dashboard-dropdown-tag">Verified Customer</span>
                      </div>
                    </div>

                    <div className="dashboard-dropdown-list">
                      <Link
                        to="/customer/profile"
                        className="dashboard-dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <span className="dashboard-item-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        <span>User Profile</span>
                      </Link>

                      <Link
                        to="/customer/my-bookings"
                        className="dashboard-dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <span className="dashboard-item-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        </span>
                        <span>My Bookings</span>
                      </Link>

                      <Link
                        to="/customer/wallet"
                        className="dashboard-dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <span className="dashboard-item-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" />
                            <path d="M7 15h0M2 9.5h20" />
                          </svg>
                        </span>
                        <span>My Wallet</span>
                      </Link>

                      <Link
                        to="/customer/saved-salons"
                        className="dashboard-dropdown-item"
                        onClick={() => setUserDropdownOpen(false)}
                      >
                        <span className="dashboard-item-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </span>
                        <span>Saved Salons {favoritesCount > 0 ? `(${favoritesCount})` : ""}</span>
                      </Link>
                    </div>

                    <div className="dashboard-dropdown-divider" />

                    <button
                      type="button"
                      className="dashboard-dropdown-item dashboard-logout-btn"
                      onClick={() => {
                        setUserDropdownOpen(false);
                        setShowLogoutModal(true);
                      }}
                    >
                      <span className="dashboard-item-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile Animated Hamburger Toggle */}
              <button
                type="button"
                className={`dashboard-mobile-toggle ${mobileMenuOpen ? "open" : ""}`}
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation menu"
                title={mobileMenuOpen ? "Close menu" : "Open menu"}
              >
                <span className="burger-line" />
                <span className="burger-line" />
                <span className="burger-line" />
              </button>
            </div>
          </div>

          {/* Mobile Floating Drawer */}
          <div className={`dashboard-mobile-drawer ${mobileMenuOpen ? "open" : ""}`}>
            <Link
              to="/customer/home"
              className="dashboard-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span>Home</span>
            </Link>

            <Link
              to="/customer/salons"
              className="dashboard-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Find Salons</span>
            </Link>

            <Link
              to="/customer/my-bookings"
              className="dashboard-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>Bookings</span>
            </Link>

            <Link
              to="/customer/wallet"
              className="dashboard-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M7 15h0M2 9.5h20" />
              </svg>
              <span>My Wallet</span>
            </Link>

            <Link
              to="/customer/saved-salons"
              className="dashboard-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span>Saved Salons {favoritesCount > 0 ? `(${favoritesCount})` : ""}</span>
            </Link>

            <Link
              to="/customer/profile"
              className="dashboard-mobile-link mobile-profile-btn"
              onClick={() => setMobileMenuOpen(false)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>User Profile ({userName})</span>
            </Link>

            <div className="dashboard-mobile-divider" />

            <button
              type="button"
              className="dashboard-mobile-logout"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLogoutModal(true);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out ({userName})</span>
            </button>
          </div>
        </header>
      </div>

      {/* Spacer so page content doesn't tuck behind fixed header */}
      <div className="dashboard-header-spacer" aria-hidden="true" />

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="dashboard-toast" role="alert">
          <span>🌿</span> {toastMessage}
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <div
          className="dashboard-modal-overlay"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="dashboard-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="dashboard-modal-close"
              onClick={() => setShowProfileModal(false)}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="dashboard-modal-header">
              <div className="dashboard-modal-avatar">
                {userAvatar ? (
                  <img
                    src={resolveImageUrl(userAvatar)}
                    alt={userFullName}
                    style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                  />
                ) : (
                  userInitial
                )}
              </div>
              <div className="dashboard-modal-titles">
                <h3>{userFullName}</h3>
                <span className="dashboard-modal-pill">🌿 Wellness Member</span>
              </div>
            </div>

            <div className="dashboard-info-grid">
              <div className="dashboard-info-row">
                <span className="dashboard-label">Full Name</span>
                <span className="dashboard-val">{userFullName}</span>
              </div>
              <div className="dashboard-info-row">
                <span className="dashboard-label">Email Address</span>
                <span className="dashboard-val">{userEmail}</span>
              </div>
              <div className="dashboard-info-row">
                <span className="dashboard-label">Account Role</span>
                <span className="dashboard-val">Customer / Member</span>
              </div>
              <div className="dashboard-info-row">
                <span className="dashboard-label">Phone Number</span>
                <span className="dashboard-val">{userPhone}</span>
              </div>
              <div className="dashboard-info-row">
                <span className="dashboard-label">Account Status</span>
                <span className="dashboard-val dashboard-status-active">● Active</span>
              </div>
            </div>

            <div className="dashboard-modal-footer">
              <button
                type="button"
                className="dashboard-btn-close"
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="dashboard-btn-logout"
                onClick={() => {
                  setShowProfileModal(false);
                  setShowLogoutModal(true);
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="dashboard-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="dashboard-modal-box dashboard-logout-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="dashboard-modal-close"
              onClick={() => setShowLogoutModal(false)}
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="dashboard-modal-avatar logout-avatar">
              {userAvatar ? (
                <img
                  src={resolveImageUrl(userAvatar)}
                  alt={userFullName}
                  style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
                />
              ) : (
                userInitial
              )}
            </div>

            <h3 className="dashboard-modal-title">Sign Out of BookMySalon</h3>
            <div className="dashboard-modal-subtitle">
              Wellness Member • {userName}
            </div>

            <p className="dashboard-modal-message">
              Are you sure you want to sign out? You can sign back in anytime with your registered credentials.
            </p>

            <div className="dashboard-modal-actions">
              <button
                type="button"
                className="dashboard-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="dashboard-btn-confirm"
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

export default CustomerHeader;

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/salonsExplore.css";

function CustomerHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
    
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const userMenuRef = useRef(null);

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
      <header className="explore-header">
        <div className="explore-header-inner">
          <Link to="/customer-home" className="explore-brand-group">
            <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

          <nav className="explore-nav-links">
            <Link to="/customer-home" className="explore-nav-link">Home</Link>
            <Link to="/salons" className="explore-nav-link">Find Salons</Link>
            <a
              href="#bookings"
              className="explore-nav-link"
              onClick={(e) => {
                e.preventDefault();
                showToast("Opening your bookings...");
              }}
            >
              Bookings
            </a>
            <a
              href="#favorites"
              className="explore-nav-link"
              onClick={(e) => {
                e.preventDefault();
                showToast("You have 0 saved favorite salon(s).");
              }}
            >
              Favorites
            </a>
          </nav>

          <div className="explore-header-right">
            <button
              type="button"
              className="explore-notif-btn"
              title="Notifications"
              onClick={() => showToast("You have no unread notifications.")}
            >
              🔔
              <span className="explore-notif-dot" />
            </button>

            {/* Customer Avatar & Profile Dropdown */}
            <div className="explore-user-menu-wrapper" ref={userMenuRef}>
              <button
                type="button"
                className={`explore-user-chip ${userDropdownOpen ? "dropdown-active" : ""}`}
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                title="Account menu & profile"
                aria-expanded={userDropdownOpen}
              >
                <div className="explore-user-info">
                  <span className="explore-user-name">{userName}</span>
                  <span className="explore-user-badge">Wellness Member</span>
                </div>
                {user.avatar ?
                <div className="explore-user-avatar">
                  <img className="explore-user-avatar" src={resolveImageUrl(user.avatar)} alt={user.full_name} />
                </div>:<div className="explore-user-avatar">
                  {userInitial}
                </div>
                }
                
                <span className="explore-user-caret">▾</span>
              </button>

              {userDropdownOpen && (
                <div className="customer-avatar-dropdown">
                  <div className="dropdown-profile-header">
                    <div className="dropdown-avatar-circle">
                      {userInitial}
                    </div>
                    <div className="dropdown-profile-details">
                      <span className="dropdown-user-fullname">{userFullName}</span>
                      <span className="dropdown-user-email">{userEmail}</span>
                      <span className="dropdown-wellness-tag">🌿 Verified Customer</span>
                    </div>
                  </div>

                  <div className="dropdown-menu-list">
                    <Link
                      to="/customer/profile"
                      className="dropdown-menu-item"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{ textDecoration: "none" }}
                    >
                      <span className="dropdown-item-icon">👤</span>
                      <span>User Profile</span>
                    </Link>

                    <Link
                      to="/customer/profile?tab=bookings"
                      className="dropdown-menu-item"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{ textDecoration: "none" }}
                    >
                      <span className="dropdown-item-icon">📅</span>
                      <span>My Appointments</span>
                    </Link>

                    <Link
                      to="/customer/profile?tab=favorites"
                      className="dropdown-menu-item"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{ textDecoration: "none" }}
                    >
                      <span className="dropdown-item-icon">❤️</span>
                      <span>Saved Favorites</span>
                    </Link>
                  </div>

                  <div className="dropdown-menu-divider" />

                  <button
                    type="button"
                    className="dropdown-menu-item dropdown-logout-btn"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      setShowLogoutModal(true);
                    }}
                  >
                    <span className="dropdown-item-icon">🚪</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

            {/* Mobile menu toggle */}
            <button
              type="button"
              className="explore-mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              title={mobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        {/* Mobile slide-down navigation drawer */}
        {mobileMenuOpen && (
          <div className="explore-mobile-drawer">
            <Link
              to="/customer-home"
              className="explore-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>🏠</span> Home
            </Link>
            <Link
              to="/salons"
              className="explore-mobile-link"
              onClick={() => setMobileMenuOpen(false)}
            >
              <span>🔍</span> Find Salons
            </Link>
            <a
              href="#bookings"
              className="explore-mobile-link"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                showToast("Opening your bookings...");
              }}
            >
              <span>📅</span> Bookings
            </a>
            <a
              href="#favorites"
              className="explore-mobile-link"
              onClick={(e) => {
                e.preventDefault();
                setMobileMenuOpen(false);
                showToast("You have 0 saved favorite salon(s).");
              }}
            >
              <span>❤️</span> Favorites
            </a>
            <button
              type="button"
              className="explore-mobile-link"
              style={{ background: "none", border: "none", width: "100%", textAlign: "left", cursor: "pointer" }}
              onClick={() => {
                setMobileMenuOpen(false);
                setShowProfileModal(true);
              }}
            >
              <span>👤</span> User Profile ({userName})
            </button>
            <div className="explore-mobile-divider" />
            <button
              type="button"
              className="explore-mobile-logout"
              onClick={() => {
                setMobileMenuOpen(false);
                setShowLogoutModal(true);
              }}
            >
              <span>🚪</span> Sign Out ({userName})
            </button>
          </div>
        )}
      </header>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="explore-toast-banner" role="alert">
          <span>🌿</span> {toastMessage}
        </div>
      )}

      {/* User Profile Modal */}
      {showProfileModal && (
        <div
          className="profile-modal-overlay"
          onClick={() => setShowProfileModal(false)}
        >
          <div
            className="profile-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="profile-modal-header">
              <div className="profile-modal-avatar">
                {userInitial}
              </div>
              <div className="profile-modal-titles">
                <h3>{userFullName}</h3>
                <span className="profile-membership-pill">🌿 Wellness Member</span>
              </div>
              <button
                type="button"
                className="profile-modal-close"
                onClick={() => setShowProfileModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              <div className="profile-info-grid">
                <div className="profile-info-row">
                  <span className="profile-label">Full Name</span>
                  <span className="profile-val">{userFullName}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-label">Email Address</span>
                  <span className="profile-val">{userEmail}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-label">Account Role</span>
                  <span className="profile-val">Customer / Member</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-label">Phone Number</span>
                  <span className="profile-val">{userPhone}</span>
                </div>
                <div className="profile-info-row">
                  <span className="profile-label">Account Status</span>
                  <span className="profile-val" style={{ color: "#2d6a4f", fontWeight: 700 }}>● Active</span>
                </div>
              </div>
            </div>

            <div className="profile-modal-footer">
              <button
                type="button"
                className="profile-btn-close"
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="profile-btn-logout"
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
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="logout-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="logout-modal-close"
              onClick={() => setShowLogoutModal(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="logout-modal-avatar">
              {userInitial}
            </div>

            <h3 className="logout-modal-title">Sign Out of BookMySalon</h3>
            <div className="logout-modal-subtitle">
              Wellness Member • {userName}
            </div>

            <p className="logout-modal-message">
              Are you sure you want to sign out? You can sign back in anytime with your email and password.
            </p>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-btn-confirm"
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
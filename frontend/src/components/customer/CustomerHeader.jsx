import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/salonsExplore.css";

function CustomerHeader() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleLogout = () => {
    setShowLogoutModal(false);
    logout();
    navigate("/login");
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2500);
  };

  const userName = user?.first_name || "Vishnu";
  const userInitial = (user?.first_name || "V")[0].toUpperCase();

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

            <div
              className="explore-user-chip"
              onClick={() => setShowLogoutModal(true)}
              title="Click to sign out"
            >
              <div className="explore-user-info">
                <span className="explore-user-name">{userName}</span>
                <span className="explore-user-badge">Wellness Member</span>
              </div>
              <div className="explore-user-avatar">
                {userInitial}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Floating toast notification */}
      {toastMessage && (
        <div className="explore-toast-banner" role="alert">
          <span>🌿</span> {toastMessage}
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
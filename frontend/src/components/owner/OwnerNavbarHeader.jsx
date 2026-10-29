import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import NotificationBell from "../common/NotificationBell";
import "../../styles/ownerNavbar.css";

export default function OwnerNavbarHeader({
  onQuickWalkIn,
  onExportReport,
  onNotificationsClick,
  onSettingsClick,
  showQuickWalkIn = true,
  showExportReport = true,
  customActions,
  salonInfo,
}) {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const profileDropdownRef = useRef(null);

  // Fallback salon info fetching if salonInfo prop is not provided
  const [fetchedSalon, setFetchedSalon] = useState(null);

  useEffect(() => {
    if (!salonInfo || !salonInfo.name) {
      let isMounted = true;
      api
        .get("/salons/owner/dashboard/")
        .then((res) => {
          if (isMounted && res.data?.salon_info) {
            setFetchedSalon(res.data.salon_info);
          }
        })
        .catch(() => {});
      return () => {
        isMounted = false;
      };
    }
  }, [salonInfo]);

  const activeSalon = useMemo(() => {
    if (salonInfo?.name) return salonInfo;
    if (fetchedSalon?.name) return fetchedSalon;
    return { name: "Salon Studio", city: "" };
  }, [salonInfo, fetchedSalon]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showProfileDropdown]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [showProfileDropdown]);

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate("/login");
  };

  const handleSettingsClick = () => {
    setShowProfileDropdown(false);
    if (onSettingsClick) {
      onSettingsClick();
    } else {
      navigate("/owner/dashboard", { state: { targetTab: "Settings" } });
    }
  };

  const userName = useMemo(() => {
    if (user?.first_name) {
      return `${user.first_name} ${user.last_name || ""}`.trim();
    }
    return user?.name || "Salon Owner";
  }, [user]);

  const userAvatar =
    user?.profile_photo ||
    user?.avatar ||
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80";

  return (
    <>
      <header className="studio-header">
        <div className="studio-header-inner">
          {/* Logo & Studio Brand */}
          <Link to="/owner/dashboard" className="explore-brand-group">
            <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

          {/* Top Actions */}
          <div className="studio-header-actions">
            {customActions}

            {showQuickWalkIn && (
              <button
                type="button"
                className="btn-quick-walkin"
                onClick={() => {
                  if (onQuickWalkIn) {
                    onQuickWalkIn();
                  } else {
                    navigate("/owner/dashboard");
                  }
                }}
              >
                <span>+</span>
                <span className="btn-walkin-text">Quick Walk-In</span>
              </button>
            )}

            {showExportReport && (
              <button
                type="button"
                className="btn-export-report"
                onClick={() => {
                  if (onExportReport) {
                    onExportReport();
                  } else {
                    window.print();
                  }
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>Export Daily Report</span>
              </button>
            )}

            <NotificationBell theme="dark" />

            <button
              type="button"
              className="studio-icon-btn"
              title="Settings & Security"
              onClick={handleSettingsClick}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            {/* Profile Avatar & Interactive Dropdown Menu */}
            <div className="studio-profile-menu-wrapper" ref={profileDropdownRef}>
              <button
                type="button"
                className="studio-user-avatar-btn"
                onClick={() => setShowProfileDropdown((prev) => !prev)}
                title="Salon Manager Profile & Options"
                aria-expanded={showProfileDropdown}
              >
                <img
                  src={userAvatar}
                  alt={userName}
                  className="studio-user-avatar"
                />
                <span className="studio-user-status-dot" title="Active Master Admin" />
              </button>

              {showProfileDropdown && (
                <div className="studio-profile-dropdown">
                  {/* User Profile Header */}
                  <div className="studio-dropdown-header">
                    <img
                      src={userAvatar}
                      alt={userName}
                      className="studio-dropdown-avatar"
                    />
                    <div className="studio-dropdown-user-info">
                      <div className="studio-dropdown-name">{userName}</div>
                      <span className="studio-dropdown-role">Owner • Master Admin</span>
                      <div className="studio-dropdown-email">
                        {user?.email || "owner@bookmysalon.com"}
                      </div>
                    </div>
                  </div>

                  {activeSalon?.name && (
                    <div className="studio-dropdown-salon-meta">
                      <span className="studio-dropdown-salon-icon">🏛️</span>
                      <div className="studio-dropdown-salon-text">
                        <strong>{activeSalon.name}</strong>
                        {activeSalon.city && <span> • {activeSalon.city}</span>}
                      </div>
                    </div>
                  )}

                  <div className="studio-dropdown-divider" />

                  {/* Menu Items */}
                  <div className="studio-dropdown-items">
                    <button
                      type="button"
                      className="studio-dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate("/owner/salon-profile");
                      }}
                    >
                      <span className="studio-dropdown-item-icon">👤</span>
                      <div className="studio-dropdown-item-content">
                        <span className="studio-dropdown-item-title">Salon Profile</span>
                        <span className="studio-dropdown-item-sub">View &amp; edit salon details</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="studio-dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        if (onSettingsClick) {
                          onSettingsClick();
                        } else {
                          navigate("/owner/dashboard", { state: { targetTab: "Settings" } });
                        }
                      }}
                    >
                      <span className="studio-dropdown-item-icon">⚙️</span>
                      <div className="studio-dropdown-item-content">
                        <span className="studio-dropdown-item-title">Settings &amp; Security</span>
                        <span className="studio-dropdown-item-sub">Credentials &amp; password</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="studio-dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate("/owner/dashboard", { state: { targetTab: "Revenue" } });
                      }}
                    >
                      <span className="studio-dropdown-item-icon">💰</span>
                      <div className="studio-dropdown-item-content">
                        <span className="studio-dropdown-item-title">Revenue &amp; Wallet</span>
                        <span className="studio-dropdown-item-sub">Ledger, earnings &amp; advances</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="studio-dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate("/owner/workers");
                      }}
                    >
                      <span className="studio-dropdown-item-icon">👥</span>
                      <div className="studio-dropdown-item-content">
                        <span className="studio-dropdown-item-title">Specialists &amp; Staff</span>
                        <span className="studio-dropdown-item-sub">Manage team &amp; duty roster</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="studio-dropdown-item"
                      onClick={() => {
                        setShowProfileDropdown(false);
                        navigate("/owner/services");
                      }}
                    >
                      <span className="studio-dropdown-item-icon">✨</span>
                      <div className="studio-dropdown-item-content">
                        <span className="studio-dropdown-item-title">Service Catalog</span>
                        <span className="studio-dropdown-item-sub">Pricing, categories &amp; durations</span>
                      </div>
                    </button>
                  </div>

                  <div className="studio-dropdown-divider" />

                  {/* Logout Item */}
                  <button
                    type="button"
                    className="studio-dropdown-item studio-dropdown-item--danger"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setShowLogoutModal(true);
                    }}
                  >
                    <span className="studio-dropdown-item-icon">🚪</span>
                    <div className="studio-dropdown-item-content">
                      <span className="studio-dropdown-item-title">Logout</span>
                      <span className="studio-dropdown-item-sub">End this active session</span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon">
              <img
                src={userAvatar}
                alt="Owner Avatar"
                className="studio-user-avatar"
                style={{ width: "100%", height: "100%" }}
              />
            </div>

            <h3>Logout</h3>
            <p>Are you sure you want to logout from Salon Studio?</p>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="logout-btn"
                onClick={handleLogout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/axios";
import "../../styles/workerDashboard.css";

export default function WorkerHeader({
  activeTab = "appointments",
  onTabChange,
  salonInfo,
  stylistProfile,
  extraNavItems,
  rightActions,
  searchContent,
}) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const profileMenuRef = useRef(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [fetchedSalon, setFetchedSalon] = useState(null);
  const [fetchedWorker, setFetchedWorker] = useState(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
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

  useEffect(() => {
    if (!salonInfo || !stylistProfile) {
      let isMounted = true;
      api
        .get("/salons/worker/dashboard/")
        .then((res) => {
          if (!isMounted || !res.data) return;
          const { salon, worker } = res.data;
          if (salon && !salonInfo) {
            setFetchedSalon({
              name: salon.name || "Affiliated Salon Outlet",
              city: salon.city || "",
              address: salon.address || "",
              category: salon.category_name || "",
            });
          }
          if (worker && !stylistProfile) {
            setFetchedWorker({
              name: worker.full_name || user?.full_name || "Specialist",
              avatar:
                worker.avatar ||
                "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=160&q=80",
              chair: worker.chair ? `Chair #${worker.chair}` : "Chair #01",
              shift: worker.shift || "09:30 AM - 06:30 PM",
              roleBadge: worker.role_badge || "Salon Specialist",
            });
          }
        })
        .catch(() => {
          
        });
      return () => {
        isMounted = false;
      };
    }
  }, [salonInfo, stylistProfile, user]);

  const currentSalon = salonInfo || fetchedSalon || {
    name: "Affiliated Salon Outlet",
    city: "",
    address: "",
  };

  const currentProfile = stylistProfile || fetchedWorker || {
    name: user?.full_name || "Specialist",
    avatar:
      user?.avatar ||
      "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=160&q=80",
    chair: "Chair #01 (Front Bay)",
    shift: "09:30 AM - 06:30 PM",
    roleBadge: "Salon Specialist",
  };

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate("/login");
  };

  return (
    <>
      <header className="wd-navbar">
        <div className="wd-navbar-inner">
          <div className="wd-navbar-left">
            <Link to="/worker/dashboard" className="wd-brand-link">
              <div className="wd-brand-icon">✂</div>
              <div className="explore-brand-titles">
                <span className="explore-brand-name">BookMySalon</span>
                <span className="explore-brand-sub">ORGANIC WELLNESS</span>
              </div>
            </Link>

            <div className="wd-nav-search-box">
              {searchContent}
            </div>

            <nav className="wd-nav-links">
              <button
                type="button"
                className={`wd-nav-tab ${activeTab === "appointments" ? "active" : ""}`}
                onClick={() => {
                  if (activeTab === "appointments" && onTabChange) {
                    onTabChange("appointments");
                  } else {
                    navigate("/worker/dashboard");
                  }
                }}
              >
                Dashboard
              </button>
              {/* <button
                type="button"
                className={`wd-nav-tab ${activeTab === "calendar" ? "active" : ""}`}
                onClick={() => {
                  if (activeTab === "calendar" && onTabChange) {
                    onTabChange("calendar");
                  } else {
                    navigate("/worker/calendar");
                  }
                }}
              >
                Calendar
              </button> */}

              <button
                type="button"
                className={`wd-nav-tab ${activeTab === "" ? "active" : ""}`}
                onClick={() => {
                  if (activeTab === "appointments" && onTabChange) {
                    onTabChange("appointments");
                  } else {
                    navigate("/worker/dashboard");
                  }
                }}
              >
                Appointment
              </button>

              <button
                type="button"
                className={`wd-nav-tab ${activeTab === "leaves" ? "active" : ""}`}
                onClick={() => {
                  if (activeTab === "leaves" && onTabChange) {
                    onTabChange("leaves");
                  } else {
                    navigate("/worker/leave");
                  }
                }}
              >
                Leaves
              </button>

              <button
                type="button"
                className={`wd-nav-tab ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => {
                  if (activeTab === "profile" && onTabChange) {
                    onTabChange("profile");
                  } else {
                    navigate("/worker/profile");
                  }
                }}
              >
                My Profile
              </button>

              {extraNavItems}
            </nav>
          </div>

          <div className="wd-navbar-right">
            {rightActions}

            <div className="wd-nav-profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="wd-nav-profile-btn"
                onClick={() => setShowProfileDropdown((prev) => !prev)}
                title="Specialist Profile & Options"
                aria-expanded={showProfileDropdown}
              >
                <img
                  src={currentProfile.avatar}
                  alt={currentProfile.name}
                  className="wd-nav-profile-img"
                />
                <span className="wd-nav-profile-status-dot" title="On Duty" />
              </button>

              {showProfileDropdown && (
                <div className="wd-nav-profile-dropdown">
                  <div className="wd-dropdown-header">
                    <img
                      src={currentProfile.avatar}
                      alt={currentProfile.name}
                      className="wd-dropdown-avatar"
                    />
                    <div className="wd-dropdown-user-info">
                      <div className="wd-dropdown-name">{currentProfile.name}</div>
                      <div className="wd-dropdown-role">{currentProfile.roleBadge}</div>
                      <div className="wd-dropdown-email">
                        {user?.email || "worker@bookmysalon.com"}
                      </div>
                    </div>
                  </div>

                  <div className="wd-dropdown-divider" />

                  {currentSalon?.name && (
                    <div className="wd-dropdown-meta-item">
                      <span className="wd-meta-icon">🏛️</span>
                      <span><strong>{currentSalon.name}</strong></span>
                    </div>
                  )}
                  {(currentSalon?.address || currentSalon?.city) && (
                    <div className="wd-dropdown-meta-item">
                      <span className="wd-meta-icon">📍</span>
                      <span>
                        {currentSalon.address
                          ? `${currentSalon.address}, ${currentSalon.city || ""}`
                          : currentSalon.city}
                      </span>
                    </div>
                  )}
                  {currentProfile?.chair && (
                    <div className="wd-dropdown-meta-item">
                      <span className="wd-meta-icon">🪑</span>
                      <span>{currentProfile.chair}</span>
                    </div>
                  )}
                  {currentProfile?.shift && (
                    <div className="wd-dropdown-meta-item">
                      <span className="wd-meta-icon">⏰</span>
                      <span>{currentProfile.shift}</span>
                    </div>
                  )}

                  <div className="wd-dropdown-divider" />

                  <button
                    type="button"
                    className="wd-dropdown-item"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate("/worker/profile");
                    }}
                  >
                    <span className="wd-dropdown-icon">👤</span>
                    <span>My Profile</span>
                  </button>

                  <button
                    type="button"
                    className="wd-dropdown-item"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      navigate("/worker/leave");
                    }}
                  >
                    <span className="wd-dropdown-icon">🏖️</span>
                    <span>My Leaves &amp; Schedule</span>
                  </button>

                  <button
                    type="button"
                    className="wd-dropdown-item wd-dropdown-logout-btn"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <span className="wd-dropdown-icon">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="wd-modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="wd-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px", textAlign: "center" }}
          >
            <div style={{ padding: "28px 24px 20px" }}>
              <div className="wd-logout-modal-icon-circle">
                <img
                  src={currentProfile.avatar}
                  alt={currentProfile.name}
                  className="wd-logout-modal-avatar"
                />
              </div>

              <h3
                style={{
                  margin: "16px 0 8px",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "var(--wd-text-primary, #0f172a)",
                }}
              >
                Confirm Logout
              </h3>
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: "13.5px",
                  color: "var(--wd-text-muted, #64748b)",
                  lineHeight: "1.5",
                }}
              >
                Are you sure you want to log out of Stylist Suite? Any unstarted services will remain in queue.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                  }}
                  onClick={handleLogout}
                >
                  Yes, Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/ownerNavbar.css";

const DEFAULT_NAV_TABS = [
  "Dashboard",
  "Salon",
  "Bookings",
  "Services",
  "Workers",
  "Schedule",
  "Customers",
  "Offers",
  "Revenue",
  "Reviews",
  "Settings",
];

export default function OwnerNavbar({
  activeTab = "Dashboard",
  onTabChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Search clients, staff... (Press '/' to focus)",
  onQuickWalkIn,
  onExportReport,
  onNotificationsClick,
  onSettingsClick,
  workersCount,
  showSubNav = true,
  showAddWorker = true,
  showQuickWalkIn = true,
  showExportReport = true,
  customActions,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user } = useAuth();
  const searchInputRef = useRef(null);

  const [internalSearch, setInternalSearch] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const currentSearch = searchQuery !== undefined ? searchQuery : internalSearch;

  // Global '/' keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    if (onSearchChange) {
      onSearchChange(e);
    } else {
      setInternalSearch(val);
    }
  };

  const handleTabClick = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    }

    if (tab === "Workers") {
      if (location.pathname !== "/owner/workers") {
        navigate("/owner/workers");
      }
    } else if (tab === "Dashboard") {
      if (location.pathname !== "/owner/dashboard") {
        navigate("/owner/dashboard");
      }
    } else {
      if (location.pathname !== "/owner/dashboard") {
        navigate("/owner/dashboard", { state: { targetTab: tab } });
      }
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogoutModal(false);
    navigate("/login");
  };

  return (
    <>
      {/* --------------------------------------------------------------------
          TOP BAR HEADER
          -------------------------------------------------------------------- */}
      <header className="studio-header">
        <div className="studio-header-inner">
          {/* Logo & Studio Brand */}
          <Link to="/owner/dashboard" className="studio-brand-group">
            <div className="studio-logo-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M7 16V14" />
                <path d="M12 16V10" />
                <path d="M17 16V6" />
              </svg>
            </div>
            <div className="studio-brand-titles">
              <span className="studio-brand-name">BookMySalon</span>
              <span className="studio-brand-badge">BUSINESS STUDIO</span>
            </div>
          </Link>

          {/* Search bar */}
          <div className="studio-search-wrapper">
            <span className="studio-search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="studio-search-input"
              placeholder={searchPlaceholder}
              value={currentSearch}
              onChange={handleSearchChange}
            />
          </div>

          {/* Top Actions */}
          <div className="studio-header-actions">
            {customActions}

            {showAddWorker && (
              <button
                type="button"
                className="btn-add-worker-header"
                onClick={() => navigate("/owner/add-worker")}
              >
                <span>+</span>
                <span>Add Worker</span>
              </button>
            )}

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
                <span>Quick Walk-In</span>
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
                    alert("Exporting daily operational report...");
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

            <button
              type="button"
              className="studio-icon-btn"
              title="Notifications"
              onClick={() => {
                if (onNotificationsClick) {
                  onNotificationsClick();
                } else {
                  alert("Notifications: All systems and appointments up to date.");
                }
              }}
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
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span className="studio-icon-badge" />
            </button>

            <button
              type="button"
              className="studio-icon-btn"
              title="Settings"
              onClick={() => {
                if (onSettingsClick) {
                  onSettingsClick();
                } else {
                  handleTabClick("Settings");
                }
              }}
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

            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
              alt={user?.first_name || "Owner Avatar"}
              className="studio-user-avatar"
              title="Salon Manager • Click to Logout"
              onClick={() => setShowLogoutModal(true)}
            />
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          LOGOUT CONFIRMATION MODAL
          -------------------------------------------------------------------- */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="logout-modal-icon">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
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

      {/* --------------------------------------------------------------------
          HORIZONTAL SUB-NAVIGATION TABS
          -------------------------------------------------------------------- */}
      {showSubNav && (
        <nav className="studio-nav-bar">
          <div className="studio-nav-tabs">
            {DEFAULT_NAV_TABS.map((tab) => {
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  className={`studio-nav-tab ${isActive ? "active" : ""}`}
                  onClick={() => handleTabClick(tab)}
                >
                  {tab}
                  {tab === "Workers" && typeof workersCount === "number" && workersCount > 0 && (
                    <span className="studio-nav-tab-badge">
                      {workersCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}

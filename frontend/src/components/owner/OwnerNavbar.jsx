import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import OwnerNavbarHeader from "./OwnerNavbarHeader";
import api from "../../api/axios";
import "../../styles/ownerNavbar.css";

export const DEFAULT_NAV_TABS = [
  "Dashboard",
  "Salon",
  "Bookings",
  "Services",
  "Workers",
  "Worker Leaves",
  "Salon Schedule",
  "Offers",
  "Subscription",
  "Support",
  "Revenue",
  "Reviews",
  "Settings",
];

// Rich, luxury SVG icons matching the BookMySalon emerald & gold aesthetic
export const NAV_TAB_ICONS = {
  Dashboard: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  Salon: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  Bookings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  ),
  Services: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3-4.8-2.5-4.8 2.5.9-5.3-3.8-3.7 5.3-.8z" />
    </svg>
  ),
  Workers: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  "Worker Leaves": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="10" y1="14" x2="14" y2="18" />
      <line x1="14" y1="14" x2="10" y2="18" />
    </svg>
  ),
  "Salon Schedule": (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Offers: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  ),
  Subscription: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
  Support: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  Revenue: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  Reviews: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  Settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

// Shorter labels for tight laptop & tablet displays to guarantee zero clipping
export const SHORT_TAB_LABELS = {
  "Worker Leaves": "Leaves",
  "Salon Schedule": "Schedule",
  Subscription: "Billing",
};

// Logical grouping for mobile & tablet responsive navigation drawer
export const NAV_TAB_GROUPS = [
  {
    title: "Core Studio",
    tabs: ["Dashboard", "Salon", "Salon Schedule"],
  },
  {
    title: "Operations & Staff",
    tabs: ["Bookings", "Services", "Workers", "Worker Leaves"],
  },
  {
    title: "Growth & Finance",
    tabs: ["Offers", "Subscription", "Revenue", "Reviews"],
  },
  {
    title: "Help & Settings",
    tabs: ["Support", "Settings"],
  },
];

export default function OwnerNavbar({
  activeTab = "Dashboard",
  onTabChange,
  workersCount,
  tabs = DEFAULT_NAV_TABS,
  showSubNav = true,
  withHeader = false,
  headerProps = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Unread support ticket polling
  useEffect(() => {
    let isMounted = true;
    api
      .get("/support/owner/unread-count/")
      .then((res) => {
        if (isMounted) {
          setUnreadSupportCount(res.data?.unread_count || 0);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  // Listen for global header hamburger toggle event
  useEffect(() => {
    const handleToggleEvent = () => setIsMobileMenuOpen((prev) => !prev);
    window.addEventListener("toggle-owner-nav-menu", handleToggleEvent);
    return () => {
      window.removeEventListener("toggle-owner-nav-menu", handleToggleEvent);
    };
  }, []);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  // Auto-close mobile drawer if resized to desktop breakpoint
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024 && isMobileMenuOpen) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileMenuOpen]);

  // Lock body scroll when mobile full drawer is open to avoid background page shifting
  useEffect(() => {
    if (isMobileMenuOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isMobileMenuOpen]);

  // Accurate active tab check across aliases
  const isTabActive = useCallback(
    (tab) => {
      return (
        activeTab === tab ||
        (tab === "Salon" && (activeTab === "Salon Profile" || activeTab === "Profile")) ||
        (tab === "Bookings" && activeTab === "Appointments") ||
        (tab === "Reviews" && activeTab === "Ratings") ||
        (tab === "Revenue" && (activeTab === "Wallet" || activeTab === "Earnings")) ||
        (tab === "Settings" && activeTab === "Security") ||
        (tab === "Salon Schedule" && activeTab === "Schedule") ||
        (tab === "Worker Leaves" && (activeTab === "Worker Schedule" || activeTab === "Leaves"))
      );
    },
    [activeTab]
  );

  // Resolve current active tab label for compact displays
  const currentActiveTab = useMemo(() => {
    return tabs.find((t) => isTabActive(t)) || activeTab || "Dashboard";
  }, [tabs, activeTab, isTabActive]);

  const handleTabClick = (tab) => {
    setIsMobileMenuOpen(false);

    if (onTabChange) {
      onTabChange(tab);
    }

    if (tab === "Workers") {
      if (location.pathname !== "/owner/workers") {
        navigate("/owner/workers");
      }
    } else if (tab === "Services") {
      if (location.pathname !== "/owner/services") {
        navigate("/owner/services");
      }
    } else if (tab === "Salon" || tab === "Salon Profile" || tab === "Profile") {
      if (location.pathname !== "/owner/salon-profile") {
        navigate("/owner/salon-profile");
      }
    } else if (tab === "Worker Leaves" || tab === "Worker Schedule" || tab === "Leaves") {
      if (location.pathname !== "/owner/worker-leaves") {
        navigate("/owner/worker-leaves");
      }
    } else if (tab === "Salon Schedule") {
      if (location.pathname !== "/owner/schedule") {
        navigate("/owner/schedule");
      }
    } else if (tab === "Offers") {
      if (location.pathname !== "/owner/offers") {
        navigate("/owner/offers");
      }
    } else if (tab === "Subscription" || tab === "Billing") {
      if (location.pathname !== "/owner/subscription") {
        navigate("/owner/subscription");
      }
    } else if (tab === "Support" || tab === "Support Tickets" || tab === "Tickets") {
      if (location.pathname !== "/owner/support") {
        navigate("/owner/support");
      }
    } else if (tab === "Bookings" || tab === "Appointments") {
      if (location.pathname !== "/owner/bookings") {
        navigate("/owner/bookings");
      }
    } else if (tab === "Reviews" || tab === "Ratings") {
      if (location.pathname !== "/owner/reviews") {
        navigate("/owner/reviews");
      }
    } else if (tab === "Revenue" || tab === "Wallet" || tab === "Earnings") {
      if (location.pathname !== "/owner/revenue") {
        navigate("/owner/revenue");
      }
    } else if (tab === "Settings" || tab === "Security") {
      if (location.pathname !== "/owner/settings") {
        navigate("/owner/settings");
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

  return (
    <>
      {withHeader && <OwnerNavbarHeader {...headerProps} />}

      {showSubNav && (
        <nav className="studio-nav-bar" aria-label="Salon Owner Navigation">
          {/* Desktop & Tablet Navigation Island */}
          <div className="studio-nav-tabs">
            {tabs.map((tab) => {
              const active = isTabActive(tab);
              const shortLabel = SHORT_TAB_LABELS[tab] || tab;
              const icon = NAV_TAB_ICONS[tab] || null;

              return (
                <button
                  key={tab}
                  type="button"
                  className={`studio-nav-tab ${active ? "active" : ""}`}
                  onClick={() => handleTabClick(tab)}
                  title={tab}
                  aria-current={active ? "page" : undefined}
                >
                  {icon && <span className="studio-nav-icon">{icon}</span>}
                  <span className="studio-tab-label-full">{tab}</span>
                  <span className="studio-tab-label-short">{shortLabel}</span>

                  {tab === "Support" && unreadSupportCount > 0 && (
                    <span
                      className="owner-nav-unread-pill"
                      title={`${unreadSupportCount} unread replies from Super Admin`}
                    >
                      {unreadSupportCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact Mobile Navigation Bar (Active on Mobile Screens < 768px) */}
          <div className="studio-mobile-bar">
            {/* Active Page Indicator Chip */}
            <button
              type="button"
              className="studio-mobile-active-chip"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              title="Click to view all navigation links"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="studio-mobile-active-dot" />
              <span className="studio-mobile-active-icon">
                {NAV_TAB_ICONS[currentActiveTab]}
              </span>
              <span className="studio-mobile-active-name">{currentActiveTab}</span>
              <svg
                className={`studio-mobile-arrow ${isMobileMenuOpen ? "rotated" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Quick-Access Operational Shortcuts on Mobile */}
            <div className="studio-mobile-quick-links">
              {currentActiveTab !== "Dashboard" && (
                <button
                  type="button"
                  className="studio-mobile-quick-chip"
                  onClick={() => handleTabClick("Dashboard")}
                  title="Go to Dashboard"
                >
                  {NAV_TAB_ICONS.Dashboard}
                  <span>Home</span>
                </button>
              )}

              {currentActiveTab !== "Bookings" && (
                <button
                  type="button"
                  className="studio-mobile-quick-chip"
                  onClick={() => handleTabClick("Bookings")}
                  title="Go to Bookings"
                >
                  {NAV_TAB_ICONS.Bookings}
                  <span>Bookings</span>
                </button>
              )}
            </div>

            {/* Expand Full Menu Trigger Button */}
            <button
              type="button"
              className={`studio-mobile-menu-trigger ${isMobileMenuOpen ? "open" : ""}`}
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle all navigation pages"
              title="All Navigation Tabs"
              aria-expanded={isMobileMenuOpen}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {isMobileMenuOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="14" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  </>
                )}
              </svg>
              <span className="studio-mobile-menu-text">
                {isMobileMenuOpen ? "Close" : "Menu"}
              </span>

              {unreadSupportCount > 0 && (
                <span className="studio-mobile-unread-dot" title="Unread support notifications" />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* Responsive Slide-Over / Full-Screen Navigation Drawer for Mobile & Small Tablets */}
      {isMobileMenuOpen && (
        <div
          className="owner-mobile-drawer-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Salon Owner Navigation Menu"
        >
          <div
            className="owner-mobile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="owner-mobile-drawer-header">
              <div className="owner-drawer-brand">
                <span className="owner-drawer-brand-title">Salon Navigation</span>
                <span className="owner-drawer-brand-badge">All 13 Portals</span>
              </div>

              <button
                type="button"
                className="owner-mobile-drawer-close"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                title="Close"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Categorized 2-Column Responsive Card Grid */}
            <div className="owner-mobile-drawer-body">
              {NAV_TAB_GROUPS.map((group) => (
                <div key={group.title} className="owner-drawer-group">
                  <div className="owner-drawer-group-title">{group.title}</div>
                  <div className="owner-drawer-group-grid">
                    {group.tabs.map((tab) => {
                      const active = isTabActive(tab);
                      const icon = NAV_TAB_ICONS[tab] || null;

                      return (
                        <button
                          key={tab}
                          type="button"
                          className={`owner-drawer-item ${active ? "active" : ""}`}
                          onClick={() => handleTabClick(tab)}
                        >
                          <span className="owner-drawer-item-icon">{icon}</span>
                          <span className="owner-drawer-item-label">{tab}</span>

                          {tab === "Support" && unreadSupportCount > 0 && (
                            <span className="owner-nav-unread-pill">
                              {unreadSupportCount}
                            </span>
                          )}

                          {active && (
                            <span className="owner-drawer-active-check" title="Current Active Portal">
                              ✓
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Drawer Footer Actions */}
            <div className="owner-mobile-drawer-footer">
              <button
                type="button"
                className="owner-drawer-footer-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate("/owner/dashboard");
                }}
              >
                <span>🏛️</span>
                <span>Owner Overview</span>
              </button>
              <button
                type="button"
                className="owner-drawer-footer-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  navigate("/owner/settings");
                }}
              >
                <span>⚙️</span>
                <span>Security</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

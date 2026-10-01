import { useNavigate, useLocation } from "react-router-dom";
import OwnerNavbarHeader from "./OwnerNavbarHeader";
import "../../styles/ownerNavbar.css";

export const DEFAULT_NAV_TABS = [
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
  workersCount,
  tabs = DEFAULT_NAV_TABS,
  showSubNav = true,
  // Optional backward compatibility flag if mounted standalone
  withHeader = false,
  headerProps = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleTabClick = (tab) => {
    if (onTabChange) {
      onTabChange(tab);
    }

    if (tab === "Workers") {
      if (location.pathname !== "/owner/workers") {
        navigate("/owner/workers");
      }
    } else if (tab === "Salon" || tab === "Salon Profile" || tab === "Profile") {
      if (location.pathname !== "/owner/salon-profile") {
        navigate("/owner/salon-profile");
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
        <nav className="studio-nav-bar">
          <div className="studio-nav-tabs">
            {tabs.map((tab) => {
              const isActive =
                activeTab === tab ||
                (tab === "Salon" && (activeTab === "Salon Profile" || activeTab === "Profile"));
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

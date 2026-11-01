import { useState, useEffect } from "react";
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
  "Customers",
  "Offers",
  "Support",
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
  withHeader = false,
  headerProps = {},
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadSupportCount, setUnreadSupportCount] = useState(0);

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

  const handleTabClick = (tab) => {
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
    } else if (tab === "Support" || tab === "Support Tickets" || tab === "Tickets") {
      if (location.pathname !== "/owner/support") {
        navigate("/owner/support");
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
                  {tab === "Support" && unreadSupportCount > 0 && (
                    <span className="owner-nav-unread-pill" title={`${unreadSupportCount} unread replies from Super Admin`}>
                      {unreadSupportCount}
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

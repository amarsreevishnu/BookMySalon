import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/ownerStickyFooter.css";

export default function OwnerStickyFooter({
  salonInfo: propSalonInfo,
  rating: propRating,
  reviewsCount: propReviewsCount,
}) {
  const location = useLocation();


   const currentFormattedDate = useMemo(() => {
      const d = new Date();
      const day = d.getDate();
      const month = d.toLocaleString("default", { month: "short" });
      return `Today, ${day} ${month}`;
    }, []);

  // Initialize with passed props or localStorage cache if available
  const [salon, setSalon] = useState(() => {
    if (propSalonInfo && propSalonInfo.name) {
      return {
        ...propSalonInfo,
        rating: propRating || propSalonInfo.rating || 5.0,
        reviews_count: propReviewsCount ?? propSalonInfo.reviews_count ?? 0,
      };
    }
    try {
      const cached = localStorage.getItem("owner_salon_info");
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // ignore
    }
    return {
      name: "",
      city: "",
      category: "",
      outlet_code: "",
      is_open: true,
      rating: 5.0,
      reviews_count: 0,
    };
  });

  // Keep state synced whenever parent passes or updates props
  useEffect(() => {
    if (propSalonInfo && propSalonInfo.name) {
      const merged = {
        name: propSalonInfo.name,
        city: propSalonInfo.city || "",
        category: propSalonInfo.category || "",
        outlet_code: propSalonInfo.outlet_code || "#01",
        is_open: propSalonInfo.is_open !== false,
        rating: propRating || propSalonInfo.rating || 5.0,
        reviews_count: propReviewsCount ?? propSalonInfo.reviews_count ?? 0,
      };
      setSalon(merged);
      try {
        localStorage.setItem("owner_salon_info", JSON.stringify(merged));
      } catch {}
    }
  }, [propSalonInfo, propRating, propReviewsCount]);

  // Fallback fetch if salon name is missing (e.g. direct load of a subpage)
  useEffect(() => {
    if (salon.name) return;

    let isMounted = true;
    const fetchSalonFallback = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await api.get("/salons/owner/dashboard/", config);
        if (res.data && isMounted) {
          const info = res.data.salon_info || {};
          const loaded = {
            name: info.name || "My Salon Studio",
            city: info.city || "",
            category: info.category || "",
            outlet_code: info.outlet_code || "#01",
            is_open: info.is_open !== false,
            rating: res.data.rating || 5.0,
            reviews_count: res.data.reviews_count || 0,
          };
          setSalon(loaded);
          try {
            localStorage.setItem("owner_salon_info", JSON.stringify(loaded));
          } catch {}
        }
      } catch (err) {
        console.log("OwnerStickyFooter fallback fetch error:", err);
      }
    };

    fetchSalonFallback();
    return () => {
      isMounted = false;
    };
  }, [salon.name]);

  const isProfilePage = location.pathname === "/owner/salon-profile";

  return (
    <footer className="studio-sticky-footer">
      <div className="studio-sticky-footer-inner">
        <div className="salon-footer-brand-section">
          <div className="salon-footer-badge">
            <span><div className="explore-brand-icon">✂</div></span>
          </div>
          <div className="salon-footer-brand-text">
            <span className="salon-footer-title">
              {salon.name || "My Salon Studio"}
            </span>
            <span className="salon-footer-sub">
              Outlet {salon.outlet_code || "#01"}
            </span>
          </div>
        </div>

        <div className="salon-footer-details-section">
          {salon.category && (
            <span className="salon-footer-tag">
              <span className="tag-icon">✂️</span>
              <span>{salon.category}</span>
            </span>
          )}
          {salon.city && (
            <span className="salon-footer-tag">
              <span className="tag-icon">📍</span>
              <span>{salon.city}</span>
            </span>
          )}
          <span className="salon-footer-tag salon-footer-tag--live">
            <span className="live-dot" />
            <span>{salon.is_open !== false ? "Open • Accepting Clients" : "Closed"}</span>
          </span>
          <span className="salon-footer-tag salon-footer-tag--rating">
            <span className="star-icon">★</span>
            <span>{Number(salon.rating || 5.0).toFixed(1)}</span>
            <span className="reviews-num">({salon.reviews_count || 0} reviews)</span>
          </span>
          <span>{currentFormattedDate}</span>
        </div>

        <div className="salon-footer-actions-section">
          <Link
            to={"/owner/dashboard"}
            className="salon-footer-action-link"
          >
            <span>Dashboard</span>
            <span className="arrow">→</span>
          </Link>
          
        </div>
      </div>
    </footer>
  );
}

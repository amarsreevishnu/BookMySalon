import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SalonCard from "./SalonCard";
import api from "../api/axios";
import { resolveImageUrl } from "../utils/imageUtils";

function PopularSalons() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [favorites, setFavorites] = useState(new Set());

  const toggleFavorite = (salonName, e) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(salonName)) {
        next.delete(salonName);
      } else {
        next.add(salonName);
      }
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;
    api
      .get("/salons/")
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((s) => ({
            id: s.id,
            name: s.name,
            location: s.city
              ? `${s.city}, ${s.state || ""}`.trim().replace(/,$/, "")
              : s.address,
            description: s.description || "Certified treatments & verified stylists",
            price: "From ₹299",
            rating: typeof s.rating === "number" ? s.rating.toFixed(1) : (parseFloat(s.rating) || 5.0).toFixed(1),
            category: s.category || "Hair & Styling",
            image: resolveImageUrl(
              s.cover_image || (s.images && s.images[0])
            ),
          }));
          setSalons(mapped);
        }
      })
      .catch((err) => {
        console.error("Failed to load popular salons:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSalons = salons.filter((s) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Top Rated") return parseFloat(s.rating) >= 4.8;
    if (activeFilter === "Hair") return (s.category || "").toLowerCase().includes("hair");
    if (activeFilter === "Spa") return (s.category || "").toLowerCase().includes("spa");
    return true;
  });

  return (
    <section className="section-container" id="salons">
      <div className="section-heading">
        <div>
          <span className="eyebrow">LIVE AVAILABILITY</span>
          <h2>Nearby & Top-Rated Salons</h2>
        </div>

        <Link to="/customer/salons" className="text-button">
          View all salons ({salons.length}) →
        </Link>
      </div>

      {/* Interactive Filter Pills */}
      <div className="landing-filter-pills">
        {["All", "Top Rated", "Hair", "Spa"].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`landing-tab-btn ${activeFilter === tab ? "active" : ""}`}
            onClick={() => setActiveFilter(tab)}
          >
            {tab === "Top Rated" ? "★ Top Rated" : tab}
          </button>
        ))}
      </div>

      <div className="salon-grid">
        {filteredSalons.slice(0, 6).map((salon) => (
          <article className="salon-card interactive-salon-card" key={salon.name}>
            <div className="salon-image-wrapper">
              <img src={salon.image} alt={salon.name} />
              <span className="salon-rating">★ {salon.rating}</span>
              {/* <button
                type="button"
                className={`landing-fav-btn ${favorites.has(salon.name) ? "favorited" : ""}`}
                onClick={(e) => toggleFavorite(salon.name, e)}
                title={favorites.has(salon.name) ? "Remove from favorites" : "Save to favorites"}
              >
                {favorites.has(salon.name) ? "♥" : "♡"}
              </button> */}
              <span className="salon-live-chip">⚡ Instant Slot</span>
            </div>

            <div className="salon-card-content">
              <span className="salon-location">📍 {salon.location}</span>
              <h3 title={salon.name}>{salon.name}</h3>
              <p>{salon.description}</p>

              <div className="salon-card-bottom">
                <div className="salon-price-info">
                  <small>Tariff starts</small>
                  <strong>{salon.price}</strong>
                </div>

                <Link to="/customer/salons" className="small-button">
                  <span>Book Slot</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default PopularSalons;
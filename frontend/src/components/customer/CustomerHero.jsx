import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";

function CustomerHero({
  search,
  setSearch,
  selectedFilter,
  setSelectedFilter,
  onSearch,
}) {
  const { user } = useAuth();
  
  const [location, setLocation] = useState(() => {
    return localStorage.getItem("user_detected_location") || "Detecting...";
  });

  const fetchBrowserLocation = () => {
    if (!navigator.geolocation) {
      setLocation("Location not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const place = data.city || data.locality || data.principalSubdivision;
            if (place) {
              setLocation(place);
              localStorage.setItem("user_detected_location", place);
              return;
            }
          }
        } catch (err) {
          console.warn("Primary geocoding service failed:", err);
        }

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            const place =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              addr.state_district;
            if (place) {
              setLocation(place);
              localStorage.setItem("user_detected_location", place);
              return;
            }
          }
        } catch (err) {
          console.warn("Fallback geocoding service failed:", err);
        }

        setLocation(`${latitude.toFixed(2)}°, ${longitude.toFixed(2)}°`);
      },
      (error) => {
        console.warn("Geolocation error:", error);
        setLocation((prev) =>
          prev && prev !== "Detecting..." ? prev : "Thiruvananthapuram"
        );
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    fetchBrowserLocation();
    
  }, []);

  return (
    <section className="customer-hero">
      <div className="customer-hero-top">
        <div>
          <h1>
            Hello, {user?.first_name || user?.full_name || ""} <span>👋</span>
          </h1>

          <p>
            Ready for your next self-care session? Here is what is open and
            available right now.
          </p>
        </div>

        <div
          className="current-location"
          onClick={fetchBrowserLocation}
          style={{ cursor: "pointer" }}
          title="Click to refresh location"
        >
          <span>📍</span>
          <div>
            <small>CURRENT LOCATION</small>
            <strong>{location}</strong>
          </div>
          <span>⌄</span>
        </div>
      </div>

      <div className="availability-message">
        <span>●</span>
        14 botanical & partner salons open near you with live slots
      </div>

      <div className="customer-search">
        <span className="search-symbol">🔍</span>

        <input
          type="text"
          placeholder="Search salons, services (haircut, spa, facial)..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onSearch();
            }
          }}
        />

        <button type="button" onClick={onSearch}>
          Find Salons →
        </button>
      </div>

      <div className="quick-filters">
        <span>QUICK FILTERS:</span>

        <button
          type="button"
          className={selectedFilter === "Open Now" ? "active" : ""}
          onClick={() => setSelectedFilter("Open Now")}
        >
          ● Open Now
        </button>

        <button
          type="button"
          className={selectedFilter === "Near Me" ? "active" : ""}
          onClick={() => setSelectedFilter("Near Me")}
        >
          📍 Near Me
        </button>

        <button
          type="button"
          className={selectedFilter === "Top Rated" ? "active" : ""}
          onClick={() => setSelectedFilter("Top Rated")}
        >
          ★ Top Rated
        </button>

        <button
          type="button"
          className={selectedFilter === "Offers" ? "active" : ""}
          onClick={() => setSelectedFilter("Offers")}
        >
          🏷 Offers
        </button>

        <button
          type="button"
          className={selectedFilter === "All" ? "active" : ""}
          onClick={() => setSelectedFilter("All")}
        >
          All Salons
        </button>
      </div>
    </section>
  );
}

export default CustomerHero;
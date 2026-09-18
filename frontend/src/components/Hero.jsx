import { useState } from "react";
import { useNavigate } from "react-router-dom";

function Hero() {
  const navigate = useNavigate();
  const [location, setLocation] = useState("Thiruvananthapuram");
  const [treatment, setTreatment] = useState("");

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (treatment.trim()) params.append("search", treatment.trim());
    if (location.trim()) params.append("location", location.trim());
    const query = params.toString();
    navigate(query ? `/salons?${query}` : "/salons");
  };

  const handleQuickChipClick = (serviceName) => {
    setTreatment(serviceName);
    navigate(`/salons?search=${encodeURIComponent(serviceName)}`);
  };

  return (
    <section className="hero-section">
      <div className="hero-content">
        

        <h1>
          Find Your Sanctuary.
          <br />
          Book Certified Salons.
        </h1>

        <p>
          Discover curated botanical salons, verified non-toxic treatments, and elite master stylists with guaranteed instant slot reservations.
        </p>

        {/* Interactive Search Box */}
        <form className="hero-search-box" onSubmit={handleSearchSubmit}>
          <div className="search-field">
            <span className="search-icon">📍</span>
            <div className="search-input-col">
              <label htmlFor="hero-location-input">LOCATION</label>
              <input
                id="hero-location-input"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City or area (e.g. Indiranagar, Bengaluru)"
              />
            </div>
          </div>

          <div className="search-field-divider"></div>

          <div className="search-field">
            <span className="search-icon">✨</span>
            <div className="search-input-col">
              <label htmlFor="hero-service-input">SERVICE OR TREATMENT</label>
              <input
                id="hero-service-input"
                type="text"
                value={treatment}
                onChange={(e) => setTreatment(e.target.value)}
                placeholder="Haircut, Organic Spa, Facial..."
              />
            </div>
          </div>

          <button type="submit" className="search-button">
            <span>Find Salons</span>
            <span>→</span>
          </button>
        </form>

        {/* Quick Suggestion Chips */}
        <div className="hero-quick-chips">
          <span className="quick-chips-label">Popular now:</span>
          {["Haircut & Styling", "Organic Hair Spa", "Botanical Facial", "Gel Manicure", "Ayurvedic Massage"].map((chip) => (
            <button
              key={chip}
              type="button"
              className="hero-chip-btn"
              onClick={() => handleQuickChipClick(chip)}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="hero-trust-row">
          <div className="trust-item">
            <span className="trust-icon">⚡</span>
            <span>Real-Time Instant Slots</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">🌿</span>
            <span>Certified Botanical Products</span>
          </div>
          <div className="trust-item">
            <span className="trust-icon">★</span>
            <span>4.9/5 from 12k+ Bookings</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
import { Link } from "react-router-dom";

function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <p className="eyebrow">YOUR BEAUTY, YOUR WAY</p>

        <h1>
          Find the perfect
          <br />
          salon near you
        </h1>

        <p className="hero-description">
          Discover trusted salons, explore beauty services, and book your
          next appointment with ease.
        </p>

        <div className="search-box">
          <div className="search-field">
            <span className="search-icon">⌖</span>

            <div>
              <label>Location</label>
              <p>Thiruvananthapuram</p>
            </div>
          </div>

          <div className="search-divider"></div>

          <div className="search-field">
            <span className="search-icon">✂</span>

            <div>
              <label>Service</label>
              <p>Haircut, spa, facial...</p>
            </div>
          </div>

          <Link to="/register" className="search-button">
            Search
          </Link>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
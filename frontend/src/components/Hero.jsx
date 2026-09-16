import { Link } from "react-router-dom";

function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <span className="eyebrow">YOUR BEAUTY, YOUR WAY</span>

        <h1>
          Find the perfect
          <br />
          salon near you
        </h1>

        <p>
          Discover trusted salons, explore premium services, and book your
          next self-care experience with ease.
        </p>

        <div className="hero-search-box">
          <div className="search-field">
            <span className="search-icon">⌖</span>
            <div>
              <small>LOCATION</small>
              <strong>Thiruvananthapuram</strong>
            </div>
          </div>

          <div className="search-field">
            <span className="search-icon">⌕</span>
            <div>
              <small>WHAT ARE YOU LOOKING FOR?</small>
              <strong>Haircut, Spa, Beauty...</strong>
            </div>
          </div>

          <Link to="/login" className="search-button">
            Search
          </Link>
        </div>
      </div>
    </section>
  );
}

export default Hero;
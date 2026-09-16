import { Link } from "react-router-dom";

function OfferBanner() {
  return (
    <section className="section-container">
      <div className="offer-banner">
        <div className="offer-content">
          <span className="eyebrow">SPECIAL OFFER</span>

          <h2>Summer Radiance Package</h2>

          <p>
            Refresh your look with our carefully selected beauty and wellness
            treatments.
          </p>

          <Link to="/login" className="dark-button">
            Explore offer
          </Link>
        </div>

        <img
          src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=85"
          alt="Beauty products"
        />
      </div>
    </section>
  );
}

export default OfferBanner;
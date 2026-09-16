import { Link } from "react-router-dom";

function OfferBanner() {
  return (
    <section className="offer-banner">
      <div className="offer-content">
        <p className="eyebrow">LIMITED TIME OFFER</p>

        <h2>Summer Radiance Package</h2>

        <p>
          Refresh your look with our special seasonal beauty packages and
          enjoy exclusive offers from selected salons.
        </p>

        <Link to="/register" className="primary-button">
          Explore offer
        </Link>
      </div>

      <div className="offer-image">
        <img
          src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80"
          alt="Beauty products and skincare"
        />
      </div>
    </section>
  );
}

export default OfferBanner;
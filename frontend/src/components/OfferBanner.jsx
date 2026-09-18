import { useState } from "react";
import { Link } from "react-router-dom";

function OfferBanner() {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText("WELLNESS20");
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <section className="section-container">
      <div className="offer-banner interactive-offer-banner">
        <div className="offer-content">
          <div className="offer-badge-row">
            <span className="eyebrow offer-pill">🏷 EXCLUSIVE WELCOME OFFER</span>
            <span className="offer-validity">● Limited Slots Today</span>
          </div>

          <h2>
            Flat 20% OFF
            <br />
            On Your First Booking
          </h2>

          <p>
            Experience our hand-vetted organic hair rituals, botanical skin detox, and restorative spa treatments at verified partner salons.
          </p>

          <div className="offer-code-container">
            <div className="offer-code-box">
              <span className="offer-code-label">PROMO CODE</span>
              <span className="offer-code-text">WELLNESS20</span>
            </div>
            <button
              type="button"
              className="copy-code-btn"
              onClick={handleCopyCode}
            >
              {copied ? "✓ Code Copied!" : "📋 Copy Code"}
            </button>
          </div>

          <div className="offer-perks-row">
            <span>✨ Zero Booking Fees</span>
            <span>•</span>
            <span>🌿 Free Organic Scalp Consultation</span>
          </div>

          <div className="offer-actions-row">
            <Link to="/salons" className="dark-button offer-cta-btn">
              <span>Explore Eligible Salons</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="offer-media-wrap">
          <img
            src="https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1000&q=85"
            alt="Organic beauty and wellness"
          />
          <div className="offer-floating-tag">
            <span>👑 4.9★ Rated Botanical Spa Rituals</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default OfferBanner;
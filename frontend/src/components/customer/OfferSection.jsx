import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

const FALLBACK_OFFERS = [
  {
    id: "f1",
    salon_id: null,
    type: "FIRST BOOKING",
    title: "Flat ₹150 OFF on Your First Booking",
    description: "Welcome to BookMySalon. Experience organic hair rituals & detox treatments.",
    code: "WELCOME150",
    image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "f2",
    salon_id: null,
    type: "COMBO SPECIAL",
    title: "Haircut & Botanical Scalp Spa Combo",
    description: "Combine haircut and deep conditioning at participating premier city salons.",
    code: "SUMMERGLOW",
    image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: "f3",
    salon_id: null,
    type: "FESTIVE TREAT",
    title: "20% OFF Luxury Hair Spa & Color",
    description: "Special seasonal discount on top-tier styling packages and treatments.",
    code: "LUXE20",
    image: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=85",
  },
];

const DEFAULT_OFFER_IMAGES = [
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=85",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=700&q=85",
];

function OfferSection() {
  const navigate = useNavigate();
  const [liveOffers, setLiveOffers] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/offers/featured/")
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          setLiveOffers(res.data.slice(0, 6));
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const displayOffers = liveOffers.length > 0 ? liveOffers : FALLBACK_OFFERS;

  const handleClaimOffer = (offer) => {
    if (offer.salon_id) {
      navigate(`/customer/salons/${offer.salon_id}/book?coupon=${offer.code || ""}`);
    } else {
      navigate(`/offers?code=${offer.code || ""}`);
    }
  };

  return (
    <section className="customer-section offers-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">🏷️ EXCLUSIVE DISCOUNTS</span>
          <h2>Today's Offers & Featured Deals</h2>
          <p className="section-subtitle">
            Exclusive platform promo codes and salon combo deals redeemable instantly
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            to="/offers"
            style={{
              fontSize: "0.88rem",
              fontWeight: 600,
              color: "#1b4332",
              textDecoration: "none",
              padding: "6px 14px",
              background: "#f1f5f9",
              borderRadius: "20px",
            }}
          >
            View All Deals →
          </Link>
          <span className="section-side-badge">
            ⏳ Limited Availability
          </span>
        </div>
      </div>

      <div className="offers-grid">
        {displayOffers.map((offer, idx) => {
          const typeLabel =
            offer.offer_type === "COMBO"
              ? "COMBO DEAL"
              : offer.offer_type === "FIRST_BOOKING"
              ? "FIRST BOOKING"
              : offer.offer_type === "FESTIVAL"
              ? "FESTIVE OFFER"
              : offer.type || "SPECIAL OFFER";

          const cardImg =
            offer.banner_image ||
            offer.salon_cover_image ||
            offer.image ||
            DEFAULT_OFFER_IMAGES[idx % DEFAULT_OFFER_IMAGES.length];

          return (
            <article className="offer-card" key={offer.id}>
              <img src={cardImg} alt={offer.title} />

              <div className="offer-card-content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="offer-type">{typeLabel}</span>
                  {offer.salon_name && (
                    <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 600 }}>
                      📍 {offer.salon_name}
                    </span>
                  )}
                </div>

                <h3>{offer.title}</h3>

                <p>{offer.description || "Limited-time promotion at hand-vetted partner salons."}</p>

                <div className="offer-bottom">
                  <div>
                    <small>PROMO CODE</small>
                    <strong>{offer.code || "AUTO-APPLY"}</strong>
                  </div>

                  <button type="button" onClick={() => handleClaimOffer(offer)}>
                    Claim Offer
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default OfferSection;

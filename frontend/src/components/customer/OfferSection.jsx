import { useNavigate } from "react-router-dom";

const offers = [
  {
    id: 1,
    type: "FLASH DEAL",
    title: "Flat 25% OFF on Hair Spa & Cut",
    description:
      "Refresh your style with selected salons and limited-time services.",
    code: "GLOW25",
    button: "Claim Offer",
    image:
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 2,
    type: "LIMITED TREAT",
    title: "Free Beard Trim with Deluxe Facial",
    description:
      "Enjoy a complimentary beard trim with selected facial packages.",
    code: "FRESHLOOK",
    button: "Claim Offer",
    image:
      "https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=700&q=85",
  },
  {
    id: 3,
    type: "FIRST BOOKING",
    title: "₹150 Cashback on First Booking",
    description:
      "Apply this offer during your first booking to receive cashback.",
    code: "WELCOME150",
    button: "Apply Code",
    image:
      "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=700&q=85",
  },
];

function OfferSection() {
  const navigate = useNavigate();

  return (
    <section className="customer-section offers-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">🏷️ EXCLUSIVE DISCOUNTS</span>
          <h2>Today's Offers & Deals</h2>
          <p className="section-subtitle">
            Exclusive promo codes redeemable instantly during booking
          </p>
        </div>

        <span className="section-side-badge">
          ⏳ Limited Availability
        </span>
      </div>

      <div className="offers-grid">
        {offers.map((offer) => (
          <article className="offer-card" key={offer.id}>
            <img src={offer.image} alt={offer.title} />

            <div className="offer-card-content">
              <span className="offer-type">{offer.type}</span>

              <h3>{offer.title}</h3>

              <p>{offer.description}</p>

              <div className="offer-bottom">
                <div>
                  <small>PROMO CODE</small>
                  <strong>{offer.code}</strong>
                </div>

                <button
                  onClick={() =>
                    navigate(
                      `/offers/${offer.id}?code=${offer.code}`
                    )
                  }
                >
                  {offer.button}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default OfferSection;
import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import "../../styles/offersPage.css";

const CATEGORIES = [
  { key: "ALL", label: "All Offers", icon: "🏷️" },
  { key: "FIRST_BOOKING", label: "First Booking", icon: "🌟" },
  { key: "COMBO", label: "Value Combos", icon: "🎁" },
  { key: "FESTIVAL", label: "Festive Offers", icon: "🎉" },
  { key: "SERVICE", label: "Service Specials", icon: "✂️" },
  { key: "COUPON", label: "Coupon Deals", icon: "🎟️" },
];

export default function OffersPage() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .get("/offers/featured/")
      .then((res) => {
        if (isMounted && Array.isArray(res.data)) {
          setOffers(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load featured platform offers:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode(null);
    }, 2500);
  };

  const filteredOffers = useMemo(() => {
    return offers.filter((offer) => {
      if (activeCategory !== "ALL" && offer.offer_type !== activeCategory) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = offer.title?.toLowerCase().includes(q);
        const matchesSalon = offer.salon_name?.toLowerCase().includes(q);
        const matchesCity = offer.salon_city?.toLowerCase().includes(q);
        const matchesCode = offer.code?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSalon && !matchesCity && !matchesCode) {
          return false;
        }
      }

      return true;
    });
  }, [offers, activeCategory, searchQuery]);

  return (
    <div className="offers-page-wrapper">
      <CustomerHeader />

      <main className="offers-page-container">
        {/* Hero Banner */}
        <div className="offers-hero-banner">
          <div className="offers-hero-badge">
            <span>🏷️</span> Verified Salon Deals
          </div>
          <h1 className="offers-hero-title">
            Exclusive Offers & Handpicked Deals
          </h1>
          <p className="offers-hero-subtitle">
            Save on premium hair styling, rejuvenating facials, luxury spa combos, and seasonal specials at top-rated salons across your city.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="offers-filters-bar">
          <div className="offers-type-pills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                className={`offers-pill-btn ${activeCategory === cat.key ? "active" : ""}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>

          <div className="offers-search-wrap">
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search salon, city, or offer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Deals Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <p>Discovering verified salon promotions...</p>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="deals-empty">
            <div className="deals-empty-icon">🏷️</div>
            <h3>No Offers Available Right Now</h3>
            <p>
              {offers.length === 0
                ? "Partner salons are currently refreshing their seasonal promotions. Check back soon for fresh discounts and luxury bundles!"
                : "No active offers match your selected filter."}
            </p>
          </div>
        ) : (
          <div className="deals-cards-grid">
            {filteredOffers.map((deal) => {
              const hasCode = Boolean(deal.code);
              const isCopied = copiedCode === deal.code;

              return (
                <article key={deal.id} className="deal-card">
                  {/* Cover with Salon Branding */}
                  <div className="deal-card-cover">
                    {deal.salon_cover_image ? (
                      <img src={deal.salon_cover_image} alt={deal.salon_name} />
                    ) : null}
                    <div className="deal-card-overlay" />

                    <div className="deal-card-badge">
                      {deal.offer_type === "COMBO"
                        ? "Combo Deal"
                        : deal.offer_type === "FIRST_BOOKING"
                        ? "First Booking"
                        : deal.offer_type === "FESTIVAL"
                        ? "Festive Special"
                        : deal.offer_type === "SERVICE"
                        ? "Service Offer"
                        : "Promo Deal"}
                    </div>

                    <div className="deal-card-salon-meta">
                      <h4 className="deal-card-salon-name">{deal.salon_name}</h4>
                      <div className="deal-card-salon-city">
                        <span>📍</span> {deal.salon_city || "City Center"}
                      </div>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="deal-card-body">
                    <h3 className="deal-card-title">{deal.title}</h3>
                    {deal.description && (
                      <p className="deal-card-desc">{deal.description}</p>
                    )}

                    {/* Promo Code & Discount Highlight */}
                    <div className="deal-promo-row">
                      <div className="deal-discount-tag">
                        {deal.discount_type === "FIXED_PRICE"
                          ? `₹${parseFloat(deal.discount_value)} Combo`
                          : deal.discount_type === "PERCENTAGE"
                          ? `${parseFloat(deal.discount_value)}% OFF`
                          : `₹${parseFloat(deal.discount_value)} FLAT OFF`}
                      </div>

                      {hasCode && (
                        <div className="deal-code-pill">
                          <span className="deal-code-text">{deal.code}</span>
                          <button
                            type="button"
                            className="deal-copy-btn"
                            onClick={() => handleCopyCode(deal.code)}
                          >
                            {isCopied ? "✓ Copied" : "Copy"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Combo Included Services */}
                    {deal.offer_type === "COMBO" && deal.services_detail?.length > 0 && (
                      <div className="deal-combo-included">
                        <div className="deal-combo-title">Included in Combo:</div>
                        <div className="deal-combo-list">
                          {deal.services_detail.map((s) => (
                            <span key={s.id} className="deal-combo-item">
                              ✓ {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Validity & Restrictions */}
                    <div style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: "16px" }}>
                      <span>📅 Valid until {deal.end_date}</span>
                      {parseFloat(deal.min_spend) > 0 && (
                        <span> • Min spend ₹{parseFloat(deal.min_spend)}</span>
                      )}
                      {deal.customer_eligibility === "FIRST_TIME" && (
                        <span> • New clients only</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="deal-card-cta">
                      <Link
                        to={`/customer/salons/${deal.salon_id}/book?coupon=${deal.code || ""}`}
                        className="deal-book-btn"
                      >
                        Book with Offer →
                      </Link>
                      <Link
                        to={`/customer/salons/${deal.salon_id}`}
                        className="deal-view-salon-btn"
                      >
                        View Salon
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      <CustomerFooter />
    </div>
  );
}


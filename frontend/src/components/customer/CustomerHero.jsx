import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Link } from "react-router-dom";

import api from "../../api/axios";

const FALLBACK_HERO_OFFER = {
  id: "hero-top-offer",
  title: "Flat ₹150 OFF on Your First Booking",
  description: "Experience premium botanical hair rituals & wellness treatments.",
  code: "WELCOME150",
  discount_display: "FLAT ₹150 OFF",
  type_label: "FIRST BOOKING",
  salon_name: null,
  salon_id: null,
  image: "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=700&q=85",
};

function CustomerHero({
  search,
  setSearch,
  selectedFilter,
  setSelectedFilter,
  onSearch,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [location, setLocation] = useState(() => {
    return localStorage.getItem("user_detected_location") || "Detecting...";
  });

  const [latestOffer, setLatestOffer] = useState(FALLBACK_HERO_OFFER);
  const [copied, setCopied] = useState(false);

  // Fetch Latest / Featured Offer
  useEffect(() => {
    let isMounted = true;
    api
      .get("/offers/featured/")
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const top = res.data[0];
          const discountDisplay =
            top.discount_type === "PERCENTAGE"
              ? `${Math.round(top.discount_value)}% OFF`
              : `FLAT ₹${Math.round(top.discount_value)} OFF`;

          const typeLabel =
            top.offer_type === "COMBO"
              ? "COMBO DEAL"
              : top.offer_type === "FIRST_BOOKING"
              ? "FIRST BOOKING"
              : top.offer_type === "FESTIVAL"
              ? "FESTIVE OFFER"
              : top.offer_type_display || "EXCLUSIVE DEAL";

          setLatestOffer({
            id: top.id,
            title: top.title,
            description:
              top.description ||
              "Limited-time promotion at hand-vetted partner salons.",
            code: top.code || "AUTO-APPLY",
            discount_display: discountDisplay,
            type_label: typeLabel,
            salon_name: top.salon_name || null,
            salon_id: top.salon_id || null,
            image:
              top.banner_image ||
              top.salon_cover_image ||
              FALLBACK_HERO_OFFER.image,
          });
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyCode = (e) => {
    e.stopPropagation();
    if (!latestOffer?.code) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(latestOffer.code);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleClaimOffer = () => {
    if (latestOffer?.salon_id) {
      navigate(
        `/salons/${salon_id}|| ""}`
      );
    } else {
      navigate(`/offers?code=${latestOffer.code || ""}`);
    }
  };

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

  const userName = user?.first_name || user?.full_name || "";

  return (
    <section className="customer-hero">
      <div className="customer-hero-top">
        <div className="customer-hero-intro">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            <span className="hero-eyebrow-text">Curated Wellness & Salons</span>
          </div>

          <h1 className="customer-hero-title">
            Hello, {userName} <span className="hero-wave">👋</span>
          </h1>

          <p className="customer-hero-subtitle">
            Ready for your next self-care session? Here is what is open and
            available right now.
          </p>
        </div>

        <div
          className="current-location"
          onClick={fetchBrowserLocation}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fetchBrowserLocation();
            }
          }}
          title="Click to refresh location"
        >
          <div className="location-pin-wrap">
            <svg
              className="location-pin-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="location-pulse-dot" />
          </div>
          <div className="location-text">
            <small>CURRENT LOCATION</small>
            <strong>{location}</strong>
          </div>
          <span className="location-chevron">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </div>

      <div className="customer-hero-body">
        <div className="customer-hero-left">
          <div className="availability-message">
            <span className="availability-beacon">
              <span className="beacon-ping" />
              <span className="beacon-core" />
            </span>
            <span className="availability-text">
              <strong>14 botanical & partner salons</strong> open near you with live slots
            </span>
          </div>

          <div className="customer-search-wrapper">
            <div className="customer-search">
              <div className="customer-search-input-wrap">
                <span className="search-symbol" aria-hidden="true">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </span>

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
                  aria-label="Search salons or services"
                />

                {search && (
                  <button
                    type="button"
                    className="search-clear-btn"
                    onClick={() => setSearch("")}
                    title="Clear search"
                    aria-label="Clear search"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>

              <button
                type="button"
                className="search-submit-btn"
                onClick={onSearch}
              >
                <span>Find Salons</span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>

          <div className="quick-filters">
            <span className="quick-filters-label">QUICK FILTERS:</span>

            <div className="quick-filters-scroll">
              <button
                type="button"
                className={`quick-filter-pill ${selectedFilter === "Open Now" ? "active" : ""}`}
                onClick={() => setSelectedFilter("Open Now")}
              >
                <span className="filter-pill-dot" />
                <span>Open Now</span>
              </button>

              <button
                type="button"
                className={`quick-filter-pill ${selectedFilter === "Near Me" ? "active" : ""}`}
                onClick={() => setSelectedFilter("Near Me")}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Near Me</span>
              </button>

              <button
                type="button"
                className={`quick-filter-pill ${selectedFilter === "Top Rated" ? "active" : ""}`}
                onClick={() => setSelectedFilter("Top Rated")}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                <span>Top Rated</span>
              </button>

              <button
                type="button"
                className={`quick-filter-pill ${selectedFilter === "Offers" ? "active" : ""}`}
                onClick={() => setSelectedFilter("Offers")}
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                  <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <span>Offers</span>
              </button>

              <button
                type="button"
                className={`quick-filter-pill ${selectedFilter === "All" ? "active" : ""}`}
                onClick={() => setSelectedFilter("All")}
              >
                <span>All Salons</span>
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Latest Offer Showcase Card */}
        <aside className="hero-latest-offer" aria-label="Latest Featured Deal">
          <div
            className="hero-offer-card"
            onClick={handleClaimOffer}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleClaimOffer();
            }}
          >
            <div className="hero-offer-header">
              <div className="hero-offer-tag">
                <span className="hero-offer-fire">🔥</span>
                <span>{latestOffer.type_label}</span>
              </div>
              <span className="hero-offer-badge">{latestOffer.discount_display}</span>
            </div>

            <div className="hero-offer-content">
              <div className="hero-offer-thumb-container">
                <img
                  src={latestOffer.image}
                  alt={latestOffer.title}
                  className="hero-offer-thumb"
                  loading="lazy"
                />
                <span className="hero-offer-live-badge">LIVE DEAL</span>
              </div>

              <div className="hero-offer-text">
                {latestOffer.salon_name && (
                  <span className="hero-offer-salon">
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {latestOffer.salon_name}
                  </span>
                )}
                <h4 className="hero-offer-title">{latestOffer.title}</h4>
                <p className="hero-offer-desc">{latestOffer.description}</p>
              </div>
            </div>

            <div
              className="hero-offer-footer"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`hero-offer-code-pill ${copied ? "copied" : ""}`}
                onClick={handleCopyCode}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleCopyCode(e);
                  }
                }}
                title="Click to copy coupon code"
              >
                <div className="code-pill-meta">
                  <small>COUPON</small>
                  <strong>{latestOffer.code}</strong>
                </div>
                <span className="code-pill-btn">
                  {copied ? (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>Copy</span>
                    </>
                  )}
                </span>
              </div>
                  <Link
                    to={`/customer/salons/${latestOffer.salon_id}`}
                    className="hero-offer-claim-btn"
                    title="Claim this offer"
                  >
                    <span>Claim</span>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
                  </Link>
              
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default CustomerHero;

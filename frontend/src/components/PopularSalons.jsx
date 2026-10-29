import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import { resolveImageUrl } from "../utils/imageUtils";
import "../styles/popularSalons.css";

/* ------------------------------------------------------------------ */
/* Animated card wrapper — reveal + tilt + spotlight (inline style)    */
/* ------------------------------------------------------------------ */
function AnimatedCard({ children, index = 0 }) {
  const ref = useRef(null);
  const readyRef = useRef(false);
  const rafRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Initial hidden state
    el.style.opacity = "0";
    el.style.transform = "perspective(1000px) translateY(28px) scale(0.95)";
    el.style.transition =
      "opacity 0.65s ease, transform 0.65s cubic-bezier(0.22,1,0.36,1), box-shadow 0.35s ease, border-color 0.3s ease";
    el.style.transitionDelay = `${Math.min(index, 6) * 70}ms`;

    const delay = Math.min(index, 6) * 70;

    const reveal = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!el) return;
          el.style.opacity = "1";
          el.style.transform = "perspective(1000px) translateY(0) scale(1)";
        });
      });
      timeoutRef.current = setTimeout(() => {
        if (!el) return;
        el.style.transitionDelay = "0ms";
        el.style.transition =
          "opacity 0.2s ease, transform 0.12s cubic-bezier(0.3,0.8,0.4,1), box-shadow 0.35s ease, border-color 0.3s ease";
        readyRef.current = true;
      }, 650 + delay + 40);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal();
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -30px 0px" }
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [index]);

  const handleMouseMove = (e) => {
    const el = ref.current;
    if (!el || !readyRef.current || rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rx = ((y - rect.height / 2) / (rect.height / 2)) * -6;
      const ry = ((x - rect.width / 2) / (rect.width / 2)) * 6;
      el.style.transform = `perspective(1000px) translateY(-6px) scale(1.02) rotateX(${rx.toFixed(
        2
      )}deg) rotateY(${ry.toFixed(2)}deg)`;
      el.style.setProperty("--mx", `${x}px`);
      el.style.setProperty("--my", `${y}px`);
    });
  };

  const handleEnter = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.add("ac--hover");
    if (readyRef.current) {
      el.style.transform = "perspective(1000px) translateY(-6px) scale(1.02)";
    }
  };

  const handleLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("ac--hover");
    if (readyRef.current) {
      el.style.transform = "perspective(1000px) translateY(0) scale(1)";
    }
  };

  return (
    <article
      ref={ref}
      className="ac"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      <span className="ac-spotlight" aria-hidden="true" />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */
function SkeletonCard({ delay = 0 }) {
  return (
    <article
      className="ac ac--skeleton"
      style={{ animationDelay: `${delay}ms` }}
      aria-hidden="true"
    >
      <div className="ac-skel ac-skel--media" />
      <div className="ac-body">
        <div className="ac-skel" style={{ width: "40%", height: 11 }} />
        <div className="ac-skel" style={{ width: "85%", height: 20, marginTop: 10 }} />
        <div className="ac-skel" style={{ width: "100%", height: 12, marginTop: 10 }} />
        <div className="ac-skel" style={{ width: "65%", height: 12, marginTop: 6 }} />
        <div className="ac-footer-skel">
          <div className="ac-skel" style={{ width: 80, height: 34, borderRadius: 8 }} />
          <div className="ac-skel" style={{ width: 110, height: 40, borderRadius: 22 }} />
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Main Component — logic unchanged from your original                 */
/* ------------------------------------------------------------------ */
function PopularSalons() {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [favorites, setFavorites] = useState(new Set());

  const toggleFavorite = (salonName, e) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(salonName)) next.delete(salonName);
      else next.add(salonName);
      return next;
    });
  };

  useEffect(() => {
    let isMounted = true;
    api
      .get("/salons/")
      .then((res) => {
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const mapped = res.data.map((s) => ({
            id: s.id,
            name: s.name,
            location: s.city
              ? `${s.city}, ${s.state || ""}`.trim().replace(/,$/, "")
              : s.address,
            description: s.description || "Certified treatments & verified stylists",
            price: "From ₹299",
            rating:
              typeof s.rating === "number"
                ? s.rating.toFixed(1)
                : (parseFloat(s.rating) || 5.0).toFixed(1),
            category: s.category || "Hair & Styling",
            image: resolveImageUrl(s.cover_image || (s.images && s.images[0])),
          }));
          setSalons(mapped);
        }
      })
      .catch((err) => {
        console.error("Failed to load popular salons:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSalons = salons.filter((s) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Top Rated") return parseFloat(s.rating) >= 4.8;
    if (activeFilter === "Hair")
      return (s.category || "").toLowerCase().includes("hair");
    if (activeFilter === "Spa")
      return (s.category || "").toLowerCase().includes("spa");
    return true;
  });

  /* Filter counts for badges */
  const counts = {
    All: salons.length,
    "Top Rated": salons.filter((s) => parseFloat(s.rating) >= 4.8).length,
    Hair: salons.filter((s) =>
      (s.category || "").toLowerCase().includes("hair")
    ).length,
    Spa: salons.filter((s) => (s.category || "").toLowerCase().includes("spa"))
      .length,
  };

  const pills = [
    { id: "All", label: "All Salons", icon: "✦" },
    { id: "Top Rated", label: "Top Rated", icon: "★" },
    { id: "Hair", label: "Hair", icon: "✂" },
    { id: "Spa", label: "Spa", icon: "✿" },
  ];

  return (
    <section className="ac-section" id="salons">
      {/* Heading */}
      <div className="ac-heading">
        <div>
          <span className="ac-eyebrow">
            <span className="ac-eyebrow-dot" />
            LIVE AVAILABILITY
          </span>
          <h2 className="ac-title">Nearby &amp; Top-Rated Salons</h2>
          <p className="ac-subtitle">
            Book instantly from the best wellness studios around you.
          </p>
        </div>

        <Link to="/customer/salons" className="ac-view-all">
          View all salons
          {!loading && <span className="ac-view-count">{salons.length}</span>}
          <span className="ac-view-arrow">→</span>
        </Link>
      </div>

      {/* Filter pills */}
      <div className="ac-filter-bar" role="tablist" aria-label="Filter salons">
        {pills.map((p) => {
          const isActive = activeFilter === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ac-pill ${isActive ? "ac-pill--active" : ""}`}
              onClick={() => setActiveFilter(p.id)}
            >
              <span className="ac-pill-icon" aria-hidden="true">{p.icon}</span>
              <span>{p.label}</span>
              {!loading && (
                <span className="ac-pill-count">{counts[p.id] ?? 0}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <div className="ac-grid">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} delay={i * 60} />
          ))
        ) : filteredSalons.length === 0 ? (
          <div className="ac-empty">
            <div className="ac-empty-icon">🔍</div>
            <h4>No salons in "{activeFilter}"</h4>
            <p>Try another category or view all salons.</p>
            <button
              type="button"
              className="ac-empty-btn"
              onClick={() => setActiveFilter("All")}
            >
              Show all salons
            </button>
          </div>
        ) : (
          filteredSalons.slice(0, 6).map((salon, idx) => {
            const isFav = favorites.has(salon.name);
            return (
              <AnimatedCard key={salon.id || salon.name} index={idx}>
                {/* Media */}
                <Link
                  to="/customer/salons"
                  className="ac-media"
                  aria-label={`View ${salon.name}`}
                >
                  <img
                    src={salon.image}
                    alt={salon.name}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                  <span className="ac-overlay" />

                  <span className="ac-chip ac-chip--category">
                    {salon.category}
                  </span>
                  <span className="ac-chip ac-chip--rating">
                    <span className="ac-chip-star">★</span>
                    {salon.rating}
                  </span>

                  <div className="ac-actions">
                    <button
                      type="button"
                      className={`ac-fav ${isFav ? "ac-fav--active" : ""}`}
                      onClick={(e) => toggleFavorite(salon.name, e)}
                      aria-label={
                        isFav ? "Remove from favorites" : "Save to favorites"
                      }
                      title={isFav ? "Remove from favorites" : "Save to favorites"}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={isFav ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                  </div>

                  <div className="ac-media-footer">
                    <span className="ac-live">
                      <span className="ac-live-dot" />
                      Instant Slot
                    </span>
                  </div>
                </Link>

                {/* Body */}
                <div className="ac-body">
                  <span className="ac-location">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 21s-7-7-7-12a7 7 0 1 1 14 0c0 5-7 12-7 12z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    {salon.location}
                  </span>

                  <h3 className="ac-name" title={salon.name}>
                    {salon.name}
                  </h3>

                  <p className="ac-desc">{salon.description}</p>

                  <div className="ac-footer">
                    <div className="ac-price">
                      <small>Tariff starts</small>
                      <strong>{salon.price}</strong>
                    </div>

                    <Link to="/customer/salons" className="ac-book">
                      <span>Book Slot</span>
                      <span className="ac-book-arrow">→</span>
                    </Link>
                  </div>
                </div>
              </AnimatedCard>
            );
          })
        )}
      </div>
    </section>
  );
}

export default PopularSalons;
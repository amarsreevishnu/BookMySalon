import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import SalonCard from "./SalonCard";
import api from "../../api/axios";
import { resolveImageUrl } from "../../utils/imageUtils";

function SalonSection({
  selectedCategory,
  selectedFilter,
}) {
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const checkScrollButtons = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
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
            rating: typeof s.rating === "number" ? s.rating.toFixed(1) : (parseFloat(s.rating) || 5.0).toFixed(1),
            openUntil: "9:00 PM",
            price: "₹299+",
            description:
              s.description ||
              "Verified salon treatments and expert specialists.",
            category: s.category?.toLowerCase().includes("hair")
              ? "Hair"
              : s.category?.toLowerCase().includes("nail")
              ? "Nails"
              : s.category?.toLowerCase().includes("skin")
              ? "Skin"
              : s.category?.toLowerCase().includes("spa")
              ? "Spa"
              : s.category || "Hair",
            tags:
              s.amenities && s.amenities.length > 0
                ? s.amenities.slice(0, 3)
                : [s.category || "Hair"],
            image: resolveImageUrl(
              s.cover_image || (s.images && s.images[0])
            ),
          }));
          setSalons(mapped);
        }
      })
      .catch((err) => {
        console.error("Failed to load salons list:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  let filteredSalons = [...salons];

  if (selectedCategory !== "All") {
    filteredSalons = filteredSalons.filter(
      (salon) =>
        salon.category === selectedCategory ||
        salon.tags.some((tag) =>
          tag.toLowerCase().includes(
            selectedCategory.toLowerCase()
          )
        )
    );
  }

  if (selectedFilter === "Top Rated") {
    filteredSalons = filteredSalons.filter(
      (salon) => Number(salon.rating) >= 4.8
    );
  }

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const timer = setTimeout(() => {
      checkScrollButtons();
    }, 100);

    el.addEventListener("scroll", checkScrollButtons);
    window.addEventListener("resize", checkScrollButtons);

    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", checkScrollButtons);
      window.removeEventListener("resize", checkScrollButtons);
    };
  }, [filteredSalons]);

  // Auto-scroll animation effect
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || filteredSalons.length <= 1 || isPaused) return;

    const interval = setInterval(() => {
      if (!scrollContainerRef.current) return;
      const container = scrollContainerRef.current;
      const maxScrollLeft = container.scrollWidth - container.clientWidth;

      // Loop back smoothly to the start if near the end
      if (container.scrollLeft >= maxScrollLeft - 20) {
        container.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        // Scroll forward by one card (card width 300px + gap 22px = 322px)
        const scrollStep = 322;
        container.scrollBy({ left: scrollStep, behavior: "smooth" });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [filteredSalons.length, isPaused]);

  const handleScroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 322;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section className="customer-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">● LIVE AVAILABILITY</span>
          <h2>Available Salons Near You</h2>
          <p className="section-subtitle">
            Certified organic & verified venues open with slots available today
          </p>
        </div>

        <div className="section-heading-actions">
          {filteredSalons.length > 0 && (
            <div className="salon-scroll-arrows">
              <button
                type="button"
                className="salon-scroll-btn"
                onClick={() => handleScroll("left")}
                disabled={!canScrollLeft}
                aria-label="Scroll left"
                title="Scroll left"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                className="salon-scroll-btn"
                onClick={() => handleScroll("right")}
                disabled={!canScrollRight}
                aria-label="Scroll right"
                title="Scroll right"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          )}
          <span className="section-side-text">Showing verified salons</span>
          <Link to="/customer/salons" className="text-button">
            View all salons →
          </Link>
        </div>
      </div>

      {filteredSalons.length > 0 ? (
        <div
          className="customer-salon-scroll-wrapper"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onTouchStart={() => setIsPaused(true)}
          onTouchEnd={() => setIsPaused(false)}
        >
          <div className="customer-salon-grid" ref={scrollContainerRef}>
            {filteredSalons.map((salon) => (
              <SalonCard key={salon.id} salon={salon} />
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-salon-message">
          No salons found for this category.
        </div>
      )}
    </section>
  );
}

export default SalonSection;
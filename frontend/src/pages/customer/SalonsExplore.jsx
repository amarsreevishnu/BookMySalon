import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import "../../styles/salonsExplore.css";

export default function SalonsExplore() {
  const navigate = useNavigate();
  const routeLocation = useLocation();
  const { user, logout } = useAuth();

  const currentUser = useMemo(() => {
    if (user && user.first_name) return user;
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, [user]);

  // Read URL query params passed from CustomerHome
  const searchParams = useMemo(() => new URLSearchParams(routeLocation.search), [routeLocation.search]);

  // Top Bar Search & Booking Inputs
  const [locationParam, setLocationParam] = useState("Indiranagar, Bengaluru");
  const [treatmentQuery, setTreatmentQuery] = useState(() => searchParams.get("search") || "");
  const [selectedDate, setSelectedDate] = useState("Today, 24 Oct");
  const [timeWindow, setTimeWindow] = useState("2:00 PM – 5:00 PM");

  // Sidebar Filter States (clean defaults so all approved salons appear immediately)
  const [instantSlots, setInstantSlots] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState("Any");
  const [minRating, setMinRating] = useState(0);
  const [priceTier, setPriceTier] = useState(null); // null = all, 1 = <500, 2 = 500-1500, 3 = 1500+
  const [atmosphere, setAtmosphere] = useState("All Salons");
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedPurity, setSelectedPurity] = useState([]);

  // Sorting & View mode
  const [sortBy, setSortBy] = useState("Recommended for You");
  const [viewMode, setViewMode] = useState("list");

  // Favorites state
  const [savedFavorites, setSavedFavorites] = useState(new Set([1]));

  // Feedback Toast
  const [toastMessage, setToastMessage] = useState("");

  // Modals state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [bookingModalSalon, setBookingModalSalon] = useState(null);
  const [bookingService, setBookingService] = useState("Haircut & Styling");
  const [bookingTime, setBookingTime] = useState("2:30 PM");
  const [detailsModalSalon, setDetailsModalSalon] = useState(null);

  // Raw salons from backend / defaults
  const [salonsList, setSalonsList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Fetch Salons from Backend
  useEffect(() => {
    const fetchSalons = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await api.get("/salons/explore/", config);
        if (res.data && res.data.salons) {
          setSalonsList(res.data.salons);
        }
      } catch (err) {
        // Fallback to local curated items matching reference
        console.log("Using curated partner salons for exploration", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSalons();
  }, []);

  // Filter salons dynamically
  const filteredSalons = useMemo(() => {
    let list = salonsList.length > 0 ? [...salonsList] : [
      {
        id: 5,
        name: "Apple Salon Sreekariyam",
        badge: "● Verified Partner",
        badge_type: "partner",
        distance_km: 1.5,
        address_line: "Sreekariyam Gandhipuarm",
        city: "sreekariyam, Kerala",
        tags: ["Hair & Styling", "Air Conditioned", "Card & UPI"],
        gender_category: "unisex",
        rating: 4.9,
        review_count: 42,
        has_instant_slot: true,
        instant_slot_text: "Instant slot available today • Verified Partner",
        price_tier: 2,
        services: [
          { name: "Haircut & Styling", price: "₹349", category: "hair" },
          { name: "Organic Detox Spa", price: "₹899", category: "spa" },
          { name: "Hydra Facial Glow", price: "₹999", category: "skin" },
        ],
        purity_note: "Certified clean & botanical hygiene standards",
        image: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
        phone: "8848194536",
        opening_hours: "9:00 AM – 8:30 PM",
      },
      {
        id: 1,
        name: "Aura Luxe Salon & Spa",
        badge: "● Verified Organic",
        badge_type: "organic",
        distance_km: 1.2,
        address_line: "12th Main, Indiranagar",
        city: "Indiranagar, Bengaluru",
        tags: ["Unisex", "AC"],
        gender_category: "unisex",
        rating: 4.9,
        review_count: 128,
        has_instant_slot: true,
        instant_slot_text: "Instant Slot available in 15 mins (2:30 PM)",
        price_tier: 2,
        services: [
          {"name": "Haircut & Styling", "price": "₹300", "category": "hair"},
          {"name": "Organic Hair Spa", "price": "₹1,000", "category": "spa"},
          {"name": "Deep Tissue Massage", "price": "₹1,400", "category": "massage"},
        ],
        purity_note: "Botanical products only",
        image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85",
        phone: "+91 98450 12345",
        opening_hours: "9:00 AM – 9:00 PM",
      },
      {
        id: 2,
        name: "Urban Glow Hair Studio",
        badge: "🏷 20% OFF",
        badge_type: "promo",
        distance_km: 2.1,
        address_line: "CMH Road, Indiranagar",
        city: "Indiranagar, Bengaluru",
        tags: ["Women-Only", "Organic Hair-Care"],
        gender_category: "women-only",
        rating: 4.7,
        review_count: 94,
        has_instant_slot: true,
        instant_slot_text: "Next slot at 3:15 PM • Flat 20% OFF on first booking",
        price_tier: 2,
        services: [
          {"name": "Haircut & Blowdry", "price": "₹450", "category": "hair"},
          {"name": "Botanical Facial", "price": "₹850", "category": "skin"},
          {"name": "Nourishing Hair Spa", "price": "₹950", "category": "spa"},
        ],
        purity_note: "Cruelty-free botanical dyes only",
        image: "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=85",
        phone: "+91 98450 23456",
        opening_hours: "9:30 AM – 8:30 PM",
      },
      {
        id: 3,
        name: "The Grooming Club",
        badge: "👑 Men's Luxury",
        badge_type: "luxury",
        distance_km: 2.4,
        address_line: "100 Feet Road, Indiranagar",
        city: "Indiranagar, Bengaluru",
        tags: ["Men's Luxury Grooming"],
        gender_category: "men's care",
        rating: 4.8,
        review_count: 107,
        has_instant_slot: true,
        instant_slot_text: "Instant Slot available now • Zero waiting",
        price_tier: 1,
        services: [
          {"name": "Precision Haircut", "price": "₹350", "category": "hair"},
          {"name": "Deluxe Beard Trim", "price": "₹200", "category": "beard"},
          {"name": "Head & Shoulder Spa", "price": "₹800", "category": "spa"},
        ],
        purity_note: "Cold-pressed & jojoba oils ritual",
        image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=85",
        phone: "+91 98450 34567",
        opening_hours: "10:00 AM – 9:30 PM",
      },
      {
        id: 4,
        name: "Verdant Nail & Skin Sanctuary",
        badge: "🌿 Cruelty-Free & Eco",
        badge_type: "eco",
        distance_km: 2.8,
        address_line: "Defence Colony, Indiranagar",
        city: "Indiranagar, Bengaluru",
        tags: ["Unisex", "Eco Studio"],
        gender_category: "unisex",
        rating: 5.0,
        review_count: 219,
        has_instant_slot: true,
        instant_slot_text: "Available today from 4:00 PM • 🎁 Free Herbal Tea & Scalp Massage",
        price_tier: 2,
        services: [
          {"name": "Botanical Facial", "price": "₹750", "category": "skin"},
          {"name": "Ayurvedic Spa Ritual", "price": "₹1,200", "category": "spa"},
          {"name": "Gel Manicure", "price": "₹400", "category": "nails"},
        ],
        purity_note: "100% Vegan non-toxic formulas",
        image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
        phone: "+91 98450 45678",
        opening_hours: "9:00 AM – 8:00 PM",
      },
    ];

    // Filter by text search
    if (treatmentQuery.trim()) {
      const q = treatmentQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.address_line.toLowerCase().includes(q) ||
          s.services.some((srv) => srv.name.toLowerCase().includes(q)) ||
          s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Filter by category URL parameter if present
    const categoryUrlParam = searchParams.get("category");
    if (categoryUrlParam && categoryUrlParam.toLowerCase() !== "all") {
      const cat = categoryUrlParam.toLowerCase();
      list = list.filter(
        (s) =>
          s.tags?.some((t) => t.toLowerCase().includes(cat)) ||
          s.services?.some((srv) => srv.name.toLowerCase().includes(cat) || (srv.category && srv.category.toLowerCase().includes(cat)))
      );
    }

    // Filter by atmosphere
    if (atmosphere !== "All Salons") {
      const atm = atmosphere.toLowerCase();
      list = list.filter(
        (s) =>
          s.gender_category?.toLowerCase().includes(atm) ||
          s.tags.some((t) => t.toLowerCase().includes(atm))
      );
    }

    // Filter by Instant Slots
    if (instantSlots) {
      list = list.filter((s) => s.has_instant_slot);
    }

    // Filter by distance
    if (distanceRadius !== "Any") {
      const maxKm = parseInt(distanceRadius, 10) || 5;
      list = list.filter((s) => s.distance_km <= maxKm);
    }

    // Filter by Min Rating
    if (minRating > 0) {
      list = list.filter((s) => s.rating >= minRating);
    }

    // Filter by Price Tier
    if (priceTier) {
      list = list.filter((s) => s.price_tier === priceTier);
    }

    // Sorting
    if (sortBy === "Highest Rated") {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === "Nearest Distance") {
      list.sort((a, b) => a.distance_km - b.distance_km);
    }

    return list;
  }, [
    salonsList,
    treatmentQuery,
    searchParams,
    atmosphere,
    instantSlots,
    distanceRadius,
    minRating,
    priceTier,
    sortBy,
  ]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (treatmentQuery.trim()) count++;
    if (atmosphere !== "All Salons") count++;
    if (instantSlots) count++;
    if (distanceRadius !== "Any") count++;
    if (minRating > 0) count++;
    if (priceTier) count++;
    if (selectedServices.length > 0) count += selectedServices.length;
    if (selectedPurity.length > 0) count += selectedPurity.length;
    return count;
  }, [treatmentQuery, atmosphere, instantSlots, distanceRadius, minRating, priceTier, selectedServices, selectedPurity]);

  // Toggle favorite heart
  const toggleFavorite = (id) => {
    setSavedFavorites((prev) => {
      const updated = new Set(prev);
      if (updated.has(id)) {
        updated.delete(id);
        setToastMessage("Removed from your saved favorites.");
      } else {
        updated.add(id);
        setToastMessage("Saved to your personal favorites! ♥");
      }
      return updated;
    });
  };

  // Reset all filters
  const handleClearAll = () => {
    setTreatmentQuery("");
    setInstantSlots(false);
    setDistanceRadius("Any");
    setMinRating(0);
    setPriceTier(null);
    setAtmosphere("All Salons");
    setSelectedServices([]);
    setSelectedPurity([]);
    setToastMessage("All filters cleared.");
  };

  // Confirm Slot Booking
  const handleConfirmBooking = (e) => {
    e.preventDefault();
    setToastMessage(
      `Slot reserved at ${bookingModalSalon.name} for ${bookingService} at ${bookingTime}! Confirmation SMS sent.`
    );
    setBookingModalSalon(null);
  };

  return (
    <div className="explore-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: "var(--explore-primary)",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "8px",
          boxShadow: "var(--explore-shadow-lg)",
          fontSize: "13px",
          fontWeight: 600,
          zIndex: 110,
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --------------------------------------------------------------------
          TOP HEADER
          -------------------------------------------------------------------- */}
      <header className="explore-header">
        <div className="explore-header-inner">
          <Link to="/customer-home" className="explore-brand-group">
            <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

          <nav className="explore-nav-links">
            <Link to="/customer-home" className="explore-nav-link">Home</Link>
            <Link to="/salons" className="explore-nav-link active">Find Salons</Link>
            <a href="#bookings" className="explore-nav-link" onClick={(e) => { e.preventDefault(); setToastMessage("Opening your bookings..."); }}>Bookings</a>
            <a href="#favorites" className="explore-nav-link" onClick={(e) => { e.preventDefault(); setToastMessage(`You have ${savedFavorites.size} saved favorite salon(s).`); }}>Favorites</a>
          </nav>

          <div className="explore-header-right">
            <button
              type="button"
              className="explore-notif-btn"
              title="Notifications"
              onClick={() => setToastMessage("You have no unread notifications.")}
            >
              🔔
              <span className="explore-notif-dot" />
            </button>

            <div
              className="explore-user-chip"
              onClick={() => setShowLogoutModal(true)}
              title="Click to sign out"
            >
              <div className="explore-user-info">
                <span className="explore-user-name">{currentUser.first_name || "Vishnu"}</span>
                <span className="explore-user-badge">Wellness Member</span>
              </div>
              <div className="explore-user-avatar">
                {(currentUser.first_name || "V")[0].toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          FLOATING 4-PART SEARCH & BOOKING BAR
          -------------------------------------------------------------------- */}
      <section className="explore-filter-bar-wrapper">
        <div className="explore-filter-bar">
          {/* Segment 1: Location */}
          <div className="filter-bar-segment">
            <div className="filter-segment-icon green">📍</div>
            <div className="filter-segment-content">
              <span className="filter-segment-label">LOCATION</span>
              <select
                className="filter-segment-select"
                value={locationParam}
                onChange={(e) => setLocationParam(e.target.value)}
              >
                <option value="Indiranagar, Bengaluru">Indiranagar, Bengaluru</option>
                <option value="Koramangala, Bengaluru">Koramangala, Bengaluru</option>
                <option value="Whitefield, Bengaluru">Whitefield, Bengaluru</option>
                <option value="HSR Layout, Bengaluru">HSR Layout, Bengaluru</option>
              </select>
            </div>
          </div>

          {/* Segment 2: Treatment or Stylist */}
          <div className="filter-bar-segment" style={{ flex: 1.4 }}>
            <div className="filter-segment-icon gold">✨</div>
            <div className="filter-segment-content">
              <span className="filter-segment-label">TREATMENT OR STYLIST</span>
              <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
                <input
                  type="text"
                  className="filter-segment-input"
                  placeholder="Haircut, Organic Spa, Herbal Facial"
                  value={treatmentQuery}
                  onChange={(e) => setTreatmentQuery(e.target.value)}
                />
                {treatmentQuery && (
                  <button
                    type="button"
                    onClick={() => setTreatmentQuery("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#94a3b8",
                      cursor: "pointer",
                      fontSize: "13px",
                      padding: "0 4px",
                    }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Segment 3: Date */}
          <div className="filter-bar-segment">
            <div className="filter-segment-icon gray">📅</div>
            <div className="filter-segment-content">
              <span className="filter-segment-label">DATE</span>
              <select
                className="filter-segment-select"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              >
                <option value="Today, 24 Oct">Today, 24 Oct</option>
                <option value="Tomorrow, 25 Oct">Tomorrow, 25 Oct</option>
                <option value="Saturday, 26 Oct">Saturday, 26 Oct</option>
              </select>
            </div>
          </div>

          {/* Segment 4: Time Window */}
          <div className="filter-bar-segment">
            <div className="filter-segment-icon gray">⏱</div>
            <div className="filter-segment-content">
              <span className="filter-segment-label">TIME WINDOW</span>
              <select
                className="filter-segment-select"
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
              >
                <option value="2:00 PM – 5:00 PM">2:00 PM – 5:00 PM</option>
                <option value="9:00 AM – 12:00 PM">9:00 AM – 12:00 PM</option>
                <option value="12:00 PM – 3:00 PM">12:00 PM – 3:00 PM</option>
                <option value="5:00 PM – 8:00 PM">5:00 PM – 8:00 PM</option>
              </select>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            className="btn-search-salons"
            onClick={() => setToastMessage("Filtered salons for " + (treatmentQuery || "all treatments"))}
          >
            <span>🔍</span>
            <span>Search Salons</span>
          </button>
        </div>
      </section>

      {/* --------------------------------------------------------------------
          MAIN 2-COLUMN SECTION
          -------------------------------------------------------------------- */}
      <main className="explore-main-content">
        {/* ======================= LEFT FILTERS SIDEBAR ======================= */}
        <aside className="explore-sidebar">
          {/* Header */}
          <div className="sidebar-header">
            <div className="sidebar-title">
              <span>⚡</span>
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="sidebar-active-count-badge">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <button
              type="button"
              className="sidebar-clear-btn"
              onClick={handleClearAll}
            >
              Clear all
            </button>
          </div>

          {/* Section 1: Instant Slots Toggle */}
          <div className="instant-slots-card">
            <div>
              <div className="instant-slots-title">
                <span>⚡</span>
                <span>Instant Slots</span>
              </div>
              <div className="instant-slots-sub">
                Available in next 30 mins
              </div>
            </div>

            <label className="filter-toggle-switch">
              <input
                type="checkbox"
                checked={instantSlots}
                onChange={(e) => setInstantSlots(e.target.checked)}
              />
              <span className="slider-round" />
            </label>
          </div>

          {/* Section 2: Distance Radius */}
          <div className="filter-section-block">
            <div className="filter-section-header">
              <span className="filter-section-label">Distance Radius</span>
              <span className="filter-section-subtext">Under {distanceRadius}</span>
            </div>
            <div className="filter-segmented-pills">
              {["2 km", "5 km", "10 km", "Any"].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  className={`filter-pill ${distanceRadius === dist ? "active" : ""}`}
                  onClick={() => setDistanceRadius(dist)}
                >
                  {dist}
                </button>
              ))}
            </div>
          </div>

          {/* Section 3: Guest Rating */}
          <div className="filter-section-block">
            <span className="filter-section-label">Guest Rating</span>
            <div className="filter-checkbox-list">
              {[
                { label: "★ 4.8 & above", sub: "(Exceptional)", val: 4.8 },
                { label: "★ 4.5 & above", sub: "(Very Good)", val: 4.5 },
                { label: "★ 4.0 & above", sub: "(Good)", val: 4.0 },
              ].map((item) => (
                <label key={item.val} className={`filter-checkbox-item ${minRating === item.val ? "checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={minRating === item.val}
                    onChange={() => setMinRating(minRating === item.val ? 0 : item.val)}
                  />
                  <span>
                    <strong>{item.label}</strong> <small style={{ color: "var(--explore-text-light)" }}>{item.sub}</small>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 4: Price Level */}
          <div className="filter-section-block">
            <span className="filter-section-label">Price Level</span>
            <div className="price-level-grid">
              {[
                { tier: 1, sym: "₹", range: "< ₹500" },
                { tier: 2, sym: "₹₹", range: "₹500–₹1,500" },
                { tier: 3, sym: "₹₹₹", range: "₹1,500+" },
              ].map((p) => (
                <div
                  key={p.tier}
                  className={`price-level-card ${priceTier === p.tier ? "active" : ""}`}
                  onClick={() => setPriceTier(priceTier === p.tier ? null : p.tier)}
                >
                  <span className="price-level-symbol">{p.sym}</span>
                  <span className="price-level-range">{p.range}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Atmosphere & Gender */}
          <div className="filter-section-block">
            <span className="filter-section-label">Atmosphere & Gender</span>
            <div className="filter-segmented-pills">
              {["All Salons", "Unisex", "Women-Only", "Men's Care"].map((atm) => (
                <button
                  key={atm}
                  type="button"
                  className={`filter-pill ${atmosphere === atm ? "active" : ""}`}
                  onClick={() => setAtmosphere(atm)}
                >
                  {atm}
                </button>
              ))}
            </div>
          </div>

          {/* Section 6: Holistic Services */}
          <div className="filter-section-block">
            <span className="filter-section-label">Holistic Services</span>
            <div className="filter-checkbox-list">
              {[
                "Hair Cut & Styling",
                "Organic Hair Spa",
                "Ayurvedic Herbal Facial",
                "Botanical Manicure & Pedicure",
                "Full Body Holistic Massage",
                "Artisan Beard Grooming",
              ].map((srv) => (
                <label key={srv} className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedServices.includes(srv)}
                    onChange={() => {
                      setSelectedServices((prev) =>
                        prev.includes(srv) ? prev.filter((i) => i !== srv) : [...prev, srv]
                      );
                    }}
                  />
                  <span>{srv}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Section 7: Offers & Purity */}
          <div className="filter-section-block">
            <span className="filter-section-label">Offers & Purity</span>
            <div className="filter-checkbox-list">
              {[
                "Verified Non-Toxic / Clean",
                "First Booking Promo Active",
                "Free Scalp & Tea Ritual",
              ].map((purity) => (
                <label key={purity} className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedPurity.includes(purity)}
                    onChange={() => {
                      setSelectedPurity((prev) =>
                        prev.includes(purity) ? prev.filter((i) => i !== purity) : [...prev, purity]
                      );
                    }}
                  />
                  <span>{purity}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ======================= RIGHT RESULTS COLUMN ======================= */}
        <section className="explore-results-column">
          {/* Header Bar */}
          <div className="results-header-bar">
            <div className="results-title-group">
              <div className="results-title-row">
                <h1 className="results-main-title">
                  {filteredSalons.length} Botanical {filteredSalons.length === 1 ? "Salon" : "Salons"}
                </h1>
                <span className="results-live-badge">
                  <span className="results-live-dot" />
                  <span>Live Availability</span>
                </span>
              </div>
              <p className="results-subtitle">
                Showing curated wellness spaces near {locationParam}
              </p>
            </div>

            <div className="results-controls">
              <select
                className="sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="Recommended for You">Sort: Recommended for You</option>
                <option value="Highest Rated">Sort: Highest Rated</option>
                <option value="Nearest Distance">Sort: Nearest Distance</option>
              </select>

              <div className="view-mode-toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  title="List View"
                >
                  ☰
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                >
                  ⊞
                </button>
              </div>
            </div>
          </div>

          {/* Salon Cards List */}
          {filteredSalons.length === 0 ? (
            <div className="salons-empty-state">
              <div className="salons-empty-icon">🌿</div>
              <h3 className="salons-empty-title">No matching salons found</h3>
              <p className="salons-empty-desc">
                We couldn't find any botanical salons matching your active filters. Try loosening your distance, rating, or search term.
              </p>
              <button
                type="button"
                className="salons-empty-reset-btn"
                onClick={handleClearAll}
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={`salons-cards-list ${viewMode === "grid" ? "grid-mode" : ""}`}>
              {filteredSalons.map((salon) => (
                <article key={salon.id} className="salon-explore-card">
                  {/* Media Left */}
                  <div className="salon-card-media">
                    <img
                      src={salon.image || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85"}
                      alt={salon.name}
                      className="salon-card-img"
                    />
                    <span className={`salon-badge-overlay ${salon.badge_type || "organic"}`}>
                      {salon.badge || "● Verified Organic"}
                    </span>
                    <button
                      type="button"
                      className={`btn-fav-toggle ${savedFavorites.has(salon.id) ? "saved" : ""}`}
                      onClick={() => toggleFavorite(salon.id)}
                      title={savedFavorites.has(salon.id) ? "Remove from favorites" : "Save to favorites"}
                    >
                      {savedFavorites.has(salon.id) ? "♥" : "♡"}
                    </button>
                  </div>

                  {/* Content Right */}
                  <div className="salon-card-content">
                    <div className="salon-card-header-group">
                      <div className="salon-card-top-row">
                        <h3 className="salon-card-name" title={salon.name}>{salon.name}</h3>
                        <span className="salon-card-rating">
                          <span className="rating-star">★</span>
                          <span className="rating-val">{salon.rating || "4.8"}</span>
                          <span className="rating-count">({salon.review_count || "48"})</span>
                        </span>
                      </div>

                      <p className="salon-card-meta">
                        <span>📍 {salon.distance_km || "2.4"} km away</span>
                        <span>•</span>
                        <span>{salon.address_line || salon.city || "Bengaluru"}</span>
                        <span>•</span>
                        <span>{(salon.tags && salon.tags.length > 0 ? salon.tags : ["Unisex", "AC"]).slice(0, 2).join(" • ")}</span>
                      </p>
                    </div>

                    {/* Slot availability inline badges matching reference */}
                    <div className="salon-slot-row">
                      {(() => {
                        const text = salon.instant_slot_text || "Instant Slot available today • Guaranteed reservation";
                        if (text.includes(" • ") && (text.includes("OFF") || text.includes("🎁") || text.includes("Free"))) {
                          const [slotPart, promoPart] = text.split(" • ");
                          return (
                            <>
                              <span className="salon-slot-pill grey">
                                <span className="slot-pill-icon">🕒</span>
                                <span>{slotPart}</span>
                              </span>
                              <span className={promoPart.includes("OFF") ? "salon-slot-promo red" : "salon-slot-pill gold"}>
                                {promoPart}
                              </span>
                            </>
                          );
                        } else {
                          const isInstant = salon.has_instant_slot || text.toLowerCase().includes("instant");
                          return (
                            <span className={`salon-slot-pill ${isInstant ? "green" : "grey"}`}>
                              <span className="slot-pill-icon">{isInstant ? "⚡" : "🕒"}</span>
                              <span>{text}</span>
                            </span>
                          );
                        }
                      })()}
                    </div>

                    {/* Pricing row (borderless clean 3 uniform columns) */}
                    <div className="salon-services-pricing-grid">
                      {(() => {
                        const sList = (salon.services && salon.services.length > 0) ? [...salon.services] : [];
                        const defaults = [
                          { name: "Haircut & Styling", price: "₹349" },
                          { name: "Organic Hair Spa", price: "₹899" },
                          { name: "Hydra Facial Glow", price: "₹999" },
                        ];
                        while (sList.length < 3) {
                          sList.push(defaults[sList.length]);
                        }
                        return sList.slice(0, 3).map((srv, idx) => (
                          <div key={idx} className="service-tariff-col">
                            <span className="service-tariff-name" title={srv.name}>{srv.name}</span>
                            <span className="service-tariff-price">{srv.price}</span>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Footer & Actions */}
                    <div className="salon-card-bottom-row">
                      <span className="salon-purity-text" title={salon.purity_note}>
                        🌿 {salon.purity_note || "Standard clean hygiene certified"}
                      </span>

                      <div className="salon-card-btn-group">
                        <button
                          type="button"
                          className="btn-view-salon"
                          onClick={() => setDetailsModalSalon(salon)}
                        >
                          View Salon
                        </button>
                        <button
                          type="button"
                          className="btn-book-slot"
                          onClick={() => {
                            setBookingModalSalon(salon);
                            setBookingService(salon.services?.[0]?.name || "Haircut & Styling");
                          }}
                        >
                          <span>Book Slot</span>
                          <span>→</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination / Load More Footer */}
          <div className="explore-pagination-row">
            <span className="pagination-counter">
              Showing {filteredSalons.length} of 28 partner salons
            </span>

            <button
              type="button"
              className="btn-load-more"
              onClick={() => setToastMessage("Loading additional curated salons near you...")}
            >
              <span>⌄</span>
              <span>Load 8 More Salons</span>
            </button>

            <div className="pagination-pages-group">
              <button type="button" className="page-num-btn active">1</button>
              <button type="button" className="page-num-btn" onClick={() => setToastMessage("Page 2 loaded")}>2</button>
              <button type="button" className="page-num-btn" onClick={() => setToastMessage("Page 3 loaded")}>3</button>
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------------------
          ORGANIC WELLNESS FOOTER
          -------------------------------------------------------------------- */}
      <footer className="explore-footer">
        <div className="explore-footer-inner">
          <div>
            <div className="explore-brand-group" style={{ marginBottom: "12px" }}>
              <div className="explore-brand-icon" style={{ width: "30px", height: "30px", fontSize: "14px" }}>✂</div>
              <span className="explore-brand-name" style={{ fontSize: "15px" }}>BookMySalon</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", lineHeight: 1.6, maxWidth: "280px" }}>
              Discover curated botanical wellness salons, cruelty-free sanctuaries, and holistic hair specialists near you.
            </p>
          </div>

          <div>
            <h4 className="footer-col-title">Explore</h4>
            <div className="footer-link-list">
              <a href="#botanical" className="footer-link">Botanical Salons</a>
              <a href="#organic" className="footer-link">Organic Treatments</a>
              <a href="#holistic" className="footer-link">Holistic Spas</a>
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">Account</h4>
            <div className="footer-link-list">
              <a href="#appointments" className="footer-link">My Appointments</a>
              <a href="#saved" className="footer-link">Saved Salons</a>
              <a href="#preferences" className="footer-link">Preferences</a>
            </div>
          </div>

          <div>
            <h4 className="footer-col-title">Purity Promise</h4>
            <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", lineHeight: 1.6 }}>
              All partner salons prioritize verified non-toxic, sustainable, and organic care rituals for mindful beauty experiences.
            </p>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <span>© 2025 BookMySalon Inc.</span>
          <span>Clean Luxury Wellness</span>
        </div>
      </footer>

      {/* --------------------------------------------------------------------
          MODAL: BOOK SLOT
          -------------------------------------------------------------------- */}
      {bookingModalSalon && (
        <div className="explore-modal-overlay" onClick={() => setBookingModalSalon(null)}>
          <div className="explore-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-banner">
              <img
                src={bookingModalSalon.image}
                alt={bookingModalSalon.name}
                className="modal-header-img"
              />
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setBookingModalSalon(null)}
              >
                ✕
              </button>
            </div>

            <form className="modal-body" onSubmit={handleConfirmBooking}>
              <div>
                <span className="modal-rating-badge">★ {bookingModalSalon.rating}</span>
                <h2 className="modal-title" style={{ marginTop: "6px" }}>Book Slot at {bookingModalSalon.name}</h2>
                <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", margin: "4px 0 0" }}>
                  📍 {bookingModalSalon.address_line}
                </p>
              </div>

              <div>
                <h4 className="modal-section-title">Select Treatment Service</h4>
                <div className="modal-service-list">
                  {bookingModalSalon.services.map((srv, idx) => (
                    <div
                      key={idx}
                      className={`modal-service-row selectable ${bookingService === srv.name ? "selected" : ""}`}
                      onClick={() => setBookingService(srv.name)}
                    >
                      <span>{srv.name}</span>
                      <strong>{srv.price}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <strong>Date</strong>
                  <span>{selectedDate}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Slot Time</strong>
                  <select
                    value={bookingTime}
                    onChange={(e) => setBookingTime(e.target.value)}
                    style={{ border: "none", background: "transparent", fontWeight: 600, outline: "none", cursor: "pointer" }}
                  >
                    <option value="2:30 PM">2:30 PM (Instant Slot)</option>
                    <option value="3:15 PM">3:15 PM</option>
                    <option value="4:00 PM">4:00 PM</option>
                    <option value="5:30 PM">5:30 PM</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-view-salon"
                  onClick={() => setBookingModalSalon(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-book-slot">
                  Confirm Reservation →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: VIEW SALON DETAILS
          -------------------------------------------------------------------- */}
      {detailsModalSalon && (
        <div className="explore-modal-overlay" onClick={() => setDetailsModalSalon(null)}>
          <div className="explore-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-banner">
              <img
                src={detailsModalSalon.image}
                alt={detailsModalSalon.name}
                className="modal-header-img"
              />
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDetailsModalSalon(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div>
                <span className="modal-rating-badge">★ {detailsModalSalon.rating} ({detailsModalSalon.review_count} verified reviews)</span>
                <h2 className="modal-title" style={{ marginTop: "6px" }}>{detailsModalSalon.name}</h2>
                <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", margin: "4px 0 0" }}>
                  📍 {detailsModalSalon.address_line}, {detailsModalSalon.city}
                </p>
              </div>

              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <strong>Operating Hours</strong>
                  <span>{detailsModalSalon.opening_hours || "9:00 AM – 9:00 PM"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Contact Phone</strong>
                  <span>{detailsModalSalon.phone || "+91 98450 12345"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Atmosphere</strong>
                  <span>{detailsModalSalon.gender_category || "Unisex"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Purity Standard</strong>
                  <span>{detailsModalSalon.purity_note}</span>
                </div>
              </div>

              <div>
                <h4 className="modal-section-title">Verified Services Menu</h4>
                <div className="modal-service-list">
                  {detailsModalSalon.services.map((srv, idx) => (
                    <div key={idx} className="modal-service-row">
                      <span>{srv.name}</span>
                      <strong>{srv.price}</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-view-salon"
                  onClick={() => setDetailsModalSalon(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-book-slot"
                  onClick={() => {
                    const sel = detailsModalSalon;
                    setDetailsModalSalon(null);
                    setBookingModalSalon(sel);
                    setBookingService(sel.services[0]?.name || "Haircut & Styling");
                  }}
                >
                  <span>Book Slot Now</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div
          className="logout-modal-overlay"
          onClick={() => setShowLogoutModal(false)}
        >
          <div
            className="logout-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="logout-modal-close"
              onClick={() => setShowLogoutModal(false)}
              aria-label="Close"
            >
              ✕
            </button>

            <div className="logout-modal-avatar">
              {(currentUser?.first_name || "V")[0].toUpperCase()}
            </div>

            <h3 className="logout-modal-title">Sign Out of BookMySalon</h3>
            <div className="logout-modal-subtitle">
              Wellness Member • {currentUser?.first_name || "Vishnu"}
            </div>

            <p className="logout-modal-message">
              Are you sure you want to sign out? You can sign back in anytime with your email and password.
            </p>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-btn-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-btn-confirm"
                onClick={() => {
                  setShowLogoutModal(false);
                  logout();
                  navigate("/login");
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



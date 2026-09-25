import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { resolveImageUrl } from "../../utils/imageUtils";
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
  const [locationParam, setLocationParam] = useState("All Locations");
  const [treatmentQuery, setTreatmentQuery] = useState(() => searchParams.get("search") || "");
  const [selectedDate, setSelectedDate] = useState("Today");
  const [timeWindow, setTimeWindow] = useState("All Day Slots");

  // Sidebar Filter States (clean defaults so all approved salons appear immediately)
  const [instantSlots, setInstantSlots] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState("Any");
  const [minRating, setMinRating] = useState(0);
  const [priceTier, setPriceTier] = useState(null);
  const [atmosphere, setAtmosphere] = useState("All Salons");
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedPurity, setSelectedPurity] = useState([]);

  // Sorting & View mode
  const [sortBy, setSortBy] = useState("Recommended for You");
  const [viewMode, setViewMode] = useState("list");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

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
        console.log("Error loading salons for exploration", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSalons();
  }, []);

  // Dynamically extract locations from fetched salons
  const availableLocations = useMemo(() => {
    const locs = new Set();
    salonsList.forEach((s) => {
      if (s.city) locs.add(s.city);
    });
    return ["All Locations", ...Array.from(locs)];
  }, [salonsList]);

  // Dynamically extract categories & service tags from fetched salons
  const availableCategories = useMemo(() => {
    const catSet = new Set();
    salonsList.forEach((s) => {
      if (s.category) catSet.add(s.category);
      if (s.tags && Array.isArray(s.tags)) {
        s.tags.forEach((t) => catSet.add(t));
      }
    });
    if (catSet.size === 0) {
      return ["Hair & Styling", "AC", "Certified"];
    }
    return Array.from(catSet).slice(0, 6);
  }, [salonsList]);

  // Filter salons dynamically
  const filteredSalons = useMemo(() => {
    let list = salonsList.length > 0 ? [...salonsList] : [];

    // Filter by text search
    if (treatmentQuery.trim()) {
      const q = treatmentQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.address_line && s.address_line.toLowerCase().includes(q)) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.services && Array.isArray(s.services) && s.services.some((srv) => srv.name && srv.name.toLowerCase().includes(q))) ||
          (s.tags && Array.isArray(s.tags) && s.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    // Filter by location
    if (locationParam !== "All Locations") {
      const loc = locationParam.toLowerCase();
      list = list.filter(
        (s) =>
          (s.city && s.city.toLowerCase().includes(loc)) ||
          (s.address_line && s.address_line.toLowerCase().includes(loc))
      );
    }

    // Filter by category URL parameter if present
    const categoryUrlParam = searchParams.get("category");
    if (categoryUrlParam && categoryUrlParam.toLowerCase() !== "all") {
      const cat = categoryUrlParam.toLowerCase();
      list = list.filter(
        (s) =>
          s.tags?.some((t) => t.toLowerCase().includes(cat)) ||
          s.services?.some((srv) => srv.name?.toLowerCase().includes(cat) || (srv.category && srv.category.toLowerCase().includes(cat)))
      );
    }

    // Filter by selected services / tags from sidebar
    if (selectedServices.length > 0) {
      list = list.filter((s) =>
        selectedServices.some(
          (sel) =>
            s.tags?.some((t) => t.toLowerCase().includes(sel.toLowerCase())) ||
            s.services?.some((srv) => srv.name?.toLowerCase().includes(sel.toLowerCase()))
        )
      );
    }

    // Filter by atmosphere
    if (atmosphere !== "All Salons") {
      const atm = atmosphere.toLowerCase();
      list = list.filter(
        (s) =>
          s.gender_category?.toLowerCase().includes(atm) ||
          s.tags?.some((t) => t.toLowerCase().includes(atm))
      );
    }

    // Filter by Instant Slots
    if (instantSlots) {
      list = list.filter((s) => s.has_instant_slot);
    }

    // Filter by Min Rating
    if (minRating > 0) {
      list = list.filter((s) => (s.rating || 0) >= minRating);
    }

    // Filter by Price Tier
    if (priceTier) {
      list = list.filter((s) => s.price_tier === priceTier);
    }

    // Sorting
    if (sortBy === "Highest Rated") {
      list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "Nearest Distance") {
      list.sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0));
    }

    return list;
  }, [
    salonsList,
    treatmentQuery,
    locationParam,
    searchParams,
    selectedServices,
    atmosphere,
    instantSlots,
    distanceRadius,
    minRating,
    priceTier,
    sortBy,
  ]);

  // Reset pagination when search, filters, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    treatmentQuery,
    locationParam,
    searchParams,
    selectedServices,
    atmosphere,
    instantSlots,
    distanceRadius,
    minRating,
    priceTier,
    sortBy,
    pageSize,
  ]);

  // Pagination Calculations
  const totalPages = Math.max(1, Math.ceil(filteredSalons.length / pageSize));
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (validCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredSalons.length);
  const paginatedSalons = filteredSalons.slice(startIndex, endIndex);

 
  
  // Helper for generating page numbers with smart ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (validCurrentPage <= 3) {
      return [1, 2, 3, 4, "...", totalPages];
    }
    if (validCurrentPage >= totalPages - 2) {
      return [1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [
      1,
      "...",
      validCurrentPage - 1,
      validCurrentPage,
      validCurrentPage + 1,
      "...",
      totalPages,
    ];
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages || page === validCurrentPage) return;
    setCurrentPage(page);
    const colEl = document.querySelector(".explore-results-column");
    if (colEl) {
      colEl.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

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
    setCurrentPage(1);
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
                {availableLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
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
                  placeholder="Haircut, Styling, Facial..."
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
          <div className="filter-bar-segment" title="Date scheduling coming soon">
            <div className="filter-segment-icon gray">📅</div>
            <div className="filter-segment-content">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="filter-segment-label">DATE</span>
                <span className="coming-soon-pill">Coming Soon</span>
              </div>
              <select
                className="filter-segment-select"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setToastMessage("Online date scheduler is coming soon!");
                }}
              >
                <option value="Today">Today (Live)</option>
                <option value="Tomorrow">Tomorrow</option>
              </select>
            </div>
          </div>

          {/* Segment 4: Time Window */}
          <div className="filter-bar-segment" title="Slot scheduling coming soon">
            <div className="filter-segment-icon gray">⏱</div>
            <div className="filter-segment-content">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="filter-segment-label">TIME WINDOW</span>
                <span className="coming-soon-pill">Coming Soon</span>
              </div>
              <select
                className="filter-segment-select"
                value={timeWindow}
                onChange={(e) => {
                  setTimeWindow(e.target.value);
                  setToastMessage("Slot scheduling is coming soon!");
                }}
              >
                <option value="All Day Slots">All Day Slots</option>
                <option value="Morning">Morning (9 AM – 12 PM)</option>
                <option value="Afternoon">Afternoon (12 PM – 5 PM)</option>
                <option value="Evening">Evening (5 PM – 9 PM)</option>
              </select>
            </div>
          </div>

          {/* Action Button */}
          <button
            type="button"
            className="btn-search-salons"
            onClick={() => setToastMessage(filteredSalons.length > 0 ? `Showing ${filteredSalons.length} open salon(s)` : "No salons found matching your search")}
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
                <span className="coming-soon-pill">Coming Soon</span>
              </div>
              <div className="instant-slots-sub">
                Available in next 30 mins
              </div>
            </div>

            <label className="filter-toggle-switch">
              <input
                type="checkbox"
                checked={instantSlots}
                onChange={(e) => {
                  setInstantSlots(e.target.checked);
                  setToastMessage("Instant slots booking is coming soon!");
                }}
              />
              <span className="slider-round" />
            </label>
          </div>

          {/* Section 2: Distance Radius */}
          <div className="filter-section-block">
            <div className="filter-section-header">
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span className="filter-section-label">Distance Radius</span>
                <span className="coming-soon-pill">Coming Soon</span>
              </div>
              <span className="filter-section-subtext">Under {distanceRadius}</span>
            </div>
            <div className="filter-segmented-pills">
              {["2 km", "5 km", "10 km", "Any"].map((dist) => (
                <button
                  key={dist}
                  type="button"
                  className={`filter-pill ${distanceRadius === dist ? "active" : ""}`}
                  onClick={() => {
                    setDistanceRadius(dist);
                    setToastMessage("GPS radius calculation coming soon!");
                  }}
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
              {availableCategories.map((srv) => (
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span className="filter-section-label">Offers & Purity</span>
              <span className="coming-soon-pill">Coming Soon</span>
            </div>
            <div className="filter-checkbox-list">
              {[
                "Verified Clean / Non-Toxic",
                "First Booking Promo Active",
                "Complimentary Scalp Ritual",
              ].map((purity) => (
                <label key={purity} className="filter-checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedPurity.includes(purity)}
                    onChange={() => {
                      setSelectedPurity((prev) =>
                        prev.includes(purity) ? prev.filter((i) => i !== purity) : [...prev, purity]
                      );
                      setToastMessage("Purity & offers filter coming soon!");
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
              {paginatedSalons.map((salon) => (
                <article key={salon.id} className="salon-explore-card">
                  {/* Media Left */}
                  <div className="salon-card-media">
                    <img
                      src={resolveImageUrl(salon.image)}
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
                          <span className="rating-val">{salon.rating || "4.9"}</span>
                          <span className="rating-count">({salon.review_count ? salon.review_count : "Verified"})</span>
                        </span>
                      </div>

                      <p className="salon-card-meta">
                        <span>📍 {salon.address_line || salon.city || "Kerala"}</span>
                        <span>•</span>
                        <span>{(salon.tags && salon.tags.length > 0 ? salon.tags : ["Hair & Styling", "AC"]).slice(0, 3).join(" • ")}</span>
                      </p>
                    </div>

                    {/* Slot availability inline badges matching reference */}
                    <div className="salon-slot-row">
                      <span className="salon-slot-pill green">
                        <span className="slot-pill-icon">●</span>
                        <span>{salon.instant_slot_text || "Open today • Verified Partner"}</span>
                      </span>
                      {salon.opening_hours && (
                        <span className="salon-slot-pill grey">
                          <span className="slot-pill-icon">⏱</span>
                          <span>{salon.opening_hours}</span>
                        </span>
                      )}
                    </div>

                    {/* Pricing row (borderless clean 3 uniform columns) */}
                    <div className="salon-services-pricing-grid">
                      {salon.services && salon.services.length > 0 ? (
                        salon.services.slice(0, 3).map((item, idx) => (
                          <div key={item.id || item.name || idx} className="service-tariff-col">
                            <span className="service-tariff-name" title={item.name}>{item.name}</span>
                            <span className="service-tariff-price">{item.price}</span>
                          </div>
                        ))
                      ) : (
                        <div className="service-tariff-col" style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--explore-text-muted)" }}>
                          <span className="service-tariff-name">Services available upon inquiry</span>
                          <span className="service-tariff-price">₹299+</span>
                        </div>
                      )}
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

          {/* Pagination Controls */}
          {filteredSalons.length > 0 && (
            <div className="explore-pagination-row">
              <div className="pagination-info-group">
                <span className="pagination-counter">
                  Showing <strong>{startIndex + 1}–{endIndex}</strong> of{" "}
                  <strong>{filteredSalons.length}</strong> partner salons
                </span>

                <div className="pagination-per-page">
                  <label htmlFor="salon-page-size">Per page:</label>
                  <select
                    id="salon-page-size"
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="pagination-select"
                  >
                    <option value={4}>4</option>
                    <option value={6}>6</option>
                    <option value={8}>8</option>
                    <option value={12}>12</option>
                  </select>
                </div>
              </div>

              <div className="pagination-pages-group">
                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => handlePageChange(validCurrentPage - 1)}
                  disabled={validCurrentPage <= 1}
                  aria-label="Previous page"
                >
                  ‹ Prev
                </button>

                {getPageNumbers().map((num, idx) =>
                  num === "..." ? (
                    <span key={`dots-${idx}`} className="page-ellipsis">
                      …
                    </span>
                  ) : (
                    <button
                      key={num}
                      type="button"
                      className={`page-num-btn ${num === validCurrentPage ? "active" : ""}`}
                      onClick={() => handlePageChange(num)}
                    >
                      {num}
                    </button>
                  )
                )}

                <button
                  type="button"
                  className="page-nav-btn"
                  onClick={() => handlePageChange(validCurrentPage + 1)}
                  disabled={validCurrentPage >= totalPages}
                  aria-label="Next page"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
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
          MODAL: BOOK SLOT / CONTACT SALON
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

            <div className="modal-body">
              <div>
                <span className="modal-rating-badge">★ {bookingModalSalon.rating || "4.9"}</span>
                <h2 className="modal-title" style={{ marginTop: "6px" }}>Book Slot at {bookingModalSalon.name}</h2>
                <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", margin: "4px 0 0" }}>
                  📍 {bookingModalSalon.address_line || bookingModalSalon.city}
                </p>
              </div>

              <div className="coming-soon-call-box">
                <span className="coming-soon-pill" style={{ marginBottom: "8px" }}>Online Booking Coming Soon</span>
                <p>
                  Instant online slot booking is launching soon! You can contact the salon directly to reserve your slot today.
                </p>
                {bookingModalSalon.phone && (
                  <a
                    href={`tel:${bookingModalSalon.phone}`}
                    className="coming-soon-call-link"
                  >
                    <span>📞 Call {bookingModalSalon.phone}</span>
                  </a>
                )}
              </div>

              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <strong>Operating Hours</strong>
                  <span>{bookingModalSalon.opening_hours || "9:00 AM – 8:30 PM"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Atmosphere</strong>
                  <span>{bookingModalSalon.gender_category || "Unisex"}</span>
                </div>
              </div>

              {bookingModalSalon.services && bookingModalSalon.services.length > 0 && (
                <div>
                  <h4 className="modal-section-title">Verified Services</h4>
                  <div className="modal-service-list">
                    {bookingModalSalon.services.map((srv, idx) => (
                      <div key={idx} className="modal-service-row">
                        <span>{srv.name}</span>
                        <strong>{srv.price}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer-actions">
                <button
                  type="button"
                  className="btn-view-salon"
                  onClick={() => setBookingModalSalon(null)}
                >
                  Close
                </button>
                {bookingModalSalon.phone && (
                  <a
                    href={`tel:${bookingModalSalon.phone}`}
                    className="btn-book-slot"
                    style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <span>Call to Book</span>
                    <span>→</span>
                  </a>
                )}
              </div>
            </div>
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
                <span className="modal-rating-badge">★ {detailsModalSalon.rating || "4.9"} ({detailsModalSalon.review_count ? `${detailsModalSalon.review_count} verified reviews` : "Verified Partner"})</span>
                <h2 className="modal-title" style={{ marginTop: "6px" }}>{detailsModalSalon.name}</h2>
                <p style={{ fontSize: "12px", color: "var(--explore-text-muted)", margin: "4px 0 0" }}>
                  📍 {detailsModalSalon.address_line || detailsModalSalon.city}
                </p>
              </div>

              <div className="modal-info-grid">
                <div className="modal-info-item">
                  <strong>Operating Hours</strong>
                  <span>{detailsModalSalon.opening_hours || "9:00 AM – 8:30 PM"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Contact Phone</strong>
                  <span>{detailsModalSalon.phone || "Contact upon arrival"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Atmosphere</strong>
                  <span>{detailsModalSalon.gender_category || "Unisex"}</span>
                </div>
                <div className="modal-info-item">
                  <strong>Purity Standard</strong>
                  <span>{detailsModalSalon.purity_note || detailsModalSalon.description || "Certified clean standards"}</span>
                </div>
              </div>

              {detailsModalSalon.services && detailsModalSalon.services.length > 0 && (
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
              )}

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
                    setBookingService(sel.services?.[0]?.name || "Haircut & Styling");
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



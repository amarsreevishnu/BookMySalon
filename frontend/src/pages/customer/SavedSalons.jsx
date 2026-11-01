import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import useFavorites from "../../hooks/useFavorites";
import api from "../../api/axios";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/savedSalons.css";

export default function SavedSalons() {
  const { toggleFavorite, isFavorite, isAuthenticated } = useFavorites();
  const [salons, setSalons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2800);
  };

  // Fetch full list of saved salons from API
  const fetchSavedSalons = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/accounts/customer/favorites/");
      setSalons(Array.isArray(res.data?.favorites) ? res.data.favorites : []);
    } catch (err) {
      console.error(err);
      setError("Failed to load your saved salons. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSavedSalons();
  }, [fetchSavedSalons]);

  // Handle heart click on the saved list
  const handleRemoveFavorite = async (salon) => {
    const res = await toggleFavorite(salon.id, salon.name);
    if (res.success) {
      // Optimistically remove from page state
      setSalons((prev) => prev.filter((s) => s.id !== salon.id));
      showToast(`Removed "${salon.name}" from your Saved Salons.`);
    }
  };

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const set = new Set();
    salons.forEach((s) => {
      if (s.category) set.add(s.category.split("•")[0].trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [salons]);

  // Filtered salons
  const filteredSalons = useMemo(() => {
    return salons.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.city && s.city.toLowerCase().includes(query)) ||
        (s.category && s.category.toLowerCase().includes(query));

      const matchesCat =
        categoryFilter === "ALL" ||
        (s.category && s.category.toLowerCase().includes(categoryFilter.toLowerCase()));

      return matchesSearch && matchesCat;
    });
  }, [salons, searchQuery, categoryFilter]);

  return (
    <div className="saved-salons-container">
      <CustomerHeader />

      <main className="saved-salons-main">
        {/* Header Row */}
        <div className="saved-header-row">
          <div className="saved-title-group">
            <h1>
              <span className="saved-title-heart">♥</span> Saved Salons
            </h1>
            <p>
              Your personal collection of favourite salons. Quickly access and book treatments without searching again.
            </p>
          </div>

          {!loading && salons.length > 0 && (
            <div className="saved-count-pill">
              ♥ {salons.length} Saved Sanctuary{salons.length > 1 ? "ies" : ""}
            </div>
          )}
        </div>

        {/* Search & Filter Controls (if salons exist) */}
        {!loading && salons.length > 0 && (
          <div className="saved-controls-card">
            <div className="saved-search-wrap">
              <span className="saved-search-icon">🔍</span>
              <input
                type="text"
                className="saved-search-input"
                placeholder="Search saved salons by name, city, or service..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {categories.length > 2 && (
              <select
                className="saved-filter-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === "ALL" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#dc2626",
              padding: "12px 18px",
              borderRadius: "12px",
              marginBottom: "20px",
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Main Content Area */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 20px", color: "#64748b" }}>
            <span style={{ fontSize: "2rem", display: "block", marginBottom: "12px" }}>⏳</span>
            Loading your saved salons...
          </div>
        ) : salons.length === 0 ? (
          /* Empty State */
          <div className="saved-empty-container">
            <div className="saved-empty-icon">🤍</div>
            <h2 className="saved-empty-title">No saved salons yet</h2>
            <p className="saved-empty-desc">
              Explore verified wellness spaces, tap the heart icon on any salon card to save it, and access all your preferred spots right here.
            </p>
            <Link to="/customer/salons" className="saved-explore-cta">
              <span>🔍</span> Explore Salons
            </Link>
          </div>
        ) : filteredSalons.length === 0 ? (
          /* Search Empty State */
          <div className="saved-empty-container" style={{ padding: "50px 20px" }}>
            <div className="saved-empty-icon">🔎</div>
            <h3 className="saved-empty-title">No Matching Salons</h3>
            <p className="saved-empty-desc">
              No saved salons matched your search term "{searchQuery}". Try a different keyword or clear your filters.
            </p>
            <button
              type="button"
              className="saved-explore-cta"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("ALL");
              }}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          /* Salons Cards Grid */
          <div className="saved-salons-grid">
            {filteredSalons.map((salon) => {
              const available = salon.is_available !== false && salon.approval_status === "APPROVED";

              return (
                <article key={salon.id} className="saved-salon-card">
                  {/* Media / Image Area */}
                  <div className="saved-card-media">
                    <img
                      src={resolveImageUrl(salon.cover_image)}
                      alt={salon.name}
                      className="saved-card-img"
                    />

                    {/* Rating Badge */}
                    <div className="saved-card-rating">
                      <span className="star">★</span>
                      <span>{salon.rating || "4.9"}</span>
                      {salon.reviews_count > 0 && <span>({salon.reviews_count})</span>}
                    </div>

                    {/* Availability Badge */}
                    <div className={`saved-avail-badge ${available ? "available" : "unavailable"}`}>
                      {available ? "● Available for Booking" : "⚠️ Currently Unavailable"}
                    </div>

                    {/* Heart Button */}
                    <button
                      type="button"
                      className="saved-card-heart-btn"
                      onClick={() => handleRemoveFavorite(salon)}
                      title="Remove from saved salons"
                      aria-label="Remove from saved salons"
                    >
                      ♥
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="saved-card-body">
                    <span className="saved-card-category">{salon.category}</span>
                    <h3 className="saved-card-title">{salon.name}</h3>

                    <p className="saved-card-address">
                      <span>📍</span> {salon.address || salon.city || "Kerala"}
                      {salon.city ? `, ${salon.city}` : ""}
                    </p>

                    {salon.amenities && salon.amenities.length > 0 && (
                      <div className="saved-card-tags">
                        {salon.amenities.slice(0, 3).map((tag, idx) => (
                          <span key={idx} className="saved-tag-pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="saved-card-footer">
                      {available ? (
                        <Link
                          to={`/customer/salons/${salon.id}`}
                          className="saved-book-btn"
                        >
                          Book Appointment <span>→</span>
                        </Link>
                      ) : (
                        <button
                          type="button"
                          className="saved-book-btn disabled"
                          disabled
                          title="This salon is temporarily inactive or not accepting new bookings."
                        >
                          Booking Paused (Unavailable)
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="saved-toast-notification">
          {toastMessage}
        </div>
      )}

      <CustomerFooter />
    </div>
  );
}

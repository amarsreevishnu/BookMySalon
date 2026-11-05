import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/adminOffers.css";

const PRESET_HIDE_REASONS = [
  "Misleading or deceptive promotional claims",
  "Pricing violates platform minimum or maximum guidelines",
  "Salon venue compliance under audit or investigation",
  "Customer complaints regarding coupon refusal at checkout",
  "Expired or unhonored promotional terms",
  "Platform compliance and anti-fraud policy violation",
];

const OFFER_TYPES = [
  { key: "ALL", label: "All Types", icon: "🏷️" },
  { key: "SERVICE", label: "Service Specials", icon: "✂️" },
  { key: "FIRST_BOOKING", label: "First Booking", icon: "🌟" },
  { key: "COUPON", label: "Coupon Deals", icon: "🎟️" },
  { key: "COMBO", label: "Value Combos", icon: "🎁" },
  { key: "FESTIVAL", label: "Festive Offers", icon: "🎉" },
];

export default function AdminOffersManagement() {
  // Global Platform Statistics
  const [stats, setStats] = useState({
    total_offers: 0,
    active_offers: 0,
    hidden_offers: 0,
    promoted_offers: 0,
    expired_offers: 0,
    total_redemptions: 0,
    total_salons: 0,
    salons_with_offers: 0,
  });

  // Salons Directory List (Left Panel)
  const [salons, setSalons] = useState([]);
  const [salonsLoading, setSalonsLoading] = useState(true);
  const [salonSearch, setSalonSearch] = useState("");
  const [salonStatusFilter, setSalonStatusFilter] = useState("ALL");
  const [selectedSalon, setSelectedSalon] = useState(null); // null means "All Platform Salons"

  // Offers Data (Right Panel)
  const [offers, setOffers] = useState([]);
  const [offersLoading, setOffersLoading] = useState(true);

  // Filters & Sorting for Offers
  const [offerSearch, setOfferSearch] = useState("");
  const [offerTypeFilter, setOfferTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  // Modals State
  const [hideModalOffer, setHideModalOffer] = useState(null);
  const [hidePresetReason, setHidePresetReason] = useState(PRESET_HIDE_REASONS[0]);
  const [hideCustomReason, setHideCustomReason] = useState("");

  const [unhideModalOffer, setUnhideModalOffer] = useState(null);
  const [unhideReason, setUnhideReason] = useState("");

  const [inspectModalOffer, setInspectModalOffer] = useState(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  const showToast = (text, type = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3800);
  };

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    showToast(`Coupon code '${code}' copied to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // 1. Fetch Global Offer Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get("/offers/admin/stats/");
      if (res.data) setStats(res.data);
    } catch (err) {
      console.error("Error fetching admin offers stats:", err);
    }
  }, []);

  // 2. Fetch Salons Directory Summary
  const fetchSalons = useCallback(async () => {
    setSalonsLoading(true);
    try {
      const params = {};
      if (salonSearch) params.search = salonSearch;
      if (salonStatusFilter && salonStatusFilter !== "ALL") params.status = salonStatusFilter;

      const res = await api.get("/offers/admin/salons/", { params });
      setSalons(res.data?.salons || []);
    } catch (err) {
      console.error("Error fetching admin salons summary:", err);
    } finally {
      setSalonsLoading(false);
    }
  }, [salonSearch, salonStatusFilter]);

  // 3. Fetch Offers
  const fetchOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      const params = {};
      if (selectedSalon) {
        params.salon_id = selectedSalon.id;
      }
      if (offerSearch) params.search = offerSearch;
      if (offerTypeFilter && offerTypeFilter !== "ALL") params.offer_type = offerTypeFilter;
      if (statusFilter && statusFilter !== "all") params.status = statusFilter;
      if (sortBy) params.sort_by = sortBy;

      const res = await api.get("/offers/admin/offers/", { params });
      setOffers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching admin offers:", err);
      showToast("Failed to load offers. Please try again.", "error");
    } finally {
      setOffersLoading(false);
    }
  }, [selectedSalon, offerSearch, offerTypeFilter, statusFilter, sortBy]);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchSalons();
  }, [fetchStats, fetchSalons]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  // Handle Hide Offer from Platform
  const handleConfirmHide = async () => {
    if (!hideModalOffer) return;
    const finalReason = hideCustomReason.trim() || hidePresetReason;
    setActionLoading(true);
    try {
      const res = await api.post(`/offers/admin/offers/${hideModalOffer.id}/moderate/`, {
        action: "hide",
        reason: finalReason,
      });

      const updatedOffer = res.data.offer;
      setOffers((prev) =>
        prev.map((o) => (o.id === hideModalOffer.id ? { ...o, ...updatedOffer } : o))
      );

      showToast(`✓ Offer '${hideModalOffer.title}' is now hidden from platform display.`);
      setHideModalOffer(null);
      setHideCustomReason("");
      fetchStats();
      fetchSalons();
    } catch (err) {
      console.error("Error hiding offer:", err);
      showToast(err.response?.data?.error || "Failed to hide offer from platform.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Unhide / Restore Offer to Platform
  const handleConfirmUnhide = async () => {
    if (!unhideModalOffer) return;
    setActionLoading(true);
    try {
      const res = await api.post(`/offers/admin/offers/${unhideModalOffer.id}/moderate/`, {
        action: "unhide",
        reason: unhideReason.trim(),
      });

      const updatedOffer = res.data.offer;
      setOffers((prev) =>
        prev.map((o) => (o.id === unhideModalOffer.id ? { ...o, ...updatedOffer } : o))
      );

      showToast(`✓ Offer '${unhideModalOffer.title}' has been restored to platform view.`);
      setUnhideModalOffer(null);
      setUnhideReason("");
      fetchStats();
      fetchSalons();
    } catch (err) {
      console.error("Error unhiding offer:", err);
      showToast(err.response?.data?.error || "Failed to restore offer.", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Format Discount Label
  const getDiscountLabel = (offer) => {
    if (offer.discount_type === "PERCENTAGE") {
      return `${Math.round(offer.discount_value)}% OFF`;
    }
    if (offer.discount_type === "FLAT") {
      return `₹${Math.round(offer.discount_value)} FLAT OFF`;
    }
    if (offer.discount_type === "FIXED_PRICE") {
      return `₹${Math.round(offer.discount_value)} COMBO PRICE`;
    }
    return `₹${offer.discount_value} OFF`;
  };

  return (
    <div className="aom-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="aom-toast">
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Admin Sidebar Navigation */}
      <AdminSidebar activeTab="OFFERS" />

      {/* Main Container */}
      <main className="aom-main">
        {/* Sticky Header */}
        <header className="aom-header">
          <div className="aom-breadcrumb">
            <Link to="/admin/dashboard">Platform Operations</Link>
            <span className="aom-breadcrumb-separator">&gt;</span>
            <Link to="/admin/dashboard">Super Admin</Link>
            <span className="aom-breadcrumb-separator">&gt;</span>
            <span className="aom-breadcrumb-current">Offers & Promotions</span>
          </div>

          <div className="aom-header-row">
            <div className="aom-title-group">
              <h1>Salon Offers & Promotions Governance</h1>
              <p>
                Audit salon discount promotions, manage platform deals, and moderate compliance.
              </p>
            </div>

            <div className="aom-header-actions">
              <button
                type="button"
                className="aom-btn-refresh"
                onClick={() => {
                  fetchStats();
                  fetchSalons();
                  fetchOffers();
                }}
              >
                <span>🔄</span>
                <span>Refresh Data</span>
              </button>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="aom-content">
          {/* Platform Offers Statistics Row */}
          <div className="aom-stats-grid">
            <div className="aom-stat-card">
              <div className="aom-stat-icon total">
                <span>🏷️</span>
              </div>
              <div className="aom-stat-info">
                <span className="aom-stat-label">Total Platform Offers</span>
                <span className="aom-stat-val">{stats.total_offers}</span>
                <span className="aom-stat-sub">Across {stats.salons_with_offers} Salons</span>
              </div>
            </div>

            <div className="aom-stat-card">
              <div className="aom-stat-icon active">
                <span>✅</span>
              </div>
              <div className="aom-stat-info">
                <span className="aom-stat-label">Active & Redeemable</span>
                <span className="aom-stat-val">{stats.active_offers}</span>
                <span className="aom-stat-sub">Currently Valid Deals</span>
              </div>
            </div>

            <div className="aom-stat-card">
              <div className="aom-stat-icon promoted">
                <span>🌐</span>
              </div>
              <div className="aom-stat-info">
                <span className="aom-stat-label">Promoted on Platform</span>
                <span className="aom-stat-val">{stats.promoted_offers}</span>
                <span className="aom-stat-sub">Featured Deals Page</span>
              </div>
            </div>

            <div className="aom-stat-card">
              <div className="aom-stat-icon hidden">
                <span>🚨</span>
              </div>
              <div className="aom-stat-info">
                <span className="aom-stat-label">Hidden by Super Admin</span>
                <span className="aom-stat-val" style={{ color: "#b91c1c" }}>
                  {stats.hidden_offers}
                </span>
                <span className="aom-stat-sub">Compliance Suspended</span>
              </div>
            </div>

            <div className="aom-stat-card">
              <div className="aom-stat-icon redemptions">
                <span>🎟️</span>
              </div>
              <div className="aom-stat-info">
                <span className="aom-stat-label">Total Redemptions</span>
                <span className="aom-stat-val">{stats.total_redemptions}</span>
                <span className="aom-stat-sub">Customer Bookings</span>
              </div>
            </div>
          </div>

          {/* Two-Column Master Workspace */}
          <div className="aom-workspace">
            {/* --------------------------------------------------------
               LEFT PANEL: Salons Directory
               -------------------------------------------------------- */}
            <aside className="aom-salons-panel">
              <div className="aom-panel-header">
                <h2>Salons Directory</h2>
                <span className="aom-panel-badge">{salons.length} Venues</span>
              </div>

              {/* Salon Search */}
              <div className="aom-salon-search-wrap">
                <span className="aom-search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Search salons by name, city..."
                  value={salonSearch}
                  onChange={(e) => setSalonSearch(e.target.value)}
                  className="aom-salon-search-input"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="aom-status-tabs">
                <button
                  type="button"
                  className={`aom-status-tab ${salonStatusFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setSalonStatusFilter("ALL")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`aom-status-tab ${salonStatusFilter === "APPROVED" ? "active" : ""}`}
                  onClick={() => setSalonStatusFilter("APPROVED")}
                >
                  Approved
                </button>
                <button
                  type="button"
                  className={`aom-status-tab ${salonStatusFilter === "PENDING" ? "active" : ""}`}
                  onClick={() => setSalonStatusFilter("PENDING")}
                >
                  Pending
                </button>
              </div>

              {/* "All Registered Salons" Selectable Card */}
              <div
                className={`aom-all-salons-card ${selectedSalon === null ? "active" : ""}`}
                onClick={() => setSelectedSalon(null)}
              >
                <div>
                  <div className="aom-all-salons-title">All Registered Salons</div>
                  <div className="aom-all-salons-sub">Platform-wide offers overview</div>
                </div>
                <span className="aom-all-salons-badge">{stats.total_offers} Offers</span>
              </div>

              {/* Salons List */}
              <div className="aom-salons-list">
                {salonsLoading ? (
                  <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#647b6b" }}>
                    Loading salons directory...
                  </div>
                ) : salons.length === 0 ? (
                  <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#647b6b" }}>
                    No salons found matching search.
                  </div>
                ) : (
                  salons.map((salon) => {
                    const isSelected = selectedSalon?.id === salon.id;
                    return (
                      <div
                        key={salon.id}
                        className={`aom-salon-card ${isSelected ? "active" : ""}`}
                        onClick={() => setSelectedSalon(salon)}
                      >
                        {salon.cover_image ? (
                          <img
                            src={resolveImageUrl(salon.cover_image)}
                            alt={salon.name}
                            className="aom-salon-thumb"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="aom-salon-thumb-placeholder">
                            {salon.name?.[0] || "S"}
                          </div>
                        )}

                        <div className="aom-salon-info">
                          <div className="aom-salon-name" title={salon.name}>
                            {salon.name}
                          </div>
                          <div className="aom-salon-meta">
                            <span>📍 {salon.city || "Unspecified"}</span>
                            <span>•</span>
                            <span>{salon.approval_status}</span>
                          </div>
                          <div className="aom-salon-badges">
                            <span className="aom-chip-badge offers">
                              {salon.total_offers} {salon.total_offers === 1 ? "Offer" : "Offers"}
                            </span>
                            {salon.promoted_offers > 0 && (
                              <span className="aom-chip-badge promoted">
                                🌐 {salon.promoted_offers}
                              </span>
                            )}
                            {salon.hidden_offers > 0 && (
                              <span className="aom-chip-badge hidden">
                                🚨 {salon.hidden_offers} Hidden
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </aside>

            {/* --------------------------------------------------------
               RIGHT PANEL: Offers Grid & Controls
               -------------------------------------------------------- */}
            <section className="aom-offers-panel">
              {/* Selected Scope Banner */}
              <div className="aom-scope-banner">
                <div className="aom-scope-left">
                  {selectedSalon ? (
                    <>
                      {selectedSalon.cover_image ? (
                        <img
                          src={resolveImageUrl(selectedSalon.cover_image)}
                          alt={selectedSalon.name}
                          className="aom-scope-thumb"
                        />
                      ) : (
                        <div className="aom-scope-thumb-placeholder">
                          {selectedSalon.name?.[0] || "S"}
                        </div>
                      )}
                      <div className="aom-scope-details">
                        <h2>{selectedSalon.name}</h2>
                        <div className="aom-scope-meta">
                          <span>📍 {selectedSalon.city}</span>
                          <span>•</span>
                          <span>Owner: {selectedSalon.owner_email || "N/A"}</span>
                          <span>•</span>
                          <span className="aom-scope-tag">ID #{selectedSalon.id}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="aom-scope-thumb-placeholder">🏷️</div>
                      <div className="aom-scope-details">
                        <h2>All Registered Salons Offers</h2>
                        <div className="aom-scope-meta">
                          <span>Platform-wide promotion directory across all approved venues</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="aom-chip-badge offers" style={{ fontSize: "12px", padding: "6px 12px" }}>
                    Showing {offers.length} {offers.length === 1 ? "Offer" : "Offers"}
                  </span>
                </div>
              </div>

              {/* Filters & Search Toolbar */}
              <div className="aom-filter-bar">
                <div className="aom-filter-top-row">
                  {/* Search Offer Code / Title */}
                  <div className="aom-filter-search-wrap">
                    <span className="aom-search-icon">🔍</span>
                    <input
                      type="text"
                      placeholder="Search by coupon code, offer title, salon name..."
                      value={offerSearch}
                      onChange={(e) => setOfferSearch(e.target.value)}
                      className="aom-filter-search-input"
                    />
                  </div>

                  {/* Status Dropdown */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="aom-filter-select"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active Offers</option>
                    <option value="promoted">Promoted on Platform (🌐)</option>
                    <option value="hidden">Hidden by Super Admin (🚨)</option>
                    <option value="inactive">Inactive Offers</option>
                    <option value="expired">Expired Offers</option>
                  </select>

                  {/* Sort Dropdown */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="aom-filter-select"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="discount_high">Highest Discount</option>
                    <option value="discount_low">Lowest Discount</option>
                    <option value="most_used">Most Redeemed</option>
                    <option value="expiring_soon">Expiring Soonest</option>
                  </select>
                </div>

                {/* Offer Type Category Pills */}
                <div className="aom-type-pills">
                  {OFFER_TYPES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      className={`aom-type-pill ${offerTypeFilter === t.key ? "active" : ""}`}
                      onClick={() => setOfferTypeFilter(t.key)}
                    >
                      <span>{t.icon}</span>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Offers Grid */}
              {offersLoading ? (
                <div style={{ padding: "60px 0", textAlign: "center", color: "#647b6b" }}>
                  Loading offers from server...
                </div>
              ) : offers.length === 0 ? (
                <div className="aom-empty-state">
                  <div className="aom-empty-icon">🏷️</div>
                  <h3>No Offers Found</h3>
                  <p>
                    {selectedSalon
                      ? `No offers currently configured for ${selectedSalon.name} matching the selected filters.`
                      : "No offers found across registered salons matching your search and filter criteria."}
                  </p>
                  {(offerSearch || offerTypeFilter !== "ALL" || statusFilter !== "all") && (
                    <button
                      type="button"
                      className="aom-btn-refresh"
                      onClick={() => {
                        setOfferSearch("");
                        setOfferTypeFilter("ALL");
                        setStatusFilter("all");
                      }}
                      style={{ marginTop: 8 }}
                    >
                      Reset Search Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="aom-offers-grid">
                  {offers.map((offer) => (
                    <div
                      key={offer.id}
                      className={`aom-offer-card ${offer.is_hidden_by_admin ? "hidden-moderated" : ""}`}
                    >
                      {/* Card Header: Coupon Code + Discount Pill */}
                      <div className="aom-offer-card-header">
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            className="aom-code-badge"
                            onClick={() => handleCopyCode(offer.code)}
                            title="Click to copy code"
                          >
                            <span>{offer.code}</span>
                            <span>{copiedCode === offer.code ? "✓" : "📋"}</span>
                          </span>
                          <span className="aom-chip-badge offers">
                            {offer.offer_type_display || offer.offer_type}
                          </span>
                        </div>

                        <span className="aom-discount-pill">
                          {getDiscountLabel(offer)}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <div className="aom-offer-title-wrap">
                        <h3>{offer.title}</h3>
                        <p className="aom-offer-desc">
                          {offer.description || "No promotional description provided."}
                        </p>
                      </div>

                      {/* Offer Metadata Grid */}
                      <div className="aom-offer-meta-grid">
                        <div className="aom-meta-item">
                          <span className="aom-meta-label">Min Booking Spend</span>
                          <span className="aom-meta-val">
                            {offer.min_spend > 0 ? `₹${offer.min_spend}` : "None (₹0)"}
                          </span>
                        </div>

                        <div className="aom-meta-item">
                          <span className="aom-meta-label">Redemptions</span>
                          <span className="aom-meta-val">
                            {offer.usage_count} / {offer.total_usage_limit || "∞"} used
                          </span>
                        </div>

                        <div className="aom-meta-item">
                          <span className="aom-meta-label">Validity Period</span>
                          <span className="aom-meta-val">
                            {offer.start_date} → {offer.end_date}
                          </span>
                        </div>

                        <div className="aom-meta-item">
                          <span className="aom-meta-label">Max Discount Cap</span>
                          <span className="aom-meta-val">
                            {offer.max_discount_amount ? `₹${offer.max_discount_amount}` : "No Cap"}
                          </span>
                        </div>
                      </div>

                      {/* Salon Attribution (Crucial in All Salons mode) */}
                      {!selectedSalon && (
                        <div className="aom-salon-attribution">
                          <span>🏪</span>
                          <span>
                            <strong>{offer.salon_name}</strong> ({offer.salon_city})
                          </span>
                        </div>
                      )}

                      {/* Visibility & Status Indicators */}
                      <div className="aom-status-row">
                        {offer.is_active ? (
                          <span className="aom-badge active">● Active</span>
                        ) : (
                          <span className="aom-badge inactive">○ Inactive</span>
                        )}

                        {offer.show_on_platform ? (
                          <span className="aom-badge promoted">
                            🌐 Promoted on Platform Deals
                          </span>
                        ) : (
                          <span className="aom-badge direct">
                            🏪 Salon Direct Only
                          </span>
                        )}

                        {offer.is_expired && (
                          <span className="aom-badge expired">
                            ⏳ Expired
                          </span>
                        )}
                      </div>

                      {/* Super Admin Moderation Warning Banner */}
                      {offer.is_hidden_by_admin && (
                        <div className="aom-moderation-banner">
                          <div className="aom-mod-banner-title">
                            <span>🚨</span>
                            <span>Hidden from Platform by Super Admin</span>
                          </div>
                          <p className="aom-mod-banner-reason">
                            <strong>Reason:</strong> {offer.admin_hidden_reason || "Platform compliance violation."}
                          </p>
                          {offer.admin_hidden_at && (
                            <span className="aom-mod-banner-date">
                              Hidden on: {new Date(offer.admin_hidden_at).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Card Actions Toolbar */}
                      <div className="aom-card-actions">
                        <button
                          type="button"
                          className="aom-btn-inspect"
                          onClick={() => setInspectModalOffer(offer)}
                        >
                          View Details ↗
                        </button>

                        <div>
                          {offer.is_hidden_by_admin ? (
                            <button
                              type="button"
                              className="aom-btn-unhide"
                              onClick={() => setUnhideModalOffer(offer)}
                            >
                              <span>✓</span>
                              <span>Restore to Platform</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="aom-btn-hide"
                              onClick={() => {
                                setHideModalOffer(offer);
                                setHidePresetReason(PRESET_HIDE_REASONS[0]);
                                setHideCustomReason("");
                              }}
                            >
                              <span>🚫</span>
                              <span>Hide from Platform</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* --------------------------------------------------------
         MODAL 1: Hide Offer from Platform
         -------------------------------------------------------- */}
      {hideModalOffer && (
        <div className="aom-modal-backdrop" onClick={() => setHideModalOffer(null)}>
          <div className="aom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aom-modal-header">
              <div>
                <h3 style={{ color: "#991b1b" }}>Hide Offer from Platform</h3>
                <span style={{ fontSize: "12px", color: "#647b6b" }}>
                  Super Admin Moderation Action
                </span>
              </div>
              <button
                type="button"
                className="aom-modal-close"
                onClick={() => setHideModalOffer(null)}
              >
                ✕
              </button>
            </div>

            <div className="aom-modal-body">
              {/* Offer Summary Preview */}
              <div className="aom-modal-offer-preview">
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#172a1d" }}>
                    {hideModalOffer.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#647b6b", marginTop: 2 }}>
                    Code: <strong>{hideModalOffer.code}</strong> • Salon:{" "}
                    <strong>{hideModalOffer.salon_name}</strong>
                  </div>
                </div>
                <span className="aom-discount-pill">
                  {getDiscountLabel(hideModalOffer)}
                </span>
              </div>

              {/* Warning Notice */}
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fef3c7",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  fontSize: "12px",
                  color: "#92400e",
                  lineHeight: 1.5,
                }}
              >
                ⚠️ <strong>Platform Moderation:</strong> Hiding this offer will immediately remove it from public platform deals, salon storefronts, and customer checkout. Salon owners will see an admin compliance notice and cannot override it until you restore it.
              </div>

              {/* Preset Reasons */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#273e30", display: "block", marginBottom: 8 }}>
                  Select Moderation Reason *
                </label>
                <div className="aom-preset-reasons">
                  {PRESET_HIDE_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      className={`aom-preset-reason-btn ${hidePresetReason === reason ? "active" : ""}`}
                      onClick={() => setHidePresetReason(reason)}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Reason / Notes */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#273e30", display: "block", marginBottom: 6 }}>
                  Additional Audit Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide specific compliance details or notes for audit history..."
                  value={hideCustomReason}
                  onChange={(e) => setHideCustomReason(e.target.value)}
                  className="aom-modal-textarea"
                />
              </div>
            </div>

            <div className="aom-modal-footer">
              <button
                type="button"
                className="aom-modal-btn-cancel"
                onClick={() => setHideModalOffer(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aom-modal-btn-confirm-hide"
                onClick={handleConfirmHide}
                disabled={actionLoading}
              >
                {actionLoading ? "Hiding Offer..." : "Confirm Hide from Platform"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
         MODAL 2: Unhide / Restore Offer to Platform
         -------------------------------------------------------- */}
      {unhideModalOffer && (
        <div className="aom-modal-backdrop" onClick={() => setUnhideModalOffer(null)}>
          <div className="aom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="aom-modal-header">
              <div>
                <h3 style={{ color: "#166534" }}>Restore Offer to Platform</h3>
                <span style={{ fontSize: "12px", color: "#647b6b" }}>
                  Super Admin Reinstatement
                </span>
              </div>
              <button
                type="button"
                className="aom-modal-close"
                onClick={() => setUnhideModalOffer(null)}
              >
                ✕
              </button>
            </div>

            <div className="aom-modal-body">
              <div className="aom-modal-offer-preview">
                <div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#172a1d" }}>
                    {unhideModalOffer.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#647b6b", marginTop: 2 }}>
                    Code: <strong>{unhideModalOffer.code}</strong> • Salon:{" "}
                    <strong>{unhideModalOffer.salon_name}</strong>
                  </div>
                </div>
                <span className="aom-discount-pill">
                  {getDiscountLabel(unhideModalOffer)}
                </span>
              </div>

              <p style={{ fontSize: "13px", color: "#273e30", margin: 0, lineHeight: 1.5 }}>
                Restoring this offer will lift the Super Admin moderation hold. The offer will once again be visible to customers and eligible for bookings if active and within its valid date range.
              </p>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#273e30", display: "block", marginBottom: 6 }}>
                  Restoration Audit Note (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Salon owner updated promotional terms to comply with platform guidelines..."
                  value={unhideReason}
                  onChange={(e) => setUnhideReason(e.target.value)}
                  className="aom-modal-textarea"
                />
              </div>
            </div>

            <div className="aom-modal-footer">
              <button
                type="button"
                className="aom-modal-btn-cancel"
                onClick={() => setUnhideModalOffer(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="aom-modal-btn-confirm-unhide"
                onClick={handleConfirmUnhide}
                disabled={actionLoading}
              >
                {actionLoading ? "Restoring..." : "✓ Confirm Restore to Platform"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------
         MODAL 3: Full Offer Details Inspection
         -------------------------------------------------------- */}
      {inspectModalOffer && (
        <div className="aom-modal-backdrop" onClick={() => setInspectModalOffer(null)}>
          <div className="aom-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="aom-modal-header">
              <div>
                <h3>Offer Inspection & Details</h3>
                <span style={{ fontSize: "12px", color: "#647b6b" }}>
                  ID #{inspectModalOffer.id} • Created{" "}
                  {new Date(inspectModalOffer.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                className="aom-modal-close"
                onClick={() => setInspectModalOffer(null)}
              >
                ✕
              </button>
            </div>

            <div className="aom-modal-body">
              {/* Header Box */}
              <div className="aom-modal-offer-preview">
                <div>
                  <span className="aom-code-badge" style={{ fontSize: "14px" }}>
                    {inspectModalOffer.code}
                  </span>
                  <h4 style={{ margin: "6px 0 2px", fontSize: "16px", color: "#172a1d" }}>
                    {inspectModalOffer.title}
                  </h4>
                  <div style={{ fontSize: "12px", color: "#647b6b" }}>
                    Salon: <strong>{inspectModalOffer.salon_name}</strong> ({inspectModalOffer.salon_city})
                  </div>
                </div>
                <span className="aom-discount-pill" style={{ fontSize: "13px" }}>
                  {getDiscountLabel(inspectModalOffer)}
                </span>
              </div>

              {/* Description */}
              {inspectModalOffer.description && (
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#708477" }}>
                    Description
                  </span>
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#273e30", lineHeight: 1.5 }}>
                    {inspectModalOffer.description}
                  </p>
                </div>
              )}

              {/* Grid of Details */}
              <div className="aom-offer-meta-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">Offer Type</span>
                  <span className="aom-meta-val">{inspectModalOffer.offer_type_display}</span>
                </div>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">Customer Eligibility</span>
                  <span className="aom-meta-val">{inspectModalOffer.customer_eligibility}</span>
                </div>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">Redemption Limit</span>
                  <span className="aom-meta-val">
                    {inspectModalOffer.per_customer_limit || 1} per customer
                  </span>
                </div>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">Total Redemptions</span>
                  <span className="aom-meta-val">
                    {inspectModalOffer.usage_count} / {inspectModalOffer.total_usage_limit || "Unlimited"}
                  </span>
                </div>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">Start Date</span>
                  <span className="aom-meta-val">{inspectModalOffer.start_date}</span>
                </div>
                <div className="aom-meta-item">
                  <span className="aom-meta-label">End Date</span>
                  <span className="aom-meta-val">{inspectModalOffer.end_date}</span>
                </div>
              </div>

              {/* Applicable Services */}
              <div>
                <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#708477", display: "block", marginBottom: 6 }}>
                  Applicable Services
                </span>
                {inspectModalOffer.apply_to_all_services ? (
                  <span className="aom-chip-badge offers" style={{ fontSize: "12px", padding: "4px 10px" }}>
                    ✓ Applies to All Services of this Salon
                  </span>
                ) : Array.isArray(inspectModalOffer.services_detail) &&
                  inspectModalOffer.services_detail.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {inspectModalOffer.services_detail.map((s) => (
                      <span
                        key={s.id}
                        className="aom-chip-badge offers"
                        style={{ fontSize: "12px", padding: "4px 10px" }}
                      >
                        {s.name} (₹{s.price})
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: "#647b6b" }}>
                    No specific services attached.
                  </span>
                )}
              </div>

              {/* Terms and Conditions */}
              {inspectModalOffer.terms_and_conditions && (
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#708477" }}>
                    Terms & Conditions
                  </span>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#47594d", background: "#f8faf9", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e3ebe5" }}>
                    {inspectModalOffer.terms_and_conditions}
                  </p>
                </div>
              )}

              {/* Moderation Status if hidden */}
              {inspectModalOffer.is_hidden_by_admin && (
                <div className="aom-moderation-banner">
                  <div className="aom-mod-banner-title">
                    <span>🚨</span>
                    <span>Admin Moderation Record</span>
                  </div>
                  <p className="aom-mod-banner-reason">
                    <strong>Reason:</strong> {inspectModalOffer.admin_hidden_reason}
                  </p>
                  {inspectModalOffer.admin_hidden_at && (
                    <span className="aom-mod-banner-date">
                      Hidden on: {new Date(inspectModalOffer.admin_hidden_at).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="aom-modal-footer">
              <button
                type="button"
                className="aom-modal-btn-cancel"
                onClick={() => setInspectModalOffer(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


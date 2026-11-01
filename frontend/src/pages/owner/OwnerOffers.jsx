import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerOffers.css";

const DAYS_OF_WEEK = [
  { key: "MON", label: "Mon" },
  { key: "TUE", label: "Tue" },
  { key: "WED", label: "Wed" },
  { key: "THU", label: "Thu" },
  { key: "FRI", label: "Fri" },
  { key: "SAT", label: "Sat" },
  { key: "SUN", label: "Sun" },
];

const OFFER_TYPES = [
  {
    key: "SERVICE",
    label: "Service-specific Offer",
    badgeClass: "service",
    icon: "✂️",
    desc: "Discounts on selected services using percentage or flat amount.",
  },
  {
    key: "FIRST_BOOKING",
    label: "First-booking Offer",
    badgeClass: "first_booking",
    icon: "🌟",
    desc: "Special discount for new customers making their first booking.",
  },
  {
    key: "COUPON",
    label: "Coupon Code Offer",
    badgeClass: "coupon",
    icon: "🎟️",
    desc: "Customers apply a custom promo code during booking.",
  },
  {
    key: "COMBO",
    label: "Combo Offer",
    badgeClass: "combo",
    icon: "🎁",
    desc: "Bundle 2+ services with % off, flat off, or fixed combo price.",
  },
  {
    key: "FESTIVAL",
    label: "Festival Offer",
    badgeClass: "festival",
    icon: "🎉",
    desc: "Special seasonal occasion offers (e.g. 25% off Onam, Diwali Special).",
  },
];

const generateRandomCouponCode = (type = "SERVICE") => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  let prefix = "DEAL";
  if (type === "COMBO") prefix = "COMBO";
  else if (type === "FESTIVAL") prefix = "FEST";
  else if (type === "FIRST_BOOKING") prefix = "FIRST";
  else if (type === "COUPON") prefix = "PROMO";
  return `${prefix}-${result}`;
};

export default function OwnerOffers() {
  const [salonInfo, setSalonInfo] = useState({ id: null, name: "Salon" });
  const [offersList, setOffersList] = useState([]);
  const [salonServices, setSalonServices] = useState([]);
  const [stats, setStats] = useState({
    total_offers: 0,
    active_offers: 0,
    promoted_offers: 0,
    max_promoted_allowed: 3,
    total_redemptions: 0,
    total_discount_given: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState("");

  // Filters
  const [activeTab, setActiveTab] = useState("all"); // "all" | "active" | "promoted" | "expired"
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // "create" | "edit"
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formOfferType, setFormOfferType] = useState("SERVICE");
  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState("PERCENTAGE"); // "PERCENTAGE" | "FLAT" | "FIXED_PRICE"
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formMaxDiscount, setFormMaxDiscount] = useState("");
  const [formMinSpend, setFormMinSpend] = useState("0");
  const [formCustomerEligibility, setFormCustomerEligibility] = useState("ALL"); // "ALL" | "FIRST_TIME"
  const [formApplyToAll, setFormApplyToAll] = useState(false);
  const [formSelectedServices, setFormSelectedServices] = useState([]);
  const [formTotalLimit, setFormTotalLimit] = useState("");
  const [formPerCustomerLimit, setFormPerCustomerLimit] = useState("1");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formApplicableDays, setFormApplicableDays] = useState([]);
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formTerms, setFormTerms] = useState("");
  const [formShowOnPlatform, setFormShowOnPlatform] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);

  // Redemptions Modal State
  const [redemptionsModalOpen, setRedemptionsModalOpen] = useState(false);
  const [activeRedemptionsOffer, setActiveRedemptionsOffer] = useState(null);
  const [redemptionsList, setRedemptionsList] = useState([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);

  // Delete Confirm Modal State
  const [deleteConfirmOffer, setDeleteConfirmOffer] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Fetch Owner Offers & Salon Services
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [offersRes, servicesRes] = await Promise.all([
        api.get("/offers/owner/"),
        api.get("/services/owner/services/"),
      ]);

      if (offersRes.data) {
        if (offersRes.data.salon) {
          setSalonInfo(offersRes.data.salon);
        }
        if (offersRes.data.stats) {
          setStats(offersRes.data.stats);
        }
        if (Array.isArray(offersRes.data.offers)) {
          setOffersList(offersRes.data.offers);
        }
      }

      if (servicesRes.data && Array.isArray(servicesRes.data.services)) {
        setSalonServices(servicesRes.data.services);
      }
    } catch (err) {
      console.error("Failed to load offers:", err);
      showToast("Could not load offers data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setModalMode("create");
    setEditingOfferId(null);
    setFormError("");

    const todayStr = new Date().toISOString().split("T")[0];
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    const endStr = nextMonth.toISOString().split("T")[0];

    setFormTitle("");
    setFormDescription("");
    setFormOfferType("SERVICE");
    setFormCode(generateRandomCouponCode("SERVICE"));
    setFormDiscountType("PERCENTAGE");
    setFormDiscountValue("");
    setFormMaxDiscount("");
    setFormMinSpend("0");
    setFormCustomerEligibility("ALL");
    setFormApplyToAll(false);
    setFormSelectedServices([]);
    setFormTotalLimit("");
    setFormPerCustomerLimit("1");
    setFormStartDate(todayStr);
    setFormEndDate(endStr);
    setFormApplicableDays([]);
    setFormStartTime("");
    setFormEndTime("");
    setFormTerms("Valid for online or in-salon appointments during the promotional period.");
    setFormShowOnPlatform(stats.promoted_offers < 3);
    setFormIsActive(true);

    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (offer) => {
    setModalMode("edit");
    setEditingOfferId(offer.id);
    setFormError("");

    setFormTitle(offer.title || "");
    setFormDescription(offer.description || "");
    setFormOfferType(offer.offer_type || "SERVICE");
    setFormCode(offer.code || generateRandomCouponCode(offer.offer_type || "SERVICE"));
    setFormDiscountType(offer.discount_type || "PERCENTAGE");
    setFormDiscountValue(offer.discount_value ? String(offer.discount_value) : "");
    setFormMaxDiscount(offer.max_discount_amount ? String(offer.max_discount_amount) : "");
    setFormMinSpend(offer.min_spend ? String(offer.min_spend) : "0");
    setFormCustomerEligibility(offer.customer_eligibility || "ALL");
    setFormApplyToAll(Boolean(offer.apply_to_all_services));
    setFormSelectedServices(Array.isArray(offer.services) ? offer.services : []);
    setFormTotalLimit(offer.total_usage_limit ? String(offer.total_usage_limit) : "");
    setFormPerCustomerLimit(offer.per_customer_limit ? String(offer.per_customer_limit) : "1");
    setFormStartDate(offer.start_date || "");
    setFormEndDate(offer.end_date || "");
    setFormApplicableDays(Array.isArray(offer.applicable_days) ? offer.applicable_days : []);
    setFormStartTime(offer.start_time || "");
    setFormEndTime(offer.end_time || "");
    setFormTerms(offer.terms_and_conditions || "");
    setFormShowOnPlatform(Boolean(offer.show_on_platform));
    setFormIsActive(Boolean(offer.is_active));

    setIsModalOpen(true);
  };

  // Preset configuration when switching offer type in create modal
  const handleOfferTypeChange = (type) => {
    setFormOfferType(type);
    if (modalMode === "create") {
      setFormCode(generateRandomCouponCode(type));
    }
    if (type === "FIRST_BOOKING") {
      setFormCustomerEligibility("FIRST_TIME");
      setFormApplyToAll(true);
    } else if (type === "COMBO") {
      setFormApplyToAll(false);
      setFormDiscountType("FIXED_PRICE");
      if (salonServices.length >= 2 && formSelectedServices.length < 2) {
        setFormSelectedServices([salonServices[0].id, salonServices[1].id]);
      }
    } else if (type === "FESTIVAL") {
      if (!formTitle) setFormTitle("Festival Special");
      setFormDiscountType("PERCENTAGE");
      setFormDiscountValue("25");
    } else if (type === "SERVICE") {
      if (formDiscountType === "FIXED_PRICE") setFormDiscountType("PERCENTAGE");
    }
  };

  // Toggle day selection
  const handleToggleDay = (dayKey) => {
    if (formApplicableDays.includes(dayKey)) {
      setFormApplicableDays(formApplicableDays.filter((d) => d !== dayKey));
    } else {
      setFormApplicableDays([...formApplicableDays, dayKey]);
    }
  };

  // Toggle service selection
  const handleToggleService = (svcId) => {
    if (formSelectedServices.includes(svcId)) {
      setFormSelectedServices(formSelectedServices.filter((id) => id !== svcId));
    } else {
      setFormSelectedServices([...formSelectedServices, svcId]);
    }
  };

  // Selected services sum for combo pricing calculation preview
  const comboServicesTotal = useMemo(() => {
    if (!formSelectedServices.length) return 0;
    return salonServices
      .filter((s) => formSelectedServices.includes(s.id))
      .reduce((sum, s) => sum + parseFloat(s.price || 0), 0);
  }, [formSelectedServices, salonServices]);

  // Form Submit Handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!formTitle.trim()) {
      setFormError("Please enter an offer title.");
      return;
    }

    const val = parseFloat(formDiscountValue);
    if (isNaN(val) || val <= 0) {
      setFormError("Discount value must be a positive number greater than 0 and cannot be negative.");
      return;
    }

    if (formDiscountType === "PERCENTAGE" && val > 100) {
      setFormError("Percentage discount cannot exceed 100%.");
      return;
    }

    if (formMaxDiscount && formMaxDiscount.trim() !== "") {
      const maxCap = parseFloat(formMaxDiscount);
      if (isNaN(maxCap) || maxCap <= 0) {
        setFormError("Maximum discount cap must be greater than ₹0 and cannot be negative.");
        return;
      }
    }

    if (formMinSpend && formMinSpend.trim() !== "") {
      const minSpendVal = parseFloat(formMinSpend);
      if (isNaN(minSpendVal) || minSpendVal < 0) {
        setFormError("Minimum booking spend cannot be negative.");
        return;
      }
    }

    if (formOfferType === "COMBO") {
      if (formSelectedServices.length < 2) {
        setFormError("Combo offers require combining at least 2 services.");
        return;
      }
      if (formDiscountType === "FIXED_PRICE") {
        if (val <= 0) {
          setFormError("Fixed combo price must be greater than ₹0.");
          return;
        }
        if (comboServicesTotal > 0 && val >= comboServicesTotal) {
          setFormError(
            `Fixed combo price (₹${val}) must be lower than the combined services total (₹${comboServicesTotal}) so clients receive an actual discount.`
          );
          return;
        }
      }
    }

    if (formTotalLimit && formTotalLimit.trim() !== "") {
      const totalLimitVal = parseInt(formTotalLimit, 10);
      if (isNaN(totalLimitVal) || totalLimitVal < 1) {
        setFormError("Total redemptions limit must be at least 1 and cannot be negative.");
        return;
      }
    }

    if (formPerCustomerLimit && formPerCustomerLimit.trim() !== "") {
      const perCustVal = parseInt(formPerCustomerLimit, 10);
      if (isNaN(perCustVal) || perCustVal < 1) {
        setFormError("Per-customer limit must be at least 1 and cannot be negative.");
        return;
      }
    }

    if (!formStartDate || !formEndDate) {
      setFormError("Please select both start and end validity dates.");
      return;
    }

    if (formStartDate > formEndDate) {
      setFormError("End date cannot be earlier than start date.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (formEndDate < todayStr) {
      setFormError("End date cannot be in the past.");
      return;
    }

    // Check platform promotion limit client-side before sending
    if (formShowOnPlatform && formIsActive) {
      const alreadyPromoted = offersList.filter(
        (o) => o.show_on_platform && o.is_active && o.id !== editingOfferId
      ).length;
      if (alreadyPromoted >= 3) {
        setFormError("Limit reached: You can promote a maximum of 3 active offers on the BookMySalon platform at a time. Please uncheck 'Show on BookMySalon Platform' or remove promotion from another offer.");
        return;
      }
    }

    // Auto-generate random coupon code if none was entered
    const finalCode = formCode.trim().toUpperCase() || generateRandomCouponCode(formOfferType);

    const payload = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      offer_type: formOfferType,
      code: finalCode,
      discount_type: formDiscountType,
      discount_value: formDiscountValue,
      max_discount_amount: formMaxDiscount && formMaxDiscount.trim() ? formMaxDiscount.trim() : null,
      min_spend: formMinSpend.trim() || "0",
      customer_eligibility: formCustomerEligibility,
      apply_to_all_services: formOfferType === "COMBO" ? false : formApplyToAll,
      service_ids: formSelectedServices,
      total_usage_limit: formTotalLimit && formTotalLimit.trim() ? parseInt(formTotalLimit, 10) : null,
      per_customer_limit: formPerCustomerLimit && formPerCustomerLimit.trim() ? parseInt(formPerCustomerLimit, 10) : 1,
      start_date: formStartDate,
      end_date: formEndDate,
      applicable_days: formApplicableDays,
      start_time: formStartTime || null,
      end_time: formEndTime || null,
      terms_and_conditions: formTerms.trim(),
      show_on_platform: formShowOnPlatform,
      is_active: formIsActive,
    };

    setSubmitting(true);
    try {
      if (modalMode === "create") {
        await api.post("/offers/owner/", payload);
        showToast("Offer created successfully! 🎉");
      } else {
        await api.put(`/offers/owner/${editingOfferId}/`, payload);
        showToast("Offer updated successfully! ✨");
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      console.error("Error saving offer:", err);
      const data = err.response?.data;
      if (data?.show_on_platform) {
        setFormError(Array.isArray(data.show_on_platform) ? data.show_on_platform[0] : data.show_on_platform);
      } else if (data?.error) {
        setFormError(typeof data.error === "object" ? JSON.stringify(data.error) : data.error);
      } else {
        setFormError("Failed to save offer. Please check all required fields.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Toggle Active
  const handleToggleActive = async (offer) => {
    try {
      const res = await api.patch(`/offers/owner/${offer.id}/toggle-active/`);
      if (res.data?.offer) {
        setOffersList((prev) =>
          prev.map((o) => (o.id === offer.id ? res.data.offer : o))
        );
        showToast(res.data.message || "Offer status updated.");
        fetchData();
      }
    } catch (err) {
      console.error("Toggle active failed:", err);
      showToast("Could not update offer status.");
    }
  };

  // Quick Toggle Platform Promotion
  const handleTogglePlatform = async (offer) => {
    // If currently false and already 3 promoted, warn user
    if (!offer.show_on_platform && stats.promoted_offers >= 3) {
      showToast("Limit reached: Maximum 3 active offers can be promoted on the platform at a time.");
      return;
    }

    try {
      const res = await api.patch(`/offers/owner/${offer.id}/toggle-platform/`);
      if (res.data?.offer) {
        setOffersList((prev) =>
          prev.map((o) => (o.id === offer.id ? res.data.offer : o))
        );
        showToast(res.data.message || "Platform promotion updated.");
        fetchData();
      }
    } catch (err) {
      const msg = err.response?.data?.error || "Could not toggle platform promotion.";
      showToast(msg);
    }
  };

  // Open Redemptions Modal
  const handleViewRedemptions = async (offer) => {
    setActiveRedemptionsOffer(offer);
    setRedemptionsModalOpen(true);
    setLoadingRedemptions(true);
    try {
      const res = await api.get(`/offers/owner/redemptions/?offer_id=${offer.id}`);
      if (Array.isArray(res.data)) {
        setRedemptionsList(res.data);
      }
    } catch (err) {
      console.error("Failed to load redemptions:", err);
      showToast("Could not load redemption history.");
    } finally {
      setLoadingRedemptions(false);
    }
  };

  // Delete Offer
  const handleConfirmDelete = async () => {
    if (!deleteConfirmOffer) return;
    setDeleting(true);
    try {
      const res = await api.delete(`/offers/owner/${deleteConfirmOffer.id}/`);
      showToast(res.data?.message || "Offer removed.");
      setDeleteConfirmOffer(null);
      fetchData();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Could not delete offer.");
    } finally {
      setDeleting(false);
    }
  };

  // Filtered offers list
  const filteredOffers = useMemo(() => {
    return offersList.filter((offer) => {
      // Tab filter
      if (activeTab === "active" && !offer.is_active) return false;
      if (activeTab === "promoted" && (!offer.show_on_platform || !offer.is_active)) return false;
      if (activeTab === "expired" && !offer.is_expired && !offer.is_exhausted && offer.is_active) return false;

      // Type filter
      if (typeFilter !== "all" && offer.offer_type !== typeFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = offer.title?.toLowerCase().includes(q);
        const matchesCode = offer.code?.toLowerCase().includes(q);
        const matchesDesc = offer.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [offersList, activeTab, typeFilter, searchQuery]);

  return (
    <div className="oo-page-wrapper">
      <OwnerNavbarHeader salonInfo={salonInfo} />
      <OwnerNavbar activeTab="Offers" />

      <main className="oo-main-container">
        {/* Breadcrumb */}
        <div className="oo-breadcrumb">
          <Link to="/owner/dashboard" className="oo-breadcrumb-link">
            Owner Dashboard
          </Link>
          <span>/</span>
          <span className="oo-breadcrumb-active">Offers & Promotions</span>
        </div>

        {/* Header */}
        <div className="oo-header">
          <div className="oo-title-area">
            <h1>Offer Management System</h1>
            <p className="oo-subtitle">
              Create, manage, and promote service discounts, combos, coupons, and festive specials for {salonInfo.name}.
            </p>
          </div>

          <div className="oo-header-actions">
            <button
              type="button"
              className="oo-btn-primary"
              onClick={handleOpenCreateModal}
            >
              <span>✨</span>
              Create New Offer
            </button>
          </div>
        </div>

        {/* KPI Stats Grid */}
        <div className="oo-stats-grid">
          <div className="oo-stat-card">
            <div className="oo-stat-icon total">🏷️</div>
            <div className="oo-stat-info">
              <span className="oo-stat-label">Total Offers</span>
              <span className="oo-stat-value">{stats.total_offers}</span>
              <span className="oo-stat-subtext">Configured deals</span>
            </div>
          </div>

          <div className="oo-stat-card">
            <div className="oo-stat-icon active">🟢</div>
            <div className="oo-stat-info">
              <span className="oo-stat-label">Active Offers</span>
              <span className="oo-stat-value">{stats.active_offers}</span>
              <span className="oo-stat-subtext">Currently valid</span>
            </div>
          </div>

          <div className="oo-stat-card">
            <div className="oo-stat-icon promoted">📢</div>
            <div className="oo-stat-info">
              <span className="oo-stat-label">Promoted on Platform</span>
              <span className="oo-stat-value">
                {stats.promoted_offers} / {stats.max_promoted_allowed}
              </span>
              <span className="oo-stat-subtext">
                {stats.promoted_offers >= 3 ? "Maximum slots in use" : `${3 - stats.promoted_offers} platform slots free`}
              </span>
            </div>
          </div>

          <div className="oo-stat-card">
            <div className="oo-stat-icon redemptions">👥</div>
            <div className="oo-stat-info">
              <span className="oo-stat-label">Total Redemptions</span>
              <span className="oo-stat-value">{stats.total_redemptions}</span>
              <span className="oo-stat-subtext">Customer bookings</span>
            </div>
          </div>

          <div className="oo-stat-card">
            <div className="oo-stat-icon discount">💰</div>
            <div className="oo-stat-info">
              <span className="oo-stat-label">Discounts Saved</span>
              <span className="oo-stat-value">₹{Math.round(stats.total_discount_given).toLocaleString("en-IN")}</span>
              <span className="oo-stat-subtext">Customer savings</span>
            </div>
          </div>
        </div>

        {/* Platform Promotion Policy Notice */}
        <div className="oo-platform-notice">
          <div className="oo-platform-notice-text">
            <span style={{ fontSize: "1.4rem" }}>🌟</span>
            <div>
              <strong>Show on BookMySalon Platform:</strong> You can independently promote up to <strong>3 active featured offers</strong> directly on the customer homepage and dedicated deals page without requiring admin approval.
            </div>
          </div>
          <span className="oo-platform-pill">
            {stats.promoted_offers} of 3 featured
          </span>
        </div>

        {/* Controls & Filter Bar */}
        <div className="oo-controls-bar">
          <div className="oo-tabs">
            <button
              type="button"
              className={`oo-tab-btn ${activeTab === "all" ? "active" : ""}`}
              onClick={() => setActiveTab("all")}
            >
              All Offers ({offersList.length})
            </button>
            <button
              type="button"
              className={`oo-tab-btn ${activeTab === "active" ? "active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active ({offersList.filter((o) => o.is_active).length})
            </button>
            <button
              type="button"
              className={`oo-tab-btn ${activeTab === "promoted" ? "active" : ""}`}
              onClick={() => setActiveTab("promoted")}
            >
              Promoted on Platform ({stats.promoted_offers})
            </button>
            <button
              type="button"
              className={`oo-tab-btn ${activeTab === "expired" ? "active" : ""}`}
              onClick={() => setActiveTab("expired")}
            >
              Expired / Inactive
            </button>
          </div>

          <div className="oo-filter-group">
            <div className="oo-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search offer title or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="oo-type-select"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Offer Types</option>
              {OFFER_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Offers Grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <p>Loading salon offers and promotions...</p>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="oo-empty-state">
            <div className="oo-empty-icon">🏷️</div>
            <h3>No Offers Found</h3>
            <p>
              {offersList.length === 0
                ? "You haven't created any promotional offers yet. Create your first service discount, combo bundle, or coupon code to attract more clients!"
                : "No offers match your current filter criteria."}
            </p>
            <button
              type="button"
              className="oo-btn-primary"
              onClick={handleOpenCreateModal}
            >
              ✨ Create Offer Now
            </button>
          </div>
        ) : (
          <div className="oo-offers-grid">
            {filteredOffers.map((offer) => {
              const typeMeta = OFFER_TYPES.find((t) => t.key === offer.offer_type) || OFFER_TYPES[0];
              return (
                <div
                  key={offer.id}
                  className={`oo-offer-card ${offer.show_on_platform ? "is-promoted" : ""} ${!offer.is_active ? "is-inactive" : ""}`}
                >
                  {/* Promoted Ribbon */}
                  {offer.show_on_platform && offer.is_active && (
                    <div className="oo-promoted-ribbon">
                      <span>⭐</span> Promoted on BookMySalon Platform
                    </div>
                  )}

                  {/* Card Head */}
                  <div className="oo-card-head">
                    <div className="oo-offer-badge-row">
                      <span className={`oo-badge-type ${typeMeta.badgeClass}`}>
                        {typeMeta.icon} {typeMeta.label}
                      </span>
                      <span
                        className={`oo-badge-status ${
                          offer.is_expired
                            ? "expired"
                            : offer.is_active
                            ? "active"
                            : "inactive"
                        }`}
                      >
                        {offer.is_expired
                          ? "Expired"
                          : offer.is_exhausted
                          ? "Limit Reached"
                          : offer.is_active
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <div className="oo-card-actions-menu">
                      <button
                        type="button"
                        className="oo-icon-btn"
                        title="View Redemptions"
                        onClick={() => handleViewRedemptions(offer)}
                      >
                        📊
                      </button>
                      <button
                        type="button"
                        className="oo-icon-btn"
                        title="Edit Offer"
                        onClick={() => handleOpenEditModal(offer)}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="oo-icon-btn delete"
                        title="Delete or Archive Offer"
                        onClick={() => setDeleteConfirmOffer(offer)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="oo-card-body">
                    <h3 className="oo-card-title">{offer.title}</h3>
                    {offer.description && (
                      <p className="oo-card-desc">{offer.description}</p>
                    )}

                    {/* Discount Highlight */}
                    <div className="oo-discount-box">
                      <div className="oo-discount-main">
                        <span className="oo-discount-number">
                          {offer.discount_type === "FIXED_PRICE"
                            ? `₹${parseFloat(offer.discount_value)}`
                            : offer.discount_type === "PERCENTAGE"
                            ? `${parseFloat(offer.discount_value)}%`
                            : `₹${parseFloat(offer.discount_value)}`}
                        </span>
                        <span className="oo-discount-label">
                          {offer.discount_type === "FIXED_PRICE"
                            ? "Combo Price"
                            : offer.discount_type === "PERCENTAGE"
                            ? "OFF"
                            : "FLAT OFF"}
                        </span>
                      </div>

                      {offer.code && (
                        <div className="oo-discount-code" title="Promo code for customer checkout">
                          {offer.code}
                        </div>
                      )}
                    </div>

                    {/* Combo Services Tags */}
                    {offer.offer_type === "COMBO" && offer.services_detail?.length > 0 && (
                      <div className="oo-combo-tags">
                        <span className="oo-combo-label">Bundled Services ({offer.services_detail.length}):</span>
                        <div className="oo-combo-pills">
                          {offer.services_detail.map((s) => (
                            <span key={s.id} className="oo-combo-pill">
                              ✓ {s.name} (₹{s.price})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Service specific tags */}
                    {offer.offer_type === "SERVICE" && !offer.apply_to_all_services && offer.services_detail?.length > 0 && (
                      <div className="oo-combo-tags">
                        <span className="oo-combo-label">Applies to ({offer.services_detail.length}):</span>
                        <div className="oo-combo-pills">
                          {offer.services_detail.map((s) => (
                            <span key={s.id} className="oo-combo-pill">
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Details list */}
                    <div className="oo-details-list">
                      {parseFloat(offer.min_spend) > 0 && (
                        <div className="oo-detail-item">
                          <span>💵</span>
                          <span>Min booking spend: ₹{parseFloat(offer.min_spend)}</span>
                        </div>
                      )}

                      {offer.max_discount_amount && (
                        <div className="oo-detail-item">
                          <span>🛡️</span>
                          <span>Max discount cap: ₹{parseFloat(offer.max_discount_amount)}</span>
                        </div>
                      )}

                      <div className="oo-detail-item">
                        <span>👥</span>
                        <span>
                          {offer.customer_eligibility === "FIRST_TIME"
                            ? "First-time customers only"
                            : "Eligible for all customers"}
                        </span>
                      </div>

                      <div className="oo-detail-item">
                        <span>📅</span>
                        <span>
                          Valid: {offer.start_date} to {offer.end_date}
                        </span>
                      </div>

                      {offer.applicable_days?.length > 0 && (
                        <div className="oo-detail-item">
                          <span>🗓️</span>
                          <span>Days: {offer.applicable_days.join(", ")}</span>
                        </div>
                      )}

                      <div className="oo-detail-item">
                        <span>📈</span>
                        <span>
                          Usage: {offer.usage_count} redemptions
                          {offer.total_usage_limit ? ` / ${offer.total_usage_limit} limit` : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Toggles */}
                  <div className="oo-card-footer">
                    {/* Active Toggle */}
                    <label className="oo-toggle-label">
                      <div className="oo-toggle-switch">
                        <input
                          type="checkbox"
                          checked={offer.is_active}
                          onChange={() => handleToggleActive(offer)}
                        />
                        <span className="oo-toggle-slider" />
                      </div>
                      <span>{offer.is_active ? "Active" : "Paused"}</span>
                    </label>

                    {/* Platform Promotion Toggle */}
                    <label
                      className="oo-toggle-label"
                      title="Promote on BookMySalon homepage and dedicated deals page"
                    >
                      <div className="oo-toggle-switch">
                        <input
                          type="checkbox"
                          checked={offer.show_on_platform && offer.is_active}
                          disabled={!offer.is_active || offer.is_expired}
                          onChange={() => handleTogglePlatform(offer)}
                        />
                        <span className="oo-toggle-slider platform" />
                      </div>
                      <span style={{ color: offer.show_on_platform ? "#854d0e" : "#64748b" }}>
                        {offer.show_on_platform ? "Featured ⭐" : "Promote"}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Create / Edit Offer Modal */}
      {isModalOpen && (
        <div className="oo-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="oo-modal-container large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="oo-modal-head">
              <h2>{modalMode === "create" ? "Create New Promotional Offer" : "Edit Offer Details"}</h2>
              <button
                type="button"
                className="oo-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form className="oo-modal-form" onSubmit={handleFormSubmit}>
              <div className="oo-modal-body">
                {formError && <div className="oo-modal-alert">⚠️ {formError}</div>}

                {/* Offer Type Selection (Create only) */}
                <div className="oo-form-group">
                  <label className="oo-form-label">Select Offer Type</label>
                  <div className="oo-chips-grid" style={{ maxHeight: "none" }}>
                    {OFFER_TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        className={`oo-chip-btn ${formOfferType === t.key ? "selected" : ""}`}
                        onClick={() => handleOfferTypeChange(t.key)}
                      >
                        <span>{t.icon}</span>
                        <span>{t.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="oo-form-hint">
                    {OFFER_TYPES.find((t) => t.key === formOfferType)?.desc}
                  </div>
                </div>

                {/* Title & Description */}
                <div className="oo-form-grid-2">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Offer Title *</label>
                    <input
                      type="text"
                      className="oo-form-input"
                      placeholder="e.g. 20% Off Precision Haircut"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">Promo / Coupon Code (Auto-Generated)</label>
                    <div className="oo-code-input-group">
                      <input
                        type="text"
                        className="oo-form-input"
                        placeholder="e.g. DEAL-7X9K"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      />
                      <button
                        type="button"
                        className="oo-btn-randomize"
                        title="Generate a new random code"
                        onClick={() => setFormCode(generateRandomCouponCode(formOfferType))}
                      >
                        🎲 Randomize
                      </button>
                    </div>
                    <div className="oo-form-hint">
                      Auto-generated unique random code. Click "Randomize" to generate another code.
                    </div>
                  </div>
                </div>

                <div className="oo-form-group">
                  <label className="oo-form-label">Offer Description</label>
                  <textarea
                    rows={2}
                    className="oo-form-textarea"
                    placeholder="Brief highlights or description for customers..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                {/* Discount Settings */}
                <div className="oo-form-grid-3">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Discount Type *</label>
                    <select
                      className="oo-form-select"
                      value={formDiscountType}
                      onChange={(e) => setFormDiscountType(e.target.value)}
                    >
                      {formOfferType === "COMBO" ? (
                        <>
                          <option value="FIXED_PRICE">Fixed Combo Price (e.g. ₹799)</option>
                          <option value="PERCENTAGE">Percentage Discount (%)</option>
                          <option value="FLAT">Flat Discount (₹)</option>
                        </>
                      ) : (
                        <>
                          <option value="PERCENTAGE">Percentage Discount (%)</option>
                          <option value="FLAT">Flat Discount (₹)</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">
                      {formDiscountType === "FIXED_PRICE"
                        ? "Fixed Combo Price (₹) *"
                        : formDiscountType === "PERCENTAGE"
                        ? "Discount Percentage (%) *"
                        : "Flat Discount (₹) *"}
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="oo-form-input"
                      placeholder={formDiscountType === "PERCENTAGE" ? "20" : "100"}
                      value={formDiscountValue}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseFloat(v) < 0) return;
                        setFormDiscountValue(v);
                      }}
                      required
                    />
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">Max Discount Cap (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      className="oo-form-input"
                      placeholder="e.g. 300 (Optional)"
                      value={formMaxDiscount}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseFloat(v) < 0) return;
                        setFormMaxDiscount(v);
                      }}
                      disabled={formDiscountType !== "PERCENTAGE"}
                    />
                  </div>
                </div>

                <div className="oo-form-grid-2">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Minimum Booking Spend (₹)</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      className="oo-form-input"
                      placeholder="0 for no minimum"
                      value={formMinSpend}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseFloat(v) < 0) return;
                        setFormMinSpend(v);
                      }}
                    />
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">Customer Eligibility</label>
                    <select
                      className="oo-form-select"
                      value={formCustomerEligibility}
                      onChange={(e) => setFormCustomerEligibility(e.target.value)}
                    >
                      <option value="ALL">All Customers</option>
                      <option value="FIRST_TIME">First-time Customers Only</option>
                    </select>
                  </div>
                </div>

                {/* Service Selection */}
                {formOfferType === "COMBO" ? (
                  <div className="oo-form-group">
                    <label className="oo-form-label">
                      Select Combo Services to Bundle (Select 2 or more) *
                    </label>
                    <div className="oo-chips-grid">
                      {salonServices.map((s) => {
                        const isSelected = formSelectedServices.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={`oo-chip-btn ${isSelected ? "selected" : ""}`}
                            onClick={() => handleToggleService(s.id)}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{s.effective_name} (₹{s.price})</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="oo-form-hint" style={{ marginTop: "6px" }}>
                      Combined Original Total: <strong>₹{comboServicesTotal}</strong>.
                      {formDiscountType === "FIXED_PRICE" && formDiscountValue && (
                        <span> Customer pays ₹{formDiscountValue} (Saves ₹{Math.max(0, comboServicesTotal - parseFloat(formDiscountValue || 0))}).</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="oo-form-group">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <label className="oo-form-label" style={{ margin: 0 }}>
                        Applicable Services
                      </label>
                      <label style={{ fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={formApplyToAll}
                          onChange={(e) => setFormApplyToAll(e.target.checked)}
                        />
                        <span>Apply to all services</span>
                      </label>
                    </div>

                    {!formApplyToAll && (
                      <div className="oo-chips-grid">
                        {salonServices.map((s) => {
                          const isSelected = formSelectedServices.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={`oo-chip-btn ${isSelected ? "selected" : ""}`}
                              onClick={() => handleToggleService(s.id)}
                            >
                              <span>{isSelected ? "✓" : "+"}</span>
                              <span>{s.effective_name} (₹{s.price})</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Dates & Times */}
                <div className="oo-form-grid-2">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Start Date *</label>
                    <input
                      type="date"
                      className="oo-form-input"
                      value={formStartDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">End Date *</label>
                    <input
                      type="date"
                      className="oo-form-input"
                      value={formEndDate}
                      min={formStartDate || new Date().toISOString().split("T")[0]}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Applicable Days of Week */}
                <div className="oo-form-group">
                  <label className="oo-form-label">
                    Applicable Days of the Week (Leave all unselected for Every Day)
                  </label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {DAYS_OF_WEEK.map((d) => {
                      const isSelected = formApplicableDays.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          className={`oo-chip-btn ${isSelected ? "selected" : ""}`}
                          onClick={() => handleToggleDay(d.key)}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Happy Hours / Time window (optional) */}
                <div className="oo-form-grid-2">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Daily Start Time (Optional)</label>
                    <input
                      type="time"
                      className="oo-form-input"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                    />
                    <span className="oo-form-hint">For happy hour / afternoon slots</span>
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">Daily End Time (Optional)</label>
                    <input
                      type="time"
                      className="oo-form-input"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                    />
                  </div>
                </div>

                {/* Limits */}
                <div className="oo-form-grid-2">
                  <div className="oo-form-group">
                    <label className="oo-form-label">Total Redemptions Limit</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="oo-form-input"
                      placeholder="Blank for unlimited"
                      value={formTotalLimit}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseInt(v, 10) < 0) return;
                        setFormTotalLimit(v);
                      }}
                    />
                  </div>

                  <div className="oo-form-group">
                    <label className="oo-form-label">Per Customer Limit</label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      className="oo-form-input"
                      value={formPerCustomerLimit}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (parseInt(v, 10) < 0) return;
                        setFormPerCustomerLimit(v);
                      }}
                    />
                  </div>
                </div>

                {/* Terms and Conditions */}
                <div className="oo-form-group">
                  <label className="oo-form-label">Terms and Conditions</label>
                  <textarea
                    rows={2}
                    className="oo-form-textarea"
                    value={formTerms}
                    onChange={(e) => setFormTerms(e.target.value)}
                  />
                </div>

                {/* Platform Promotion Checkbox */}
                <div
                  style={{
                    background: "#fefce8",
                    border: "1px solid #fef08a",
                    borderRadius: "10px",
                    padding: "14px 16px",
                    marginTop: "10px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "#854d0e",
                    }}
                  >
                    <input
                      type="checkbox"
                      style={{ marginTop: "3px" }}
                      checked={formShowOnPlatform}
                      onChange={(e) => setFormShowOnPlatform(e.target.checked)}
                    />
                    <div>
                      <div>Show on BookMySalon Platform (Homepage & Dedicated Deals Page)</div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 400,
                          color: "#a16207",
                          marginTop: "2px",
                        }}
                      >
                        Feature this deal on the platform's public deals section. Strictly maximum 3 active featured offers per salon at a time.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="oo-modal-foot">
                <button
                  type="button"
                  className="oo-btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="oo-btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving Offer..."
                    : modalMode === "create"
                    ? "✨ Publish Offer"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Redemptions History Modal */}
      {redemptionsModalOpen && (
        <div
          className="oo-modal-overlay"
          onClick={() => setRedemptionsModalOpen(false)}
        >
          <div
            className="oo-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "680px" }}
          >
            <div className="oo-modal-head">
              <h2>Redemption History: {activeRedemptionsOffer?.title}</h2>
              <button
                type="button"
                className="oo-close-btn"
                onClick={() => setRedemptionsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="oo-modal-body">
              {loadingRedemptions ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  Loading redemptions history...
                </div>
              ) : redemptionsList.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <div style={{ fontSize: "2rem", marginBottom: "8px" }}>🎟️</div>
                  <p>No customers have redeemed this offer yet.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {redemptionsList.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #e2e8f0",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>
                          {r.customer_name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                          Booking #{r.booking} • {new Date(r.redeemed_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: "#16a34a" }}>
                          -₹{parseFloat(r.discount_amount)} Saved
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
                          Subtotal: ₹{parseFloat(r.order_subtotal)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="oo-modal-foot">
              <button
                type="button"
                className="oo-btn-secondary"
                onClick={() => setRedemptionsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Modal */}
      {deleteConfirmOffer && (
        <div
          className="oo-modal-overlay"
          onClick={() => setDeleteConfirmOffer(null)}
        >
          <div
            className="oo-modal-container"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "480px" }}
          >
            <div className="oo-modal-head">
              <h2>Confirm Deletion</h2>
              <button
                type="button"
                className="oo-close-btn"
                onClick={() => setDeleteConfirmOffer(null)}
              >
                ✕
              </button>
            </div>

            <div className="oo-modal-body">
              <p style={{ color: "#334155", lineHeight: 1.5, margin: 0 }}>
                Are you sure you want to delete the offer <strong>"{deleteConfirmOffer.title}"</strong>?
              </p>
              {deleteConfirmOffer.usage_count > 0 && (
                <div
                  style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    color: "#92400e",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    fontSize: "0.84rem",
                    marginTop: "12px",
                  }}
                >
                  ℹ️ This offer has {deleteConfirmOffer.usage_count} redemptions. Deleting will safely archive and deactivate it so customer booking receipts remain intact.
                </div>
              )}
            </div>

            <div className="oo-modal-foot">
              <button
                type="button"
                className="oo-btn-secondary"
                onClick={() => setDeleteConfirmOffer(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="oo-btn-primary"
                style={{ background: "#dc2626" }}
                disabled={deleting}
                onClick={handleConfirmDelete}
              >
                {deleting ? "Deleting..." : "Delete Offer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && <div className="oo-toast">{toastMessage}</div>}

      <OwnerStickyFooter />
    </div>
  );
}


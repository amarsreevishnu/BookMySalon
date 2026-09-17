import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/createSalon.css";

const CATEGORIES = [
  "Hair & Styling",
  "Skin & Facial",
  "Nail Bar",
  "Spa & Massage",
  "Bridal Studio",
  "Men's Grooming",
  "Tattoo & Piercing",
  "Holistic Wellness",
];

const DEFAULT_DAYS = [
  { day: "Monday", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { day: "Tuesday", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { day: "Wednesday", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { day: "Thursday", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { day: "Friday", isOpen: true, openTime: "09:00", closeTime: "20:00" },
  { day: "Saturday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Sunday", isOpen: false, openTime: "10:00", closeTime: "18:00" },
];

const AMENITY_OPTIONS = [
  {
    id: "wifi",
    name: "High-Speed Wi-Fi",
    desc: "Complimentary for all clients",
    icon: "📶",
  },
  {
    id: "parking",
    name: "Valet & Dedicated Parking",
    desc: "Free on-site parking available",
    icon: "🚗",
  },
  {
    id: "ac",
    name: "Air Conditioned Suites",
    desc: "Fully climate controlled spaces",
    icon: "❄️",
  },
  {
    id: "beverages",
    name: "Refreshments & Beverages",
    desc: "Artisan coffee, herbal tea & water",
    icon: "☕",
  },
  {
    id: "payments",
    name: "Card & UPI Payments",
    desc: "All cashless payments accepted",
    icon: "💳",
  },
  {
    id: "wheelchair",
    name: "Wheelchair Accessible",
    desc: "Step-free ramp & broad doorways",
    icon: "♿",
  },
  {
    id: "sanitized",
    name: "Sanitized Tools & Equipment",
    desc: "Medical grade UV sterilization",
    icon: "✨",
  },
  {
    id: "kids",
    name: "Kid Friendly",
    desc: "Dedicated kids styling chairs",
    icon: "🧸",
  },
];

const SAMPLE_IMAGES = [
  "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80",
];

const TIME_OPTIONS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"
];

function formatTimeDisplay(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const formattedHour = h % 12 === 0 ? 12 : h % 12;
  return `${formattedHour}:${m < 10 ? "0" + m : m} ${period}`;
}

export default function CreateSalon() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    category: "Hair & Styling",
    description: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Karnataka",
    pincode: "",
    latitude: "12.9716",
    longitude: "77.5946",
  });

  const [openingHours, setOpeningHours] = useState(DEFAULT_DAYS);
  const [selectedAmenities, setSelectedAmenities] = useState([
    "High-Speed Wi-Fi",
    "Air Conditioned Suites",
    "Card & UPI Payments",
  ]);
  const [images, setImages] = useState(SAMPLE_IMAGES);
  const [activeStep, setActiveStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSaved, setLastSaved] = useState("Draft saved");
  const [submittedSalon, setSubmittedSalon] = useState(null);

  // Auto-restore draft if present
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem("bms_salon_draft");
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
        if (parsed.openingHours) setOpeningHours(parsed.openingHours);
        if (parsed.selectedAmenities) setSelectedAmenities(parsed.selectedAmenities);
        if (parsed.images && parsed.images.length > 0) setImages(parsed.images);
        setLastSaved("Draft restored from storage");
      }
    } catch {
      // Ignore local storage parse error
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCategorySelect = (cat) => {
    setFormData((prev) => ({ ...prev, category: cat }));
  };

  const handleDayToggle = (dayName) => {
    setOpeningHours((prev) =>
      prev.map((d) => (d.day === dayName ? { ...d, isOpen: !d.isOpen } : d))
    );
  };

  const handleTimeChange = (dayName, field, value) => {
    setOpeningHours((prev) =>
      prev.map((d) => (d.day === dayName ? { ...d, [field]: value } : d))
    );
  };

  const copyMondayToAll = () => {
    const monday = openingHours.find((d) => d.day === "Monday") || openingHours[0];
    setOpeningHours((prev) =>
      prev.map((d) => ({
        ...d,
        isOpen: monday.isOpen,
        openTime: monday.openTime,
        closeTime: monday.closeTime,
      }))
    );
  };

  const toggleAmenity = (name) => {
    setSelectedAmenities((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData((prev) => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
      },
      (error) => {
        alert("Unable to detect location: " + error.message);
      }
    );
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result) {
          setImages((prev) => [...prev, reader.result]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveDraft = () => {
    const draft = {
      formData,
      openingHours,
      selectedAmenities,
      images,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem("bms_salon_draft", JSON.stringify(draft));
    setLastSaved("Draft saved just now");
  };

  // Calculate readiness percentage
  const checklist = {
    basic: Boolean(formData.name.trim() && formData.category && formData.description.trim() && formData.phone.trim()),
    location: Boolean(formData.address.trim() && formData.city.trim()),
    hours: openingHours.some((d) => d.isOpen),
    amenities: selectedAmenities.length > 0,
    photos: images.length > 0,
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const readinessPercent = Math.round((completedCount / 5) * 100);

  const scrollToSection = (stepNum, sectionId) => {
    setActiveStep(stepNum);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!formData.name.trim()) {
      setErrorMessage("Please provide your salon name.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!formData.phone.trim()) {
      setErrorMessage("Please provide a contact phone number.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage("Please provide an official contact email for credentials.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!formData.address.trim() || !formData.city.trim()) {
      setErrorMessage("Please complete street address and city.");
      scrollToSection(2, "card-location");
      return;
    }

    setIsSubmitting(true);

    try {
      const latNum = formData.latitude && !isNaN(Number(formData.latitude))
        ? Number(Number(formData.latitude).toFixed(6))
        : null;
      const lngNum = formData.longitude && !isNaN(Number(formData.longitude))
        ? Number(Number(formData.longitude).toFixed(6))
        : null;

      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim() || "Karnataka",
        pincode: formData.pincode.trim(),
        latitude: latNum,
        longitude: lngNum,
        opening_hours: { days: openingHours },
        amenities: selectedAmenities,
        cover_image: images[0] || "",
        images: images,
      };

      let response;
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      try {
        response = await api.post("/salons/create/", payload, config);
      } catch (postErr) {
        if (postErr.response?.status === 401) {
          // Fallback anonymously if stale token in localStorage
          response = await api.post("/salons/create/", payload);
        } else {
          throw postErr;
        }
      }

      if (response && (response.status === 201 || response.status === 200)) {
        setSubmittedSalon(response.data.salon || payload);
        localStorage.removeItem("bms_salon_draft");
      }
    } catch (err) {
      let msg = "Failed to submit salon application. Please check all fields.";
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "string") {
          if (data.includes("<html") || data.includes("<!DOCTYPE")) {
            msg = "Server error (500). Please check backend logs or retry.";
          } else {
            msg = data;
          }
        } else if (data.detail) {
          msg = data.detail;
        } else if (data.message) {
          msg = data.message;
        } else if (data.error) {
          msg = data.error;
        } else {
          const firstKey = Object.keys(data)[0];
          const errorVal = data[firstKey];
          msg = `${firstKey}: ${Array.isArray(errorVal) ? errorVal[0] : String(errorVal)}`;
        }
      } else if (err.message) {
        msg = err.message;
      }
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="create-salon-page">
      {/* Top Navigation Header */}
      <header className="cs-header-nav">
        <div className="cs-header-nav-inner">
          <Link to="/" className="cs-brand-group">
            <div className="cs-brand-logo">B</div>
            <span className="cs-brand-name">BookMySalon</span>
            <span className="cs-brand-badge">PARTNER ONBOARDING</span>
          </Link>

          <div className="cs-header-actions">
            <span className="cs-support-phone">
              Need help? <strong>+91 800-SALON-PRO</strong>
            </span>
            <Link to="/" className="cs-back-home-btn">
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="cs-main-container">
        {/* Top Breadcrumb */}
        <div className="cs-top-breadcrumb">
          <Link to="/" className="cs-breadcrumb-link">
            ← Back to Home
          </Link>
        </div>

        {/* Page Title & Status */}
        <div className="cs-title-row">
          <div>
            <h1>List Your Salon</h1>
            <p>
              Complete the details below to submit your salon profile for Super Admin verification and start accepting bookings.
            </p>
          </div>
          <div className="cs-draft-status">{lastSaved}</div>
        </div>

        {/* Stepper Pills */}
        <nav className="cs-stepper-row" aria-label="Creation steps">
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 1 ? "active" : checklist.basic ? "completed" : ""}`}
            onClick={() => scrollToSection(1, "card-basic")}
          >
            <span className="cs-step-num">1</span>
            Basic Details
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 2 ? "active" : checklist.location ? "completed" : ""}`}
            onClick={() => scrollToSection(2, "card-location")}
          >
            <span className="cs-step-num">2</span>
            Location & Coordinates
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 3 ? "active" : checklist.hours ? "completed" : ""}`}
            onClick={() => scrollToSection(3, "card-hours")}
          >
            <span className="cs-step-num">3</span>
            Opening Hours
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 4 ? "active" : checklist.amenities ? "completed" : ""}`}
            onClick={() => scrollToSection(4, "card-amenities")}
          >
            <span className="cs-step-num">4</span>
            Facilities & Amenities
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 5 ? "active" : checklist.photos ? "completed" : ""}`}
            onClick={() => scrollToSection(5, "card-photos")}
          >
            <span className="cs-step-num">5</span>
            Photo Gallery
          </button>
        </nav>

        {/* Error notification banner */}
        {errorMessage && (
          <div
            style={{
              padding: "14px 18px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              color: "#991b1b",
              fontSize: "13px",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>⚠️ {errorMessage}</span>
            <button
              onClick={() => setErrorMessage("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontWeight: "700" }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Two-Column Grid */}
        <div className="cs-content-grid">
          {/* Left Column: Form Cards */}
          <div className="cs-cards-stack">
            {/* Card 1: Basic Details */}
            <section className="cs-card" id="card-basic">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon green">🏪</div>
                  <div>
                    <h2>Basic Details</h2>
                    <p>Provide your salon's core branding information</p>
                  </div>
                </div>
                <span className="cs-card-badge">Step 1 of 5</span>
              </div>

              <div className="cs-form-group">
                <label className="cs-label">
                  Salon Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. The Luxe Parlour & Spa"
                  className="cs-input"
                  required
                />
              </div>

              <div className="cs-form-group">
                <label className="cs-label">
                  Primary Specialization / Category <span className="required">*</span>
                </label>
                <div className="cs-chips-container">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      className={`cs-chip ${formData.category === cat ? "selected" : ""}`}
                      onClick={() => handleCategorySelect(cat)}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="cs-form-group">
                <label className="cs-label">
                  <span>About / Description</span>
                  <span className="cs-char-counter">{formData.description.length}/600</span>
                </label>
                <textarea
                  rows={4}
                  name="description"
                  maxLength={600}
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Describe your salon's ambience, signature treatments, premium products used, and what makes your client experience unforgettable..."
                  className="cs-textarea"
                />
              </div>

              <div className="cs-form-row-2">
                <div className="cs-form-group">
                  <label className="cs-label">
                    Official Contact Email <span className="required">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="owner@yourparlour.com"
                    className="cs-input"
                    required
                  />
                  <span style={{ fontSize: "11px", color: "#66786c", marginTop: "4px", display: "block" }}>
                    Your login credentials will be emailed here upon Super Admin approval.
                  </span>
                </div>

                <div className="cs-form-group">
                  <label className="cs-label">
                    Primary Phone Number <span className="required">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="+91 98765 43210"
                    className="cs-input"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Card 2: Location & Coordinates */}
            <section className="cs-card" id="card-location">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon amber">📍</div>
                  <div>
                    <h2>Location & Coordinates</h2>
                    <p>Help clients discover your venue accurately on search maps</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cs-detect-location-btn"
                  onClick={handleDetectLocation}
                >
                  📍 Detect My Location
                </button>
              </div>

              <div className="cs-form-group">
                <label className="cs-label">
                  Street Address & Landmark <span className="required">*</span>
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="e.g. Shop 4, Rosewood Galleria, 100 Feet Road, Indiranagar"
                  className="cs-input"
                  required
                />
              </div>

              <div className="cs-form-row-3">
                <div className="cs-form-group">
                  <label className="cs-label">
                    City <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    placeholder="e.g. Bangalore"
                    className="cs-input"
                    required
                  />
                </div>

                <div className="cs-form-group">
                  <label className="cs-label">State</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    placeholder="e.g. Karnataka"
                    className="cs-input"
                  />
                </div>

                <div className="cs-form-group">
                  <label className="cs-label">Pincode</label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    placeholder="e.g. 560038"
                    className="cs-input"
                  />
                </div>
              </div>

              <div className="cs-form-row-2">
                <div className="cs-form-group">
                  <label className="cs-label">Latitude</label>
                  <input
                    type="text"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                    placeholder="12.9716"
                    className="cs-input"
                  />
                </div>
                <div className="cs-form-group">
                  <label className="cs-label">Longitude</label>
                  <input
                    type="text"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                    placeholder="77.5946"
                    className="cs-input"
                  />
                </div>
              </div>

              {/* Interactive Map Mock */}
              <div className="cs-map-mock-container" title="Click to update map center pin">
                <div className="cs-map-roads">
                  <div className="cs-map-road-h" />
                  <div className="cs-map-road-v" />
                </div>
                <div className="cs-map-pin-badge">
                  <div className="cs-map-pin-pill">
                    <span>📍</span>
                    <span>{formData.name || "Selected Salon Location"}</span>
                  </div>
                  <div className="cs-map-pin-point" />
                </div>
                <div className="cs-map-coords-pill">
                  {formData.latitude}° N, {formData.longitude}° E
                </div>
              </div>
            </section>

            {/* Card 3: Opening Hours & Rhythm */}
            <section className="cs-card" id="card-hours">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon slate">⏰</div>
                  <div>
                    <h2>Opening Hours & Rhythm</h2>
                    <p>Configure your weekly booking window for appointments</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="cs-hours-header-action"
                  onClick={copyMondayToAll}
                >
                  Copy Monday to all days
                </button>
              </div>

              <div className="cs-hours-table">
                {openingHours.map((schedule) => (
                  <div className="cs-day-row" key={schedule.day}>
                    <div className="cs-day-toggle-group">
                      <label className="cs-switch" aria-label={`Toggle ${schedule.day}`}>
                        <input
                          type="checkbox"
                          checked={schedule.isOpen}
                          onChange={() => handleDayToggle(schedule.day)}
                        />
                        <span className="cs-slider" />
                      </label>
                      <span className="cs-day-name">{schedule.day}</span>
                    </div>

                    <div className="cs-day-times">
                      <select
                        disabled={!schedule.isOpen}
                        value={schedule.openTime}
                        onChange={(e) => handleTimeChange(schedule.day, "openTime", e.target.value)}
                        className="cs-time-select"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTimeDisplay(t)}
                          </option>
                        ))}
                      </select>

                      <span className="cs-time-divider">to</span>

                      <select
                        disabled={!schedule.isOpen}
                        value={schedule.closeTime}
                        onChange={(e) => handleTimeChange(schedule.day, "closeTime", e.target.value)}
                        className="cs-time-select"
                      >
                        {TIME_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {formatTimeDisplay(t)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className={`cs-day-status-pill ${!schedule.isOpen ? "closed" : ""}`}>
                      {schedule.isOpen ? (
                        <span>
                          {formatTimeDisplay(schedule.openTime)} - {formatTimeDisplay(schedule.closeTime)}
                        </span>
                      ) : (
                        <span>Closed</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="cs-hours-tip-banner">
                <span>💡</span>
                <span>
                  <strong>Partner Tip:</strong> Salons offering early morning (8:00 AM) or late evening (8:00 PM+) slots record up to 34% more weekly appointments.
                </span>
              </div>
            </section>

            {/* Card 4: Facilities & Amenities */}
            <section className="cs-card" id="card-amenities">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon teal">✨</div>
                  <div>
                    <h2>Facilities & Amenities</h2>
                    <p>Highlight comfort amenities to rank higher in client search filters</p>
                  </div>
                </div>
                <span className="cs-card-badge">{selectedAmenities.length} selected</span>
              </div>

              <div className="cs-amenities-grid">
                {AMENITY_OPTIONS.map((amenity) => {
                  const isSelected = selectedAmenities.includes(amenity.name);
                  return (
                    <div
                      key={amenity.id}
                      className={`cs-amenity-tile ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleAmenity(amenity.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && toggleAmenity(amenity.name)}
                    >
                      <div className="cs-amenity-checkbox">
                        {isSelected ? "✓" : ""}
                      </div>
                      <div className="cs-amenity-info">
                        <span className="cs-amenity-name">
                          {amenity.icon} {amenity.name}
                        </span>
                        <span className="cs-amenity-desc">{amenity.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Card 5: Photo Gallery & Cover */}
            <section className="cs-card" id="card-photos">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon purple">📷</div>
                  <div>
                    <h2>Photo Gallery & Cover</h2>
                    <p>High-resolution salon photos increase client booking conversion by 2.5x</p>
                  </div>
                </div>
                <span className="cs-card-badge">{images.length} photos</span>
              </div>

              {/* Dropzone */}
              <div
                className="cs-dropzone"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                />
                <div className="cs-dropzone-icon">☁️</div>
                <h4>Drag & drop your salon photos here, or browse files</h4>
                <p>Supports JPG, PNG, WEBP up to 5MB each. First photo will be your main cover banner.</p>
                <button type="button" className="cs-dropzone-btn">
                  Browse Files
                </button>
              </div>

              {/* Gallery Previews */}
              {images.length > 0 && (
                <div className="cs-gallery-previews">
                  {images.map((imgUrl, idx) => (
                    <div className="cs-photo-card" key={idx}>
                      <img src={imgUrl} alt={`Salon gallery ${idx + 1}`} />
                      {idx === 0 && <span className="cs-photo-badge">Cover Photo</span>}
                      <button
                        type="button"
                        className="cs-photo-delete-btn"
                        title="Remove photo"
                        onClick={() => removePhoto(idx)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Bottom Actions Bar */}
            <div className="cs-bottom-bar">
              <div className="cs-bottom-secondary-actions">
                <button
                  type="button"
                  className="cs-secondary-btn"
                  onClick={handleSaveDraft}
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  className="cs-secondary-btn"
                  onClick={() => {
                    const card = document.getElementById("client-preview-card");
                    if (card) card.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  Preview as Client
                </button>
              </div>

              <button
                type="button"
                className="cs-submit-btn"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="cs-spinner" /> Submitting Application...
                  </>
                ) : (
                  <>Submit for Admin Approval →</>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Sticky Sidebar */}
          <aside className="cs-sidebar-sticky">
            {/* Live Client Preview Card */}
            <div className="cs-preview-card" id="client-preview-card">
              <div className="cs-preview-header">
                <h3>Live Client Preview</h3>
                <span className="cs-preview-client-badge">Public Listing</span>
              </div>

              <div className="cs-preview-image-wrap">
                <img
                  src={
                    images[0] ||
                    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80"
                  }
                  alt={formData.name || "Salon preview"}
                />
                <div className="cs-preview-rating-badge">★ 4.9 (New)</div>
              </div>

              <div className="cs-preview-body">
                <h4 className="cs-preview-salon-title">
                  {formData.name || "The Luxe Parlour & Spa"}
                </h4>
                <div className="cs-preview-location">
                  <span>📍</span>
                  <span>
                    {formData.address
                      ? `${formData.address.split(",")[0]}, ${formData.city || "Bangalore"}`
                      : "Indiranagar, Bangalore"}
                  </span>
                </div>
                <p className="cs-preview-desc-snippet">
                  {formData.description ||
                    "Premium hair styling, facial therapies, and luxury wellness treatments curated for sophisticated clientele."}
                </p>

                <div className="cs-preview-tags">
                  <span className="cs-preview-tag">{formData.category}</span>
                  {selectedAmenities.slice(0, 2).map((a) => (
                    <span key={a} className="cs-preview-tag">
                      {a}
                    </span>
                  ))}
                </div>

                <div className="cs-preview-footer">
                  <div>
                    <span className="cs-preview-price-label">Services from</span>
                    <span className="cs-preview-price-val">₹399</span>
                  </div>
                  <button type="button" className="cs-preview-book-btn" disabled>
                    Book Now
                  </button>
                </div>
              </div>
            </div>

            {/* Listing Readiness Checklist */}
            <div className="cs-checklist-card">
              <div className="cs-checklist-header">
                <h3>Listing Readiness</h3>
                <span className="cs-checklist-pct">{readinessPercent}%</span>
              </div>

              <div className="cs-progress-bar-bg">
                <div
                  className="cs-progress-bar-fill"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>

              <div className="cs-checklist-items">
                <div className={`cs-checklist-item ${checklist.basic ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.basic ? "done" : "pending"}`}>
                    {checklist.basic ? "✓" : ""}
                  </div>
                  <span>Basic Details & Category</span>
                </div>

                <div className={`cs-checklist-item ${checklist.location ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.location ? "done" : "pending"}`}>
                    {checklist.location ? "✓" : ""}
                  </div>
                  <span>Address & Geolocation</span>
                </div>

                <div className={`cs-checklist-item ${checklist.hours ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.hours ? "done" : "pending"}`}>
                    {checklist.hours ? "✓" : ""}
                  </div>
                  <span>Operating Schedule</span>
                </div>

                <div className={`cs-checklist-item ${checklist.amenities ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.amenities ? "done" : "pending"}`}>
                    {checklist.amenities ? "✓" : ""}
                  </div>
                  <span>Facilities & Amenities</span>
                </div>

                <div className={`cs-checklist-item ${checklist.photos ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.photos ? "done" : "pending"}`}>
                    {checklist.photos ? "✓" : ""}
                  </div>
                  <span>At least 1 Salon Photo</span>
                </div>
              </div>
            </div>

            {/* Fast 24-48hr Verification Card */}
            <div className="cs-guarantee-card">
              <div className="cs-guarantee-icon">⚡</div>
              <div className="cs-guarantee-text">
                <h4>Fast 24-48hr Verification</h4>
                <p>
                  Our Super Admin team reviews every salon application within 24-48 hours. Upon approval, your owner account credentials will be emailed to your official email.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Application Submitted Success Modal */}
      {submittedSalon && (
        <div className="cs-modal-backdrop">
          <div className="cs-success-modal">
            <div className="cs-modal-check-icon">✓</div>
            <h2>Application Submitted!</h2>
            <p>
              Your salon <strong>{submittedSalon.name}</strong> has been registered and submitted for Super Admin review.
            </p>

            <div className="cs-modal-details-box">
              <div>
                <strong>Application Status:</strong>{" "}
                <span style={{ color: "#d97706", fontWeight: "700" }}>Pending Super Admin Approval</span>
              </div>
              <div>
                <strong>Notification Email:</strong> {submittedSalon.email || formData.email}
              </div>
              <div>
                <strong>Next Step:</strong> Once approved, your temporary login ID & password will be sent to this email address so you can access your salon management dashboard.
              </div>
            </div>

            <div className="cs-modal-btn-row">
              <button
                type="button"
                className="cs-secondary-btn"
                onClick={() => {
                  setSubmittedSalon(null);
                  navigate("/");
                }}
              >
                Back to Home
              </button>
              <button
                type="button"
                className="cs-submit-btn"
                onClick={() => {
                  setSubmittedSalon(null);
                  navigate("/");
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


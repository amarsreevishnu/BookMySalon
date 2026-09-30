import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import "../../styles/addWorker.css";

const DEFAULT_PORTRAIT =
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80";

const DEFAULT_SERVICES = [
  {
    id: "serv-1",
    name: "Classic Bespoke Haircut",
    tag: "Bestseller",
    price: "₹750",
    raw_price: 750,
    duration: "45 mins",
    desc: "Consultation, wash, signature cut & organic styling finish",
    category: "Hair Styling",
  },
  {
    id: "serv-2",
    name: "Beard Sculpt & Trim",
    tag: "Fast Track",
    price: "₹450",
    raw_price: 450,
    duration: "25 mins",
    desc: "Precision clipper contouring with botanical beard balm",
    category: "Beard Grooming",
  },
  {
    id: "serv-3",
    name: "Hair Styling & Blowdry",
    tag: "",
    price: "₹900",
    raw_price: 900,
    duration: "40 mins",
    desc: "Volume boost with Moroccan Argan heat protection",
    category: "Hair Styling",
  },
  {
    id: "serv-4",
    name: "Scalp Detox & Rejuvenation",
    tag: "Signature",
    price: "₹1,450",
    raw_price: 1450,
    duration: "50 mins",
    desc: "Rosemary scrub, ozone steam massage & peptide hydration",
    category: "Hair Styling",
  },
  {
    id: "serv-5",
    name: "Royal Hot-Towel Shave",
    tag: "",
    price: "₹600",
    raw_price: 600,
    duration: "35 mins",
    desc: "Pre-shave sandalwood oil, straight razor, herbal cold pack finish",
    category: "Beard Grooming",
  },
  {
    id: "serv-6",
    name: "Hydra-Radiance Facial",
    tag: "",
    price: "₹1,850",
    raw_price: 1850,
    duration: "50 mins",
    desc: "Deep pore ultrasonic cleanse, hyaluronic infusion & cold hammer",
    category: "Skin & Facial",
  },
];

const INITIAL_SPECIALIZATIONS = [
  {
    id: "hair",
    name: "Hair Styling",
    desc: "Cut, Color & Treatment",
    defaultSelected: true,
  },
  {
    id: "beard",
    name: "Beard Grooming",
    desc: "Shaping & Hot Towel",
    defaultSelected: true,
  },
  {
    id: "skin",
    name: "Skin & Facial",
    desc: "Aesthetic Cleansing",
    defaultSelected: false,
  },
  {
    id: "spa",
    name: "Spa & Massage",
    desc: "Ayurvedic & Relax",
    defaultSelected: false,
  },
  {
    id: "nail",
    name: "Nail Art & Care",
    desc: "Gel, Acrylic & Pedicure",
    defaultSelected: false,
  },
];

const DAYS_OF_WEEK = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
];

export default function AddWorker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // Salon metadata
  const [salonDetails, setSalonDetails] = useState({
    name: "Indiranagar Flagship, Bengaluru",
    id: null,
  });

  // Form Fields
  const [fullName, setFullName] = useState("Anil Sharma");
  const [phoneNumber, setPhoneNumber] = useState("98412 33456");
  const [email, setEmail] = useState("anil.sharma@bookmysalon.in");
  const [experience, setExperience] = useState("Master Stylist | 8+ yrs");
  const [station, setStation] = useState("Chair #04 • Men's Grooming Bay");
  const [employmentStatus, setEmploymentStatus] = useState(
    "Full-Time Specialist (Payroll + Commission)"
  );
  const [bio, setBio] = useState(
    "Certified Toni&Guy graduate with 8+ years precision cutting expertise. Specialises in textured crops, bespoke beard architecture, and relaxing scalp detox therapy."
  );
  const [profilePhoto, setProfilePhoto] = useState(DEFAULT_PORTRAIT);
  const [isPhotoCustom, setIsPhotoCustom] = useState(false);

  // Specializations
  const [specializationsList, setSpecializationsList] = useState(
    INITIAL_SPECIALIZATIONS
  );
  const [selectedSpecs, setSelectedSpecs] = useState([
    "Hair Styling",
    "Beard Grooming",
  ]);
  const [showCustomSpecModal, setShowCustomSpecModal] = useState(false);
  const [customSpecName, setCustomSpecName] = useState("");
  const [customSpecDesc, setCustomSpecDesc] = useState("");

  // Services Catalog
  const [availableServices, setAvailableServices] = useState(DEFAULT_SERVICES);
  const [selectedServiceIds, setSelectedServiceIds] = useState([
    "serv-1",
    "serv-2",
  ]);

  // Working Hours & Shift
  const [timeIn, setTimeIn] = useState("09:00 AM");
  const [timeOut, setTimeOut] = useState("07:30 PM");
  const [weeklyOffDay, setWeeklyOffDay] = useState(2); // Wednesday (index 2)

  // Commission Tier
  const [commissionTier, setCommissionTier] = useState(
    "Tier 2 • Senior Specialist"
  );

  // UI / Status States
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalData, setSuccessModalData] = useState(null);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Fetch salon details and existing services if available
  useEffect(() => {
    const fetchSalonInfo = async () => {
      try {
        const res = await api.get("/salons/owner/workers/");
        if (res.data && res.data.salon) {
          setSalonDetails({
            id: res.data.salon.id,
            name: `${res.data.salon.name}, ${res.data.salon.city || "Bengaluru"}`,
          });
          if (
            Array.isArray(res.data.salon.services) &&
            res.data.salon.services.length > 0
          ) {
            const merged = res.data.salon.services.map((s, idx) => ({
              id: `backend-${idx}`,
              name: typeof s === "string" ? s : s.name || `Service ${idx + 1}`,
              tag: idx === 0 ? "Bestseller" : "",
              price: s.price ? `₹${s.price}` : "₹650",
              raw_price: s.price || 650,
              duration: s.duration || "45 mins",
              desc: s.description || "Expert salon service with standard care",
              category: s.category || "General",
            }));
            setAvailableServices((prev) => [...merged, ...prev]);
          }
        }
      } catch (err) {
        console.warn("Could not load backend salon info:", err);
      }
    };
    fetchSalonInfo();
  }, []);

  // Handle Photo selection
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Photo size must be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePhoto(String(reader.result || ""));
      setIsPhotoCustom(true);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto("");
    setIsPhotoCustom(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Toggle Specialization
  const toggleSpecialization = (specName) => {
    setSelectedSpecs((prev) =>
      prev.includes(specName)
        ? prev.filter((s) => s !== specName)
        : [...prev, specName]
    );
  };

  // Add Custom Category
  const handleAddCustomSpec = (e) => {
    e.preventDefault();
    if (!customSpecName.trim()) return;
    const newSpec = {
      id: `custom-${Date.now()}`,
      name: customSpecName.trim(),
      desc: customSpecDesc.trim() || "Specialized Salon Category",
      defaultSelected: true,
    };
    setSpecializationsList((prev) => [...prev, newSpec]);
    setSelectedSpecs((prev) => [...prev, newSpec.name]);
    setCustomSpecName("");
    setCustomSpecDesc("");
    setShowCustomSpecModal(false);
  };

  // Toggle Service
  const toggleService = (id) => {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllServices = () => {
    setSelectedServiceIds(availableServices.map((s) => s.id));
  };

  const handleClearServices = () => {
    setSelectedServiceIds([]);
  };

  // Selected services list for live preview
  const selectedServicesList = useMemo(() => {
    return availableServices.filter((s) => selectedServiceIds.includes(s.id));
  }, [availableServices, selectedServiceIds]);

  // Form submission handler
  const handleCreateWorker = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    if (!fullName.trim()) {
      setErrorMessage("Please enter the worker's official full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid work or contact email address.");
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage("Please enter a contact phone number.");
      return;
    }

    setSubmitting(true);

    const payload = {
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone_number: `+91 ${phoneNumber.replace("+91", "").trim()}`,
      specialization: selectedSpecs[0] || "Stylist",
      experience: experience,
      station: station,
      employment_status: employmentStatus,
      bio: bio.trim(),
      specializations: selectedSpecs,
      assigned_services: selectedServicesList.map((s) => ({
        id: s.id,
        name: s.name,
        price: s.raw_price || s.price,
        duration: s.duration,
      })),
      shift_hours: {
        time_in: timeIn,
        time_out: timeOut,
        weekly_off: DAYS_OF_WEEK[weeklyOffDay]?.full || "Wednesday",
      },
      commission_tier: commissionTier,
      profile_photo: isPhotoCustom ? profilePhoto : "",
    };

    try {
      const res = await api.post("/salons/owner/workers/", payload);
      const data = res.data;

      setSuccessModalData({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password:
          data.credentials?.password ||
          data.worker?.temporary_password ||
          "Worker@123",
        station: station,
        salon: salonDetails.name,
        email_sent: data.email_sent !== false,
      });
    } catch (err) {
      const data = err.response?.data;
      if (typeof data === "string") {
        setErrorMessage(data);
      } else if (data?.email) {
        setErrorMessage(
          Array.isArray(data.email) ? data.email.join(" ") : String(data.email)
        );
      } else if (data?.detail) {
        setErrorMessage(data.detail);
      } else if (data?.error) {
        setErrorMessage(data.error);
      } else {
        const firstVal = Object.values(data || {})[0];
        setErrorMessage(
          Array.isArray(firstVal)
            ? firstVal.join(" ")
            : "Failed to create worker account. Please verify input fields."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!successModalData) return;
    const text = `BookMySalon Staff Access Credentials:\nSalon: ${successModalData.salon}\nName: ${successModalData.name}\nStation: ${successModalData.station}\nWorker ID (Email): ${successModalData.email}\nTemporary Password: ${successModalData.password}\nLogin Portal: ${window.location.origin}/login`;
    navigator.clipboard?.writeText(text);
    setCopiedStatus(true);
    setTimeout(() => setCopiedStatus(false), 3000);
  };

  return (
    <div className="add-worker-page">
      {/* --------------------------------------------------------------------
          REUSABLE OWNER SUITE NAVBAR
          -------------------------------------------------------------------- */}
      <OwnerNavbar activeTab="Workers" showAddWorker={false} />

      {/* --------------------------------------------------------------------
          MAIN CONTENT AREA
          -------------------------------------------------------------------- */}
      <div className="aw-content-wrapper">
        {/* Breadcrumb & Section Header */}
        <div className="aw-top-hero">
          <div>
            <div className="aw-breadcrumbs">
              <Link to="/owner/dashboard" className="aw-breadcrumb-item">
                Owner Suite
              </Link>
              <span>›</span>
              <span className="aw-breadcrumb-item">Staff & Operations</span>
              <span>›</span>
              <Link to="/owner/workers" className="aw-breadcrumb-item">
                Worker Management
              </Link>
              <span>›</span>
              <span className="aw-breadcrumb-active">Add New Specialist</span>
            </div>

            <div className="aw-step-badge">
              <span className="aw-step-dot" />
              <span>STAFF ONBOARDING FLOW • STEP 1 OF 2</span>
            </div>

            <h1 className="aw-page-title">Add Worker</h1>
            <p className="aw-page-subtitle">
              Onboard a new specialist, assign chair/station, configure service
              capabilities, and preview their live booking presence.
            </p>
          </div>

          <div className="aw-hero-actions">
            <button type="button" className="aw-pill-btn">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3" />
                <path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z" />
                <path d="M5 18v2" />
                <path d="M19 18v2" />
              </svg>
              <span>Active Chairs #1-18</span>
            </button>

            <button type="button" className="aw-pill-btn">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Import CSV</span>
            </button>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div
            style={{
              background: "#fdeeee",
              border: "1px solid #f5c2c7",
              color: "#842029",
              padding: "12px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              fontSize: "13.5px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>⚠️ {errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage("")}
              style={{
                background: "none",
                border: "none",
                color: "#842029",
                cursor: "pointer",
                fontWeight: "700",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* --------------------------------------------------------------------
            TWO-COLUMN GRID (LEFT FORM / RIGHT PREVIEW)
            -------------------------------------------------------------------- */}
        <div className="aw-main-grid">
          {/* LEFT COLUMN - FORM CARDS */}
          <div className="aw-form-column">
            {/* 1. Staff Portrait & Identity */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Staff Portrait & Identity</h3>
                </div>
                <span className="aw-card-meta">JPEG, PNG, WEBP up to 5MB</span>
              </div>

              <div className="aw-portrait-section">
                <div className="aw-avatar-preview-box">
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt="Staff Preview"
                      className="aw-avatar-img"
                    />
                  ) : (
                    <span style={{ fontSize: "28px" }}>👤</span>
                  )}
                </div>

                <div className="aw-portrait-info">
                  <h4 className="aw-portrait-title">Public Client Visibility</h4>
                  <p className="aw-portrait-desc">
                    High-resolution staff portraits increase client direct
                    booking conversion rates by 40%. Use a clean, warm-neutral
                    background matching the salon&apos;s internal ambiance.
                  </p>

                  <div className="aw-portrait-actions">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handlePhotoUpload}
                    />
                    <button
                      type="button"
                      className="aw-btn-upload"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      <span>Upload New Photo</span>
                    </button>

                    {profilePhoto && (
                      <button
                        type="button"
                        className="aw-btn-remove"
                        onClick={handleRemovePhoto}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Worker Information */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" />
                      <path d="M3 9h18" />
                      <path d="M9 21V9" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Worker Information</h3>
                </div>
              </div>

              {/* Row 1: Full Name & Phone Number */}
              <div className="aw-form-row">
                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">
                      Full Name<span className="aw-req">*</span>
                    </label>
                    <span className="aw-sub-label">Official ID name</span>
                  </div>
                  <input
                    type="text"
                    className="aw-input"
                    placeholder="e.g. Anil Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>

                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">
                      Phone Number<span className="aw-req">*</span>
                    </label>
                    <span className="aw-sub-label">For SMS/Shift Alerts</span>
                  </div>
                  <div className="aw-phone-input-group">
                    <span className="aw-phone-prefix">+91</span>
                    <input
                      type="tel"
                      className="aw-phone-field"
                      placeholder="98412 33456"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Work / Contact Email & Experience Title */}
              <div className="aw-form-row">
                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">
                      Work / Contact Email<span className="aw-req">*</span>
                    </label>
                    <span className="aw-sub-label">Worker ID Login</span>
                  </div>
                  <input
                    type="email"
                    className="aw-input"
                    placeholder="anil.sharma@bookmysalon.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">
                      Experience & Title Level<span className="aw-req">*</span>
                    </label>
                    <span className="aw-sub-label">Public Badge</span>
                  </div>
                  <select
                    className="aw-select"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                  >
                    <option value="Master Stylist | 8+ yrs">
                      Master Stylist | 8+ yrs
                    </option>
                    <option value="Senior Specialist | 5-8 yrs">
                      Senior Specialist | 5-8 yrs
                    </option>
                    <option value="Stylist | 3-5 yrs">Stylist | 3-5 yrs</option>
                    <option value="Junior Stylist | 1-2 yrs">
                      Junior Stylist | 1-2 yrs
                    </option>
                    <option value="Apprentice | < 1 yr">
                      Apprentice | &lt; 1 yr
                    </option>
                  </select>
                </div>
              </div>

              {/* Row 3: Primary Chair / Station Assignment & Employment Status */}
              <div className="aw-form-row">
                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">
                      Primary Chair / Station Assignment
                    </label>
                  </div>
                  <select
                    className="aw-select"
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                  >
                    <option value="Chair #04 • Men's Grooming Bay">
                      Chair #04 • Men&apos;s Grooming Bay
                    </option>
                    <option value="Chair #01 • Front Bay">
                      Chair #01 • Front Bay
                    </option>
                    <option value="Chair #02 • Color Bar">
                      Chair #02 • Color Bar
                    </option>
                    <option value="Station #03 • Styling Section">
                      Station #03 • Styling Section
                    </option>
                    <option value="Spa Pod #02 • Wellness Wing">
                      Spa Pod #02 • Wellness Wing
                    </option>
                    <option value="Nail Station #01 • Lounge">
                      Nail Station #01 • Lounge
                    </option>
                  </select>
                </div>

                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">Employment Status</label>
                  </div>
                  <select
                    className="aw-select"
                    value={employmentStatus}
                    onChange={(e) => setEmploymentStatus(e.target.value)}
                  >
                    <option value="Full-Time Specialist (Payroll + Commission)">
                      Full-Time Specialist (Payroll + Commission)
                    </option>
                    <option value="Part-Time Specialist (Shift Based)">
                      Part-Time Specialist (Shift Based)
                    </option>
                    <option value="Contract / Booth Rental">
                      Contract / Booth Rental
                    </option>
                    <option value="Freelance Consultant">
                      Freelance Consultant
                    </option>
                  </select>
                </div>
              </div>

              {/* Row 4: Professional Bio */}
              <div className="aw-form-group" style={{ marginBottom: 0 }}>
                <div className="aw-label-row">
                  <label className="aw-label">
                    Professional Bio & Specialty Philosophy
                  </label>
                </div>
                <textarea
                  className="aw-textarea"
                  maxLength={300}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Share a short bio, cutting philosophy, certifications, or specialty expertise..."
                />
                <span className="aw-char-count">{bio.length} / 300 chars</span>
              </div>
            </div>

            {/* 3. Specializations */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Specializations</h3>
                </div>
                <span className="aw-card-meta">Select all applicable fields</span>
              </div>

              <p className="aw-section-subtitle">
                Defines which marketplace category feeds will display this
                worker when customers search for specialists.
              </p>

              <div className="aw-specs-grid">
                {specializationsList.map((spec) => {
                  const isSelected = selectedSpecs.includes(spec.name);
                  return (
                    <div
                      key={spec.id}
                      className={`aw-spec-card ${isSelected ? "selected" : ""}`}
                      onClick={() => toggleSpecialization(spec.name)}
                    >
                      <div className="aw-checkbox-custom">
                        {isSelected && "✓"}
                      </div>
                      <div className="aw-spec-info">
                        <span className="aw-spec-title">{spec.name}</span>
                        <span className="aw-spec-desc">{spec.desc}</span>
                      </div>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="aw-add-category-btn"
                  onClick={() => setShowCustomSpecModal(true)}
                >
                  <span>+</span>
                  <span>Custom Category</span>
                </button>
              </div>
            </div>

            {/* 4. Assigned Services Checklist */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Assigned Services</h3>
                </div>

                <div className="aw-services-header-actions">
                  <button
                    type="button"
                    className="aw-action-link"
                    onClick={handleSelectAllServices}
                  >
                    Select All
                  </button>
                  <span style={{ color: "#a8b8ae" }}>•</span>
                  <button
                    type="button"
                    className="aw-action-link"
                    onClick={handleClearServices}
                  >
                    Clear
                  </button>
                </div>
              </div>

              <p className="aw-section-subtitle">
                Select which individual catalog services will be routed to this
                staff member&apos;s appointment queue.
              </p>

              <div className="aw-services-list">
                {availableServices.map((service) => {
                  const isChecked = selectedServiceIds.includes(service.id);
                  return (
                    <div
                      key={service.id}
                      className={`aw-service-item ${isChecked ? "selected" : ""}`}
                      onClick={() => toggleService(service.id)}
                    >
                      <div className="aw-service-left">
                        <div className="aw-checkbox-custom">
                          {isChecked && "✓"}
                        </div>
                        <div className="aw-service-meta">
                          <div className="aw-service-title-row">
                            <span className="aw-service-name">
                              {service.name}
                            </span>
                            {service.tag && (
                              <span
                                className={`aw-service-badge ${
                                  service.tag === "Signature" ? "signature" : ""
                                }`}
                              >
                                {service.tag}
                              </span>
                            )}
                          </div>
                          <span className="aw-service-sub">{service.desc}</span>
                        </div>
                      </div>

                      <div className="aw-service-right">
                        <span className="aw-service-price">
                          {service.price}
                        </span>
                        <span className="aw-service-duration">
                          {service.duration}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - LIVE MARKETPLACE PREVIEW & SETTINGS */}
          <div className="aw-sidebar-column">
            {/* 1. LIVE MARKETPLACE PREVIEW */}
            <div className="aw-preview-card">
              <div className="aw-preview-header">
                <div className="aw-preview-title">
                  <span className="aw-pulse-dot" />
                  <span>LIVE MARKETPLACE PREVIEW</span>
                </div>
                <span className="aw-badge-available">Available</span>
              </div>

              <div className="aw-preview-body">
                <div className="aw-preview-profile-row">
                  <img
                    src={profilePhoto || DEFAULT_PORTRAIT}
                    alt={fullName}
                    className="aw-preview-avatar"
                  />
                  <div className="aw-preview-info">
                    <h4 className="aw-preview-name">
                      {fullName || "Specialist Name"}
                    </h4>
                    <div className="aw-preview-rating-row">
                      <span className="aw-preview-star">★</span>
                      <span style={{ fontWeight: 700, color: "#19271e" }}>
                        5.0
                      </span>
                      <span>•</span>
                      <span className="aw-preview-badge-text">New Partner</span>
                    </div>
                    <span
                      style={{
                        fontSize: "11.5px",
                        color: "#586b5f",
                        marginTop: "2px",
                      }}
                    >
                      {experience}
                    </span>
                  </div>
                </div>

                <div className="aw-preview-meta-chips">
                  <span className="aw-meta-chip">{station}</span>
                  <span className="aw-meta-chip green">Available Today</span>
                </div>

                <p className="aw-preview-bio-text">
                  &ldquo;
                  {bio ||
                    "Experienced specialist dedicated to precision styling and luxury client care."}
                  &rdquo;
                </p>

                <div className="aw-preview-services-box">
                  <div className="aw-preview-services-label">
                    TOP ELIGIBLE CATALOG SERVICES
                  </div>
                  <div className="aw-preview-chips">
                    {selectedServicesList.length > 0 ? (
                      selectedServicesList.slice(0, 3).map((s) => (
                        <span key={s.id} className="aw-service-chip">
                          ✓ {s.name}
                        </span>
                      ))
                    ) : (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#87998e",
                          fontStyle: "italic",
                        }}
                      >
                        No services selected
                      </span>
                    )}
                    {selectedServicesList.length > 3 && (
                      <span className="aw-service-chip">
                        +{selectedServicesList.length - 3} more
                      </span>
                    )}
                  </div>
                </div>

                <button type="button" className="aw-btn-book-preview">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>Book Appointment with {fullName.split(" ")[0]}</span>
                </button>

                <div className="aw-preview-guarantee">
                  ✓ Instant Confirmation • Staff Guarantee
                </div>
              </div>
            </div>

            {/* 2. Shift & Working Hours */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Shift & Working Hours</h3>
                </div>
                <span className="aw-card-meta">Default: Salon Hours</span>
              </div>

              <div className="aw-schedule-row">
                <span className="aw-schedule-label">Weekly Schedule</span>
                <span className="aw-schedule-val">Mon - Fri (8.5 hrs)</span>
              </div>

              <div className="aw-times-grid">
                <div className="aw-time-field">
                  <span className="aw-time-label">TIME IN</span>
                  <input
                    type="text"
                    className="aw-input"
                    value={timeIn}
                    onChange={(e) => setTimeIn(e.target.value)}
                  />
                </div>
                <div className="aw-time-field">
                  <span className="aw-time-label">TIME OUT</span>
                  <input
                    type="text"
                    className="aw-input"
                    value={timeOut}
                    onChange={(e) => setTimeOut(e.target.value)}
                  />
                </div>
              </div>

              <div className="aw-form-group" style={{ marginBottom: 0 }}>
                <span className="aw-time-label" style={{ marginBottom: "6px" }}>
                  DESIGNATED WEEKLY OFF
                </span>
                <div className="aw-days-selector">
                  {DAYS_OF_WEEK.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`aw-day-btn ${weeklyOffDay === idx ? "active" : ""}`}
                      onClick={() => setWeeklyOffDay(idx)}
                    >
                      {day.short}
                    </button>
                  ))}
                </div>
                <span className="aw-day-note">
                  {DAYS_OF_WEEK[weeklyOffDay]?.full} assigned as weekly rest day
                </span>
              </div>
            </div>

            {/* 3. Commission Tier */}
            <div className="aw-card">
              <div className="aw-card-header">
                <div className="aw-card-title-group">
                  <div className="aw-card-icon">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="12" cy="8" r="7" />
                      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Commission Tier</h3>
                </div>
                <span
                  className="aw-card-meta"
                  style={{ color: "#c59b27", fontWeight: 700 }}
                >
                  Tier 2 Active
                </span>
              </div>

              <div className="aw-tiers-list">
                {[
                  {
                    title: "Tier 1 • Junior Stylist",
                    desc: "35% service payout + base stipend",
                  },
                  {
                    title: "Tier 2 • Senior Specialist",
                    desc: "40% service payout + 5% retail bonus",
                  },
                  {
                    title: "Tier 3 • Salon Director",
                    desc: "45% profit share on premium services",
                  },
                ].map((tier) => (
                  <div
                    key={tier.title}
                    className={`aw-tier-card ${
                      commissionTier === tier.title ? "selected" : ""
                    }`}
                    onClick={() => setCommissionTier(tier.title)}
                  >
                    <input
                      type="radio"
                      name="commission_tier"
                      checked={commissionTier === tier.title}
                      onChange={() => setCommissionTier(tier.title)}
                      className="aw-tier-radio"
                    />
                    <div className="aw-tier-info">
                      <span className="aw-tier-title">{tier.title}</span>
                      <span className="aw-tier-desc">{tier.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Auto-Sync With Client Portal Notice */}
            <div className="aw-sync-callout">
              <div className="aw-sync-icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div>
                <h5 className="aw-sync-title">Auto-Sync With Client Portal</h5>
                <p className="aw-sync-text">
                  Once created, this worker will immediately receive an
                  onboarding welcome email with their login ID and secure
                  password to access the BookMySalon Worker Portal, and arise on
                  client-facing discovery for <strong>{salonDetails.name}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------
          STICKY BOTTOM ACTION BAR
          -------------------------------------------------------------------- */}
      <footer className="aw-bottom-bar">
        <div className="aw-bottom-inner">
          <div className="aw-ready-status">
            <span className="aw-ready-icon">✓</span>
            <span>
              All mandatory fields saved, ready for partner directory activation.
            </span>
          </div>

          <div className="aw-bottom-actions">
            <button
              type="button"
              className="aw-btn-cancel"
              onClick={() => navigate("/owner/dashboard")}
            >
              Cancel
            </button>

            <button
              type="button"
              className="aw-btn-draft"
              onClick={() => {
                localStorage.setItem(
                  "bms_worker_draft",
                  JSON.stringify({ fullName, email, phoneNumber, station })
                );
                alert("Worker information saved as draft on this device.");
              }}
            >
              Save as Draft
            </button>

            <button
              type="button"
              className="aw-btn-submit"
              disabled={submitting}
              onClick={handleCreateWorker}
            >
              {submitting ? (
                <span>Creating &amp; Sending Email...</span>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  <span>Create Worker</span>
                </>
              )}
            </button>
          </div>
        </div>
      </footer>

      {/* --------------------------------------------------------------------
          SUCCESS MODAL WITH EMAIL & CREDENTIALS
          -------------------------------------------------------------------- */}
      {successModalData && (
        <div className="aw-modal-overlay">
          <div className="aw-success-modal">
            <div className="aw-modal-success-icon">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h3 className="aw-modal-title">Worker Account Created!</h3>
            <p className="aw-modal-subtitle">
              Specialist <strong>{successModalData.name}</strong> is now
              registered for <strong>{successModalData.salon}</strong>.
            </p>

            <div className="aw-email-dispatched-badge">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6zm-2 0l-8 5-8-5h16zm0 12H4V8l8 5 8-5v10z" />
              </svg>
              <span>
                {successModalData.email_sent
                  ? `Credentials sent to ${successModalData.email}`
                  : `Credentials generated for ${successModalData.email}`}
              </span>
            </div>

            <div className="aw-creds-box">
              <div className="aw-cred-row">
                <span className="aw-cred-label">Login Portal:</span>
                <span className="aw-cred-val">/login</span>
              </div>
              <div className="aw-cred-row">
                <span className="aw-cred-label">Worker ID (Email):</span>
                <span className="aw-cred-val">{successModalData.email}</span>
              </div>
              <div className="aw-cred-row">
                <span className="aw-cred-label">Temporary Password:</span>
                <span
                  className="aw-cred-val"
                  style={{ color: "#136636", fontWeight: 800 }}
                >
                  {successModalData.password}
                </span>
              </div>
              <div className="aw-cred-row">
                <span className="aw-cred-label">Station:</span>
                <span className="aw-cred-val">{successModalData.station}</span>
              </div>
            </div>

            <button
              type="button"
              className="aw-btn-copy"
              onClick={handleCopyCredentials}
            >
              <span>📋</span>
              <span>
                {copiedStatus
                  ? "✓ Credentials Copied to Clipboard!"
                  : "Copy Login Credentials"}
              </span>
            </button>

            <div className="aw-modal-actions">
              <button
                type="button"
                className="aw-btn-modal-secondary"
                onClick={() => {
                  setSuccessModalData(null);
                  setFullName("");
                  setEmail("");
                  setPhoneNumber("");
                }}
              >
                Add Another Worker
              </button>

              <button
                type="button"
                className="aw-btn-modal-primary"
                onClick={() => navigate("/owner/workers")}
              >
                View Worker Management
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          CUSTOM SPECIALIZATION MODAL
          -------------------------------------------------------------------- */}
      {showCustomSpecModal && (
        <div className="aw-modal-overlay">
          <div className="aw-custom-cat-modal">
            <h4 className="aw-custom-cat-title">Add Custom Category</h4>
            <form onSubmit={handleAddCustomSpec}>
              <div className="aw-form-group">
                <label className="aw-label">Category Name</label>
                <input
                  type="text"
                  className="aw-input"
                  placeholder="e.g. Hair Extensions, Bridal Makeup"
                  value={customSpecName}
                  onChange={(e) => setCustomSpecName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="aw-form-group">
                <label className="aw-label">Short Description</label>
                <input
                  type="text"
                  className="aw-input"
                  placeholder="e.g. Micro-link & tape-in applications"
                  value={customSpecDesc}
                  onChange={(e) => setCustomSpecDesc(e.target.value)}
                />
              </div>

              <div className="aw-modal-actions" style={{ marginTop: "20px" }}>
                <button
                  type="button"
                  className="aw-btn-modal-secondary"
                  onClick={() => setShowCustomSpecModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="aw-btn-modal-primary">
                  Add Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


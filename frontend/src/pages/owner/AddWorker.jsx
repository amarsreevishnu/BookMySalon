import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import "../../styles/addWorker.css";

const DAYS_OF_WEEK = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
];

const INITIAL_SPECIALIZATIONS = [
  { id: "hair", name: "Hair Styling", desc: "Cut, Color & Treatment", defaultSelected: true },
  { id: "beard", name: "Beard Grooming", desc: "Shaping & Hot Towel", defaultSelected: false },
  { id: "skin", name: "Skin & Facial", desc: "Aesthetic Cleansing", defaultSelected: false },
  { id: "spa", name: "Spa & Massage", desc: "Ayurvedic & Relax", defaultSelected: false },
  { id: "nail", name: "Nail Art & Care", desc: "Gel, Acrylic & Pedicure", defaultSelected: false },
];

export default function AddWorker() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const idCardFileInputRef = useRef(null);

  // Active Salon Metadata
  const [salonDetails, setSalonDetails] = useState({
    id: null,
    name: "",
    city: "",
  });
  const [isLoadingSalon, setIsLoadingSalon] = useState(true);
  const [hasActiveSalon, setHasActiveSalon] = useState(true);

  // Form Fields (Empty initial defaults - no dummy names or numbers)
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [experience, setExperience] = useState("Senior Specialist | 5-8 yrs");
  const [station, setStation] = useState("Chair #01 • Main Bay");
  const [employmentStatus, setEmploymentStatus] = useState("Full-Time Specialist");
  const [bio, setBio] = useState("");

  // Staff Photo (Only added by owner - no default portrait)
  const [profilePhoto, setProfilePhoto] = useState("");

  // Worker Identification Card (Aadhaar / Gov ID - Optional)
  const [idCardType, setIdCardType] = useState("Aadhaar Card");
  const [idCardNumber, setIdCardNumber] = useState("");
  const [idCardPhoto, setIdCardPhoto] = useState("");

  // Specializations
  const [specializationsList, setSpecializationsList] = useState(INITIAL_SPECIALIZATIONS);
  const [selectedSpecs, setSelectedSpecs] = useState(["Hair Styling"]);
  const [showCustomSpecModal, setShowCustomSpecModal] = useState(false);
  const [customSpecName, setCustomSpecName] = useState("");
  const [customSpecDesc, setCustomSpecDesc] = useState("");

  // Dynamic Services Catalog (Loaded strictly from server)
  const [availableServices, setAvailableServices] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [isLoadingServices, setIsLoadingServices] = useState(true);

  // Working Hours & Shift (Moved to main create form)
  const [timeIn, setTimeIn] = useState("09:00 AM");
  const [timeOut, setTimeOut] = useState("07:30 PM");
  const [weeklyOffDay, setWeeklyOffDay] = useState(2); // Wednesday (index 2)

  // Status & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successModalData, setSuccessModalData] = useState(null);
  const [copiedStatus, setCopiedStatus] = useState(false);

  // Fetch active salon and existing services dynamically from server
  useEffect(() => {
    let isMounted = true;

    const loadSalonAndServices = async () => {
      try {
        setIsLoadingSalon(true);
        setIsLoadingServices(true);

        // 1. Fetch which salon is currently active for this owner
        let activeSalon = null;
        try {
          const resWorkers = await api.get("/salons/owner/workers/");
          if (resWorkers.data?.salon && resWorkers.data.salon.id) {
            activeSalon = resWorkers.data.salon;
          }
        } catch (workerErr) {
          console.warn("Could not fetch salon from workers endpoint:", workerErr);
        }

        if (!activeSalon) {
          try {
            const resDash = await api.get("/salons/owner/dashboard/");
            if (resDash.data?.salon_info && resDash.data.salon_info.id) {
              activeSalon = resDash.data.salon_info;
            } else if (resDash.data?.salon && resDash.data.salon.id) {
              activeSalon = resDash.data.salon;
            }
          } catch (dashErr) {
            console.warn("Could not fetch salon from dashboard endpoint:", dashErr);
          }
        }

        if (!activeSalon) {
          try {
            const resProf = await api.get("/salons/owner/profile/");
            if (resProf.data?.id) {
              activeSalon = resProf.data;
            }
          } catch (profErr) {
            console.warn("Could not fetch salon from profile endpoint:", profErr);
          }
        }

        if (isMounted) {
          if (activeSalon && activeSalon.id) {
            setSalonDetails({
              id: activeSalon.id,
              name: activeSalon.name,
              city: activeSalon.city || "",
            });
            setHasActiveSalon(true);
          } else {
            setHasActiveSalon(false);
          }
        }

        // 2. Load services dynamically for the active salon
        let loadedServices = [];

        // Check custom offerings first
        try {
          const resOfferings = await api.get("/services/owner/services/");
          const srvList = resOfferings.data?.services || [];
          if (Array.isArray(srvList) && srvList.length > 0) {
            loadedServices = srvList.map((item) => ({
              id: String(item.id || item.service),
              name: item.effective_name || item.custom_name || item.service_details?.name || "Service",
              tag: "",
              price: String(item.price).startsWith("₹") ? item.price : `₹${item.price}`,
              raw_price: Number(item.price) || 0,
              duration: typeof item.duration === "number" ? `${item.duration} mins` : item.duration || "45 mins",
              desc: item.effective_description || item.description || "Expert salon service with standard care",
              category: item.category_name || "General",
            }));
          }
        } catch {
          // If offerings not loaded, fallback to salon.services or public catalog
        }

        // If no custom offerings, check salon.services from salon object
        if (
          loadedServices.length === 0 &&
          activeSalon?.services &&
          Array.isArray(activeSalon.services) &&
          activeSalon.services.length > 0
        ) {
          loadedServices = activeSalon.services.map((s, idx) => ({
            id: `salon-srv-${idx}`,
            name: typeof s === "string" ? s : s.name || `Service ${idx + 1}`,
            tag: "",
            price: s.price ? (String(s.price).startsWith("₹") ? s.price : `₹${s.price}`) : "₹500",
            raw_price: s.price ? Number(String(s.price).replace(/[^\d.]/g, "")) : 500,
            duration: s.duration || "45 mins",
            desc: s.description || "Standard salon service",
            category: s.category || "General",
          }));
        }

        // If still empty, fetch standard benchmark platform catalog
        if (loadedServices.length === 0) {
          try {
            const resCat = await api.get("/services/public/categories/");
            if (Array.isArray(resCat.data)) {
              const flat = [];
              resCat.data.forEach((cat) => {
                (cat.services || []).forEach((srv) => {
                  flat.push({
                    id: `catalog-${srv.id}`,
                    name: srv.name,
                    tag: "",
                    price: `₹${Math.round(Number(srv.standard_price)) || 450}`,
                    raw_price: Math.round(Number(srv.standard_price)) || 450,
                    duration: srv.standard_duration ? `${srv.standard_duration} mins` : "45 mins",
                    desc: srv.description || "Benchmark platform catalog service",
                    category: cat.name,
                  });
                });
              });
              loadedServices = flat;
            }
          } catch (catErr) {
            console.warn("Could not load public catalog services:", catErr);
          }
        }

        if (isMounted) {
          setAvailableServices(loadedServices);

          // Auto-derive specializations list from loaded categories if available
          const categoriesInServices = [
            ...new Set(loadedServices.map((s) => s.category).filter(Boolean)),
          ];
          if (categoriesInServices.length > 0) {
            const dynamicSpecs = categoriesInServices.map((catName, idx) => ({
              id: `cat-${idx}`,
              name: catName,
              desc: `Specialist services in ${catName}`,
              defaultSelected: idx === 0,
            }));
            setSpecializationsList(dynamicSpecs);
            setSelectedSpecs([categoriesInServices[0]]);
          }
        }
      } catch (err) {
        console.error("Error loading active salon data:", err);
      } finally {
        if (isMounted) {
          setIsLoadingSalon(false);
          setIsLoadingServices(false);
        }
      }
    };

    loadSalonAndServices();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Photo upload by owner
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
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Handle ID Card document scan upload (Optional)
  const handleIdCardUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("ID card file size must be less than 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setIdCardPhoto(String(reader.result || ""));
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveIdCardPhoto = () => {
    setIdCardPhoto("");
    if (idCardFileInputRef.current) idCardFileInputRef.current.value = "";
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

  // Toggle Services
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
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Please enter a valid work or contact email address.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage("Please enter a contact phone number.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setSubmitting(true);

    // Clean and normalize phone number (limit to <= 20 chars)
    const rawDigits = phoneNumber.replace(/\D/g, "");
    const localDigits = rawDigits.startsWith("91") && rawDigits.length > 10 ? rawDigits.slice(2) : rawDigits;
    const formattedPhone = localDigits ? `+91 ${localDigits}` : phoneNumber.trim();

    const payload = {
      full_name: fullName.trim(),
      email: email.trim().toLowerCase(),
      phone_number: formattedPhone,
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
      id_card_type: idCardType,
      id_card_number: idCardNumber.trim(),
      id_card_photo: idCardPhoto || "",
      profile_photo: profilePhoto || "",
    };

    try {
      let res;
      try {
        res = await api.post("/salons/owner/add-worker/", payload);
      } catch (endpointErr) {
        if (endpointErr.response?.status === 404) {
          res = await api.post("/salons/owner/workers/", payload);
        } else {
          throw endpointErr;
        }
      }
      const data = res.data;

      setSuccessModalData({
        name: fullName.trim(),
        email: email.trim().toLowerCase(),
        password:
          data.credentials?.password ||
          data.worker?.temporary_password ||
          "Worker@123",
        station: station,
        salon: salonDetails.name || "Your Salon",
        email_sent: data.email_sent !== false,
      });
    } catch (err) {
      console.error("Worker creation failed:", err);
      const data = err.response?.data;
      let msg = "";

      if (typeof data === "string") {
        msg = data;
      } else if (data?.email) {
        msg = Array.isArray(data.email) ? data.email.join(" ") : String(data.email);
      } else if (data?.phone_number) {
        msg = Array.isArray(data.phone_number) ? data.phone_number.join(" ") : String(data.phone_number);
      } else if (data?.detail) {
        msg = data.detail;
      } else if (data?.error) {
        msg = data.error;
      } else if (data?.message) {
        msg = data.message;
      } else if (data && typeof data === "object") {
        const errorList = [];
        for (const [field, val] of Object.entries(data)) {
          const fieldLabel = field !== "non_field_errors" ? `${field.replace(/_/g, " ")}: ` : "";
          if (Array.isArray(val)) {
            errorList.push(`${fieldLabel}${val.join(" ")}`);
          } else if (typeof val === "string") {
            errorList.push(`${fieldLabel}${val}`);
          }
        }
        msg = errorList.length > 0 ? errorList.join(" | ") : "Failed to create worker account. Please verify input fields.";
      } else {
        msg = err.message || "Failed to create worker account. Please check your network connection and input values.";
      }

      setErrorMessage(msg);
      window.scrollTo({ top: 0, behavior: "smooth" });
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
      {/* Reusable Owner Suite Header & Navbar */}
      <OwnerNavbarHeader showAddWorker={false} />
      <OwnerNavbar activeTab="Workers" />

      {/* Main Content Area */}
      <div className="aw-content-wrapper">
        {/* Breadcrumbs & Hero Header */}
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
              <span>STAFF ONBOARDING • CREATE WORKER</span>
            </div>

            <h1 className="aw-page-title">Add Worker</h1>
            <p className="aw-page-subtitle">
              Onboard a specialist for your salon, assign their chair/station, configure service
              capabilities, set work shifts, and preview their live booking card.
            </p>
          </div>

          <div className="aw-hero-actions">
            <Link to="/owner/workers" className="aw-pill-btn">
              <span>View All Workers</span>
            </Link>
          </div>
        </div>

        {/* Active Salon Banner */}
        {salonDetails.id ? (
          <div className="aw-active-salon-banner">
            <div className="aw-active-salon-left">
              <div className="aw-active-salon-icon">🏢</div>
              <div className="aw-active-salon-details">
                <span className="aw-active-salon-badge">ACTIVE SALON OUTLET</span>
                <h3 className="aw-active-salon-title">
                  {salonDetails.name} {salonDetails.city ? `• ${salonDetails.city}` : ""}
                </h3>
              </div>
            </div>
            <span className="aw-active-salon-status">✓ Active for Bookings</span>
          </div>
        ) : (
          !isLoadingSalon && (
            <div className="aw-no-salon-warning">
              <span>⚠️ No active registered salon found for your account. Please register your salon first.</span>
              <Link to="/owner/salons/create" className="aw-create-salon-link">Register Salon →</Link>
            </div>
          )
        )}

        {/* Error Alert */}
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

        {/* Main Two-Column Grid */}
        <div className="aw-main-grid">
          {/* LEFT COLUMN - MAIN WORKER CREATION FORM */}
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
                  <h3 className="aw-card-title">Staff Portrait</h3>
                </div>
                <span className="aw-card-meta">JPEG, PNG, WEBP (Optional)</span>
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
                    <div className="aw-avatar-empty-placeholder">
                      <span style={{ fontSize: "30px" }}>👤</span>
                      <span style={{ fontSize: "11px", color: "#6f8275", marginTop: "4px" }}>
                        No Photo
                      </span>
                    </div>
                  )}
                </div>

                <div className="aw-portrait-info">
                  <h4 className="aw-portrait-title">Worker Profile Picture (Optional)</h4>
                  <p className="aw-portrait-desc">
                    Upload an authentic, clear photo of the staff member. If no photo is uploaded,
                    a monogram avatar with the worker&apos;s initials will be shown.
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
                      <span>{profilePhoto ? "Change Photo" : "Upload Photo"}</span>
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
                    <span className="aw-sub-label">Official staff name</span>
                  </div>
                  <input
                    type="text"
                    className="aw-input"
                    placeholder="e.g. Rahul Sharma"
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
                      placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Work Email & Experience */}
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
                    placeholder="worker@salon.com"
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
                    <option value="Master Stylist | 8+ yrs">Master Stylist | 8+ yrs</option>
                    <option value="Senior Specialist | 5-8 yrs">Senior Specialist | 5-8 yrs</option>
                    <option value="Stylist | 3-5 yrs">Stylist | 3-5 yrs</option>
                    <option value="Junior Stylist | 1-2 yrs">Junior Stylist | 1-2 yrs</option>
                    <option value="Apprentice | < 1 yr">Apprentice | &lt; 1 yr</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Primary Station & Employment Status */}
              <div className="aw-form-row">
                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">Primary Chair / Station Assignment</label>
                  </div>
                  <select
                    className="aw-select"
                    value={station}
                    onChange={(e) => setStation(e.target.value)}
                  >
                    <option value="Chair #01 • Main Bay">Chair #01 • Main Bay</option>
                    <option value="Chair #02 • Color Bar">Chair #02 • Color Bar</option>
                    <option value="Station #03 • Styling Bay">Station #03 • Styling Bay</option>
                    <option value="Station #04 • Men's Grooming">Station #04 • Men&apos;s Grooming</option>
                    <option value="Spa Pod #01 • Wellness Wing">Spa Pod #01 • Wellness Wing</option>
                    <option value="Nail Station #01 • Lounge">Nail Station #01 • Lounge</option>
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
                    <option value="Full-Time Specialist">Full-Time Specialist</option>
                    <option value="Part-Time Specialist (Shift Based)">
                      Part-Time Specialist (Shift Based)
                    </option>
                    <option value="Contract / Booth Rental">Contract / Booth Rental</option>
                    <option value="Freelance Consultant">Freelance Consultant</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Professional Bio */}
              <div className="aw-form-group" style={{ marginBottom: 0 }}>
                <div className="aw-label-row">
                  <label className="aw-label">Professional Bio & Specialty Philosophy</label>
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

            {/* 3. Government Identification Card (Optional) */}
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
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <line x1="7" y1="8" x2="17" y2="8" />
                      <line x1="7" y1="12" x2="13" y2="12" />
                      <circle cx="15" cy="14" r="2" />
                    </svg>
                  </div>
                  <h3 className="aw-card-title">Worker Identification Card (Optional)</h3>
                </div>
                <span className="aw-card-meta">Aadhaar / Gov ID Verification</span>
              </div>

              <p className="aw-section-subtitle">
                Add government identity proof like Aadhaar card for background compliance and verification.
              </p>

              <div className="aw-form-row">
                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">ID Document Type</label>
                  </div>
                  <select
                    className="aw-select"
                    value={idCardType}
                    onChange={(e) => setIdCardType(e.target.value)}
                  >
                    <option value="Aadhaar Card">Aadhaar Card</option>
                    <option value="PAN Card">PAN Card</option>
                    <option value="Voter ID Card">Voter ID Card</option>
                    <option value="Driving License">Driving License</option>
                    <option value="Passport">Passport</option>
                  </select>
                </div>

                <div className="aw-form-group">
                  <div className="aw-label-row">
                    <label className="aw-label">ID Card / Document Number</label>
                    <span className="aw-sub-label">Optional</span>
                  </div>
                  <input
                    type="text"
                    className="aw-input"
                    placeholder="e.g. 1234 5678 9012"
                    value={idCardNumber}
                    onChange={(e) => setIdCardNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="aw-form-group" style={{ marginBottom: 0 }}>
                <div className="aw-label-row">
                  <label className="aw-label">ID Proof Document / Scan</label>
                  <span className="aw-sub-label">Optional (Max 5MB)</span>
                </div>

                <input
                  ref={idCardFileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleIdCardUpload}
                />

                {idCardPhoto ? (
                  <div className="aw-id-card-thumb-wrap">
                    <img
                      src={idCardPhoto}
                      alt="ID Document preview"
                      className="aw-id-card-preview-thumb"
                    />
                    <div className="aw-id-card-info">
                      <span className="aw-id-card-filename">✓ {idCardType} Attached</span>
                      <button
                        type="button"
                        className="aw-btn-remove"
                        onClick={handleRemoveIdCardPhoto}
                      >
                        Remove Document
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="aw-btn-upload"
                    style={{ marginTop: "6px" }}
                    onClick={() => idCardFileInputRef.current?.click()}
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
                    <span>Upload {idCardType} Photo / Scan</span>
                  </button>
                )}
              </div>
            </div>

            {/* 4. Specializations */}
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
                Defines which marketplace category feeds will display this worker when customers
                search for specialists.
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
                      <div className="aw-checkbox-custom">{isSelected && "✓"}</div>
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

            {/* 5. Assigned Services (Fetched dynamically from server) */}
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
                    Select All ({availableServices.length})
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
                Select which catalog services will be routed to this staff member&apos;s appointment queue.
              </p>

              {isLoadingServices ? (
                <div style={{ color: "#6f8275", padding: "16px 0", fontSize: "13px" }}>
                  Loading services from server...
                </div>
              ) : availableServices.length === 0 ? (
                <div
                  style={{
                    padding: "24px 16px",
                    textAlign: "center",
                    border: "1px dashed #cfded4",
                    borderRadius: "10px",
                    color: "#6f8275",
                  }}
                >
                  <span style={{ fontSize: "28px", display: "block", marginBottom: "6px" }}>✂️</span>
                  <strong>No services found for your salon.</strong>
                  <p style={{ margin: "4px 0 0", fontSize: "12px" }}>
                    Configure services in your salon menu to assign them to workers.
                  </p>
                </div>
              ) : (
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
                          <div className="aw-checkbox-custom">{isChecked && "✓"}</div>
                          <div className="aw-service-meta">
                            <div className="aw-service-title-row">
                              <span className="aw-service-name">{service.name}</span>
                              {service.category && (
                                <span className="aw-service-badge">{service.category}</span>
                              )}
                            </div>
                            <span className="aw-service-sub">{service.desc}</span>
                          </div>
                        </div>

                        <div className="aw-service-right">
                          <span className="aw-service-price">{service.price}</span>
                          <span className="aw-service-duration">{service.duration}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 6. Shift & Working Hours (Moved here from right column) */}
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
                <span className="aw-card-meta">Worker Operating Hours</span>
              </div>

              <div className="aw-schedule-row">
                <span className="aw-schedule-label">Weekly Schedule</span>
                <span className="aw-schedule-val">
                  6 Days Active • 1 Day Off ({DAYS_OF_WEEK[weeklyOffDay]?.full})
                </span>
              </div>

              <div className="aw-times-grid">
                <div className="aw-time-field">
                  <span className="aw-time-label">SHIFT TIME IN</span>
                  <input
                    type="text"
                    className="aw-input"
                    value={timeIn}
                    onChange={(e) => setTimeIn(e.target.value)}
                  />
                </div>
                <div className="aw-time-field">
                  <span className="aw-time-label">SHIFT TIME OUT</span>
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
                  DESIGNATED WEEKLY OFF DAY
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
                  {DAYS_OF_WEEK[weeklyOffDay]?.full} assigned as worker&apos;s weekly rest day
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN - LIVE MARKETPLACE PREVIEW */}
          <div className="aw-sidebar-column">
            {/* Live Marketplace Preview Card */}
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
                  {profilePhoto ? (
                    <img
                      src={profilePhoto}
                      alt={fullName || "Specialist"}
                      className="aw-preview-avatar"
                    />
                  ) : (
                    <div className="aw-preview-avatar-fallback">
                      {fullName
                        ? fullName
                            .split(" ")
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join("")
                            .toUpperCase()
                        : "👤"}
                    </div>
                  )}

                  <div className="aw-preview-info">
                    <h4 className="aw-preview-name">{fullName || "Specialist Name"}</h4>
                    <div className="aw-preview-rating-row">
                      <span className="aw-preview-star">★</span>
                      <span style={{ fontWeight: 700, color: "#19271e" }}>5.0</span>
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
                  {idCardNumber && <span className="aw-meta-chip">✓ Verified ID</span>}
                </div>

                <p className="aw-preview-bio-text">
                  &ldquo;
                  {bio ||
                    "Experienced specialist dedicated to precision styling and luxury client care."}
                  &rdquo;
                </p>

                <div className="aw-preview-services-box">
                  <div className="aw-preview-services-label">
                    ASSIGNED SERVICES ({selectedServicesList.length})
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
                  <span>Book Appointment with {fullName ? fullName.split(" ")[0] : "Staff"}</span>
                </button>

                <div className="aw-preview-guarantee">
                  ✓ Instant Confirmation • Staff Guarantee
                </div>
              </div>
            </div>

            {/* Auto-Sync & Credentials Notice */}
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
                <h5 className="aw-sync-title">Instant Credentials Dispatch</h5>
                <p className="aw-sync-text">
                  Upon creation, this specialist will receive an onboarding welcome email with their
                  login ID and secure password to access the BookMySalon Worker Portal for{" "}
                  <strong>{salonDetails.name || "your salon"}</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <footer className="aw-bottom-bar">
        <div className="aw-bottom-inner">
          <div className="aw-ready-status">
            <span className="aw-ready-icon">✓</span>
            <span>
              {salonDetails.name ? `Assigning staff to ${salonDetails.name}` : "Worker Profile Onboarding"}
            </span>
          </div>

          <div className="aw-bottom-actions">
            {errorMessage && (
              <span
                style={{
                  color: "#e53935",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  maxWidth: "280px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={errorMessage}
              >
                ⚠️ {errorMessage}
              </span>
            )}

            <button
              type="button"
              className="aw-btn-cancel"
              onClick={() => navigate("/owner/workers")}
            >
              Cancel
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

      {/* Success Modal */}
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
              Specialist <strong>{successModalData.name}</strong> is now registered for{" "}
              <strong>{successModalData.salon}</strong>.
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
                  setProfilePhoto("");
                  setIdCardNumber("");
                  setIdCardPhoto("");
                  setSelectedServiceIds([]);
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

      {/* Custom Specialization Modal */}
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

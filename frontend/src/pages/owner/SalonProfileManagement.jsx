import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/salonProfileManagement.css";

const CATEGORY_OPTIONS = [
  "Hair & Styling • Spa",
  "Hair & Styling",
  "Men's Grooming",
  "Skin & Facial",
  "Nail Bar & Art",
  "Spa & Wellness",
  "Bridal & Makeover",
  "Holistic Healing",
  "Multi-Service Studio",
];

const SECONDARY_FOCUS_OPTIONS = [
  "Unisex Salon & Wellness Spa",
  "Boutique Hair Studio",
  "Express Men's Grooming Lounge",
  "Organic Botanical Rituals",
  "Bridal Luxury Dressing Studio",
  "Aesthetic Skin Clinic",
  "Nail Care & Extensions",
];

const DEFAULT_DAYS = [
  { day: "Monday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Tuesday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Wednesday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Thursday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Friday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Saturday", isOpen: true, openTime: "09:00", closeTime: "21:00" },
  { day: "Sunday", isOpen: false, openTime: "10:00", closeTime: "19:00" },
];

const TIME_SLOTS = [
  "07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30",
  "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"
];

const ALL_AMENITY_OPTIONS = [
  { id: "valet", name: "Valet Parking", desc: "Free on-site valet assistance", icon: "🚗" },
  { id: "wifi", name: "High-Speed Wi-Fi", desc: "Fiber connection for clients", icon: "📶" },
  { id: "ac", name: "Air Conditioned", desc: "Dual-zone climate control", icon: "❄️" },
  { id: "refreshments", name: "Refreshments & Coffee", desc: "Artisanal coffee & herbal tea", icon: "☕" },
  { id: "vip", name: "Private VIP Suites", desc: "Exclusive couple & bridal rooms", icon: "👑" },
  { id: "sanitized", name: "Sanitized Tools", desc: "UV autoclave medical sterilization", icon: "✨" },
  { id: "restroom", name: "Restroom Inside", desc: "Clean private client washroom", icon: "🚻" },
  { id: "wheelchair", name: "Wheelchair Accessible", desc: "Ramp entrance & wide doorways", icon: "♿" },
  { id: "pet", name: "Pet Friendly", desc: "Small well-behaved pets welcome", icon: "🐾" },
  { id: "cashless", name: "Card & UPI Accepted", desc: "Cashless contactless billing", icon: "💳" },
  { id: "kids", name: "Kids Play Corner", desc: "Family & child-friendly lounge", icon: "🧸" },
  { id: "dyson", name: "Dyson Pro Haircare", desc: "Equipped with Dyson Pro tools", icon: "💨" },
];

function formatTimeLabel(time24) {
  if (!time24) return "";
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m < 10 ? "0" + m : m} ${period}`;
}

function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof Blob)) {
      resolve(file);
      return;
    }
    if (file.type === "image/svg+xml" || !file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
      return;
    }
    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        try {
          URL.revokeObjectURL(objectUrl);
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(objectUrl);
        }
      };
      img.onerror = () => resolve(null);
      img.src = objectUrl;
    } catch {
      resolve(null);
    }
  });
}

export default function SalonProfileManagement() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const regCertInputRef = useRef(null);
  const gstCertInputRef = useRef(null);
  const ownerIdInputRef = useRef(null);
  const ownerPhotoInputRef = useRef(null);

  // Staged document files for upload & renewal
  const [stagedDocs, setStagedDocs] = useState({
    registration_certificate: null,
    gst_certificate: null,
    owner_id_proof: null,
    owner_profile_photo: null,
  });

  // Loading & State
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [activeSection, setActiveSection] = useState("sec-basic");
  const [newHighlight, setNewHighlight] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState("Loaded from server");
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Original pristine data for Discard functionality
  const [serverData, setServerData] = useState(null);

  // Form State
  const [form, setForm] = useState({
    id: null,
    name: "ABC Salon & Spa - Indiranagar Flagship",
    tagline: "Luxury Hair, Skin, & Organic Spa Sanctuary",
    category: "Hair & Styling • Spa",
    secondary_category: "Unisex Salon & Wellness Spa",
    outlet_code: "#BLR-IND-04",
    established_year: "2018",
    short_summary: "Premier boutique salon offering precision styling and herbal wellness therapies.",
    description: "Step into our serene, climate-controlled sanctuary in the heart of Indiranagar. Featuring master stylists trained across Europe, our salon blends clean botanical haircare with high-precision grooming. Enjoy our sound-dampened VIP spa suites, bespoke espresso bar, and personalized consultations tailored to your scalp and hair health.",
    highlights: [
      "Organic Plant-Based Color",
      "Master Stylist Team",
      "Private VIP Spa Suites",
      "Clean Beauty Certified",
      "Dyson Supersonic Styling",
    ],
    address: "No. 42, 100 Feet Road, 4th Block",
    landmark: "Opposite Metro Pillar 128, 2nd Floor",
    city: "Bangalore",
    state: "Karnataka",
    pincode: "560038",
    latitude: 12.971598,
    longitude: 77.641151,
    phone: "+91 98765 43210",
    email: "contact@abcsalon.in",
    whatsapp_number: "+91 98765 43211",
    instagram_handle: "@abcsalon_indiranagar",
    website: "https://abcsalon.in",
    opening_hours: { days: DEFAULT_DAYS },
    amenities: [
      "Valet Parking",
      "High-Speed Wi-Fi",
      "Air Conditioned",
      "Refreshments & Coffee",
      "Private VIP Suites",
      "Sanitized Tools",
      "Restroom Inside",
      "Card & UPI Accepted",
    ],
    cover_image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
    images: [
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=80",
    ],
    approval_status: "APPROVED",
    registration_number: "",
    registration_valid_from: "",
    registration_valid_to: "",
    gst_number: "",
    owner_id_type: "Aadhaar Card",
    owner_id_number: "",
    registration_certificate: null,
    gst_certificate: null,
    owner_id_proof: null,
    owner_profile_photo: null,
    is_registration_expired: false,
    is_registration_expiring_soon: false,
    registration_days_left: null,
  });

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Fetch live salon profile from backend
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        let res;
        try {
          res = await api.get("/salons/owner/profile/", config);
        } catch {
          // Fallback to dashboard endpoint to resolve salon
          res = await api.get("/salons/owner/dashboard/", config);
        }

        if (res?.data) {
          const s = res.data.salon || res.data.salon_info || res.data;
          const mergedDays = s.opening_hours?.days?.length ? s.opening_hours.days : DEFAULT_DAYS;

          const loaded = {
            id: s.id || form.id,
            name: s.name || form.name,
            tagline: s.tagline || form.tagline,
            category: s.category || form.category,
            secondary_category: s.secondary_category || form.secondary_category,
            outlet_code: s.outlet_code || `#0${s.id || 4}`,
            established_year: s.established_year || form.established_year,
            short_summary: s.short_summary || form.short_summary,
            description: s.description || form.description,
            highlights: Array.isArray(s.highlights) && s.highlights.length ? s.highlights : form.highlights,
            address: s.address || form.address,
            landmark: s.landmark || form.landmark,
            city: s.city || form.city,
            state: s.state || form.state,
            pincode: s.pincode || form.pincode,
            latitude: s.latitude ? Number(s.latitude) : form.latitude,
            longitude: s.longitude ? Number(s.longitude) : form.longitude,
            phone: s.phone || form.phone,
            email: s.email || form.email,
            whatsapp_number: s.whatsapp_number || form.whatsapp_number,
            instagram_handle: s.instagram_handle || form.instagram_handle,
            website: s.website || form.website,
            opening_hours: { days: mergedDays },
            amenities: Array.isArray(s.amenities) && s.amenities.length ? s.amenities : form.amenities,
            cover_image: s.cover_image || form.cover_image,
            images: Array.isArray(s.images) && s.images.length ? s.images : form.images,
            approval_status: s.approval_status || "APPROVED",
            registration_number: s.registration_number || "",
            registration_valid_from: s.registration_valid_from || "",
            registration_valid_to: s.registration_valid_to || "",
            gst_number: s.gst_number || "",
            owner_id_type: s.owner_id_type || "Aadhaar Card",
            owner_id_number: s.owner_id_number || "",
            registration_certificate: s.registration_certificate || null,
            gst_certificate: s.gst_certificate || null,
            owner_id_proof: s.owner_id_proof || null,
            owner_profile_photo: s.owner_profile_photo || null,
            is_registration_expired: s.is_registration_expired || false,
            is_registration_expiring_soon: s.is_registration_expiring_soon || false,
            registration_days_left: s.registration_days_left ?? null,
          };

          setForm(loaded);
          setServerData(JSON.parse(JSON.stringify(loaded)));
          setLastSavedTime("Synced with server");
        }
      } catch (err) {
        console.warn("Could not load salon profile from backend, using studio defaults:", err);
        setServerData(JSON.parse(JSON.stringify(form)));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  // Update simple fields
  const handleFieldChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Highlights handlers
  const handleAddHighlight = (e) => {
    if (e) e.preventDefault();
    const clean = newHighlight.trim();
    if (!clean) return;
    if (form.highlights.includes(clean)) {
      setNewHighlight("");
      return;
    }
    setForm((prev) => ({
      ...prev,
      highlights: [...prev.highlights, clean],
    }));
    setNewHighlight("");
    setIsDirty(true);
  };

  const handleRemoveHighlight = (idx) => {
    setForm((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((_, i) => i !== idx),
    }));
    setIsDirty(true);
  };

  // Schedule Days handlers
  const handleToggleDay = (dayName) => {
    setForm((prev) => {
      const days = (prev.opening_hours?.days || DEFAULT_DAYS).map((d) =>
        d.day === dayName ? { ...d, isOpen: !d.isOpen } : d
      );
      return { ...prev, opening_hours: { days } };
    });
    setIsDirty(true);
  };

  const handleDayTimeChange = (dayName, field, value) => {
    setForm((prev) => {
      const days = (prev.opening_hours?.days || DEFAULT_DAYS).map((d) =>
        d.day === dayName ? { ...d, [field]: value } : d
      );
      return { ...prev, opening_hours: { days } };
    });
    setIsDirty(true);
  };

  const handleApplyAllHours = () => {
    setForm((prev) => {
      const days = (prev.opening_hours?.days || DEFAULT_DAYS).map((d) => ({
        ...d,
        isOpen: true,
        openTime: "09:00",
        closeTime: "21:00",
      }));
      return { ...prev, opening_hours: { days } };
    });
    setIsDirty(true);
    showToast("Applied 09:00 AM - 09:00 PM across all days.");
  };

  // Amenities selection toggle
  const handleToggleAmenity = (name) => {
    setForm((prev) => {
      const exists = prev.amenities.includes(name);
      const next = exists
        ? prev.amenities.filter((a) => a !== name)
        : [...prev.amenities, name];
      return { ...prev, amenities: next };
    });
    setIsDirty(true);
  };

  // Photos Handlers
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const compressedList = await Promise.all(files.map((f) => compressImage(f)));
      const valid = compressedList.filter(Boolean);
      if (valid.length) {
        setForm((prev) => ({
          ...prev,
          images: [...prev.images, ...valid],
          cover_image: prev.cover_image || valid[0],
        }));
        setIsDirty(true);
        showToast(`Added ${valid.length} photo(s) to gallery.`);
      }
    } catch {
      showToast("Error processing photos. Please select standard JPG or PNG images.");
    }
  };

  const handleSetCoverPhoto = (imgUrl) => {
    setForm((prev) => ({ ...prev, cover_image: imgUrl }));
    setIsDirty(true);
    showToast("Updated primary cover photo.");
  };

  const handleDeletePhoto = (index) => {
    setForm((prev) => {
      const nextImages = prev.images.filter((_, i) => i !== index);
      let nextCover = prev.cover_image;
      if (prev.cover_image === prev.images[index]) {
        nextCover = nextImages[0] || "";
      }
      return { ...prev, images: nextImages, cover_image: nextCover };
    });
    setIsDirty(true);
  };

  // Geolocation detector
  const handleDetectCoordinates = () => {
    if (!navigator.geolocation) {
      showToast("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
        setIsDirty(true);
        showToast(`Updated GPS coordinates to ${lat}, ${lng}`);
      },
      () => {
        showToast("Could not retrieve current location. Please verify browser permissions.");
      }
    );
  };

  const ALLOWED_DOC_EXTS = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];
  const MAX_DOC_BYTES = 10 * 1024 * 1024; // 10MB

  const handleDocFileSelect = (docKey, file) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const isValidExt = ALLOWED_DOC_EXTS.some((ext) => lowerName.endsWith(ext));
    if (!isValidExt) {
      showToast(`Invalid file type for "${file.name}". Supported formats: PDF, JPG, JPEG, PNG.`);
      return;
    }

    if (file.size > MAX_DOC_BYTES) {
      showToast(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max allowed size is 10MB.`);
      return;
    }

    if (docKey === "owner_profile_photo" && !file.type.startsWith("image/")) {
      showToast("Owner Profile Photo must be an image file (PNG, JPG, WebP).");
      return;
    }

    setStagedDocs((prev) => ({
      ...prev,
      [docKey]: file,
    }));
    setIsDirty(true);
    showToast(`✓ Selected new file: ${file.name}`);
  };

  const handleRemoveStagedDoc = (docKey) => {
    setStagedDocs((prev) => ({
      ...prev,
      [docKey]: null,
    }));
    setIsDirty(true);
    showToast("Removed staged document.");
  };

  // Discard changes
  const handleDiscardChanges = () => {
    if (!serverData) return;
    setForm(JSON.parse(JSON.stringify(serverData)));
    setStagedDocs({
      registration_certificate: null,
      gst_certificate: null,
      owner_id_proof: null,
      owner_profile_photo: null,
    });
    setIsDirty(false);
    setShowDiscardModal(false);
    showToast("Reverted all unsaved modifications.");
  };

  // Save changes to backend
  const handleSaveChanges = async () => {
    if (form.registration_valid_from && form.registration_valid_to) {
      if (form.registration_valid_to < form.registration_valid_from) {
        showToast("Registration Valid Till date must be on or after Valid From date.");
        return;
      }
    }

    setIsSaving(true);
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const payload = {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        category: form.category,
        secondary_category: form.secondary_category,
        outlet_code: form.outlet_code.trim(),
        established_year: form.established_year.trim(),
        short_summary: form.short_summary.trim(),
        description: form.description.trim(),
        highlights: form.highlights,
        address: form.address.trim(),
        landmark: form.landmark.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        latitude: form.latitude ? Number(Number(form.latitude).toFixed(6)) : null,
        longitude: form.longitude ? Number(Number(form.longitude).toFixed(6)) : null,
        phone: form.phone.trim(),
        email: form.email.trim(),
        whatsapp_number: form.whatsapp_number.trim(),
        instagram_handle: form.instagram_handle.trim(),
        website: form.website.trim(),
        opening_hours: form.opening_hours,
        amenities: form.amenities,
        cover_image: form.cover_image,
        images: form.images,
        registration_number: (form.registration_number || "").trim(),
        registration_valid_from: form.registration_valid_from || null,
        registration_valid_to: form.registration_valid_to || null,
        gst_number: (form.gst_number || "").trim(),
        owner_id_type: form.owner_id_type || "Aadhaar Card",
        owner_id_number: (form.owner_id_number || "").trim(),
      };

      let res;
      const hasStagedFiles = Object.values(stagedDocs).some(Boolean);
      if (hasStagedFiles) {
        const formData = new FormData();
        Object.entries(payload).forEach(([k, v]) => {
          if (v !== null && v !== undefined) {
            if (typeof v === "object") {
              formData.append(k, JSON.stringify(v));
            } else {
              formData.append(k, String(v));
            }
          }
        });
        if (stagedDocs.registration_certificate) {
          formData.append("registration_certificate", stagedDocs.registration_certificate);
        }
        if (stagedDocs.gst_certificate) {
          formData.append("gst_certificate", stagedDocs.gst_certificate);
        }
        if (stagedDocs.owner_id_proof) {
          formData.append("owner_id_proof", stagedDocs.owner_id_proof);
        }
        if (stagedDocs.owner_profile_photo) {
          formData.append("owner_profile_photo", stagedDocs.owner_profile_photo);
        }

        res = await api.patch("/salons/owner/profile/", formData, {
          headers: {
            ...(config.headers || {}),
            "Content-Type": "multipart/form-data",
          },
        });
      } else {
        res = await api.patch("/salons/owner/profile/", payload, config);
      }

      if (res.status === 200) {
        const updated = res.data.salon || res.data;
        setForm((prev) => ({ ...prev, ...updated }));
        setServerData(JSON.parse(JSON.stringify({ ...form, ...updated })));
        setStagedDocs({
          registration_certificate: null,
          gst_certificate: null,
          owner_id_proof: null,
          owner_profile_photo: null,
        });
        setIsDirty(false);
        const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        setLastSavedTime(`Saved at ${timeStr}`);
        showToast("✓ Salon profile and documents updated successfully!");
      }
    } catch (err) {
      console.error("Save error:", err);
      showToast(err.response?.data?.error || err.response?.data?.detail || "Failed to save profile changes.");
    } finally {
      setIsSaving(false);
    }
  };

  // Profile Completeness Calculation
  const completeness = useMemo(() => {
    let score = 0;
    const items = [
      Boolean(form.name.trim()),
      Boolean(form.tagline.trim()),
      Boolean(form.category),
      Boolean(form.short_summary.trim() && form.description.trim()),
      Boolean(form.highlights.length >= 3),
      Boolean(form.address.trim() && form.city.trim() && form.pincode.trim()),
      Boolean(form.phone.trim() && form.email.trim()),
      Boolean(form.whatsapp_number.trim()),
      Boolean(form.amenities.length >= 4),
      Boolean(form.images.length >= 3),
    ];
    items.forEach((it) => {
      if (it) score += 10;
    });

    let advice = "Your salon profile is comprehensive and verified!";
    if (form.images.length < 3) {
      advice = "Add 2 more interior photos to reach the 100% Star-Partner tier.";
    } else if (!form.whatsapp_number.trim()) {
      advice = "Add a WhatsApp helpline for automated instant client booking confirmations.";
    } else if (form.amenities.length < 4) {
      advice = "Select more comfort amenities to rank higher on filtered searches.";
    } else if (!form.short_summary.trim()) {
      advice = "Add a short summary snippet to elevate your card in search results.";
    }

    return { percentage: Math.min(score, 100), advice };
  }, [form]);

  // Today's schedule text snippet for card preview
  const todayHoursSnippet = useMemo(() => {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = dayNames[new Date().getDay()];
    const todaySched = (form.opening_hours?.days || DEFAULT_DAYS).find((d) => d.day === todayName);
    if (!todaySched || !todaySched.isOpen) return "Closed Today";
    return `Open Today: ${formatTimeLabel(todaySched.openTime)} - ${formatTimeLabel(todaySched.closeTime)}`;
  }, [form.opening_hours]);

  const getRegistrationValidityInfo = (validFrom, validTo) => {
    if (!validTo) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const toDate = new Date(validTo);
    toDate.setHours(0, 0, 0, 0);

    const diffTime = toDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        status: "expired",
        badge: "Registration Expired",
        color: "#b91c1c",
        bg: "#fef2f2",
        border: "#fca5a5",
        text: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago on ${validTo}. Please update your renewed registration certificate.`,
      };
    } else if (diffDays <= 30) {
      return {
        status: "expiring_soon",
        badge: "Expiring Soon",
        color: "#b45309",
        bg: "#fffbeb",
        border: "#fcd34d",
        text: `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"} on ${validTo}. Please upload your renewed license to prevent listing pause.`,
      };
    } else {
      return {
        status: "active",
        badge: "Registration Active",
        color: "#166534",
        bg: "#f0fdf4",
        border: "#bbf7d0",
        text: `Active & Valid for ${diffDays} more days (till ${validTo}). Fully compliant.`,
      };
    }
  };

  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="sp-page-wrapper">
      {/* --------------------------------------------------------------------
          STUDIO TOPBAR NAVIGATION & TABS
          -------------------------------------------------------------------- */}
      <OwnerNavbarHeader />
      <OwnerNavbar activeTab="Salon" />

      {/* --------------------------------------------------------------------
          PAGE STICKY TITLE & ACTIONS BAR
          -------------------------------------------------------------------- */}
      <header className="sp-title-bar-wrap">
        <div className="sp-title-bar-inner">
          <div className="sp-breadcrumbs">
            <Link to="/owner/dashboard" className="sp-breadcrumb-link">
              Dashboard
            </Link>
            <span className="sp-breadcrumb-sep">/</span>
            <span className="sp-breadcrumb-current">Salon Profile </span>
          </div>

          <div className="sp-title-row">
            <div className="sp-title-left">
              <h1>Salon Profile Management</h1>
              <p>
                Fine-tune your brand presence on BookMySalon, update discovery cards, coordinates, business hours, and photo galleries.
              </p>
            </div>

            <div className="sp-title-actions">
              {isDirty && (
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={() => setShowDiscardModal(true)}
                  disabled={isSaving}
                >
                  Discard Changes
                </button>
              )}

              <button
                type="button"
                className="sp-btn-primary"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save & Publish Changes"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------------------
          SECTION QUICK JUMP NAVIGATION PILLS
          -------------------------------------------------------------------- */}
      <nav className="sp-jump-nav-wrap" aria-label="Section shortcuts">
        <div className="sp-jump-nav-inner">
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-basic" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-basic")}
          >
            <span>🏷️</span> Basic Information
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-narrative" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-narrative")}
          >
            <span>✍️</span> Narrative & Highlights
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-location" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-location")}
          >
            <span>📍</span> Location & Coordinates
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-contact" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-contact")}
          >
            <span>📞</span> Contact & Helplines
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-hours" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-hours")}
          >
            <span>⏱️</span> Operating Hours
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-amenities" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-amenities")}
          >
            <span>✨</span> Facilities & Amenities
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-gallery" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-gallery")}
          >
            <span>🖼️</span> Visual Gallery
          </button>
          <button
            type="button"
            className={`sp-jump-pill ${activeSection === "sec-compliance" ? "active" : ""}`}
            onClick={() => scrollToSection("sec-compliance")}
          >
            <span>📜</span> Registration & Documents
          </button>
        </div>
      </nav>

      {/* --------------------------------------------------------------------
          MAIN 2-COLUMN CONTAINER
          -------------------------------------------------------------------- */}
      <div className="sp-container">
        {/* ==================================================================
            LEFT COLUMN: FORM SECTIONS
            ================================================================== */}
        <div className="sp-sections-col">
          {/* SECTION 1: BASIC INFORMATION */}
          <section className="sp-card" id="sec-basic">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">🏷️</div>
                <div>
                  <h2>Basic Information</h2>
                  <p>Official display name, category taxonomy, and outlet branding</p>
                </div>
              </div>
              <span className="sp-header-pill success">Verified Business</span>
            </div>

            <div className="sp-form-grid cols-1">
              <div className="sp-field">
                <div className="sp-label-row">
                  <label className="sp-label" htmlFor="sp-salon-name">
                    Salon Registered Name
                  </label>
                  <span className="sp-char-counter">{form.name.length}/60</span>
                </div>
                <input
                  id="sp-salon-name"
                  type="text"
                  className="sp-input"
                  maxLength={60}
                  value={form.name}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="e.g. ABC Salon & Spa - Indiranagar Flagship"
                />
              </div>

              <div className="sp-field">
                <div className="sp-label-row">
                  <label className="sp-label" htmlFor="sp-tagline">
                    Brand Tagline / Subtitle
                  </label>
                  <span className="sp-label-sub">Short aesthetic caption</span>
                </div>
                <input
                  id="sp-tagline"
                  type="text"
                  className="sp-input"
                  maxLength={100}
                  value={form.tagline}
                  onChange={(e) => handleFieldChange("tagline", e.target.value)}
                  placeholder="e.g. Luxury Hair, Skin, & Organic Spa Sanctuary"
                />
              </div>

              <div className="sp-form-grid">
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-primary-cat">
                    Primary Salon Category
                  </label>
                  <select
                    id="sp-primary-cat"
                    className="sp-select"
                    value={form.category}
                    onChange={(e) => handleFieldChange("category", e.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-second-cat">
                    Secondary Category / Focus
                  </label>
                  <select
                    id="sp-second-cat"
                    className="sp-select"
                    value={form.secondary_category}
                    onChange={(e) => handleFieldChange("secondary_category", e.target.value)}
                  >
                    {SECONDARY_FOCUS_OPTIONS.map((foc) => (
                      <option key={foc} value={foc}>
                        {foc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="sp-form-grid">
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-outlet-code">
                    Outlet Identifier / Code
                  </label>
                  <input
                    id="sp-outlet-code"
                    type="text"
                    className="sp-input"
                    value={form.outlet_code}
                    onChange={(e) => handleFieldChange("outlet_code", e.target.value)}
                    placeholder="e.g. #BLR-IND-04"
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-est-year">
                    Year of Establishment
                  </label>
                  <input
                    id="sp-est-year"
                    type="text"
                    className="sp-input"
                    value={form.established_year}
                    onChange={(e) => handleFieldChange("established_year", e.target.value)}
                    placeholder="e.g. 2018"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: NARRATIVE & HIGHLIGHTS */}
          <section className="sp-card" id="sec-narrative">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">✍️</div>
                <div>
                  <h2>Narrative & Highlights</h2>
                  <p>Tell clients your story, brand ethos, and signature specialities</p>
                </div>
              </div>
            </div>

            <div className="sp-form-grid cols-1">
              <div className="sp-field">
                <div className="sp-label-row">
                  <label className="sp-label" htmlFor="sp-short-summary">
                    Short Summary (Search Snippet)
                  </label>
                  <span className="sp-char-counter">{form.short_summary.length}/160</span>
                </div>
                <input
                  id="sp-short-summary"
                  type="text"
                  className="sp-input"
                  maxLength={160}
                  value={form.short_summary}
                  onChange={(e) => handleFieldChange("short_summary", e.target.value)}
                  placeholder="1-2 punchy sentences shown on mobile search cards..."
                />
              </div>

              <div className="sp-field">
                <div className="sp-label-row">
                  <label className="sp-label" htmlFor="sp-desc">
                    About the Salon / Detailed Description
                  </label>
                  <span className="sp-char-counter">{form.description.length} chars</span>
                </div>
                <textarea
                  id="sp-desc"
                  className="sp-textarea"
                  rows={5}
                  value={form.description}
                  onChange={(e) => handleFieldChange("description", e.target.value)}
                  placeholder="Describe your atmosphere, stylist experience, hygiene protocols, and guest comfort..."
                />
              </div>

              <div className="sp-field">
                <label className="sp-label">Signature Highlights & Specialities</label>
                <span className="sp-label-sub">
                  Chips that appear prominently across your venue badge bar
                </span>

                <div className="sp-chips-container">
                  {form.highlights.map((chip, idx) => (
                    <span key={chip + idx} className="sp-chip">
                      <span>✓ {chip}</span>
                      <button
                        type="button"
                        className="sp-chip-remove"
                        onClick={() => handleRemoveHighlight(idx)}
                        title={`Remove ${chip}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="sp-add-chip-row">
                  <input
                    type="text"
                    className="sp-input"
                    placeholder="Add highlight (e.g. Dyson Supersonic, VIP Suites)..."
                    value={newHighlight}
                    onChange={(e) => setNewHighlight(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddHighlight();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="sp-btn-secondary"
                    onClick={handleAddHighlight}
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: LOCATION & COORDINATES */}
          <section className="sp-card" id="sec-location">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">📍</div>
                <div>
                  <h2>Location & Coordinates</h2>
                  <p>Physical address and GPS pin for geo-distance search and navigation</p>
                </div>
              </div>
              <span className="sp-header-pill success">Map Pin Active</span>
            </div>

            <div className="sp-form-grid cols-1">
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-address">
                  Street Address
                </label>
                <input
                  id="sp-address"
                  type="text"
                  className="sp-input"
                  value={form.address}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  placeholder="e.g. No. 42, 100 Feet Road, 4th Block"
                />
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-landmark">
                  Landmark / Suite / Floor
                </label>
                <input
                  id="sp-landmark"
                  type="text"
                  className="sp-input"
                  value={form.landmark}
                  onChange={(e) => handleFieldChange("landmark", e.target.value)}
                  placeholder="e.g. Opposite Metro Pillar 128, 2nd Floor"
                />
              </div>

              <div className="sp-form-grid cols-3">
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-city">
                    City
                  </label>
                  <input
                    id="sp-city"
                    type="text"
                    className="sp-input"
                    value={form.city}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-state">
                    State
                  </label>
                  <input
                    id="sp-state"
                    type="text"
                    className="sp-input"
                    value={form.state}
                    onChange={(e) => handleFieldChange("state", e.target.value)}
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-pincode">
                    Pincode
                  </label>
                  <input
                    id="sp-pincode"
                    type="text"
                    className="sp-input"
                    value={form.pincode}
                    onChange={(e) => handleFieldChange("pincode", e.target.value)}
                  />
                </div>
              </div>

              <div className="sp-form-grid">
                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-lat">
                    Latitude Coordinates
                  </label>
                  <input
                    id="sp-lat"
                    type="number"
                    step="0.000001"
                    className="sp-input"
                    value={form.latitude || ""}
                    onChange={(e) => handleFieldChange("latitude", e.target.value)}
                  />
                </div>

                <div className="sp-field">
                  <label className="sp-label" htmlFor="sp-lng">
                    Longitude Coordinates
                  </label>
                  <input
                    id="sp-lng"
                    type="number"
                    step="0.000001"
                    className="sp-input"
                    value={form.longitude || ""}
                    onChange={(e) => handleFieldChange("longitude", e.target.value)}
                  />
                </div>
              </div>

              {/* Visual Map Preview */}
              <div className="sp-map-preview-box">
                <iframe
                  title="Salon Location Map"
                  className="sp-map-iframe"
                  loading="lazy"
                  src={`https://maps.google.com/maps?q=${form.latitude || 12.9716},${form.longitude || 77.6412}&z=15&output=embed`}
                />
                <div className="sp-map-overlay-controls">
                  <button
                    type="button"
                    className="sp-map-action-btn"
                    onClick={handleDetectCoordinates}
                    title="Use device GPS"
                  >
                    <span>🧭</span> Detect My Location
                  </button>
                  <a
                    href={`https://maps.google.com/?q=${form.latitude || 12.9716},${form.longitude || 77.6412}`}
                    target="_blank"
                    rel="noreferrer"
                    className="sp-map-action-btn"
                  >
                    <span>↗</span> Open Full Maps
                  </a>
                </div>
              </div>
              <div className="sp-map-hint">
                <span>ℹ️</span> Accurate coordinates enable nearby clients to discover your studio through the 'Near Me' search filter.
              </div>
            </div>
          </section>

          {/* SECTION 4: CONTACT & HELPLINES */}
          <section className="sp-card" id="sec-contact">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">📞</div>
                <div>
                  <h2>Contact & Helplines</h2>
                  <p>Direct customer communications and appointment assistance</p>
                </div>
              </div>
            </div>

            <div className="sp-form-grid">
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-phone">
                  Primary Contact Phone
                </label>
                <div className="sp-input-with-icon">
                  <span className="sp-input-icon">📞</span>
                  <input
                    id="sp-phone"
                    type="text"
                    className="sp-input"
                    value={form.phone}
                    onChange={(e) => handleFieldChange("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-email">
                  <span>Official Email Address</span>
                  <span style={{ fontSize: "0.72rem", color: "#166534" }}> 🔒 ✓ Verified  </span>
                </label>
                <div className="sp-input-with-icon">
                  <span className="sp-input-icon">✉️</span>
                  <input
                    id="sp-email"
                    type="email"
                    className="sp-input"
                    value={form.email}
                    disabled
                    title="Registered email address cannot be changed."
                  />
                </div>
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-whatsapp">
                  WhatsApp Helpline (Client Notifications)
                </label>
                <div className="sp-input-with-icon">
                  <span className="sp-input-icon">💬</span>
                  <input
                    id="sp-whatsapp"
                    type="text"
                    className="sp-input"
                    value={form.whatsapp_number}
                    onChange={(e) => handleFieldChange("whatsapp_number", e.target.value)}
                    placeholder="+91 98765 43211"
                  />
                </div>
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-instagram">
                  Instagram / Social Handle
                </label>
                <div className="sp-input-with-icon">
                  <span className="sp-input-icon">📸</span>
                  <input
                    id="sp-instagram"
                    type="text"
                    className="sp-input"
                    value={form.instagram_handle}
                    onChange={(e) => handleFieldChange("instagram_handle", e.target.value)}
                    placeholder="@abcsalon_indiranagar"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: OPERATING HOURS & SCHEDULE */}
          <section className="sp-card" id="sec-hours">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">⏱️</div>
                <div>
                  <h2>Operating Hours & Schedule</h2>
                  <p>Define open days and working shifts for automated online booking availability</p>
                </div>
              </div>
              <div className="sp-hours-presets-row">
                <button
                  type="button"
                  className="sp-btn-compact"
                  onClick={handleApplyAllHours}
                >
                  Apply All 9AM - 9PM
                </button>
              </div>
            </div>

            <table className="sp-hours-table" aria-label="Operating Hours Table">
              <tbody>
                {(form.opening_hours?.days || DEFAULT_DAYS).map((daySched) => (
                  <tr
                    key={daySched.day}
                    className={`sp-hours-row ${daySched.isOpen ? "is-open" : "is-closed"}`}
                  >
                    <td className="sp-hours-cell">
                      <label className="sp-hours-day-label">
                        <input
                          type="checkbox"
                          className="sp-hours-toggle"
                          checked={daySched.isOpen}
                          onChange={() => handleToggleDay(daySched.day)}
                        />
                        <span>{daySched.day}</span>
                      </label>
                    </td>

                    <td className="sp-hours-cell">
                      <select
                        className="sp-hours-time-select"
                        disabled={!daySched.isOpen}
                        value={daySched.openTime || "09:00"}
                        onChange={(e) => handleDayTimeChange(daySched.day, "openTime", e.target.value)}
                      >
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {formatTimeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="sp-hours-cell" style={{ textAlign: "center", color: "#8fa095" }}>
                      to
                    </td>

                    <td className="sp-hours-cell">
                      <select
                        className="sp-hours-time-select"
                        disabled={!daySched.isOpen}
                        value={daySched.closeTime || "21:00"}
                        onChange={(e) => handleDayTimeChange(daySched.day, "closeTime", e.target.value)}
                      >
                        {TIME_SLOTS.map((t) => (
                          <option key={t} value={t}>
                            {formatTimeLabel(t)}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="sp-hours-cell" style={{ textAlign: "right" }}>
                      {daySched.isOpen ? (
                        <span className="sp-hours-status-badge open">Open Today</span>
                      ) : (
                        <span className="sp-hours-status-badge closed">Weekly Off / Closed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="sp-hours-notice-card">
              <span>💡</span>
              <div>
                Need to block chairs for maintenance or sanitation breaks? You can manage temporary chair holds anytime on the <strong>Dashboard & Schedule</strong> panel.
              </div>
            </div>
          </section>

          {/* SECTION 6: FACILITIES & SENSORY AMENITIES */}
          <section className="sp-card" id="sec-amenities">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">✨</div>
                <div>
                  <h2>Facilities & Sensory Amenities</h2>
                  <p>Comfort features that elevate your discovery score and filter rankings</p>
                </div>
              </div>
              <span className="sp-header-pill info">
                {form.amenities.length} Selected
              </span>
            </div>

            <div className="sp-amenities-grid">
              {ALL_AMENITY_OPTIONS.map((item) => {
                const isSelected = form.amenities.includes(item.name);
                return (
                  <div
                    key={item.id}
                    className={`sp-amenity-card ${isSelected ? "selected" : ""}`}
                    onClick={() => handleToggleAmenity(item.name)}
                    role="checkbox"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        handleToggleAmenity(item.name);
                      }
                    }}
                  >
                    <div className="sp-amenity-icon">{item.icon}</div>
                    <div className="sp-amenity-info">
                      <div className="sp-amenity-title">{item.name}</div>
                      <div className="sp-amenity-desc">{item.desc}</div>
                    </div>
                    <div className="sp-amenity-check">{isSelected ? "✓" : ""}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 7: VISUAL GALLERY & SANCTUARY IMAGERY */}
          <section className="sp-card" id="sec-gallery">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">🖼️</div>
                <div>
                  <h2>Visual Gallery & Sanctuary Imagery</h2>
                  <p>High-resolution photos showcasing interior ambience, chairs, and styling stations</p>
                </div>
              </div>
              <span className="sp-header-pill info">
                {form.images.length} / 10 Photos Uploaded
              </span>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={handlePhotoUpload}
            />

            <div className="sp-gallery-container">
              {/* Cover Photo */}
              {form.cover_image && (
                <div className="sp-photo-card is-cover">
                  <img
                    src={resolveImageUrl(form.cover_image)}
                    alt="Salon Cover Banner"
                    className="sp-photo-img"
                  />
                  <div className="sp-photo-cover-badge">★ Primary Cover Photo</div>
                  <div className="sp-photo-actions">
                    <button
                      type="button"
                      className="sp-photo-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Change Cover
                    </button>
                  </div>
                </div>
              )}

              {/* Other Gallery Images */}
              {form.images
                .filter((img) => img !== form.cover_image)
                .map((imgUrl, idx) => (
                  <div key={imgUrl + idx} className="sp-photo-card">
                    <img
                      src={resolveImageUrl(imgUrl)}
                      alt={`Gallery slot ${idx + 1}`}
                      className="sp-photo-img"
                    />
                    <div className="sp-photo-actions">
                      <button
                        type="button"
                        className="sp-photo-btn"
                        onClick={() => handleSetCoverPhoto(imgUrl)}
                      >
                        Set Cover
                      </button>
                      <button
                        type="button"
                        className="sp-photo-btn delete"
                        onClick={() => handleDeletePhoto(idx + 1)}
                        title="Delete photo"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}

              {/* Upload Dropzone Card */}
              {form.images.length < 10 && (
                <div
                  className="sp-photo-upload-card"
                  onClick={() => fileInputRef.current?.click()}
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className="sp-photo-upload-icon">📷</div>
                  <div className="sp-photo-upload-title">+ Upload New Photo</div>
                  <div className="sp-photo-upload-sub">PNG, JPG up to 10MB</div>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 8: REGISTRATION & COMPLIANCE */}
          <section className="sp-card" id="sec-compliance">
            <div className="sp-card-header">
              <div className="sp-card-title-group">
                <div className="sp-card-icon-badge">📜</div>
                <div>
                  <h2>Registration & Compliance</h2>
                  <p>Salon registration validity dates, GSTIN details, and verified owner identification</p>
                </div>
              </div>
              <span className="sp-header-pill info">
                {form.registration_valid_to ? (
                  getRegistrationValidityInfo(form.registration_valid_from, form.registration_valid_to)?.status === "expired" ? "Expired" : "Active"
                ) : "Required"}
              </span>
            </div>

            {/* Registration Validity Status Alert Banner */}
            {form.registration_valid_to && (() => {
              const valInfo = getRegistrationValidityInfo(form.registration_valid_from, form.registration_valid_to);
              if (!valInfo) return null;
              return (
                <div
                  style={{
                    backgroundColor: valInfo.bg,
                    border: `1.5px solid ${valInfo.border}`,
                    borderRadius: "10px",
                    padding: "14px 18px",
                    marginBottom: "20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "12px",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "20px" }}>
                      {valInfo.status === "expired" ? "🚨" : valInfo.status === "expiring_soon" ? "⚠️" : "🟢"}
                    </span>
                    <div>
                      <div style={{ fontWeight: "700", color: valInfo.color, fontSize: "13.5px" }}>
                        {valInfo.badge}
                      </div>
                      <div style={{ fontSize: "12.5px", color: "#374151", marginTop: "2px" }}>
                        {valInfo.text}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById("sp-reg-valid-to");
                      if (input) input.focus();
                    }}
                    style={{
                      backgroundColor: valInfo.color,
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "6px",
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                    }}
                  >
                    + Update / Renew
                  </button>
                </div>
              );
            })()}

            <div className="sp-form-grid cols-2">
              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-reg-number">
                  Registration / Trade License Number
                </label>
                <input
                  id="sp-reg-number"
                  type="text"
                  className="sp-input"
                  placeholder="e.g. REG-KA-2024-8849"
                  value={form.registration_number || ""}
                  onChange={(e) => handleFieldChange("registration_number", e.target.value)}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-gst-number">
                  GSTIN (Tax Registration Number) <span style={{ fontWeight: 400, color: "#6b7280" }}>(Optional)</span>
                </label>
                <input
                  id="sp-gst-number"
                  type="text"
                  className="sp-input"
                  placeholder="e.g. 29ABCDE1234F1Z5"
                  maxLength={15}
                  value={form.gst_number || ""}
                  onChange={(e) => handleFieldChange("gst_number", e.target.value.toUpperCase())}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-reg-valid-from">
                  Registration Valid From Date
                </label>
                <input
                  id="sp-reg-valid-from"
                  type="date"
                  className="sp-input"
                  value={form.registration_valid_from || ""}
                  onChange={(e) => handleFieldChange("registration_valid_from", e.target.value)}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-reg-valid-to">
                  Registration Valid Till (Expiry Date) *
                </label>
                <input
                  id="sp-reg-valid-to"
                  type="date"
                  className="sp-input"
                  value={form.registration_valid_to || ""}
                  onChange={(e) => handleFieldChange("registration_valid_to", e.target.value)}
                />
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-owner-id-type">
                  Owner Identity Proof Type
                </label>
                <select
                  id="sp-owner-id-type"
                  className="sp-select"
                  value={form.owner_id_type || "Aadhaar Card"}
                  onChange={(e) => handleFieldChange("owner_id_type", e.target.value)}
                >
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Passport">Passport</option>
                  <option value="Driving License">Driving License</option>
                </select>
              </div>

              <div className="sp-field">
                <label className="sp-label" htmlFor="sp-owner-id-number">
                  Owner ID Number
                </label>
                <input
                  id="sp-owner-id-number"
                  type="text"
                  className="sp-input"
                  placeholder="e.g. XXXX-XXXX-1234 or ABCDE1234F"
                  value={form.owner_id_number || ""}
                  onChange={(e) => handleFieldChange("owner_id_number", e.target.value)}
                />
              </div>
            </div>

            {/* Hidden File Inputs for Document Upload & Renewal */}
            <input
              type="file"
              ref={regCertInputRef}
              style={{ display: "none" }}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                if (e.target.files?.[0]) handleDocFileSelect("registration_certificate", e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              ref={gstCertInputRef}
              style={{ display: "none" }}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                if (e.target.files?.[0]) handleDocFileSelect("gst_certificate", e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              ref={ownerIdInputRef}
              style={{ display: "none" }}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                if (e.target.files?.[0]) handleDocFileSelect("owner_id_proof", e.target.files[0]);
                e.target.value = "";
              }}
            />
            <input
              type="file"
              ref={ownerPhotoInputRef}
              style={{ display: "none" }}
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                if (e.target.files?.[0]) handleDocFileSelect("owner_profile_photo", e.target.files[0]);
                e.target.value = "";
              }}
            />

            {/* Document Verification & Renewal Table */}
            <div className="sp-docs-table-wrapper">
              <table className="sp-docs-table">
                <thead>
                  <tr>
                    <th style={{ width: "24%" }}>Document Type</th>
                    <th style={{ width: "22%" }}>Identification / Validity</th>
                    <th style={{ width: "22%" }}>Current Document</th>
                    <th style={{ width: "14%" }}>Status</th>
                    <th style={{ width: "18%" }}>Action / Update</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Row 1: Registration Certificate */}
                  <tr>
                    <td>
                      <div className="sp-doc-title-row">
                        <span>📜 Registration Certificate</span>
                        <span className="sp-doc-req-pill required">Required</span>
                      </div>
                      <div className="sp-doc-sub">Proof of business registration / trade license</div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: "11px", color: "#6b7280" }}>License No:</strong>{" "}
                        <span className="sp-doc-meta-value">{form.registration_number || "Not specified"}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: "11.5px", color: "#4b5563" }}>
                        <strong>Validity:</strong>{" "}
                        {form.registration_valid_from || form.registration_valid_to ? (
                          <span>
                            {form.registration_valid_from || "Start"} → {form.registration_valid_to || "No expiry set"}
                          </span>
                        ) : (
                          <span style={{ color: "#9ca3af" }}>Dates not set</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {form.registration_certificate ? (
                        <a
                          href={resolveImageUrl(form.registration_certificate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sp-doc-view-link"
                          title="Open uploaded certificate"
                        >
                          📄 View Certificate ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>⚠️ Missing document</span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const val = getRegistrationValidityInfo(form.registration_valid_from, form.registration_valid_to);
                        if (!val) {
                          return <span className="sp-doc-status-pill optional">● Pending Dates</span>;
                        }
                        if (val.status === "expired") {
                          return <span className="sp-doc-status-pill expired">● Expired</span>;
                        }
                        if (val.status === "expiring_soon") {
                          return <span className="sp-doc-status-pill expiring">⏳ Expiring Soon</span>;
                        }
                        return <span className="sp-doc-status-pill active">✓ Active</span>;
                      })()}
                    </td>
                    <td>
                      <div className="sp-doc-upload-box">
                        {stagedDocs.registration_certificate ? (
                          <div className="sp-doc-staged-chip">
                            <span className="sp-doc-staged-name">✓ {stagedDocs.registration_certificate.name}</span>
                            <button
                              type="button"
                              className="sp-doc-clear-btn"
                              onClick={() => handleRemoveStagedDoc("registration_certificate")}
                              title="Cancel upload"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="sp-doc-upload-btn"
                          onClick={() => regCertInputRef.current?.click()}
                        >
                          <span>🔄</span> {form.registration_certificate ? "Upload Renewal" : "Upload File"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Row 2: GST Certificate */}
                  <tr>
                    <td>
                      <div className="sp-doc-title-row">
                        <span>📑 GST Certificate</span>
                        <span className="sp-doc-req-pill optional">Optional</span>
                      </div>
                      <div className="sp-doc-sub">Tax registration &amp; verification document</div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: "11px", color: "#6b7280" }}>GSTIN:</strong>{" "}
                        <span className="sp-doc-meta-value">{form.gst_number || "Optional / None"}</span>
                      </div>
                    </td>
                    <td>
                      {form.gst_certificate ? (
                        <a
                          href={resolveImageUrl(form.gst_certificate)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sp-doc-view-link"
                          title="Open uploaded GST certificate"
                        >
                          📄 View GST Doc ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>— Not uploaded</span>
                      )}
                    </td>
                    <td>
                      {form.gst_certificate ? (
                        <span className="sp-doc-status-pill active">✓ Uploaded</span>
                      ) : (
                        <span className="sp-doc-status-pill optional">● Optional</span>
                      )}
                    </td>
                    <td>
                      <div className="sp-doc-upload-box">
                        {stagedDocs.gst_certificate ? (
                          <div className="sp-doc-staged-chip">
                            <span className="sp-doc-staged-name">✓ {stagedDocs.gst_certificate.name}</span>
                            <button
                              type="button"
                              className="sp-doc-clear-btn"
                              onClick={() => handleRemoveStagedDoc("gst_certificate")}
                              title="Cancel upload"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="sp-doc-upload-btn"
                          onClick={() => gstCertInputRef.current?.click()}
                        >
                          <span>🔄</span> {form.gst_certificate ? "Replace File" : "Upload GST"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Row 3: Owner ID Proof */}
                  <tr>
                    <td>
                      <div className="sp-doc-title-row">
                        <span>🪪 Owner ID Proof</span>
                        <span className="sp-doc-req-pill required">Required</span>
                      </div>
                      <div className="sp-doc-sub">Owner identification ({form.owner_id_type || "Government ID"})</div>
                    </td>
                    <td>
                      <div>
                        <strong style={{ fontSize: "11px", color: "#6b7280" }}>Type:</strong>{" "}
                        <span style={{ fontSize: "12px", fontWeight: "600" }}>{form.owner_id_type || "Aadhaar Card"}</span>
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <strong style={{ fontSize: "11px", color: "#6b7280" }}>ID No:</strong>{" "}
                        <span className="sp-doc-meta-value">{form.owner_id_number || "Not specified"}</span>
                      </div>
                    </td>
                    <td>
                      {form.owner_id_proof ? (
                        <a
                          href={resolveImageUrl(form.owner_id_proof)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sp-doc-view-link"
                          title="Open uploaded Owner ID Proof"
                        >
                          👁 View ID Proof ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>⚠️ Missing document</span>
                      )}
                    </td>
                    <td>
                      {form.owner_id_proof ? (
                        <span className="sp-doc-status-pill active">✓ Verified</span>
                      ) : (
                        <span className="sp-doc-status-pill expired">⚠️ Required</span>
                      )}
                    </td>
                    <td>
                      <div className="sp-doc-upload-box">
                        {stagedDocs.owner_id_proof ? (
                          <div className="sp-doc-staged-chip">
                            <span className="sp-doc-staged-name">✓ {stagedDocs.owner_id_proof.name}</span>
                            <button
                              type="button"
                              className="sp-doc-clear-btn"
                              onClick={() => handleRemoveStagedDoc("owner_id_proof")}
                              title="Cancel upload"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="sp-doc-upload-btn"
                          onClick={() => ownerIdInputRef.current?.click()}
                        >
                          <span>🔄</span> {form.owner_id_proof ? "Replace File" : "Upload ID"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Row 4: Owner Profile Photo */}
                  <tr>
                    <td>
                      <div className="sp-doc-title-row">
                        <span>👤 Owner Profile Photo</span>
                        <span className="sp-doc-req-pill required">Required</span>
                      </div>
                      <div className="sp-doc-sub">Personal portrait for salon manager verification</div>
                    </td>
                    <td>
                      <div style={{ fontSize: "12px", color: "#4b5563" }}>
                        Manager Visual ID &amp; Avatar
                      </div>
                    </td>
                    <td>
                      {form.owner_profile_photo ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img
                            src={resolveImageUrl(form.owner_profile_photo)}
                            alt="Owner"
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              objectFit: "cover",
                              border: "1.5px solid #2d6a4f",
                            }}
                          />
                          <a
                            href={resolveImageUrl(form.owner_profile_photo)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sp-doc-view-link"
                          >
                            👁 View ↗
                          </a>
                        </div>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#9ca3af" }}>⚠️ Missing photo</span>
                      )}
                    </td>
                    <td>
                      {form.owner_profile_photo ? (
                        <span className="sp-doc-status-pill active">✓ Uploaded</span>
                      ) : (
                        <span className="sp-doc-status-pill expired">⚠️ Required</span>
                      )}
                    </td>
                    <td>
                      <div className="sp-doc-upload-box">
                        {stagedDocs.owner_profile_photo ? (
                          <div className="sp-doc-staged-chip">
                            <span className="sp-doc-staged-name">✓ {stagedDocs.owner_profile_photo.name}</span>
                            <button
                              type="button"
                              className="sp-doc-clear-btn"
                              onClick={() => handleRemoveStagedDoc("owner_profile_photo")}
                              title="Cancel upload"
                            >
                              ✕
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          className="sp-doc-upload-btn"
                          onClick={() => ownerPhotoInputRef.current?.click()}
                        >
                          <span>🔄</span> {form.owner_profile_photo ? "Replace Photo" : "Upload Photo"}
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ==================================================================
            RIGHT COLUMN: STICKY SIDEBAR
            ================================================================== */}
        <aside className="sp-sidebar-col">
          {/* Card 1: Profile Completeness */}
          <div className="sp-sidebar-card">
            <div className="sp-completeness-header">
              <span className="sp-completeness-title">Profile Completeness</span>
              <span className="sp-completeness-pct">{completeness.percentage}%</span>
            </div>

            <div className="sp-progress-track">
              <div
                className="sp-progress-fill"
                style={{ width: `${completeness.percentage}%` }}
              />
            </div>

            <div className="sp-completeness-tip">
              <span>💡</span>
              <div>{completeness.advice}</div>
            </div>
          </div>

          {/* Card 2: Client Discovery Card Preview */}
          <div className="sp-sidebar-card">
            <div className="sp-preview-header">
              <span className="sp-preview-title">Client Discovery Card Preview</span>
              <span className="sp-preview-live-pill">
                <span>●</span> Live Preview
              </span>
            </div>

            <div className="sp-discovery-card-mock">
              <div className="sp-mock-cover-wrap">
                <img
                  src={resolveImageUrl(form.cover_image || form.images[0])}
                  alt={form.name}
                  className="sp-mock-cover-img"
                />
                <div className="sp-mock-rating-badge">★ 4.9 (128)</div>
              </div>

              <div className="sp-mock-body">
                <div className="sp-mock-salon-name">{form.name || "Your Salon Name"}</div>
                <div className="sp-mock-meta">
                  {form.category || "Hair & Styling"} • {form.city || "Bangalore"}
                </div>
                <div className="sp-mock-hours">{todayHoursSnippet}</div>

                <div className="sp-mock-amenities-chips">
                  {form.amenities.slice(0, 3).map((am) => (
                    <span key={am} className="sp-mock-amenity-pill">
                      {am}
                    </span>
                  ))}
                </div>

                <div className="sp-mock-footer">
                  <div className="sp-mock-price-pill">From ₹350</div>
                  <button type="button" className="sp-mock-book-btn">
                    Book Now
                  </button>
                </div>
              </div>
            </div>

            <div className="sp-preview-caption">
              Simulated appearance across BookMySalon search and city explore listings.
            </div>
          </div>

          {/* Card 3: Quick Action Save Box */}
          <div className="sp-sidebar-card sp-quick-actions-card">
            <div className={`sp-quick-status-badge ${isDirty ? "dirty" : "clean"}`}>
              <span>{isDirty ? "⚠️ Unsaved modifications detected" : "✓ All changes synced"}</span>
            </div>
            <p className="sp-quick-note">
              Modifications immediately refresh your live listing cards and automated booking slots.
            </p>
            <div className="sp-quick-btn-stack">
              <button
                type="button"
                className="sp-btn-primary"
                onClick={handleSaveChanges}
                disabled={isSaving}
              >
                {isSaving ? "Publishing..." : "Save & Publish Changes"}
              </button>
              {isDirty && (
                <button
                  type="button"
                  className="sp-btn-secondary"
                  onClick={() => setShowDiscardModal(true)}
                  disabled={isSaving}
                >
                  Discard Edits
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Discard Confirmation Modal */}
      {showDiscardModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.55)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px",
          }}
          onClick={() => setShowDiscardModal(false)}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              maxWidth: "440px",
              width: "100%",
              padding: "28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: "18px", color: "#1e392a" }}>
              Discard Unsaved Changes?
            </h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#5e7265", lineHeight: "1.5" }}>
              Are you sure you want to revert your edits? Any modified business hours, photos, or narrative details will be reset to the last saved version.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="sp-btn-secondary"
                onClick={() => setShowDiscardModal(false)}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="sp-btn-primary"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleDiscardChanges}
              >
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Alert */}
      {toastMessage && (
        <div className="sp-toast" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}

      
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import { resolveImageUrl } from "../../utils/imageUtils";
import logo from "../../assets/logo.png"
import "../../styles/createSalon.css";

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

/**
 * Compresses an image file client-side using an HTML5 canvas.
 * Resizes large dimensions (e.g. 4000x3000 -> max 1600x1600) and encodes as JPEG (~0.80 quality),
 * reducing multi-MB phone photos to ~100KB-250KB before transmission.
 */
function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.80) {
  return new Promise((resolve) => {
    if (!file || !(file instanceof Blob)) {
      resolve(file);
      return;
    }

    // Pass through SVGs or non-image types
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

          const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          console.log(
            `[BookMySalon] Compressed ${file.name || "image"}: ${(file.size / (1024 * 1024)).toFixed(2)} MB -> ${(compressedDataUrl.length / (1024 * 1024)).toFixed(2)} MB (${width}x${height})`
          );
          resolve(compressedDataUrl);
        } catch (canvasErr) {
          console.warn("[BookMySalon] Canvas compression failed, falling back to raw data URL:", canvasErr);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };

      img.src = objectUrl;
    } catch {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    }
  });
}


export default function CreateSalon() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "Kerala",
    pincode: "",
    latitude: "12.9716",
    longitude: "77.5946",
  });

  // Service Catalog & Categories from Backend
  const [categoriesList, setCategoriesList] = useState([]);
  const [catalogServices, setCatalogServices] = useState([]);
  const [activeSuggestionCategory, setActiveSuggestionCategory] = useState("ALL");
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const [openingHours, setOpeningHours] = useState(DEFAULT_DAYS);
  const [services, setServices] = useState([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [newServiceCategory, setNewServiceCategory] = useState("");
  const [newServiceDuration, setNewServiceDuration] = useState("30 mins");
  const [serviceError, setServiceError] = useState("");

  const [selectedAmenities, setSelectedAmenities] = useState([
    "High-Speed Wi-Fi",
    "Air Conditioned Suites",
    "Card & UPI Payments",
  ]);
  const [images, setImages] = useState(SAMPLE_IMAGES);
  const [isProcessingPhotos, setIsProcessingPhotos] = useState(false);

  // Registration & Verification Documents
  const regCertInputRef = useRef(null);
  const gstCertInputRef = useRef(null);
  const ownerIdInputRef = useRef(null);
  const ownerPhotoInputRef = useRef(null);

  const [documents, setDocuments] = useState({
    registration_certificate: "",
    gst_certificate: "",
    owner_id_proof: "",
    owner_profile_photo: "",
    registration_number: "",
    registration_valid_from: "",
    registration_valid_to: "",
    gst_number: "",
    owner_id_type: "Aadhaar Card",
    owner_id_number: "",
  });

  const [documentMeta, setDocumentMeta] = useState({
    registration_certificate: null,
    gst_certificate: null,
    owner_id_proof: null,
    owner_profile_photo: null,
  });

  const [documentErrors, setDocumentErrors] = useState({
    registration_certificate: "",
    gst_certificate: "",
    owner_id_proof: "",
    owner_profile_photo: "",
    registration_number: "",
    registration_valid_from: "",
    registration_valid_to: "",
    gst_number: "",
    owner_id_type: "",
    owner_id_number: "",
  });

  const [activeStep, setActiveStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSaved, setLastSaved] = useState("Draft saved");
  const [draftSaveStatus, setDraftSaveStatus] = useState("");
  const [submittedSalon, setSubmittedSalon] = useState(null);

  const [searchParams] = useSearchParams();
  const resubmitId = searchParams.get("resubmit");
  const resubmitToken = searchParams.get("token");
  const isResubmitMode = Boolean(resubmitId);

  const [isLoadingPrefill, setIsLoadingPrefill] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [prefillError, setPrefillError] = useState("");
  const [isLinkExpired, setIsLinkExpired] = useState(false);
  const [expiredLinkInfo, setExpiredLinkInfo] = useState({ error: "", salonName: "", statusCode: "" });
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // states for Email verification
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmailAddress, setVerifiedEmailAddress] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [otpSuccessMessage, setOtpSuccessMessage] = useState("");

  
  useEffect(() => {
    let timer;
    if (otpCountdown > 0) {
      timer = setInterval(() => {
        setOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [otpCountdown]);

  // Load prefilled data if in resubmit mode, else restore draft if present
  useEffect(() => {
    if (!resubmitId) {
      try {
        const savedDraft = localStorage.getItem("bms_salon_draft");
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.formData) setFormData((prev) => ({ ...prev, ...parsed.formData }));
          if (parsed.openingHours) setOpeningHours(parsed.openingHours);
          if (parsed.services && parsed.services.length > 0) setServices(parsed.services);
          if (parsed.selectedAmenities) setSelectedAmenities(parsed.selectedAmenities);
          if (parsed.images && parsed.images.length > 0) setImages(parsed.images);
          if (parsed.documents) setDocuments(parsed.documents);
          if (parsed.documentMeta) setDocumentMeta(parsed.documentMeta);
          setLastSaved("Draft restored from storage");
        }
      } catch {
        // Ignore local storage parse error
      }
      return;
    }

    // Resubmission mode: fetch existing salon data from backend
    const loadPrefillData = async () => {
      setIsLoadingPrefill(true);
      setPrefillError("");
      try {
        const tokenQuery = resubmitToken ? `?token=${encodeURIComponent(resubmitToken)}` : "";
        const res = await api.get(`/salons/${resubmitId}/resubmit-data/${tokenQuery}`);
        const data = res.data;

        if (data) {
          setFormData({
            name: data.name || "",
            category: data.category || "Hair & Styling",
            description: data.description || "",
            email: data.email || "",
            phone: data.phone || "",
            address: data.address || "",
            city: data.city || "",
            state: data.state || "Karnataka",
            pincode: data.pincode || "",
            latitude: data.latitude !== null && data.latitude !== undefined ? String(data.latitude) : "12.9716",
            longitude: data.longitude !== null && data.longitude !== undefined ? String(data.longitude) : "77.5946",
          });

          if (data.email) {
            setIsEmailVerified(true);
            setVerifiedEmailAddress(data.email);
          }


          if (data.opening_hours?.days && Array.isArray(data.opening_hours.days)) {
            setOpeningHours(data.opening_hours.days);
          } else if (Array.isArray(data.opening_hours) && data.opening_hours.length > 0) {
            setOpeningHours(data.opening_hours);
          }

          if (Array.isArray(data.services) && data.services.length > 0) {
            setServices(
              data.services.map((srv, idx) => ({
                id: srv.id || `srv-${idx + 1}`,
                name: srv.name || "",
                price: String(srv.price || "").replace(/[^\d.]/g, ""),
                category: srv.category || data.category || "Hair & Styling",
                duration: srv.duration || "30 mins",
              }))
            );
          }

          if (Array.isArray(data.amenities) && data.amenities.length > 0) {
            setSelectedAmenities(data.amenities);
          }

          if (Array.isArray(data.images) && data.images.length > 0) {
            setImages(data.images);
          } else if (data.cover_image) {
            setImages([data.cover_image]);
          }

          if (data.admin_notes) {
            setRejectionNotes(data.admin_notes);
          }

          if (data.registration_certificate) {
            setDocuments((prev) => ({ ...prev, registration_certificate: data.registration_certificate }));
            setDocumentMeta((prev) => ({
              ...prev,
              registration_certificate: {
                name: "Salon Registration Certificate",
                type: data.registration_certificate.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE",
                ext: (data.registration_certificate.split(".").pop() || "PDF").toUpperCase(),
              },
            }));
          }
          if (data.gst_certificate) {
            setDocuments((prev) => ({ ...prev, gst_certificate: data.gst_certificate }));
            setDocumentMeta((prev) => ({
              ...prev,
              gst_certificate: {
                name: "GST Certificate",
                type: data.gst_certificate.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE",
                ext: (data.gst_certificate.split(".").pop() || "PDF").toUpperCase(),
              },
            }));
          }
          if (data.owner_id_proof) {
            setDocuments((prev) => ({ ...prev, owner_id_proof: data.owner_id_proof }));
            setDocumentMeta((prev) => ({
              ...prev,
              owner_id_proof: {
                name: "Owner ID Proof (Aadhaar/PAN)",
                type: data.owner_id_proof.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE",
                ext: (data.owner_id_proof.split(".").pop() || "PNG").toUpperCase(),
              },
            }));
          }
          if (data.owner_profile_photo) {
            setDocuments((prev) => ({ ...prev, owner_profile_photo: data.owner_profile_photo }));
            setDocumentMeta((prev) => ({
              ...prev,
              owner_profile_photo: {
                name: "Owner Profile Photo",
                type: data.owner_profile_photo.toLowerCase().endsWith(".pdf") ? "PDF" : "IMAGE",
                ext: (data.owner_profile_photo.split(".").pop() || "JPG").toUpperCase(),
              },
            }));
          }

          setDocuments((prev) => ({
            ...prev,
            registration_number: data.registration_number || prev.registration_number || "",
            registration_valid_from: data.registration_valid_from || prev.registration_valid_from || "",
            registration_valid_to: data.registration_valid_to || prev.registration_valid_to || "",
            gst_number: data.gst_number || prev.gst_number || "",
            owner_id_type: data.owner_id_type || prev.owner_id_type || "Aadhaar Card",
            owner_id_number: data.owner_id_number || prev.owner_id_number || "",
          }));

          setLastSaved("Application details pre-filled");
        }
      } catch (err) {
        console.error("Failed to load salon prefill data:", err);
        const errData = err.response?.data;
        if (
          err.response?.status === 410 ||
          errData?.status_code === "ALREADY_SUBMITTED" ||
          errData?.status_code === "ALREADY_APPROVED"
        ) {
          setIsLinkExpired(true);
          setExpiredLinkInfo({
            error:
              errData?.error ||
              "This resubmission link has expired because your application has already been resubmitted and is currently pending review.",
            salonName: errData?.salon_name || "",
            statusCode: errData?.status_code || "ALREADY_SUBMITTED",
          });
        } else {
          setPrefillError(
            errData?.error ||
            "Could not load application details. The link may have expired or is invalid."
          );
        }
      } finally {
        setIsLoadingPrefill(false);
      }
    };

    loadPrefillData();
  }, [resubmitId, resubmitToken]);

  // Fetch platform service catalog and categories from backend
  useEffect(() => {
    let isMounted = true;
    const fetchCatalog = async () => {
      try {
        setIsLoadingCategories(true);
        const res = await api.get("/services/public/categories/");
        if (!isMounted) return;
        const data = Array.isArray(res.data) ? res.data : [];
        setCategoriesList(data);

        // Flatten standard services into catalog suggestions
        const flat = [];
        data.forEach((cat) => {
          (cat.services || []).forEach((srv) => {
            flat.push({
              id: srv.id,
              name: srv.name,
              category: cat.name,
              categoryIcon: cat.icon || "✂️",
              price: Math.round(Number(srv.standard_price)) || 200,
              duration: srv.standard_duration ? `${srv.standard_duration} mins` : "30 mins",
              description: srv.description || "",
            });
          });
        });
        setCatalogServices(flat);

        // Default primary category in formData if empty
        setFormData((prev) => {
          if (!prev.category && data.length > 0) {
            return { ...prev, category: data[0].name };
          }
          return prev;
        });

        // Default category for new service addition
        if (data.length > 0) {
          setNewServiceCategory((prev) => prev || data[0].name);
        }
      } catch (err) {
        console.warn("[BookMySalon] Could not load service catalog:", err);
      } finally {
        if (isMounted) setIsLoadingCategories(false);
      }
    };

    fetchCatalog();
    return () => {
      isMounted = false;
    };
  }, []);

  const visibleSuggestions = useMemo(() => {
    if (activeSuggestionCategory === "ALL") {
      return catalogServices;
    }
    return catalogServices.filter((s) => s.category === activeSuggestionCategory);
  }, [catalogServices, activeSuggestionCategory]);

  // Auto-detect primary salon category from configured services (or fallback to catalog)
  const detectedCategory = useMemo(() => {
    if (!services || services.length === 0) {
      return categoriesList[0]?.name || "Multi-Service";
    }
    const catCounts = {};
    services.forEach((s) => {
      const cat = s.category || "General";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const sorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? sorted[0][0] : (categoriesList[0]?.name || "Multi-Service");
  }, [services, categoriesList]);

  const handleServiceNameChange = (e) => {
    const val = e.target.value;
    setNewServiceName(val);
    if (serviceError) setServiceError("");

    // Auto-fill standard benchmarks if exact match in catalog
    const match = catalogServices.find(
      (cs) => cs.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (match) {
      setNewServicePrice(String(match.price));
      setNewServiceCategory(match.category);
      if (match.duration) setNewServiceDuration(match.duration);
    }
  };

  const isValidEmail = (email) => {
    return Boolean(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()));
  };

  const handleSendEmailOtp = async () => {
    setOtpError("");
    setOtpSuccessMessage("");
    if (!formData.email.trim()) {
      setOtpError("Please enter an official contact email address first.");
      return;
    }
    if (!isValidEmail(formData.email)) {
      setOtpError("Please enter a valid official contact email address.");
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await api.post("/salons/verify-email/send-otp/", {
        email: formData.email.trim(),
      });
      setOtpSent(true);
      setOtpCountdown(60);
      setOtpSuccessMessage(res.data?.message || `Verification code sent to ${formData.email.trim()}`);
    } catch (err) {
      const errMsg =
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        "Failed to send verification code. Please check email address and try again.";
      setOtpError(errMsg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    setOtpError("");
    setOtpSuccessMessage("");
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpError("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      await api.post("/salons/verify-email/verify-otp/", {
        email: formData.email.trim(),
        otp: otpCode.trim(),
      });
      setIsEmailVerified(true);
      setVerifiedEmailAddress(formData.email.trim());
      setOtpSent(false);
      setOtpCode("");
      setOtpSuccessMessage("Official contact email successfully verified!");
      setErrorMessage("");
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.otp?.[0] ||
        "Invalid or expired verification code. Please retry or request a new code.";
      setOtpError(errMsg);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (otpCountdown > 0) return;
    setOtpError("");
    setOtpSuccessMessage("");
    setIsSendingOtp(true);
    try {
      const res = await api.post("/salons/verify-email/resend-otp/", {
        email: formData.email.trim(),
      });
      setOtpCountdown(60);
      setOtpSuccessMessage(res.data?.message || "A new verification code has been sent.");
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        err.response?.data?.email?.[0] ||
        "Failed to resend code. Please try again in a few moments.";
      setOtpError(errMsg);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleChangeVerifiedEmail = () => {
    setIsEmailVerified(false);
    setVerifiedEmailAddress("");
    setOtpSent(false);
    setOtpCode("");
    setOtpError("");
    setOtpSuccessMessage("");
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "email" && isEmailVerified && value.trim().toLowerCase() !== verifiedEmailAddress.toLowerCase()) {
      setIsEmailVerified(false);
      setVerifiedEmailAddress("");
      setOtpSent(false);
      setOtpCode("");
      setOtpError("");
      setOtpSuccessMessage("");
    }
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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    // Check individual file size limit (10MB)
    const oversized = files.filter((f) => f.size > 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setErrorMessage(
        `Selected file is too large (${oversized.map((f) => f.name).join(", ")}). Maximum allowed file size is 10MB per image.`
      );
      return;
    }

    setIsProcessingPhotos(true);
    setErrorMessage("");

    try {
      const compressedList = await Promise.all(
        files.map((file) => compressImage(file))
      );
      setImages((prev) => [...prev, ...compressedList.filter(Boolean)]);
    } catch (err) {
      console.error("Error processing photos:", err);
      setErrorMessage("Could not process one or more images. Please select standard JPG or PNG images.");
    } finally {
      setIsProcessingPhotos(false);
    }
  };

  const removePhoto = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDocumentFileChange = async (field, file) => {
    if (!file) return;

    setDocumentErrors((prev) => ({ ...prev, [field]: "" }));

    const validTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
    const validExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
    const ext = "." + (file.name.split(".").pop() || "").toLowerCase();

    const isValidType =
      validTypes.includes(file.type?.toLowerCase()) ||
      validExtensions.includes(ext);

    if (!isValidType) {
      setDocumentErrors((prev) => ({
        ...prev,
        [field]: "Unsupported format. Allowed formats: PDF, JPG, JPEG, and PNG.",
      }));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setDocumentErrors((prev) => ({
        ...prev,
        [field]: "File size exceeds 10MB limit. Please select a smaller file.",
      }));
      return;
    }

    const isPdf = file.type === "application/pdf" || ext === ".pdf";

    if (isPdf) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        setDocuments((prev) => ({ ...prev, [field]: result }));
        setDocumentMeta((prev) => ({
          ...prev,
          [field]: {
            name: file.name,
            size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
            type: "PDF",
            ext: "PDF",
          },
        }));
      };
      reader.onerror = () => {
        setDocumentErrors((prev) => ({
          ...prev,
          [field]: "Failed to read file. Please try again.",
        }));
      };
      reader.readAsDataURL(file);
    } else {
      // Compress image documents client-side to keep payload lightweight and fast
      try {
        const compressedDataUrl = await compressImage(file, 1600, 1600, 0.82);
        if (compressedDataUrl) {
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          const sizeStr = approxBytes >= 1024 * 1024
            ? (approxBytes / (1024 * 1024)).toFixed(2) + " MB"
            : Math.round(approxBytes / 1024) + " KB";

          setDocuments((prev) => ({ ...prev, [field]: compressedDataUrl }));
          setDocumentMeta((prev) => ({
            ...prev,
            [field]: {
              name: file.name,
              size: sizeStr,
              type: "IMAGE",
              ext: ext.toUpperCase().replace(".", "") || "JPG",
            },
          }));
        } else {
          throw new Error("Could not compress image");
        }
      } catch (imgErr) {
        console.warn("Fallback to raw image read for document:", imgErr);
        const reader = new FileReader();
        reader.onload = () => {
          setDocuments((prev) => ({ ...prev, [field]: reader.result }));
          setDocumentMeta((prev) => ({
            ...prev,
            [field]: {
              name: file.name,
              size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
              type: "IMAGE",
              ext: ext.toUpperCase().replace(".", "") || "JPG",
            },
          }));
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveDocument = (field) => {
    setDocuments((prev) => ({ ...prev, [field]: "" }));
    setDocumentMeta((prev) => ({ ...prev, [field]: null }));
    setDocumentErrors((prev) => ({ ...prev, [field]: "" }));
    if (field === "registration_certificate" && regCertInputRef.current) {
      regCertInputRef.current.value = "";
    } else if (field === "gst_certificate" && gstCertInputRef.current) {
      gstCertInputRef.current.value = "";
    } else if (field === "owner_id_proof" && ownerIdInputRef.current) {
      ownerIdInputRef.current.value = "";
    } else if (field === "owner_profile_photo" && ownerPhotoInputRef.current) {
      ownerPhotoInputRef.current.value = "";
    }
  };

  const getRegistrationValidityInfo = (validFrom, validTo) => {
    if (!validTo) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = validTo.split("-").map(Number);
    if (parts.length !== 3) return null;
    const toDate = new Date(parts[0], parts[1] - 1, parts[2]);
    toDate.setHours(0, 0, 0, 0);

    const diffTime = toDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const formatDateStr = (dStr) => {
      if (!dStr) return "";
      const p = dStr.split("-");
      if (p.length !== 3) return dStr;
      return `${p[2]}-${p[1]}-${p[0]}`;
    };

    if (daysLeft < 0) {
      return {
        status: "expired",
        daysLeft,
        badgeText: `🔴 Registration Expired (${Math.abs(daysLeft)} days ago on ${formatDateStr(validTo)})`,
        message: `Your registration expired on ${formatDateStr(validTo)}. Please upload your renewed registration certificate.`,
      };
    } else if (daysLeft <= 30) {
      return {
        status: "expiring_soon",
        daysLeft,
        badgeText: `⚠️ Expiring in ${daysLeft} day${daysLeft === 1 ? "" : "s"} (${formatDateStr(validTo)})`,
        message: `Registration valid until ${formatDateStr(validTo)}. Expiry alert is active; renewal recommended.`,
      };
    } else {
      return {
        status: "active",
        daysLeft,
        badgeText: `🟢 Active • Valid till ${formatDateStr(validTo)} (${daysLeft} days remaining)`,
        message: `Registration is active from ${formatDateStr(validFrom) || "issued"} to ${formatDateStr(validTo)}.`,
      };
    }
  };

  const handleAddNewRegistration = () => {
    setDocuments((prev) => ({
      ...prev,
      registration_certificate: "",
      registration_number: "",
      registration_valid_from: "",
      registration_valid_to: "",
    }));
    setDocumentMeta((prev) => ({
      ...prev,
      registration_certificate: null,
    }));
    setDocumentErrors((prev) => ({
      ...prev,
      registration_certificate: "",
      registration_number: "",
      registration_valid_from: "",
      registration_valid_to: "",
    }));
    if (regCertInputRef.current) {
      regCertInputRef.current.value = "";
      setTimeout(() => regCertInputRef.current?.click(), 80);
    }
  };

  const handleAddService = (e) => {
    if (e) e.preventDefault();
    setServiceError("");
    const cleanName = newServiceName.trim();
    const cleanPrice = newServicePrice.replace(/[^\d.]/g, "");

    if (!cleanName) {
      setServiceError("Please enter a service name (e.g. Beard Cut).");
      return;
    }
    if (!cleanPrice || Number(cleanPrice) <= 0) {
      setServiceError("Please enter a valid price in ₹ (e.g. 150).");
      return;
    }

    const newService = {
      id: `srv-${Date.now()}`,
      name: cleanName,
      price: cleanPrice,
      category: newServiceCategory || categoriesList[0]?.name || "General",
      duration: newServiceDuration || "30 mins",
    };

    setServices((prev) => [...prev, newService]);
    setNewServiceName("");
    setNewServicePrice("");
    setServiceError("");
  };

  const handleAddPreset = (preset) => {
    const exists = services.some(
      (s) => s.name.toLowerCase() === preset.name.toLowerCase()
    );
    if (exists) {
      setNewServiceName(preset.name);
      setNewServicePrice(preset.price);
      setNewServiceCategory(preset.category);
      setNewServiceDuration(preset.duration);
      return;
    }
    setServices((prev) => [
      ...prev,
      {
        id: `srv-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: preset.name,
        price: preset.price,
        category: preset.category,
        duration: preset.duration,
      },
    ]);
  };

  const handleRemoveService = (id) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSaveDraft = () => {
    try {
      const draft = {
        formData,
        openingHours,
        services,
        selectedAmenities,
        images,
        documents,
        documentMeta,
        savedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem("bms_salon_draft", JSON.stringify(draft));
      } catch (storageErr) {
        // QuotaExceededError handling: if base64 images exceed browser storage quota, save draft without heavy data URLs
        console.warn("Storage quota exceeded, saving draft with lightweight image references:", storageErr);
        const lightDraft = {
          ...draft,
          images: (images || []).filter((img) => typeof img === "string" && !img.startsWith("data:")).slice(0, 3),
        };
        localStorage.setItem("bms_salon_draft", JSON.stringify(lightDraft));
      }
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      setLastSaved(`Draft saved at ${timeStr}`);
      setDraftSaveStatus("saved");
      setTimeout(() => setDraftSaveStatus(""), 3000);
    } catch (err) {
      console.error("Could not save draft to local storage:", err);
      setDraftSaveStatus("error");
      setTimeout(() => setDraftSaveStatus(""), 3000);
    }
  };

  // Calculate readiness percentage
  const checklist = {
    basic: Boolean(formData.name.trim() && formData.description.trim() && formData.phone.trim()),
    email: Boolean(isEmailVerified || (isResubmitMode && formData.email.trim())),
    location: Boolean(formData.address.trim() && formData.city.trim()),
    hours: openingHours.some((d) => d.isOpen),
    pricing: services.length > 0,
    amenities: selectedAmenities.length > 0,
    photos: images.length > 0,
    documents: Boolean(
      documents.registration_certificate &&
      documents.registration_valid_to &&
      documents.owner_id_proof &&
      documents.owner_id_number.trim() &&
      documents.owner_profile_photo
    ),
  };

  const completedCount = Object.values(checklist).filter(Boolean).length;
  const readinessPercent = Math.round((completedCount / 8) * 100);

  const minPrice = services.length > 0
    ? Math.min(
        ...services
          .map((s) => Number(String(s.price).replace(/[^\d.]/g, "")) || 0)
          .filter((n) => n > 0)
      )
    : 350;

  const scrollToSection = (stepNum, sectionId) => {
    setActiveStep(stepNum);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    setErrorMessage("");

    const name = formData.name.trim();

    if (!name) {
      setErrorMessage("Please provide your salon name.");
      scrollToSection(1, "card-basic");
      return;
    }

    const letterCount = (name.match(/[a-zA-Z]/g) || []).length;

    if (!/^[a-zA-Z]/.test(name)) {
      setErrorMessage("Salon name must start with a letter.");
      scrollToSection(1, "card-basic");
      return;
    }

    if (letterCount < 3) {
      setErrorMessage("Salon name must contain at least 3 letters.");
      scrollToSection(1, "card-basic");
      return;
    }

    if (!/^[a-zA-Z0-9 &'()-]+$/.test(name)) {
      setErrorMessage("Salon name contains invalid characters.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage("Please provide an official contact email for credentials.");
      scrollToSection(1, "card-basic");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      setErrorMessage("Please provide a valid official contact email address.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!isEmailVerified && !isResubmitMode) {
      setErrorMessage("Please verify your official contact email with the OTP code before submitting.");
      scrollToSection(1, "card-basic");
      if (!otpSent) {
        handleSendEmailOtp();
      }
      return;
    }
    const phone = formData.phone.trim();
    if (!phone.trim()) {
      setErrorMessage("Please provide a contact phone number.");
      scrollToSection(1, "card-basic");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setErrorMessage(
        "Please enter a valid 10-digit Indian mobile number."
      );
      scrollToSection(1, "card-basic");
      return;
    }
    if (!formData.address.trim() || !formData.city.trim()) {
      setErrorMessage("Please complete street address and city.");
      scrollToSection(2, "card-location");
      return;
    }

    // Validate Required Documents & Registration Details
    const docErrors = {};
    if (!documents.registration_certificate) {
      docErrors.registration_certificate = "Salon Registration Certificate is required.";
    }
    if (!documents.registration_valid_to) {
      docErrors.registration_valid_to = "Registration Valid Till (expiry date) is required.";
    } else if (documents.registration_valid_from && documents.registration_valid_to < documents.registration_valid_from) {
      docErrors.registration_valid_to = "Registration Valid Till date must be after Valid From date.";
    }
    if (!documents.owner_id_proof) {
      docErrors.owner_id_proof = "Owner ID Proof (Aadhaar/PAN) is required.";
    }
    if (!documents.owner_id_number?.trim()) {
      docErrors.owner_id_number = "Owner ID document number is required.";
    }
    if (!documents.owner_profile_photo) {
      docErrors.owner_profile_photo = "Owner Profile Photo is required.";
    }

    if (Object.keys(docErrors).length > 0) {
      setDocumentErrors((prev) => ({ ...prev, ...docErrors }));
      setErrorMessage("Please complete all required registration, validity dates, and identity fields.");
      scrollToSection(7, "card-documents");
      return;
    }

    if (isResubmitMode) {
      setShowConfirmModal(true);
    } else {
      executeSubmit();
    }
  };

  const executeSubmit = async () => {
    setShowConfirmModal(false);
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const latNum = formData.latitude && !isNaN(Number(formData.latitude))
        ? Number(Number(formData.latitude).toFixed(6))
        : null;
      const lngNum = formData.longitude && !isNaN(Number(formData.longitude))
        ? Number(Number(formData.longitude).toFixed(6))
        : null;

      const salonCategory = detectedCategory || formData.category || "Multi-Service";

      const formattedServices = services.map((s) => ({
        name: s.name.trim(),
        price: String(s.price).startsWith("₹") ? s.price : `₹${s.price}`,
        category: s.category || salonCategory,
        duration: s.duration || "30 mins",
      }));

      const payload = {
        name: formData.name.trim(),
        category: salonCategory,
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
        services: formattedServices,
        cover_image: images[0] || "",
        // If images[0] is base64, backend automatically assigns cover_image from images gallery to save bandwidth
        cover_image: images.length > 0 && !images[0].startsWith("data:image/") ? images[0] : "",
        images: images,
        registration_certificate: documents.registration_certificate,
        registration_number: (documents.registration_number || "").trim(),
        registration_valid_from: documents.registration_valid_from || null,
        registration_valid_to: documents.registration_valid_to || null,
        gst_certificate: documents.gst_certificate,
        gst_number: (documents.gst_number || "").trim().toUpperCase(),
        owner_id_proof: documents.owner_id_proof,
        owner_id_type: documents.owner_id_type || "Aadhaar Card",
        owner_id_number: (documents.owner_id_number || "").trim(),
        owner_profile_photo: documents.owner_profile_photo,
      };

      let response;
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      if (isResubmitMode && resubmitId) {
        const queryToken = resubmitToken ? `?token=${encodeURIComponent(resubmitToken)}` : "";
        try {
          response = await api.post(`/salons/${resubmitId}/resubmit/${queryToken}`, payload, config);
        } catch (postErr) {
          if (postErr.response?.status === 401) {
            response = await api.post(`/salons/${resubmitId}/resubmit/${queryToken}`, payload);
          } else {
            throw postErr;
          }
        }
      } else {
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
      }

      if (response && (response.status === 201 || response.status === 200)) {
        setSubmittedSalon(response.data.salon || payload);
        localStorage.removeItem("bms_salon_draft");
      }
    } catch (err) {
      if (err.response?.status === 410 || err.response?.data?.status_code === "NOT_REJECTED") {
        setIsLinkExpired(true);
        setExpiredLinkInfo({
          error:
            err.response?.data?.error ||
            "This application has already been resubmitted and cannot be resubmitted again.",
          salonName: formData.name,
          statusCode: err.response?.data?.status_code || "ALREADY_SUBMITTED",
        });
        return;
      }
      let msg = "Failed to submit salon application. Please check all fields.";
      if (err.response?.status === 413) {
        msg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          "Uploaded files or payload is too large. Please select smaller photos or files (under 10MB each), or restart the Django backend server.";
      } else if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === "string") {
          if (
            data.includes("RequestDataTooBig") ||
            data.includes("DATA_UPLOAD_MAX_MEMORY_SIZE") ||
            data.includes("413") ||
            data.toLowerCase().includes("too large")
          ) {
            msg = "Uploaded files or payload exceeds server limit. Please ensure photos/documents are under 10MB, or restart the Django backend server.";
          } else if (data.includes("<html") || data.includes("<!DOCTYPE")) {
            msg = "Server encountered an error while processing your request. Please check backend logs or database connection.";
          } else {
            msg = data;
          }
        } else if (data.error) {
          msg = data.error;
        } else if (data.detail) {
          msg = data.detail;
        } else if (data.message) {
          msg = data.message;
        } else {
          const docKeys = ["registration_certificate", "gst_certificate", "owner_id_proof", "owner_profile_photo"];
          const newDocErrors = {};
          docKeys.forEach((k) => {
            if (data[k]) {
              newDocErrors[k] = Array.isArray(data[k]) ? data[k][0] : String(data[k]);
            }
          });
          if (Object.keys(newDocErrors).length > 0) {
            setDocumentErrors((prev) => ({ ...prev, ...newDocErrors }));
            scrollToSection(7, "card-documents");
          }

          const firstKey = Object.keys(data)[0];
          const errorVal = data[firstKey];
          msg = `${firstKey}: ${Array.isArray(errorVal) ? errorVal[0] : String(errorVal)}`;
        }
      } else if (err.message) {
        if (
          err.message.includes("413") ||
          err.message.toLowerCase().includes("payload too large")
        ) {
          msg = "Uploaded files or payload exceeds server limit. Please select smaller photos/documents or restart the Django server.";
        } else if (err.message.toLowerCase().includes("network error") || !err.response) {
          msg = "Cannot connect to the backend server. Please verify Django server is running at http://127.0.0.1:8000 and PostgreSQL is started.";
        } else {
          msg = err.message;
        }
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
            <div className="cs-brand-logo"><img src={logo} alt="BookMySalon Logo" />
            </div>
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
        {isLinkExpired ? (
          <div
            style={{
              maxWidth: "640px",
              margin: "40px auto",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "16px",
              padding: "48px 36px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "#fef3c7",
                color: "#d97706",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "34px",
                margin: "0 auto 20px",
              }}
            >
              🔒
            </div>
            <h2 style={{ fontSize: "24px", fontWeight: "700", color: "#1f2937", marginBottom: "12px" }}>
              Resubmission Link Expired
            </h2>
            <div
              style={{
                display: "inline-block",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "#ecfdf5",
                color: "#059669",
                fontSize: "12px",
                fontWeight: "700",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "20px",
              }}
            >
              ● Application Already Under Review
            </div>
            <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#4b5563", marginBottom: "24px" }}>
              {expiredLinkInfo.error ||
                `The application for ${expiredLinkInfo.salonName || "your salon"} has already been resubmitted and is currently undergoing priority review by our Super Admin team.`}
            </p>
            <div
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px 20px",
                fontSize: "13px",
                color: "#64748b",
                textAlign: "left",
                marginBottom: "28px",
                lineHeight: "1.5",
              }}
            >
              <div style={{ fontWeight: "700", color: "#334155" }}>Why has this link expired?</div>
              <div style={{ marginTop: "4px" }}>
                For security and compliance, each resubmission link is strictly single-use. Once an applicant resubmits their corrected application, the link is deactivated and the profile is locked for Super Admin review. You will be notified by email once a decision is made.
              </div>
            </div>
            <Link
              to="/"
              className="cs-submit-btn"
              style={{
                display: "inline-block",
                textDecoration: "none",
                padding: "12px 28px",
                borderRadius: "8px",
                fontWeight: "700",
              }}
            >
              Return to BookMySalon Home →
            </Link>
          </div>
        ) : (
          <>
            {/* Top Breadcrumb */}
            <div className="cs-top-breadcrumb">
              <Link to="/" className="cs-breadcrumb-link">
                ← Back to Home
              </Link>
            </div>

        {/* Page Title & Status */}
        <div className="cs-title-row">
          <div>
            <h1>{isResubmitMode ? "Update & Resubmit Salon Application" : "List Your Salon"}</h1>
            <p>
              {isResubmitMode
                ? "Review your pre-filled details, make any requested corrections, and resubmit for Super Admin approval."
                : "Complete the details below to submit your salon profile for Super Admin verification and start accepting bookings."}
            </p>
          </div>
          <div className="cs-draft-status">
            {isResubmitMode
              ? (draftSaveStatus === "saved" ? "Draft Saved" : "Resubmission Mode")
              : lastSaved}
          </div>
        </div>

        {/* Resubmission Mode Banner with Admin Notes */}
        {isResubmitMode && (
          <div
            style={{
              padding: "18px 24px",
              background: "#fffbeb",
              border: "1.5px solid #fde68a",
              borderRadius: "12px",
              color: "#92400e",
              marginBottom: "24px",
              boxShadow: "0 2px 8px rgba(217, 119, 6, 0.08)",
            }}
          >
            <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "24px", lineHeight: 1 }}>📝</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                  <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#92400e" }}>
                    Editing Application for {formData.name || "Your Salon"}
                  </h3>
                  <span
                    style={{
                      background: "#fef3c7",
                      color: "#b45309",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      fontSize: "11px",
                      fontWeight: "700",
                      textTransform: "uppercase",
                    }}
                  >
                    Resubmission
                  </span>
                </div>
                <p style={{ margin: "0 0 10px 0", fontSize: "13.5px", color: "#78350f", lineHeight: 1.5 }}>
                  All your previously submitted details have been automatically pre-filled. Please review each section, make the corrections requested by the Super Admin, and resubmit.
                </p>
                {rejectionNotes && (
                  <div
                    style={{
                      background: "#ffffff",
                      borderLeft: "4px solid #ef4444",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "#991b1b",
                      marginTop: "6px",
                    }}
                  >
                    <strong>Super Admin Feedback:</strong>
                    <div style={{ marginTop: "4px", color: "#7f1d1d" }}>{rejectionNotes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading Prefill Spinner */}
        {isLoadingPrefill && (
          <div
            style={{
              padding: "20px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "12px",
              color: "#166534",
              marginBottom: "24px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            ⏳ Loading your pre-filled application details...
          </div>
        )}

        {/* Prefill Error Banner */}
        {prefillError && (
          <div
            style={{
              padding: "16px 20px",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "10px",
              color: "#991b1b",
              marginBottom: "24px",
              fontSize: "14px",
            }}
          >
            ⚠️ {prefillError}
          </div>
        )}

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
            className={`cs-step-pill ${activeStep === 4 ? "active" : checklist.pricing ? "completed" : ""}`}
            onClick={() => scrollToSection(4, "card-pricing")}
          >
            <span className="cs-step-num">4</span>
            Services & Pricing
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 5 ? "active" : checklist.amenities ? "completed" : ""}`}
            onClick={() => scrollToSection(5, "card-amenities")}
          >
            <span className="cs-step-num">5</span>
            Facilities & Amenities
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 6 ? "active" : checklist.photos ? "completed" : ""}`}
            onClick={() => scrollToSection(6, "card-photos")}
          >
            <span className="cs-step-num">6</span>
            Photo Gallery
          </button>
          <button
            type="button"
            className={`cs-step-pill ${activeStep === 7 ? "active" : checklist.documents ? "completed" : ""}`}
            onClick={() => scrollToSection(7, "card-documents")}
          >
            <span className="cs-step-num">7</span>
            Registration & Documents
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
                <span className="cs-card-badge">Step 1 of 7</span>
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
                <div className="cs-form-group cs-email-verify-group">
                  <div className="cs-label-row">
                    <label className="cs-label" htmlFor="cs-official-email">
                      Official Contact Email <span className="required">*</span>
                    </label>
                    {isEmailVerified && (
                      <span className="cs-email-verified-pill">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="cs-email-input-wrapper">
                    <input
                      id="cs-official-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="owner@yourparlour.com"
                      className={`cs-input ${isEmailVerified ? "cs-input-verified" : ""}`}
                      readOnly={isEmailVerified}
                      required
                    />
                    {isEmailVerified ? (
                      <button
                        type="button"
                        className="cs-email-change-btn"
                        onClick={handleChangeVerifiedEmail}
                        title="Click to edit or re-verify a different email"
                      >
                        Change
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cs-email-verify-btn"
                        onClick={handleSendEmailOtp}
                        disabled={isSendingOtp || !isValidEmail(formData.email)}
                      >
                        {isSendingOtp ? (
                          <span className="cs-btn-spinner-sm"></span>
                        ) : otpSent ? (
                          "Resend Code"
                        ) : (
                          "Verify Email"
                        )}
                      </button>
                    )}
                  </div>

                  {!otpSent && !isEmailVerified && (
                    <span className="cs-field-subtext">
                      We will send a 6-digit verification code to verify official ownership.
                    </span>
                  )}
                  {isEmailVerified && (
                    <span className="cs-field-subtext cs-field-subtext-success">
                      ✓ Email verified. Credentials will be sent here upon Super Admin approval.
                    </span>
                  )}

                  {/* Inline OTP Verification Panel */}
                  {otpSent && !isEmailVerified && (
                    <div className="cs-inline-otp-panel">
                      <div className="cs-inline-otp-header">
                        <div className="cs-inline-otp-icon">✉</div>
                        <div className="cs-inline-otp-meta">
                          <strong>Verification Code Sent</strong>
                          <span>Check inbox for <strong>{formData.email}</strong></span>
                        </div>
                      </div>

                      <div className="cs-inline-otp-body">
                        <label className="cs-inline-otp-label">Enter 6-Digit Code</label>
                        <div className="cs-inline-otp-input-row">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            autoComplete="one-time-code"
                            placeholder="• • • • • •"
                            value={otpCode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setOtpCode(val);
                              if (otpError) setOtpError("");
                            }}
                            className="cs-inline-otp-input"
                            autoFocus
                          />
                          <button
                            type="button"
                            className="cs-inline-otp-submit-btn"
                            onClick={handleVerifyEmailOtp}
                            disabled={isVerifyingOtp || otpCode.length !== 6}
                          >
                            {isVerifyingOtp ? "Verifying..." : "Verify Code"}
                          </button>
                        </div>

                        <div className="cs-inline-otp-footer">
                          <div className="cs-inline-otp-countdown">
                            {otpCountdown > 0 ? (
                              <>
                                <span className="cs-otp-dot-pulse" />
                                <span>Expires in {otpCountdown}s</span>
                              </>
                            ) : (
                              <span className="cs-otp-expired-msg">Code expired</span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="cs-inline-otp-resend-btn"
                            onClick={handleResendEmailOtp}
                            disabled={otpCountdown > 0 || isSendingOtp}
                          >
                            {isSendingOtp ? "Sending..." : "Resend Code"}
                          </button>
                        </div>

                        {otpError && (
                          <div className="cs-inline-otp-alert error">
                            {otpError}
                          </div>
                        )}
                        {otpSuccessMessage && !otpError && (
                          <div className="cs-inline-otp-alert success">
                            {otpSuccessMessage}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
                    placeholder="e.g. Kerala"
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

            {/* Card 4: Services & Pricing Menu */}
            <section className="cs-card" id="card-pricing">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon coral">🏷️</div>
                  <div>
                    <h2>Services & Pricing Menu</h2>
                    <p>Add treatment offerings and pricing. Clients search, filter, and book by these services.</p>
                  </div>
                </div>
                <span className="cs-card-badge">
                  Step 4 of 7 • {services.length} services configured
                </span>
              </div>

              {/* Add New Service Form Box */}
              <div className="cs-service-builder-box">
                <div className="cs-service-builder-header">
                  <div className="cs-builder-tag">➕ ADD NEW SERVICE</div>
                  <span className="cs-builder-subtitle">Define a service name, price, and category</span>
                </div>

                <form onSubmit={handleAddService} className="cs-service-form">
                  <div className="cs-service-form-grid">
                    <div className="cs-form-group">
                      <label className="cs-label" htmlFor="service-name-input">
                        Service / Treatment Name <span className="required">*</span>
                      </label>
                      <input
                        id="service-name-input"
                        type="text"
                        list="catalog-services-list"
                        className="cs-input"
                        placeholder="e.g. Beard Cut, Deluxe Shave, Hydra Facial..."
                        value={newServiceName}
                        onChange={handleServiceNameChange}
                      />
                      <datalist id="catalog-services-list">
                        {catalogServices.map((cs) => (
                          <option key={cs.id} value={cs.name}>
                            {cs.category} • ₹{cs.price} • {cs.duration}
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div className="cs-form-group cs-field-price">
                      <label className="cs-label" htmlFor="service-price-input">
                        Price (₹) <span className="required">*</span>
                      </label>
                      <div className="cs-price-input-wrapper">
                        <span className="cs-currency-prefix">₹</span>
                        <input
                          id="service-price-input"
                          type="number"
                          min="1"
                          step="1"
                          className="cs-input cs-price-input"
                          placeholder="e.g. 150"
                          value={newServicePrice}
                          onChange={(e) => {
                            setNewServicePrice(e.target.value);
                            if (serviceError) setServiceError("");
                          }}
                        />
                      </div>
                    </div>

                    <div className="cs-form-group">
                      <label className="cs-label" htmlFor="service-cat-select">Category</label>
                      <select
                        id="service-cat-select"
                        className="cs-select"
                        value={newServiceCategory}
                        onChange={(e) => setNewServiceCategory(e.target.value)}
                      >
                        {categoriesList.map((cat) => (
                          <option key={cat.id || cat.name} value={cat.name}>
                            {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cs-form-group">
                      <label className="cs-label" htmlFor="service-duration-select">Duration</label>
                      <select
                        id="service-duration-select"
                        className="cs-select"
                        value={newServiceDuration}
                        onChange={(e) => setNewServiceDuration(e.target.value)}
                      >
                        <option value="15 mins">15 mins</option>
                        <option value="30 mins">30 mins</option>
                        <option value="45 mins">45 mins</option>
                        <option value="60 mins">60 mins</option>
                        <option value="90 mins">90 mins</option>
                        <option value="120 mins">120 mins</option>
                      </select>
                    </div>
                  </div>

                  {serviceError && (
                    <div className="cs-service-error-msg">
                      <span>⚠️ {serviceError}</span>
                    </div>
                  )}

                  <div className="cs-service-form-footer">
                    <button type="submit" className="cs-add-service-btn">
                      <span>+ Add Service</span>
                    </button>
                    <span className="cs-service-hint">
                      Tip: Select from catalog suggestions or type your custom service name and price.
                    </span>
                  </div>
                </form>

                {/* Quick-Add Standard Catalog Services */}
                {catalogServices.length > 0 && (
                  <div className="cs-presets-area">
                    <div className="cs-presets-header">
                      <span className="cs-presets-label">⚡ QUICK ADD STANDARD SERVICES:</span>
                      {categoriesList.length > 1 && (
                        <div className="cs-presets-cat-tabs">
                          <button
                            type="button"
                            className={`cs-presets-cat-btn ${activeSuggestionCategory === "ALL" ? "active" : ""}`}
                            onClick={() => setActiveSuggestionCategory("ALL")}
                          >
                            All ({catalogServices.length})
                          </button>
                          {categoriesList.map((cat) => {
                            const count = catalogServices.filter((s) => s.category === cat.name).length;
                            return (
                              <button
                                key={cat.id || cat.name}
                                type="button"
                                className={`cs-presets-cat-btn ${activeSuggestionCategory === cat.name ? "active" : ""}`}
                                onClick={() => setActiveSuggestionCategory(cat.name)}
                              >
                                {cat.icon ? `${cat.icon} ` : ""}{cat.name} ({count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="cs-presets-chips">
                      {visibleSuggestions.map((preset) => {
                        const isAdded = services.some(
                          (s) => s.name.toLowerCase() === preset.name.toLowerCase()
                        );
                        return (
                          <button
                            key={preset.id || preset.name}
                            type="button"
                            className={`cs-preset-chip ${isAdded ? "is-added" : ""}`}
                            onClick={() => handleAddPreset(preset)}
                            title={isAdded ? "Already added to your menu (click to edit details)" : `Click to add ${preset.name} (₹${preset.price})`}
                          >
                            <span>{isAdded ? "✓" : "+"}</span>
                            <span className="cs-preset-name">{preset.name}</span>
                            <span className="cs-preset-price">₹{preset.price}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Configured Services List */}
              <div className="cs-services-list-container">
                <div className="cs-services-list-header">
                  <h3>Active Services Menu ({services.length})</h3>
                  <span className="cs-services-help">These appear directly on your public salon card</span>
                </div>

                {services.length === 0 ? (
                  <div className="cs-services-empty-state">
                    <div className="cs-empty-icon">✂️</div>
                    <h4>No services configured yet</h4>
                    <p>Use the form above or click quick preset chips to add your first service (e.g. Beard Cut - ₹150).</p>
                  </div>
                ) : (
                  <div className="cs-services-cards-grid">
                    {services.map((srv, idx) => (
                      <div key={srv.id || idx} className="cs-service-card-item">
                        <div className="cs-service-item-main">
                          <div className="cs-service-item-icon">
                            {srv.category?.toLowerCase().includes("hair")
                              ? "✂️"
                              : srv.category?.toLowerCase().includes("beard") || srv.category?.toLowerCase().includes("men")
                              ? "🪒"
                              : srv.category?.toLowerCase().includes("skin") || srv.category?.toLowerCase().includes("facial")
                              ? "✨"
                              : srv.category?.toLowerCase().includes("nail")
                              ? "💅"
                              : srv.category?.toLowerCase().includes("spa") || srv.category?.toLowerCase().includes("massage")
                              ? "🌿"
                              : "🏷️"}
                          </div>
                          <div className="cs-service-item-details">
                            <div className="cs-service-item-name">{srv.name}</div>
                            <div className="cs-service-item-meta">
                              <span className="cs-service-cat-pill">{srv.category || "General"}</span>
                              <span className="cs-service-dur-pill">⏱ {srv.duration || "30 mins"}</span>
                            </div>
                          </div>
                        </div>

                        <div className="cs-service-item-actions">
                          <div className="cs-service-item-price">
                            ₹{String(srv.price).replace(/[^\d.]/g, "")}
                          </div>
                          <button
                            type="button"
                            className="cs-service-delete-btn"
                            onClick={() => handleRemoveService(srv.id)}
                            title={`Remove ${srv.name}`}
                            aria-label={`Remove ${srv.name}`}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Card 5: Facilities & Amenities */}
            <section className="cs-card" id="card-amenities">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon teal">✨</div>
                  <div>
                    <h2>Facilities & Amenities</h2>
                    <p>Highlight comfort amenities to rank higher in client search filters</p>
                  </div>
                </div>
                <span className="cs-card-badge">Step 5 of 7 • {selectedAmenities.length} selected</span>
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

            {/* Card 6: Photo Gallery & Cover */}
            <section className="cs-card" id="card-photos">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon purple">📷</div>
                  <div>
                    <h2>Photo Gallery & Cover</h2>
                    <p>High-resolution salon photos increase client booking conversion by 2.5x</p>
                  </div>
                </div>
                <span className="cs-card-badge">Step 6 of 7 • {images.length} photos</span>
              </div>

              {/* Dropzone */}
              <div
                className={`cs-dropzone ${isProcessingPhotos ? "processing" : ""}`}
                onClick={() => !isProcessingPhotos && fileInputRef.current?.click()}
                style={isProcessingPhotos ? { opacity: 0.7, pointerEvents: "none" } : {}}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleFileUpload}
                  disabled={isProcessingPhotos}
                />
                <div className="cs-dropzone-icon">{isProcessingPhotos ? "⏳" : "☁️"}</div>
                <h4>
                  {isProcessingPhotos
                    ? "Optimizing & compressing selected photos..."
                    : "Drag & drop your salon photos here, or browse files"}
                </h4>
                <p>
                  {isProcessingPhotos
                    ? "Auto-compressing images to ensure high quality and fast upload..."
                    : "Supports JPG, PNG, WEBP up to 10MB each (auto-compressed). First photo will be your main cover banner."}
                </p>
                <button
                  type="button"
                  className="cs-dropzone-btn"
                  disabled={isProcessingPhotos}
                >
                  {isProcessingPhotos ? "Processing..." : "Browse Files"}
                </button>
              </div>

              {/* Gallery Previews */}
              {images.length > 0 && (
                <div className="cs-gallery-previews">
                  {images.map((imgUrl, idx) => (
                    <div className="cs-photo-card" key={idx}>
                      <img src={resolveImageUrl(imgUrl)} alt={`Salon gallery ${idx + 1}`} />
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

            {/* Card 7: Salon Registration Information & Document Upload */}
            <section className="cs-card" id="card-documents">
              <div className="cs-card-header">
                <div className="cs-card-title-group">
                  <div className="cs-card-icon blue">📑</div>
                  <div>
                    <h2>Salon Registration Information & Document Upload</h2>
                    <p>Collect business proof and owner verification documents for Super Admin review</p>
                  </div>
                </div>
                <span className="cs-card-badge">Step 7 of 7</span>
              </div>

              <div className="cs-docs-grid">
                {/* 1. Salon Registration Certificate (Required) */}
                <div className={`cs-doc-card ${documentErrors.registration_certificate || documentErrors.registration_valid_to ? "has-error" : documents.registration_certificate ? "is-uploaded" : ""}`}>
                  <div className="cs-doc-header">
                    <h3 className="cs-doc-title">
                      <span>📄 Salon Registration Certificate</span>
                    </h3>
                    <span className="cs-doc-badge-required">Required</span>
                  </div>
                  <p className="cs-doc-desc">Proof of business registration (Trade License, Shops & Establishment, or MSME)</p>

                  <input
                    ref={regCertInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentFileChange("registration_certificate", file);
                    }}
                  />

                  {documents.registration_certificate ? (
                    <div className="cs-doc-preview-box">
                      <div className="cs-doc-thumb-wrap">
                        {documentMeta.registration_certificate?.type === "PDF" ||
                        (typeof documents.registration_certificate === "string" && (
                          documents.registration_certificate.startsWith("data:application/pdf") ||
                          documents.registration_certificate.toLowerCase().includes(".pdf")
                        )) ? (
                          <span className="cs-doc-pdf-icon">📕</span>
                        ) : (
                          <img
                            src={resolveImageUrl(documents.registration_certificate)}
                            alt="Registration Certificate Preview"
                            className="cs-doc-thumb-img"
                          />
                        )}
                      </div>
                      <div className="cs-doc-meta">
                        <div className="cs-doc-filesize">
                          <span className="cs-doc-format-tag">{documentMeta.registration_certificate?.ext || "DOC"}</span>
                          <span>{documentMeta.registration_certificate?.size || "Uploaded"}</span>
                        </div>
                      </div>
                      <div className="cs-doc-actions">
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => {
                            const url = documents.registration_certificate.startsWith("data:") || documents.registration_certificate.startsWith("http")
                              ? documents.registration_certificate
                              : resolveImageUrl(documents.registration_certificate);
                            window.open(url, "_blank");
                          }}
                          title="View document"
                        >
                          👁 View
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => regCertInputRef.current?.click()}
                          title="Change document"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn danger"
                          onClick={() => handleRemoveDocument("registration_certificate")}
                          title="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cs-doc-upload-box"
                      onClick={() => regCertInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleDocumentFileChange("registration_certificate", file);
                      }}
                    >
                      <div className="cs-doc-upload-icon">📁</div>
                      <div className="cs-doc-upload-text">Upload Registration Certificate</div>
                      <div className="cs-doc-upload-hint">PDF, JPG, JPEG or PNG (Max 10MB)</div>
                    </div>
                  )}

                  {documentErrors.registration_certificate && (
                    <div className="cs-doc-error">
                      <span>⚠️</span> {documentErrors.registration_certificate}
                    </div>
                  )}

                  {/* Registration Details & Validity Dates */}
                  <div className="cs-doc-inputs">
                    <div className="cs-doc-field">
                      <label className="cs-doc-field-label">
                        Registration / Trade License No.
                      </label>
                      <input
                        type="text"
                        className="cs-doc-input"
                        placeholder="e.g. TL-2026-98745 or MSME-123456"
                        value={documents.registration_number || ""}
                        onChange={(e) => setDocuments((prev) => ({ ...prev, registration_number: e.target.value }))}
                      />
                    </div>

                    <div className="cs-doc-input-row">
                      <div className="cs-doc-field">
                        <label className="cs-doc-field-label">
                          Valid From (Issue Date)
                        </label>
                        <input
                          type="date"
                          className="cs-doc-input"
                          value={documents.registration_valid_from || ""}
                          onChange={(e) => {
                            setDocuments((prev) => ({ ...prev, registration_valid_from: e.target.value }));
                            setDocumentErrors((prev) => ({ ...prev, registration_valid_to: "" }));
                          }}
                        />
                      </div>

                      <div className="cs-doc-field">
                        <label className="cs-doc-field-label">
                          <span>Valid Till (Expiry Date)<span className="required-star">*</span></span>
                        </label>
                        <input
                          type="date"
                          className={`cs-doc-input ${documentErrors.registration_valid_to ? "has-error" : ""}`}
                          value={documents.registration_valid_to || ""}
                          onChange={(e) => {
                            setDocuments((prev) => ({ ...prev, registration_valid_to: e.target.value }));
                            setDocumentErrors((prev) => ({ ...prev, registration_valid_to: "" }));
                          }}
                        />
                      </div>
                    </div>

                    {documentErrors.registration_valid_to && (
                      <div className="cs-doc-error">
                        <span>⚠️</span> {documentErrors.registration_valid_to}
                      </div>
                    )}

                    {/* Expiry Status Alert & Renewal Option */}
                    {documents.registration_valid_to && (() => {
                      const info = getRegistrationValidityInfo(documents.registration_valid_from, documents.registration_valid_to);
                      if (!info) return null;
                      return (
                        <div className={`cs-validity-status-box ${info.status}`}>
                          <div className="cs-validity-status-left">
                            <span>{info.badgeText}</span>
                          </div>
                          <button
                            type="button"
                            className="cs-renew-reg-btn"
                            onClick={handleAddNewRegistration}
                            title="Upload renewed registration certificate and dates"
                          >
                            + Add / Renew
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 2. GST Certificate (Optional) */}
                <div className={`cs-doc-card ${documentErrors.gst_certificate ? "has-error" : documents.gst_certificate ? "is-uploaded" : ""}`}>
                  <div className="cs-doc-header">
                    <h3 className="cs-doc-title">
                      <span>📑 GST Certificate</span>
                    </h3>
                    <span className="cs-doc-badge-optional">Optional</span>
                  </div>
                  <p className="cs-doc-desc">Tax registration verification (optional if not GST registered)</p>

                  <input
                    ref={gstCertInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentFileChange("gst_certificate", file);
                    }}
                  />

                  {documents.gst_certificate ? (
                    <div className="cs-doc-preview-box">
                      <div className="cs-doc-thumb-wrap">
                        {documentMeta.gst_certificate?.type === "PDF" ||
                        (typeof documents.gst_certificate === "string" && (
                          documents.gst_certificate.startsWith("data:application/pdf") ||
                          documents.gst_certificate.toLowerCase().includes(".pdf")
                        )) ? (
                          <span className="cs-doc-pdf-icon">📕</span>
                        ) : (
                          <img
                            src={resolveImageUrl(documents.gst_certificate)}
                            alt="GST Certificate Preview"
                            className="cs-doc-thumb-img"
                          />
                        )}
                      </div>
                      <div className="cs-doc-meta">
                        <div className="cs-doc-filesize">
                          <span className="cs-doc-format-tag">{documentMeta.gst_certificate?.ext || "DOC"}</span>
                          <span>{documentMeta.gst_certificate?.size || "Uploaded"}</span>
                        </div>
                      </div>
                      <div className="cs-doc-actions">
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => {
                            const url = documents.gst_certificate.startsWith("data:") || documents.gst_certificate.startsWith("http")
                              ? documents.gst_certificate
                              : resolveImageUrl(documents.gst_certificate);
                            window.open(url, "_blank");
                          }}
                          title="View document"
                        >
                          👁 View
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => gstCertInputRef.current?.click()}
                          title="Change document"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn danger"
                          onClick={() => handleRemoveDocument("gst_certificate")}
                          title="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cs-doc-upload-box"
                      onClick={() => gstCertInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleDocumentFileChange("gst_certificate", file);
                      }}
                    >
                      <div className="cs-doc-upload-icon">📂</div>
                      <div className="cs-doc-upload-text">Upload GST Certificate</div>
                      <div className="cs-doc-upload-hint">PDF, JPG, JPEG or PNG (Max 10MB)</div>
                    </div>
                  )}

                  {documentErrors.gst_certificate && (
                    <div className="cs-doc-error">
                      <span>⚠️</span> {documentErrors.gst_certificate}
                    </div>
                  )}

                  {/* GST Details */}
                  <div className="cs-doc-inputs">
                    <div className="cs-doc-field">
                      <label className="cs-doc-field-label">
                        GSTIN / Tax Identification No. (Optional)
                      </label>
                      <input
                        type="text"
                        className="cs-doc-input"
                        placeholder="e.g. 29ABCDE1234F1Z5"
                        maxLength={15}
                        value={documents.gst_number || ""}
                        onChange={(e) => setDocuments((prev) => ({ ...prev, gst_number: e.target.value.toUpperCase() }))}
                      />
                      <div className="cs-doc-field-hint">15-digit Goods & Services Tax Identification Number</div>
                    </div>
                  </div>
                </div>

                {/* 3. Owner ID Proof (Required) */}
                <div className={`cs-doc-card ${documentErrors.owner_id_proof || documentErrors.owner_id_number ? "has-error" : documents.owner_id_proof ? "is-uploaded" : ""}`}>
                  <div className="cs-doc-header">
                    <h3 className="cs-doc-title">
                      <span>🪪 Owner ID Proof (Aadhaar/PAN)</span>
                    </h3>
                    <span className="cs-doc-badge-required">Required</span>
                  </div>
                  <p className="cs-doc-desc">Verify salon owner identity (Government issued Aadhaar card or PAN card)</p>

                  <input
                    ref={ownerIdInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentFileChange("owner_id_proof", file);
                    }}
                  />

                  {documents.owner_id_proof ? (
                    <div className="cs-doc-preview-box">
                      <div className="cs-doc-thumb-wrap">
                        {documentMeta.owner_id_proof?.type === "PDF" ||
                        (typeof documents.owner_id_proof === "string" && (
                          documents.owner_id_proof.startsWith("data:application/pdf") ||
                          documents.owner_id_proof.toLowerCase().includes(".pdf")
                        )) ? (
                          <span className="cs-doc-pdf-icon">📕</span>
                        ) : (
                          <img
                            src={resolveImageUrl(documents.owner_id_proof)}
                            alt="Owner ID Proof Preview"
                            className="cs-doc-thumb-img"
                          />
                        )}
                      </div>
                      <div className="cs-doc-meta">
                        <div className="cs-doc-filesize">
                          <span className="cs-doc-format-tag">{documentMeta.owner_id_proof?.ext || "DOC"}</span>
                          <span>{documentMeta.owner_id_proof?.size || "Uploaded"}</span>
                        </div>
                      </div>
                      <div className="cs-doc-actions">
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => {
                            const url = documents.owner_id_proof.startsWith("data:") || documents.owner_id_proof.startsWith("http")
                              ? documents.owner_id_proof
                              : resolveImageUrl(documents.owner_id_proof);
                            window.open(url, "_blank");
                          }}
                          title="View document"
                        >
                          👁 View
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => ownerIdInputRef.current?.click()}
                          title="Change document"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn danger"
                          onClick={() => handleRemoveDocument("owner_id_proof")}
                          title="Remove document"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cs-doc-upload-box"
                      onClick={() => ownerIdInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleDocumentFileChange("owner_id_proof", file);
                      }}
                    >
                      <div className="cs-doc-upload-icon">🆔</div>
                      <div className="cs-doc-upload-text">Upload Owner ID Proof</div>
                      <div className="cs-doc-upload-hint">PDF, JPG, JPEG or PNG (Max 10MB)</div>
                    </div>
                  )}

                  {documentErrors.owner_id_proof && (
                    <div className="cs-doc-error">
                      <span>⚠️</span> {documentErrors.owner_id_proof}
                    </div>
                  )}

                  {/* ID Details */}
                  <div className="cs-doc-inputs">
                    <div className="cs-doc-input-row">
                      <div className="cs-doc-field">
                        <label className="cs-doc-field-label">
                          <span>ID Type<span className="required-star">*</span></span>
                        </label>
                        <select
                          className="cs-doc-select"
                          value={documents.owner_id_type || "Aadhaar Card"}
                          onChange={(e) => setDocuments((prev) => ({ ...prev, owner_id_type: e.target.value }))}
                        >
                          <option value="Aadhaar Card">Aadhaar Card</option>
                          <option value="PAN Card">PAN Card</option>
                          <option value="Passport">Passport</option>
                          <option value="Voter ID">Voter ID</option>
                          <option value="Driving License">Driving License</option>
                        </select>
                      </div>

                      <div className="cs-doc-field">
                        <label className="cs-doc-field-label">
                          <span>ID Document Number<span className="required-star">*</span></span>
                        </label>
                        <input
                          type="text"
                          className={`cs-doc-input ${documentErrors.owner_id_number ? "has-error" : ""}`}
                          placeholder="e.g. 1234 5678 9012 or ABCDE1234F"
                          value={documents.owner_id_number || ""}
                          onChange={(e) => {
                            setDocuments((prev) => ({ ...prev, owner_id_number: e.target.value }));
                            setDocumentErrors((prev) => ({ ...prev, owner_id_number: "" }));
                          }}
                        />
                      </div>
                    </div>

                    {documentErrors.owner_id_number && (
                      <div className="cs-doc-error">
                        <span>⚠️</span> {documentErrors.owner_id_number}
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Owner Profile Photo (Required) */}
                <div className={`cs-doc-card ${documentErrors.owner_profile_photo ? "has-error" : documents.owner_profile_photo ? "is-uploaded" : ""}`}>
                  <div className="cs-doc-header">
                    <h3 className="cs-doc-title">
                      <span>👤 Owner Profile Photo</span>
                    </h3>
                    <span className="cs-doc-badge-required">Required</span>
                  </div>
                  <p className="cs-doc-desc">Owner identification (Clear frontal portrait photo of salon proprietor)</p>

                  <input
                    ref={ownerPhotoInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleDocumentFileChange("owner_profile_photo", file);
                    }}
                  />

                  {documents.owner_profile_photo ? (
                    <div className="cs-doc-preview-box">
                      <div className="cs-doc-thumb-wrap">
                        {documentMeta.owner_profile_photo?.type === "PDF" ||
                        (typeof documents.owner_profile_photo === "string" && (
                          documents.owner_profile_photo.startsWith("data:application/pdf") ||
                          documents.owner_profile_photo.toLowerCase().includes(".pdf")
                        )) ? (
                          <span className="cs-doc-pdf-icon">📕</span>
                        ) : (
                          <img
                            src={resolveImageUrl(documents.owner_profile_photo)}
                            alt="Owner Profile Photo Preview"
                            className="cs-doc-thumb-img"
                          />
                        )}
                      </div>
                      <div className="cs-doc-meta">
                        
                        <div className="cs-doc-filesize">
                          <span className="cs-doc-format-tag">{documentMeta.owner_profile_photo?.ext || "IMG"}</span>
                          <span>{documentMeta.owner_profile_photo?.size || "Uploaded"}</span>
                        </div>
                      </div>
                      <div className="cs-doc-actions">
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => {
                            const url = documents.owner_profile_photo.startsWith("data:") || documents.owner_profile_photo.startsWith("http")
                              ? documents.owner_profile_photo
                              : resolveImageUrl(documents.owner_profile_photo);
                            window.open(url, "_blank");
                          }}
                          title="View photo"
                        >
                          👁 View
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn"
                          onClick={() => ownerPhotoInputRef.current?.click()}
                          title="Change photo"
                        >
                          ↻
                        </button>
                        <button
                          type="button"
                          className="cs-doc-action-btn danger"
                          onClick={() => handleRemoveDocument("owner_profile_photo")}
                          title="Remove photo"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="cs-doc-upload-box"
                      onClick={() => ownerPhotoInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleDocumentFileChange("owner_profile_photo", file);
                      }}
                    >
                      <div className="cs-doc-upload-icon">📷</div>
                      <div className="cs-doc-upload-text">Upload Owner Photo</div>
                      <div className="cs-doc-upload-hint">JPG, JPEG, PNG or PDF (Max 10MB)</div>
                    </div>
                  )}

                  {documentErrors.owner_profile_photo && (
                    <div className="cs-doc-error">
                      <span>⚠️</span> {documentErrors.owner_profile_photo}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Bottom Actions Bar */}
            <div className="cs-bottom-bar">
              <div className="cs-bottom-secondary-actions">
                
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
                <button
                  type="button"
                  className={`cs-secondary-btn cs-save-draft-btn ${
                    draftSaveStatus === "saved"
                      ? "is-saved"
                      : draftSaveStatus === "error"
                      ? "is-error"
                      : ""
                  }`}
                  onClick={handleSaveDraft}
                  title="Save current progress to your browser"
                >
                  {draftSaveStatus === "saved" ? (
                    <>✓ Draft Saved</>
                  ) : draftSaveStatus === "error" ? (
                    <>⚠️ Storage Error</>
                  ) : (
                    <>💾 Save Draft</>
                  )}
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
                    <span className="cs-spinner" /> {isResubmitMode ? "Resubmitting Application..." : "Submitting Application..."}
                  </>
                ) : (
                  <>{isResubmitMode ? "Resubmit Application →" : "Submit for Admin Approval →"}</>
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
                  src={resolveImageUrl(
                    images[0] ||
                    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80"
                  )}
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
                  <span className="cs-preview-tag">{detectedCategory}</span>
                  {selectedAmenities.slice(0, 2).map((a) => (
                    <span key={a} className="cs-preview-tag">
                      {a}
                    </span>
                  ))}
                </div>

                {/* Real-time services preview in card */}
                {services.length > 0 && (
                  <div className="cs-preview-services-preview">
                    {services.slice(0, 3).map((srv, idx) => (
                      <div key={srv.id || idx} className="cs-preview-service-row">
                        <span className="cs-preview-service-name" title={srv.name}>{srv.name}</span>
                        <span className="cs-preview-service-price">₹{String(srv.price).replace(/[^\d.]/g, "")}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="cs-preview-footer">
                  <div>
                    <span className="cs-preview-price-label">Services from</span>
                    <span className="cs-preview-price-val">
                      ₹{minPrice === Infinity ? "350" : minPrice}
                    </span>
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

                <div className={`cs-checklist-item ${checklist.email ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.email ? "done" : "pending"}`}>
                    {checklist.email ? "✓" : ""}
                  </div>
                  <span>Official Contact Email</span>
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

                <div className={`cs-checklist-item ${checklist.pricing ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.pricing ? "done" : "pending"}`}>
                    {checklist.pricing ? "✓" : ""}
                  </div>
                  <span>Services & Pricing Menu ({services.length})</span>
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

                <div className={`cs-checklist-item ${checklist.documents ? "done" : ""}`}>
                  <div className={`cs-check-icon ${checklist.documents ? "done" : "pending"}`}>
                    {checklist.documents ? "✓" : ""}
                  </div>
                  <span>Required Registration & ID Documents</span>
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
        </>
      )}
      </main>


      {/* Confirmation Modal before Resubmission */}
      {showConfirmModal && (
        <div className="cs-modal-backdrop">
          <div
            style={{
              maxWidth: "520px",
              width: "90%",
              background: "#ffffff",
              borderRadius: "16px",
              padding: "32px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.18)",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  background: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "22px",
                  flexShrink: 0,
                }}
              >
                ⚠️
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#1f2937" }}>
                  Confirm Application Resubmission
                </h3>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  For {formData.name || "Your Salon"}
                </span>
              </div>
            </div>

            <div
              style={{
                background: "#fffbeb",
                border: "1px solid #fde68a",
                borderRadius: "10px",
                padding: "14px 16px",
                fontSize: "13px",
                color: "#92400e",
                lineHeight: "1.5",
                marginBottom: "20px",
              }}
            >
              <strong>Important Notice:</strong> Once you resubmit this application, <strong>your resubmission link will immediately expire</strong> and your application will be locked for Super Admin review.
            </div>

            {rejectionNotes && (
              <div
                style={{
                  background: "#fef2f2",
                  borderLeft: "4px solid #ef4444",
                  padding: "10px 14px",
                  borderRadius: "6px",
                  fontSize: "12.5px",
                  color: "#991b1b",
                  marginBottom: "20px",
                }}
              >
                <strong>Admin Feedback Addressed:</strong>
                <div style={{ marginTop: "4px", color: "#7f1d1d" }}>{rejectionNotes}</div>
              </div>
            )}

            <div style={{ fontSize: "13.5px", color: "#4b5563", marginBottom: "24px" }}>
              Please ensure all updated contact info, timings, services, and photos are completely accurate before confirming.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                type="button"
                className="cs-secondary-btn"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                style={{ padding: "10px 20px" }}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="cs-submit-btn"
                onClick={executeSubmit}
                disabled={isSubmitting}
                style={{ padding: "10px 22px" }}
              >
                {isSubmitting ? (
                  <>
                    <span className="cs-spinner" /> Resubmitting...
                  </>
                ) : (
                  "Yes, Confirm & Resubmit →"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Application Submitted Success Modal */}
      {submittedSalon && (
        <div className="cs-modal-backdrop">
          <div className="cs-success-modal">
            <div className="cs-modal-check-icon">✓</div>
            <h2>{isResubmitMode ? "Application Resubmitted!" : "Application Submitted!"}</h2>
            <p>
              Your salon <strong>{submittedSalon.name}</strong> has been{" "}
              {isResubmitMode ? "updated and resubmitted" : "registered and submitted"} for Super Admin review.
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
                <strong>Next Step:</strong> Once verified and approved by our Super Admin team, your official Owner login credentials will be emailed to your notification address.
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


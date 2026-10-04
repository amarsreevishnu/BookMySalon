import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import api from "../../api/axios";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/salonDetail.css";

// Helper for formatting time (e.g., "09:00" -> "9:00 AM")
function formatTime12(timeStr) {
  if (!timeStr) return "";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return timeStr;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

// Rich fallback data matching reference design
const DEFAULT_SALON_DATA = {
  id: 1,
  name: "Aura Luxe Salon & Spa",
  tagline: "Exclusive Sanctuary for Hair, Wellness & Skin Artistry",
  rating: 4.9,
  reviewsCount: 124,
  priceTier: "₹₹₹ Luxury",
  status: "Open until 9:00 PM",
  address: "Heritage Square, Kowdiar Main Avenue",
  city: "Thiruvananthapuram",
  state: "Kerala",
  pincode: "695003",
  landmark: "Opposite Raj Bhavan South Gate",
  phone: "+91 98470 12345",
  email: "concierge@auraluxesalon.com",
  isVerified: true,
  images: [
    "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85",
    "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=85",
    "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=85",
    "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=800&q=85",
    "https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?auto=format&fit=crop&w=800&q=85",
    "https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=800&q=85",
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=85",
  ],
  services: [
    {
      id: 101,
      category: "Hair",
      name: "Signature Balayage & Couture Color",
      duration: "120 mins",
      price: 4200,
      description: "Custom French hand-painted highlights, gloss toner & Kérastase bond repair infusion.",
      badge: "Best Seller",
    },
    {
      id: 102,
      category: "Hair",
      name: "Organic Keratin Smoothing Therapy",
      duration: "90 mins",
      price: 5500,
      description: "Formaldehyde-free organic smoothing treatment with deep protein seal & blowdry finish.",
      badge: "Popular",
    },
    {
      id: 103,
      category: "Hair",
      name: "Master Stylist Precision Haircut & Blowout",
      duration: "45 mins",
      price: 1250,
      description: "Consultation, relaxing scalp wash with Davines shampoo, texture sculpting and signature blowout.",
      badge: "Essential",
    },
    {
      id: 104,
      category: "Hair",
      name: "Botanical Scalp Detox & Hair Spa",
      duration: "60 mins",
      price: 1800,
      description: "Steam scalp exfoliation, Ayurvedic essential oil massage, and intensely hydrating hair mask.",
      badge: "Organic",
    },
    {
      id: 105,
      category: "Spa & Wellness",
      name: "Ayurvedic Abhyanga & Deep Tissue Massage",
      duration: "75 mins",
      price: 3200,
      description: "Warm herbal medicated oils applied with rhythmic synchronized strokes to release deep muscle knots.",
      badge: "Holistic",
    },
    {
      id: 106,
      category: "Spa & Wellness",
      name: "Aroma Steam & Swedish Relaxation Ritual",
      duration: "60 mins",
      price: 2800,
      description: "Lavender & eucalyptus aromatherapeutic massage followed by cedarwood steam therapy.",
      badge: null,
    },
    {
      id: 107,
      category: "Nails & Grooming",
      name: "Russian Gel Manicure & Hand Spa",
      duration: "60 mins",
      price: 1650,
      description: "Precision cuticle e-file care, collagen soak, scrub, tension massage & high-shine gel polish.",
      badge: "Trending",
    },
    {
      id: 108,
      category: "Nails & Grooming",
      name: "Deluxe Pedicure with Hot Stone Reflexology",
      duration: "60 mins",
      price: 1950,
      description: "Himalayan salt foot soak, callus removal, volcanic basalt stone massage and organic polish.",
      badge: null,
    },
    {
      id: 109,
      category: "Facial & Skin",
      name: "Hydra-Luxe Radiance Facial Treatment",
      duration: "75 mins",
      price: 3600,
      description: "Hydro-dermabrasion deep pore suction, botanical antioxidant infusion and LED photo-light therapy.",
      badge: "Glow Pick",
    },
    {
      id: 110,
      category: "Facial & Skin",
      name: "Pure 24K Gold Luxury Illuminating Facial",
      duration: "90 mins",
      price: 4800,
      description: "Cellular renewal facial with real 24K gold foil sheets, lymphatic drain massage & peptide serum.",
      badge: "VIP Exclusive",
    },
  ],
  stylists: [
    {
      id: 201,
      name: "Elena Vance",
      role: "Creative Hair Director",
      experience: "8+ yrs exp",
      rating: 4.95,
      reviewsCount: 84,
      image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=400&q=80",
      specialty: "Balayage, Color Correction, Texture Sculpting",
    },
    {
      id: 202,
      name: "Marcus Cole",
      role: "Master Colorist & Barber",
      experience: "6+ yrs exp",
      rating: 4.9,
      reviewsCount: 62,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
      specialty: "Men's Precision Fades, Beard Architecture & Keratin",
    },
    {
      id: 203,
      name: "Priya Nair",
      role: "Senior Esthetician & Spa Therapist",
      experience: "9+ yrs exp",
      rating: 4.98,
      reviewsCount: 110,
      image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
      specialty: "Hydra Facials, Ayurvedic Deep Tissue, Lymphatic Care",
    },
  ],
  amenities: [
    { icon: "📶", title: "High-Speed WiFi", desc: "Fast fiber internet for clients" },
    { icon: "❄️", title: "Climate Controlled", desc: "Central AC with HEPA air filters" },
    { icon: "☕", title: "Complimentary Beverages", desc: "Artisan espresso, herbal teas & infused waters" },
    { icon: "🚗", title: "Valet & Dedicated Parking", desc: "Free reserved valet parking bay" },
    { icon: "💳", title: "Cashless & Contactless Pay", desc: "UPI, Tap to Pay, and major credit cards" },
    { icon: "🧼", title: "Autoclave Sanitization", desc: "100% medical-grade sterilization & single-use kits" },
  ],
  offers: [
    {
      code: "LUXE20",
      title: "Flat 20% OFF Luxury Hair & Spa",
      desc: "Valid on all services and packages above ₹2,000",
      discountRate: 0.20,
      minSpend: 2000,
    },
    {
      code: "FIRSTSPA",
      title: "₹200 Instant Welcome Discount",
      desc: "Flat ₹200 off your first appointment at Aura Luxe",
      discountFixed: 200,
      minSpend: 1000,
    },
  ],
  reviews: [
    {
      id: 301,
      author: "Ananya Menon",
      initial: "A",
      rating: 5,
      date: "3 days ago",
      treatment: "Signature Balayage & Couture Color",
      comment: "Elena is a true magician! The balayage blend is completely seamless and natural. The ambiance is so calming, like a 5-star spa in Bali. Highly recommended!",
    },
    {
      id: 302,
      author: "Rahul Varma",
      initial: "R",
      rating: 5,
      date: "1 week ago",
      treatment: "Master Precision Haircut",
      comment: "Marcus gave the cleanest fade and beard trim I have had in Trivandrum. The scalp wash with hot towel was pure bliss. 10/10 experience.",
    },
    {
      id: 303,
      author: "Sneha Kurian",
      initial: "S",
      rating: 5,
      date: "2 weeks ago",
      treatment: "Hydra-Luxe Radiance Facial Treatment",
      comment: "Priya took her time explaining my skin type and the hydra facial left my skin glowing for days without any redness. Worth every rupee!",
    },
  ],
  openingHours: [
    { day: "Monday", hours: "09:00 AM – 09:00 PM", isToday: false },
    { day: "Tuesday", hours: "09:00 AM – 09:00 PM", isToday: false },
    { day: "Wednesday", hours: "09:00 AM – 09:00 PM", isToday: false },
    { day: "Thursday", hours: "09:00 AM – 09:00 PM", isToday: false },
    { day: "Friday", hours: "09:00 AM – 09:30 PM", isToday: true },
    { day: "Saturday", hours: "08:30 AM – 09:30 PM", isToday: false },
    { day: "Sunday", hours: "09:00 AM – 08:30 PM", isToday: false },
  ],
};

export default function SalonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Salon Details State
  const [salon, setSalon] = useState(DEFAULT_SALON_DATA);
  const [loading, setLoading] = useState(true);

  // Gallery Modal
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Tab State
  const [activeTab, setActiveTab] = useState("services");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("All");

  // Booking & Cart State
  const [selectedServices, setSelectedServices] = useState([
    // Pre-select 1 signature service for rich presentation matching demo
    DEFAULT_SALON_DATA.services[0],
  ]);
  const [selectedStylist, setSelectedStylist] = useState(null); // null means "Any Available Professional"
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("11:30 AM");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Next 7 days generator
  const dateSlots = useMemo(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const isoDate = `${yyyy}-${mm}-${dd}`;

      const matchedOffDay = (salon?.offDays || []).find((od) => od.date === isoDate);

      const dayName = i === 0 ? "TODAY" : d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
      const dateNum = d.getDate().toString().padStart(2, "0");
      const monthStr = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
      list.push({
        id: i,
        isoDate,
        dayName,
        dateNum,
        monthStr,
        isOffDay: !!matchedOffDay,
        offDayReason: matchedOffDay?.reason || "Salon Closed",
        fullDateStr: d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
      });
    }
    return list;
  }, [salon?.offDays]);

  const timeSlots = [
    "09:30 AM",
    "11:00 AM",
    "11:30 AM",
    "01:00 PM",
    "02:30 PM",
    "04:00 PM",
    "05:30 PM",
    "07:00 PM",
    "08:00 PM",
  ];

  // Fetch Salon Data from backend with fallback
  useEffect(() => {
    let isMounted = true;
    async function fetchSalonDetails() {
      setLoading(true);
      try {
        const res = await api.get(`/salons/${id}/`);
        if (res.data && isMounted) {
          const apiData = res.data;
          
          // Parse images
          let parsedImages = [];
          if (Array.isArray(apiData.images) && apiData.images.length > 0) {
            parsedImages = apiData.images.map((img) => resolveImageUrl(img));
          } else if (apiData.cover_image) {
            parsedImages = [resolveImageUrl(apiData.cover_image)];
          }
          if (parsedImages.length === 0) {
            parsedImages = DEFAULT_SALON_DATA.images;
          } else {
            // Fill up with default images if less than 5 to keep mosaic grid complete
            parsedImages = [...parsedImages, ...DEFAULT_SALON_DATA.images.slice(parsedImages.length)];
          }

          // Parse workers
          let stylistList = DEFAULT_SALON_DATA.stylists;
          if (Array.isArray(apiData.workers_list) && apiData.workers_list.length > 0) {
            stylistList = apiData.workers_list.map((w, index) => ({
              id: w.id || index + 201,
              name: w.name || "Specialist",
              role: w.specialization || "Master Stylist",
              experience: w.experience || "4+ yrs exp",
              rating: parseFloat(w.rating) || 4.9,
              reviewsCount: w.reviews_count || 50,
              image: w.profile_photo ? resolveImageUrl(w.profile_photo) : DEFAULT_SALON_DATA.stylists[index % DEFAULT_SALON_DATA.stylists.length].image,
              specialty: w.station ? `Station: ${w.station}` : "Certified Beauty Specialist",
            }));
          }

          // Parse services
          let serviceList = DEFAULT_SALON_DATA.services;
          if (Array.isArray(apiData.services_list) && apiData.services_list.length > 0) {
            serviceList = apiData.services_list.map((s, index) => ({
              id: s.id || index + 101,
              category: s.category || "Hair",
              name: s.name,
              duration: s.duration ? `${s.duration} mins` : "45 mins",
              price: parseFloat(s.price) || 999,
              description: s.description || "Signature premium treatment tailored to your lifestyle.",
              badge: index === 0 ? "Popular" : null,
            }));
          }

          const currentDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
          let dynamicOpeningHours = DEFAULT_SALON_DATA.openingHours;
          let dynamicStatus = "Open until 9:00 PM";

          let rawDays = null;
          if (apiData.opening_hours) {
            if (typeof apiData.opening_hours === "string") {
              try {
                const parsed = JSON.parse(apiData.opening_hours);
                rawDays = parsed.days || (Array.isArray(parsed) ? parsed : null);
              } catch {
                rawDays = null;
              }
            } else if (apiData.opening_hours.days && Array.isArray(apiData.opening_hours.days)) {
              rawDays = apiData.opening_hours.days;
            } else if (Array.isArray(apiData.opening_hours)) {
              rawDays = apiData.opening_hours;
            }
          }

          if (rawDays && rawDays.length > 0) {
            dynamicOpeningHours = rawDays.map((d) => {
              const isToday = d.day && d.day.toLowerCase() === currentDayName.toLowerCase();
              const isClosed = !d.isOpen || d.isOpen === "false" || d.isOpen === false;
              const openFmt = formatTime12(d.openTime || "09:00");
              const closeFmt = formatTime12(d.closeTime || "21:00");
              const hours = isClosed ? "Holiday / Closed" : `${openFmt} – ${closeFmt}`;
              if (isToday) {
                dynamicStatus = isClosed ? "Closed today (Holiday / Off)" : `Open until ${closeFmt}`;
              }
              return {
                day: d.day,
                hours,
                isToday,
                isOpen: !isClosed,
              };
            });
          }

          setSalon({
            id: apiData.id || id,
            name: apiData.name || DEFAULT_SALON_DATA.name,
            tagline: apiData.tagline || DEFAULT_SALON_DATA.tagline,
            rating: 4.9,
            reviewsCount: 124,
            priceTier: "₹₹₹ Luxury",
            status: dynamicStatus,
            address: apiData.address || DEFAULT_SALON_DATA.address,
            city: apiData.city || DEFAULT_SALON_DATA.city,
            state: apiData.state || DEFAULT_SALON_DATA.state,
            pincode: apiData.pincode || DEFAULT_SALON_DATA.pincode,
            landmark: apiData.landmark || DEFAULT_SALON_DATA.landmark,
            phone: apiData.phone || DEFAULT_SALON_DATA.phone,
            email: apiData.email || DEFAULT_SALON_DATA.email,
            isVerified: true,
            images: parsedImages,
            services: serviceList,
            stylists: stylistList,
            amenities: DEFAULT_SALON_DATA.amenities,
            offers: DEFAULT_SALON_DATA.offers,
            reviews: DEFAULT_SALON_DATA.reviews,
            openingHours: dynamicOpeningHours,
            offDays: Array.isArray(apiData.off_days) ? apiData.off_days : [],
          });

          // Set first service as pre-selected if available
          if (serviceList.length > 0) {
            setSelectedServices([serviceList[0]]);
          }
        }
      } catch (err) {
        // Fallback to default mock salon data seamlessly
        setSalon({
          ...DEFAULT_SALON_DATA,
          id: id || 1,
        });
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSalonDetails();
    return () => {
      isMounted = false;
    };
  }, [id]);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2800);
  };

  // Cart / Service Toggle
  const handleToggleService = (service) => {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      if (exists) {
        showToast(`Removed "${service.name}" from booking.`);
        return prev.filter((s) => s.id !== service.id);
      } else {
        showToast(`Added "${service.name}" to booking!`);
        return [...prev, service];
      }
    });
  };

  // Bill calculations
  const billSummary = useMemo(() => {
    const subtotal = selectedServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const taxRate = 0.05; // 5% GST
    const taxes = Math.round(subtotal * taxRate);
    
    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.discountRate) {
        discount = Math.round(subtotal * appliedCoupon.discountRate);
      } else if (appliedCoupon.discountFixed) {
        discount = Math.min(subtotal, appliedCoupon.discountFixed);
      }
    }

    const total = Math.max(0, subtotal + taxes - discount);

    return {
      subtotal,
      taxes,
      discount,
      total,
    };
  }, [selectedServices, appliedCoupon]);

  // Apply Coupon
  const handleApplyCoupon = (coupon) => {
    if (billSummary.subtotal < coupon.minSpend) {
      showToast(`Add items worth ₹${coupon.minSpend} to apply ${coupon.code}`);
      return;
    }
    setAppliedCoupon(coupon);
    showToast(`Coupon ${coupon.code} applied successfully! 🎉`);
  };

  // Share link handler
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast("Salon link copied to clipboard! 📋");
    } else {
      showToast("Share URL: " + window.location.href);
    }
  };

  // Save / Favorite handler
  const handleSaveToggle = () => {
    setIsSaved(!isSaved);
    showToast(!isSaved ? "Saved to your favorite salons! ❤️" : "Removed from favorites.");
  };

  // Service categories available
  const availableCategories = useMemo(() => {
    const cats = new Set(salon.services.map((s) => s.category || "General"));
    return ["All", ...Array.from(cats)];
  }, [salon.services]);

  const filteredServices = useMemo(() => {
    if (selectedServiceCategory === "All") return salon.services;
    return salon.services.filter((s) => (s.category || "General") === selectedServiceCategory);
  }, [salon.services, selectedServiceCategory]);

  // Scroll to section helper
  const handleTabClick = (tabKey, elementId) => {
    setActiveTab(tabKey);
    const el = document.getElementById(elementId);
    if (el) {
      const yOffset = -120;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <div className="salon-detail-page">
      <CustomerHeader />

      {/* Floating Notification Toast */}
      {toastMessage && (
        <div className="salon-detail-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Breadcrumb & Share Actions */}
      <section className="salon-detail-topbar">
        <div className="salon-detail-container topbar-flex">
          <nav className="detail-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/customer-home">Home</Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/salons">Salons</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-active">{salon.name}</span>
          </nav>

          <div className="detail-top-actions">
            <button className="top-action-btn" onClick={handleShare} title="Share Salon">
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              <span>Share</span>
            </button>

            <button
              className={`top-action-btn ${isSaved ? "saved-active" : ""}`}
              onClick={handleSaveToggle}
              title="Save Salon"
            >
              <svg width="18" height="18" fill={isSaved ? "#e63946" : "none"} viewBox="0 0 24 24" stroke={isSaved ? "#e63946" : "currentColor"}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{isSaved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Hero Photo Gallery Mosaic */}
      <section className="salon-gallery-section">
        <div className="salon-detail-container">
          <div className="salon-gallery-mosaic">
            {/* Left Big Hero Image */}
            <div
              className="gallery-hero-main"
              onClick={() => {
                setActivePhotoIdx(0);
                setIsGalleryOpen(true);
              }}
            >
              <img src={salon.images[0]} alt={`${salon.name} Main View`} />
              <div className="gallery-badge-featured">
                <span>✦ Featured Luxury Partner</span>
              </div>
              <button
                type="button"
                className="gallery-view-all-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGalleryOpen(true);
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>View All Photos ({salon.images.length})</span>
              </button>
            </div>

            {/* Right 4 Thumbnail Grid */}
            <div className="gallery-thumbnails-grid">
              {salon.images.slice(1, 5).map((imgUrl, idx) => {
                const isLastThumb = idx === 3;
                return (
                  <div
                    key={idx}
                    className={`gallery-thumb-item ${isLastThumb ? "has-overlay" : ""}`}
                    onClick={() => {
                      setActivePhotoIdx(idx + 1);
                      setIsGalleryOpen(true);
                    }}
                  >
                    <img src={imgUrl} alt={`${salon.name} view ${idx + 2}`} />
                    {isLastThumb && (
                      <div className="gallery-more-overlay">
                        <span>+{salon.images.length - 4} More</span>
                        <small>Photos</small>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Salon Headline & Summary Banner */}
      <section className="salon-headline-section">
        <div className="salon-detail-container">
          <div className="headline-content">
            <div className="headline-title-row">
              <h1 className="salon-detail-title">{salon.name}</h1>
              {salon.isVerified && (
                <span className="verified-partner-badge" title="BookMySalon Certified & Hygienic Partner">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Verified Partner
                </span>
              )}
            </div>

            <p className="salon-tagline">{salon.tagline}</p>

            <div className="headline-meta-row">
              <div className="meta-pill rating-pill">
                <span className="star-icon">★</span>
                <span className="score-val">{salon.rating}</span>
                <span className="review-count">({salon.reviewsCount} reviews)</span>
              </div>

              <div className={`meta-pill status-pill ${salon.status?.toLowerCase().includes("closed") ? "status-closed" : ""}`} style={salon.status?.toLowerCase().includes("closed") ? { borderColor: "#fca5a5", background: "#fef2f2" } : {}}>
                <span className="status-dot" style={salon.status?.toLowerCase().includes("closed") ? { background: "#ef4444", boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.2)" } : {}}></span>
                <span style={salon.status?.toLowerCase().includes("closed") ? { color: "#dc2626", fontWeight: "600" } : {}}>{salon.status}</span>
              </div>

              <div className="meta-pill price-pill">
                <span>{salon.priceTier}</span>
              </div>

              <div className="meta-pill location-pill">
                <span>📍 {salon.landmark ? `${salon.landmark}, ` : ""}{salon.address}, {salon.city}</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${salon.name} ${salon.address} ${salon.city}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="directions-link"
                >
                  Get Directions ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Quick-Jump Navigation Bar */}
      <nav className="detail-subnav-sticky" aria-label="Salon Sections">
        <div className="salon-detail-container subnav-inner">
          <button
            className={`subnav-tab ${activeTab === "services" ? "active" : ""}`}
            onClick={() => handleTabClick("services", "services-section")}
          >
            Services ({salon.services.length})
          </button>
          <button
            className={`subnav-tab ${activeTab === "stylists" ? "active" : ""}`}
            onClick={() => handleTabClick("stylists", "stylists-section")}
          >
            Stylists & Team ({salon.stylists.length})
          </button>
          <button
            className={`subnav-tab ${activeTab === "amenities" ? "active" : ""}`}
            onClick={() => handleTabClick("amenities", "amenities-section")}
          >
            Amenities
          </button>
          <button
            className={`subnav-tab ${activeTab === "offers" ? "active" : ""}`}
            onClick={() => handleTabClick("offers", "offers-section")}
          >
            Exclusive Offers
          </button>
          <button
            className={`subnav-tab ${activeTab === "reviews" ? "active" : ""}`}
            onClick={() => handleTabClick("reviews", "reviews-section")}
          >
            Reviews ({salon.reviewsCount})
          </button>
          <button
            className={`subnav-tab ${activeTab === "location" ? "active" : ""}`}
            onClick={() => handleTabClick("location", "location-section")}
          >
            Location & Hours
          </button>
        </div>
      </nav>

      {/* Main 2-Column Content Area */}
      <main className="salon-detail-body">
        <div className="salon-detail-container main-grid-layout">
          
          {/* LEFT COLUMN: Services, Team, Amenities, Offers, Reviews */}
          <div className="detail-main-col">

            {/* 1. Services Section */}
            <section id="services-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Signature Services & Treatments</h2>
                  <p className="section-subtitle">
                    Select one or more services to curate your personalized appointment.
                  </p>
                </div>
              </div>

              {/* Service Categories Filter Pills */}
              <div className="service-category-pills">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    className={`category-pill-btn ${selectedServiceCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedServiceCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Services List */}
              <div className="services-card-list">
                {filteredServices.map((service) => {
                  const isAdded = selectedServices.some((s) => s.id === service.id);
                  return (
                    <article key={service.id} className={`service-item-card ${isAdded ? "item-selected" : ""}`}>
                      <div className="service-item-main">
                        <div className="service-item-top">
                          <h3 className="service-name">{service.name}</h3>
                          {service.badge && <span className="service-badge-pill">{service.badge}</span>}
                        </div>
                        <p className="service-description">{service.description}</p>
                        <div className="service-specs-row">
                          <span className="spec-item">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {service.duration}
                          </span>
                          <span className="spec-dot">•</span>
                          <span className="service-category-tag">{service.category}</span>
                        </div>
                      </div>

                      <div className="service-item-action-col">
                        <div className="service-price-block">
                          <span className="currency-symbol">₹</span>
                          <span className="price-number">{service.price.toLocaleString("en-IN")}</span>
                        </div>

                        <button
                          type="button"
                          className={`service-add-btn ${isAdded ? "added-state" : ""}`}
                          onClick={() => handleToggleService(service)}
                        >
                          {isAdded ? (
                            <>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                              </svg>
                              Added
                            </>
                          ) : (
                            <>
                              <span>+</span> Add
                            </>
                          )}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* 2. Stylists & Specialists Section */}
            <section id="stylists-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Master Stylists & Specialists</h2>
                  <p className="section-subtitle">
                    Opt for your preferred artist or let us assign the top specialist on duty.
                  </p>
                </div>
              </div>

              <div className="stylists-grid">
                {salon.stylists.map((stylist) => {
                  const isSelected = selectedStylist?.id === stylist.id;
                  return (
                    <div key={stylist.id} className={`stylist-card ${isSelected ? "stylist-selected" : ""}`}>
                      <div className="stylist-avatar-wrap">
                        <img src={stylist.image} alt={stylist.name} />
                        <div className="stylist-rating-badge">★ {stylist.rating}</div>
                      </div>

                      <div className="stylist-info">
                        <h4 className="stylist-name">{stylist.name}</h4>
                        <p className="stylist-role">{stylist.role}</p>
                        <p className="stylist-exp">{stylist.experience} • {stylist.reviewsCount} reviews</p>
                        <p className="stylist-specialty">{stylist.specialty}</p>

                        <button
                          type="button"
                          className={`stylist-select-btn ${isSelected ? "selected-btn" : ""}`}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedStylist(null);
                              showToast("Set stylist to: Any Available Specialist.");
                            } else {
                              setSelectedStylist(stylist);
                              showToast(`Selected stylist: ${stylist.name}!`);
                            }
                          }}
                        >
                          {isSelected ? "✓ Stylist Selected" : "Select Stylist"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 3. Amenities & Facilities Section */}
            <section id="amenities-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Facilities & Guest Amenities</h2>
                  <p className="section-subtitle">
                    Designed for your comfort, wellness, and utmost peace of mind.
                  </p>
                </div>
              </div>

              <div className="amenities-grid">
                {salon.amenities.map((item, idx) => (
                  <div key={idx} className="amenity-item-card">
                    <span className="amenity-icon">{item.icon}</span>
                    <div className="amenity-texts">
                      <h4 className="amenity-title">{item.title}</h4>
                      <p className="amenity-desc">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* 4. Exclusive Offers Section */}
            <section id="offers-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Exclusive Salon Offers & Coupons</h2>
                  <p className="section-subtitle">
                    Apply promo codes directly to receive instant checkout savings.
                  </p>
                </div>
              </div>

              <div className="offers-cards-grid">
                {salon.offers.map((offer) => {
                  const isCurrentApplied = appliedCoupon?.code === offer.code;
                  return (
                    <div key={offer.code} className={`coupon-card ${isCurrentApplied ? "coupon-applied" : ""}`}>
                      <div className="coupon-left">
                        <div className="coupon-badge">CODE: {offer.code}</div>
                        <h4 className="coupon-title">{offer.title}</h4>
                        <p className="coupon-desc">{offer.desc}</p>
                      </div>
                      <div className="coupon-right">
                        <button
                          type="button"
                          className="coupon-apply-btn"
                          disabled={isCurrentApplied}
                          onClick={() => handleApplyCoupon(offer)}
                        >
                          {isCurrentApplied ? "✓ Applied" : "Apply Code"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 5. Client Reviews & Ratings */}
            <section id="reviews-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Client Reviews & Experiences</h2>
                  <p className="section-subtitle">
                    Real, verified feedback from customers who visited this location.
                  </p>
                </div>
              </div>

              {/* Overall Ratings Summary Card */}
              <div className="rating-overview-card">
                <div className="overview-score-box">
                  <span className="big-score">{salon.rating}</span>
                  <div className="stars-gold">★★★★★</div>
                  <span className="total-reviews-label">Based on {salon.reviewsCount} verified visits</span>
                </div>

                <div className="overview-bars-box">
                  <div className="rating-bar-row">
                    <span>5 Stars</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: "88%" }}></div></div>
                    <span>88%</span>
                  </div>
                  <div className="rating-bar-row">
                    <span>4 Stars</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: "9%" }}></div></div>
                    <span>9%</span>
                  </div>
                  <div className="rating-bar-row">
                    <span>3 Stars</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: "2%" }}></div></div>
                    <span>2%</span>
                  </div>
                  <div className="rating-bar-row">
                    <span>2 Stars</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: "1%" }}></div></div>
                    <span>1%</span>
                  </div>
                  <div className="rating-bar-row">
                    <span>1 Star</span>
                    <div className="progress-track"><div className="progress-fill" style={{ width: "0%" }}></div></div>
                    <span>0%</span>
                  </div>
                </div>
              </div>

              {/* Reviews List */}
              <div className="reviews-list">
                {salon.reviews.map((rev) => (
                  <div key={rev.id} className="review-card">
                    <div className="review-header">
                      <div className="reviewer-info">
                        <div className="reviewer-avatar">{rev.initial}</div>
                        <div>
                          <h4 className="reviewer-name">{rev.author}</h4>
                          <span className="review-treatment-tag">Treatment: {rev.treatment}</span>
                        </div>
                      </div>
                      <div className="review-meta">
                        <div className="review-stars">{"★".repeat(rev.rating)}</div>
                        <span className="review-date">{rev.date}</span>
                      </div>
                    </div>
                    <p className="review-comment">“{rev.comment}”</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 6. Location & Working Hours */}
            <section id="location-section" className="content-card-section">
              <div className="section-header-row">
                <div>
                  <h2 className="section-title">Location & Operating Hours</h2>
                  <p className="section-subtitle">
                    Easily accessible with valet parking in the heart of Kowdiar.
                  </p>
                </div>
              </div>

              <div className="location-details-grid">
                <div className="hours-card">
                  <h4 className="card-subheading">Operating Hours</h4>
                  <ul className="hours-list">
                    {salon.openingHours.map((slot) => (
                      <li key={slot.day} className={`hours-item ${slot.isToday ? "today-highlight" : ""}`}>
                        <span className="day-name">{slot.day} {slot.isToday && <span className="today-pill">Today</span>}</span>
                        <span className="hours-val" style={slot.isOpen === false || slot.hours?.includes("Holiday") ? { color: "#dc2626", fontWeight: "600" } : {}}>{slot.hours}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="address-contact-card">
                  <h4 className="card-subheading">Contact & Address</h4>
                  <div className="address-block">
                    <p className="salon-full-address">
                      <strong>{salon.name}</strong><br />
                      {salon.landmark && <>{salon.landmark}<br /></>}
                      {salon.address}, {salon.city}, {salon.state} – {salon.pincode}
                    </p>
                    <div className="contact-methods">
                      <p>📞 Phone: <a href={`tel:${salon.phone}`}>{salon.phone}</a></p>
                      <p>✉️ Email: <a href={`mailto:${salon.email}`}>{salon.email}</a></p>
                    </div>

                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(`${salon.name} ${salon.address} ${salon.city}`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="open-maps-btn"
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Open in Google Maps
                    </a>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* RIGHT STICKY COLUMN: Appointment Booking Drawer */}
          <aside className="detail-sidebar-col">
            <div className="sticky-booking-card">
              <div className="booking-card-header">
                <h3 className="booking-card-title">Book Your Appointment</h3>
                <span className="booking-instant-badge">Instant Confirmation</span>
              </div>

              {/* 1. Date Selector */}
              <div className="booking-step-block">
                <label className="step-label">Select Date</label>
                <div className="date-pills-scroller">
                  {dateSlots.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`date-pill ${selectedDateIdx === d.id ? "date-active" : ""} ${d.isOffDay ? "date-offday" : ""}`}
                      onClick={() => setSelectedDateIdx(d.id)}
                    >
                      <span className="date-dayname">{d.dayName}</span>
                      <span className="date-number">{d.dateNum}</span>
                      <span className="date-month">{d.monthStr}</span>
                      {d.isOffDay && (
                        <span style={{ fontSize: "9px", background: "#fef2f2", color: "#dc2626", borderRadius: "4px", padding: "1px 4px", marginTop: "2px", fontWeight: "700" }}>
                          CLOSED
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Time Slot Picker */}
              <div className="booking-step-block">
                <div className="step-label-row">
                  <label className="step-label">Available Time Slots</label>
                  <span className="time-tz-note">IST (Local Time)</span>
                </div>
                {dateSlots[selectedDateIdx]?.isOffDay ? (
                  <div style={{
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: "8px",
                    padding: "16px",
                    textAlign: "center",
                    color: "#991b1b"
                  }}>
                    <div style={{ fontWeight: "700", marginBottom: "4px", fontSize: "0.95rem" }}>
                      🔒 Salon Closed on this Date
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#b91c1c" }}>
                      {dateSlots[selectedDateIdx]?.offDayReason || "Scheduled Salon Off-Day"}. Please select another date to view available time slots.
                    </div>
                  </div>
                ) : (
                  <div className="time-slots-grid">
                    {timeSlots.map((time) => (
                      <button
                        key={time}
                        type="button"
                        className={`time-slot-btn ${selectedTimeSlot === time ? "time-active" : ""}`}
                        onClick={() => setSelectedTimeSlot(time)}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Stylist Info */}
              <div className="booking-step-block">
                <label className="step-label">Assigned Specialist</label>
                <div className="selected-stylist-banner">
                  {selectedStylist ? (
                    <div className="stylist-assigned-row">
                      <img src={selectedStylist.image} alt={selectedStylist.name} className="assigned-avatar" />
                      <div className="assigned-text">
                        <span className="assigned-name">{selectedStylist.name}</span>
                        <span className="assigned-role">{selectedStylist.role}</span>
                      </div>
                      <button
                        type="button"
                        className="change-stylist-link"
                        onClick={() => setSelectedStylist(null)}
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="stylist-assigned-row">
                      <div className="assigned-avatar-placeholder">✂</div>
                      <div className="assigned-text">
                        <span className="assigned-name">Any Available Professional</span>
                        <span className="assigned-role">First available master stylist</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Selected Treatments */}
              <div className="booking-step-block">
                <div className="step-label-row">
                  <label className="step-label">Selected Treatments ({selectedServices.length})</label>
                  {selectedServices.length > 0 && (
                    <button
                      type="button"
                      className="clear-all-link"
                      onClick={() => setSelectedServices([])}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {selectedServices.length === 0 ? (
                  <div className="empty-services-prompt">
                    <p>No services selected yet.</p>
                    <small>Pick treatments from the menu on the left to schedule.</small>
                  </div>
                ) : (
                  <div className="selected-services-list">
                    {selectedServices.map((item) => (
                      <div key={item.id} className="selected-service-row">
                        <div className="selected-service-info">
                          <span className="selected-srv-name">{item.name}</span>
                          <span className="selected-srv-dur">{item.duration}</span>
                        </div>
                        <div className="selected-service-price-wrap">
                          <span className="selected-srv-price">₹{item.price.toLocaleString("en-IN")}</span>
                          <button
                            type="button"
                            className="remove-srv-btn"
                            title="Remove"
                            onClick={() => handleToggleService(item)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 5. Pricing Breakdown */}
              <div className="bill-breakdown-card">
                <div className="bill-row">
                  <span>Item Subtotal</span>
                  <span>₹{billSummary.subtotal.toLocaleString("en-IN")}</span>
                </div>
                <div className="bill-row">
                  <span>GST & Hygiene Safety (5%)</span>
                  <span>₹{billSummary.taxes.toLocaleString("en-IN")}</span>
                </div>

                {appliedCoupon && (
                  <div className="bill-row discount-row">
                    <span>Discount ({appliedCoupon.code})</span>
                    <span>-₹{billSummary.discount.toLocaleString("en-IN")}</span>
                  </div>
                )}

                <div className="bill-divider"></div>

                <div className="bill-row total-row">
                  <span>Total Amount</span>
                  <span className="total-price-tag">₹{billSummary.total.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* 6. Primary Action CTA */}
              <button
                type="button"
                className="proceed-booking-cta"
                disabled={selectedServices.length === 0 || dateSlots[selectedDateIdx]?.isOffDay}
                onClick={() => setShowBookingModal(true)}
              >
                <span>
                  {dateSlots[selectedDateIdx]?.isOffDay
                    ? "Salon Closed on Selected Date"
                    : "Proceed to Booking"}
                </span>
                {!dateSlots[selectedDateIdx]?.isOffDay && <span className="cta-arrow">→</span>}
              </button>

              <div className="cancellation-policy-box">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Free cancellation up to 2 hours before appointment time</span>
              </div>
            </div>
          </aside>

        </div>
      </main>

      {/* MODAL 1: Photo Lightbox Gallery */}
      {isGalleryOpen && (
        <div className="gallery-modal-backdrop" onClick={() => setIsGalleryOpen(false)}>
          <div className="gallery-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-modal-header">
              <h3>{salon.name} • Photo Gallery ({activePhotoIdx + 1}/{salon.images.length})</h3>
              <button className="gallery-close-btn" onClick={() => setIsGalleryOpen(false)}>✕</button>
            </div>

            <div className="gallery-modal-display">
              <button
                className="gallery-nav-arrow arrow-left"
                onClick={() => setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : salon.images.length - 1))}
              >
                ‹
              </button>
              <img src={salon.images[activePhotoIdx]} alt={`${salon.name} high res`} />
              <button
                className="gallery-nav-arrow arrow-right"
                onClick={() => setActivePhotoIdx((prev) => (prev < salon.images.length - 1 ? prev + 1 : 0))}
              >
                ›
              </button>
            </div>

            <div className="gallery-thumb-strip">
              {salon.images.map((img, idx) => (
                <div
                  key={idx}
                  className={`thumb-strip-item ${activePhotoIdx === idx ? "active-strip" : ""}`}
                  onClick={() => setActivePhotoIdx(idx)}
                >
                  <img src={img} alt={`Thumb ${idx}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Appointment Confirmation Modal */}
      {showBookingModal && (
        <div className="booking-modal-backdrop" onClick={() => !bookingSuccess && setShowBookingModal(false)}>
          <div className="booking-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {!bookingSuccess ? (
              <>
                <div className="booking-modal-header">
                  <div className="modal-title-wrap">
                    <h3>Confirm Your Appointment</h3>
                    <p>{salon.name} • {salon.city}</p>
                  </div>
                  <button className="modal-close-btn" onClick={() => setShowBookingModal(false)}>✕</button>
                </div>

                <div className="booking-modal-body">
                  <div className="booking-summary-recap">
                    <div className="recap-item">
                      <span className="recap-label">📅 Date & Time</span>
                      <strong className="recap-val">{dateSlots[selectedDateIdx]?.fullDateStr} at {selectedTimeSlot}</strong>
                    </div>

                    <div className="recap-item">
                      <span className="recap-label">👤 Assigned Stylist</span>
                      <strong className="recap-val">{selectedStylist ? selectedStylist.name : "Any Available Specialist"}</strong>
                    </div>

                    <div className="recap-item">
                      <span className="recap-label">✂ Selected Services</span>
                      <div className="recap-services-list">
                        {selectedServices.map((s) => (
                          <div key={s.id} className="recap-srv-row">
                            <span>{s.name} ({s.duration})</span>
                            <span>₹{s.price.toLocaleString("en-IN")}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="recap-bill-box">
                      <div className="recap-bill-row">
                        <span>Total Payable</span>
                        <strong className="recap-total">₹{billSummary.total.toLocaleString("en-IN")}</strong>
                      </div>
                      <small>Payment can be made online or directly at the salon counter.</small>
                    </div>
                  </div>
                </div>

                <div className="booking-modal-footer">
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setShowBookingModal(false)}
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    className="modal-confirm-btn"
                    onClick={() => {
                      setBookingSuccess(true);
                    }}
                  >
                    Confirm & Reserve Slot
                  </button>
                </div>
              </>
            ) : (
              <div className="booking-success-box">
                <div className="success-checkmark-circle">✓</div>
                <h3>Appointment Confirmed!</h3>
                <p>
                  Your reservation at <strong>{salon.name}</strong> for{" "}
                  <strong>{dateSlots[selectedDateIdx]?.fullDateStr} at {selectedTimeSlot}</strong> has been successfully booked.
                </p>
                <div className="success-booking-ref">
                  Booking Reference: <strong>BMS-{Math.floor(100000 + Math.random() * 900000)}</strong>
                </div>
                <div className="success-modal-actions">
                  <button
                    type="button"
                    className="success-home-btn"
                    onClick={() => {
                      setShowBookingModal(false);
                      setBookingSuccess(false);
                      navigate("/customer-home");
                    }}
                  >
                    Go to Home
                  </button>
                  <button
                    type="button"
                    className="success-salons-btn"
                    onClick={() => {
                      setShowBookingModal(false);
                      setBookingSuccess(false);
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CustomerFooter />
    </div>
  );
}

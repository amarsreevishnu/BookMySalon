import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import api from "../../api/axios";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/salonDetail.css";


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

const AMENITY_ICON_MAP = {
  wifi: { icon: "📶", title: "High-Speed Wi-Fi", desc: "Fast fiber internet for clients" },
  ac: { icon: "❄️", title: "Air Conditioned", desc: "Climate controlled cooling" },
  "air conditioned": { icon: "❄️", title: "Air Conditioned", desc: "Climate controlled cooling" },
  valet: { icon: "🚗", title: "Valet & Dedicated Parking", desc: "Free reserved valet parking bay" },
  parking: { icon: "🚗", title: "Dedicated Parking", desc: "Convenient vehicle parking" },
};

function parseSalonAmenities(rawAmenities) {
  if (!Array.isArray(rawAmenities) || rawAmenities.length === 0) {
    return [];
  }

  return rawAmenities.map((item) => {
    if (typeof item === "object" && item !== null && item.title) {
      return item;
    }
    const str = String(item).trim();
    const lower = str.toLowerCase();
    for (const [key, val] of Object.entries(AMENITY_ICON_MAP)) {
      if (lower === key || lower.includes(key)) {
        return val;
      }
    }
    return {
      icon: "✨",
      title: str,
      desc: "",
    };
  });
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function buildSalonOpeningHours(openingHoursData) {
  const currentDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  let rawDays = [];
  if (openingHoursData) {
    if (typeof openingHoursData === "string") {
      try {
        const parsed = JSON.parse(openingHoursData);
        rawDays = parsed.days || (Array.isArray(parsed) ? parsed : []);
      } catch {
        rawDays = [];
      }
    } else if (Array.isArray(openingHoursData.days)) {
      rawDays = openingHoursData.days;
    } else if (Array.isArray(openingHoursData)) {
      rawDays = openingHoursData;
    }
  }

  if (!rawDays || rawDays.length === 0) {
    return { openingHours: [], status: "Hours not specified" };
  }

  const list = WEEKDAYS.map((day) => {
    const matched = rawDays.find((d) => d.day && d.day.toLowerCase() === day.toLowerCase());
    const isToday = day.toLowerCase() === currentDayName.toLowerCase();

    if (!matched) {
      return {
        day,
        hours: "Closed",
        isToday,
        isOpen: false,
        closeFmt: "",
      };
    }

    const isClosed = matched.isOpen === false || matched.isOpen === "false";
    const openRaw = matched.openTime || "09:00";
    const closeRaw = matched.closeTime || "21:00";
    const openFmt = formatTime12(openRaw);
    const closeFmt = formatTime12(closeRaw);
    const hours = isClosed ? "Holiday / Closed" : `${openFmt} – ${closeFmt}`;

    return {
      day,
      hours,
      isToday,
      isOpen: !isClosed,
      closeFmt,
      openFmt,
      openRaw,
      closeRaw,
    };
  });

  const todayObj = list.find((d) => d.isToday);
  let dynamicStatus = "Open today";
  if (todayObj) {
    if (!todayObj.isOpen) {
      dynamicStatus = "Closed today (Holiday / Off)";
    } else {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [openH, openM] = (todayObj.openRaw || "09:00").split(":").map(Number);
      const [closeH, closeM] = (todayObj.closeRaw || "21:00").split(":").map(Number);
      const openMinutes = (openH || 9) * 60 + (openM || 0);
      const closeMinutes = (closeH || 21) * 60 + (closeM || 0);

      if (currentMinutes < openMinutes) {
        dynamicStatus = `Closed now (Opens at ${todayObj.openFmt})`;
      } else if (currentMinutes >= closeMinutes) {
        dynamicStatus = `Closed for today (Closed at ${todayObj.closeFmt})`;
      } else {
        dynamicStatus = `Open until ${todayObj.closeFmt}`;
      }
    }
  }

  return { openingHours: list, status: dynamicStatus };
}

export default function SalonDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Salon Details State
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Gallery Modal
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Tab State
  const [activeTab, setActiveTab] = useState("services");
  const [selectedServiceCategory, setSelectedServiceCategory] = useState("All");

  // Interactive UI Filters
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [reviewFilterRating, setReviewFilterRating] = useState(0); // 0 = all
  const [slotTimeFilter, setSlotTimeFilter] = useState("all"); // "all", "morning", "afternoon", "evening"

  // Booking & Cart State
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState("auto"); 
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [selectedSlotObj, setSelectedSlotObj] = useState(null);
  const [slotWorkerUnavailableReason, setSlotWorkerUnavailableReason] = useState(null);
  const [bookingError, setBookingError] = useState("");

  // Collapsible Sections State (Services, Stylists, Amenities, Offers, Reviews, Location, Booking)
  const [openSections, setOpenSections] = useState({
    services: true,
    stylists: true,
    amenities: true,
    offers: true,
    reviews: true,
    location: true,
    booking: true,
  });

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Step-by-step collapse inside Book Appointment card
  const [openBookingSteps, setOpenBookingSteps] = useState({
    service: true,
    date: true,
    stylist: true,
    slots: true,
  });

  const toggleBookingStep = (stepKey) => {
    setOpenBookingSteps((prev) => ({
      ...prev,
      [stepKey]: !prev[stepKey],
    }));
  };

  const scrollToBooking = (stepKey = null) => {
    if (!openSections.booking) {
      setOpenSections((prev) => ({ ...prev, booking: true }));
    }
    if (stepKey) {
      setOpenBookingSteps((prev) => ({ ...prev, [stepKey]: true }));
    }
    setTimeout(() => {
      const el = document.getElementById("booking-card-anchor");
      if (el) {
        const yOffset = -80;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 50);
  };

  // Keyboard navigation for photo lightbox gallery
  useEffect(() => {
    if (!isGalleryOpen) return;
    const numImages = salon?.images?.length || 0;
    if (numImages === 0) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsGalleryOpen(false);
      if (e.key === "ArrowLeft") {
        setActivePhotoIdx((prev) => (prev > 0 ? prev - 1 : numImages - 1));
      }
      if (e.key === "ArrowRight") {
        setActivePhotoIdx((prev) => (prev < numImages - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGalleryOpen, salon?.images?.length]);

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

  const [dynamicSlots, setDynamicSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotClosedReason, setSlotClosedReason] = useState(null);

  // Eligible workers who perform the selected service + their advance bookings
  const [eligibleWorkers, setEligibleWorkers] = useState([]);
  const [eligibleWorkersLoading, setEligibleWorkersLoading] = useState(false);

  const activeDateObj = dateSlots[selectedDateIdx] || null;

  // 1. Fetch workers that perform the selected services & check their schedule / availability on the chosen date
  useEffect(() => {
    let isMounted = true;

    if (!salon?.id || selectedServices.length === 0 || !activeDateObj || loading) {
      setEligibleWorkers([]);
      return;
    }

    async function loadEligibleWorkers() {
      setEligibleWorkersLoading(true);
      try {
        const params = {
          service_id: selectedServices[0]?.id,
          service_ids: selectedServices.map((s) => s.id).join(","),
          date: activeDateObj.isoDate,
        };

        const res = await api.get(`/bookings/salons/${salon.id}/workers/`, { params });
        if (isMounted) {
          const rawWorkers = res.data?.workers || [];
          const formatted = rawWorkers.map((w, index) => ({
            id: w.id,
            name: w.name,
            role: w.specialization || "Stylist",
            experience: w.experience || "",
            rating: typeof w.rating === "number" ? w.rating : (parseFloat(w.rating) || 5.0),
            reviewsCount: typeof w.reviews_count === "number" ? w.reviews_count : (parseInt(w.reviews_count, 10) || 0),
            image: w.profile_photo
              ? resolveImageUrl(w.profile_photo)
              : `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name || "Stylist")}&background=047857&color=ffffff&size=200`,
            specialty: w.station ? `Station: ${w.station}` : (w.specialization ? `${w.specialization}` : "Salon Specialist"),
            has_advance_bookings: w.has_advance_bookings,
            advance_bookings_count: w.advance_bookings_count,
            advance_bookings: w.advance_bookings || [],
            is_on_leave: w.is_on_leave,
            is_weekly_off: w.is_weekly_off,
            is_fully_booked: w.is_fully_booked,
            available_slots_count: w.available_slots_count,
            is_available: w.is_available,
          }));
          setEligibleWorkers(formatted);

          // If current stylist is a specific worker, verify they are still available on this date & service
          setSelectedStylist((current) => {
            if (!current || current === "auto") return current;
            const match = formatted.find((w) => String(w.id) === String(current.id));
            if (!match || match.is_available === false) {
              return null;
            }
            return match;
          });
        }
      } catch (err) {
        if (isMounted) {
          setEligibleWorkers([]);
        }
      } finally {
        if (isMounted) {
          setEligibleWorkersLoading(false);
        }
      }
    }

    loadEligibleWorkers();

    return () => {
      isMounted = false;
    };
  }, [salon?.id, selectedServices, activeDateObj?.isoDate, loading]);

  // 2. Fetch available slots based on Selected Worker (or Auto-assign) and Total Multi-Service Duration
  useEffect(() => {
    let isMounted = true;

    // Do NOT fetch or show slots until a stylist (or Auto-Assign) is chosen
    if (selectedServices.length === 0 || !activeDateObj || !salon?.id || loading || !selectedStylist) {
      setDynamicSlots([]);
      setSelectedSlotObj(null);
      setSelectedTimeSlot("");
      return;
    }

    if (activeDateObj.isOffDay) {
      setDynamicSlots([]);
      setSelectedSlotObj(null);
      setSelectedTimeSlot("");
      setSlotClosedReason(activeDateObj.offDayReason || "Salon is closed on this date");
      setSlotWorkerUnavailableReason(null);
      return;
    }

    async function loadAvailableSlots() {
      setSlotsLoading(true);
      setSlotClosedReason(null);
      setSlotWorkerUnavailableReason(null);
      try {
        const params = {
          salon_id: salon.id,
          service_id: selectedServices[0]?.id,
          service_ids: selectedServices.map((s) => s.id).join(","),
          date: activeDateObj.isoDate,
        };
        if (selectedStylist && typeof selectedStylist === "object" && selectedStylist.id) {
          params.worker_id = selectedStylist.id;
        }

        const res = await api.get("/bookings/slots/", { params });
        if (isMounted) {
          if (res.data?.closed) {
            setSlotClosedReason(res.data.reason || "Salon is closed on this date");
            setDynamicSlots([]);
            setSelectedSlotObj(null);
            setSelectedTimeSlot("");
          } else if (res.data?.worker_unavailable) {
            setSlotWorkerUnavailableReason(res.data.reason || "Specialist is unavailable on this date");
            setDynamicSlots([]);
            setSelectedSlotObj(null);
            setSelectedTimeSlot("");
          } else {
            const fetchedSlots = res.data?.slots || [];
            setDynamicSlots(fetchedSlots);
            
            // If the user already selected an available slot, preserve it
            setSelectedSlotObj((prevSlot) => {
              const stillValid = fetchedSlots.find(
                (s) => s.available && (s.time === prevSlot?.time || s.time_display === selectedTimeSlot)
              );
              if (stillValid) {
                setSelectedTimeSlot(stillValid.time_display || stillValid.time);
                return stillValid;
              }
              setSelectedTimeSlot("");
              return null;
            });
          }
        }
      } catch (err) {
        if (isMounted) {
          setDynamicSlots([]);
          setSelectedSlotObj(null);
          setSelectedTimeSlot("");
        }
      } finally {
        if (isMounted) {
          setSlotsLoading(false);
        }
      }
    }

    loadAvailableSlots();

    return () => {
      isMounted = false;
    };
  }, [salon?.id, selectedServices, activeDateObj?.isoDate, activeDateObj?.isOffDay, selectedStylist, loading]);

  // Fetch Salon Data from backend 
  const fetchSalonDetails = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    setNotFound(false);

    if (!id || id === "undefined" || id === "null") {
      setNotFound(true);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/salons/${id}/`);
      if (res.data) {
          const apiData = res.data;
          
          // Parse images
          let parsedImages = [];
          if (Array.isArray(apiData.images) && apiData.images.length > 0) {
            parsedImages = apiData.images.map((img) => resolveImageUrl(img)).filter(Boolean);
          }
          if (apiData.cover_image) {
            const cover = resolveImageUrl(apiData.cover_image);
            if (cover && !parsedImages.includes(cover)) {
              parsedImages.unshift(cover);
            }
          }
          if (parsedImages.length === 0) {
            parsedImages = [resolveImageUrl(null)];
          }

          // Parse workers
          let stylistList = [];
          if (Array.isArray(apiData.workers_list) && apiData.workers_list.length > 0) {
            stylistList = apiData.workers_list.map((w, index) => ({
              id: w.id || index + 201,
              name: w.name || "Specialist",
              role: w.specialization || "Stylist",
              experience: w.experience || "",
              rating: typeof w.rating === "number" ? w.rating : (parseFloat(w.rating) || 5.0),
              reviewsCount: typeof w.reviews_count === "number" ? w.reviews_count : (parseInt(w.reviews_count, 10) || 0),
              image: w.profile_photo
                ? resolveImageUrl(w.profile_photo)
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name || "Stylist")}&background=047857&color=ffffff&size=200`,
              specialty: w.station ? `Station: ${w.station}` : (w.specialization ? `${w.specialization}` : "Salon Specialist"),
              approvedLeaves: Array.isArray(w.approved_leaves) ? w.approved_leaves : [],
            }));
          }

          // Parse services (from services_list or services fallback)
          let serviceList = [];
          const incomingServices =
            Array.isArray(apiData.services_list) && apiData.services_list.length > 0
              ? apiData.services_list
              : Array.isArray(apiData.services) && apiData.services.length > 0
              ? apiData.services
              : [];

          if (incomingServices.length > 0) {
            serviceList = incomingServices.map((s, index) => {
              let parsedPrice = s.price;
              if (typeof parsedPrice === "string") {
                parsedPrice = parseFloat(parsedPrice.replace(/[^\d.]/g, "")) || 0;
              } else {
                parsedPrice = parseFloat(parsedPrice) || 0;
              }

              let durStr = "45 mins";
              if (typeof s.duration === "number") {
                durStr = `${s.duration} mins`;
              } else if (typeof s.duration === "string") {
                durStr = s.duration.includes("min") ? s.duration : `${s.duration} mins`;
              }

              return {
                id: s.id || index + 101,
                category: s.category || "General",
                name: s.name || "Salon Service",
                duration: durStr,
                price: parsedPrice || 0,
                description: s.description || "",
                badge: s.badge || null,
              };
            });
          }

          const { openingHours: dynamicOpeningHours, status: dynamicStatus } = buildSalonOpeningHours(apiData.opening_hours);
          const dynamicAmenities = parseSalonAmenities(apiData.amenities);

          const dynamicOffers = Array.isArray(apiData.offers) ? apiData.offers : [];

          
          const dynRating = typeof apiData.rating === "number" ? apiData.rating : (parseFloat(apiData.rating) || 5.0);
          const dynReviewsCount = typeof apiData.reviews_count === "number" ? apiData.reviews_count : (parseInt(apiData.reviews_count, 10) || 0);
          const dynReviews = Array.isArray(apiData.reviews) ? apiData.reviews : [];

          let dynamicPriceTier = "₹₹ Moderate";
          if (serviceList.length > 0) {
            const avgPrice = serviceList.reduce((acc, s) => acc + (Number(s.price) || 0), 0) / serviceList.length;
            if (avgPrice < 400) dynamicPriceTier = "₹ Affordable";
            else if (avgPrice < 1500) dynamicPriceTier = "₹₹ Moderate";
            else dynamicPriceTier = "₹₹₹ Luxury";
          }

          setSalon({
            id: apiData.id || id,
            name: apiData.name || "Exclusive Salon",
            tagline: apiData.tagline || (apiData.category ? `${apiData.category} Studio` : ""),
            rating: dynRating,
            reviewsCount: dynReviewsCount,
            priceTier: dynamicPriceTier,
            status: dynamicStatus,
            address: apiData.address || "",
            city: apiData.city || "",
            state: apiData.state || "",
            pincode: apiData.pincode || "",
            landmark: apiData.landmark || "",
            phone: apiData.phone || "",
            email: apiData.email || "",
            isVerified: apiData.approval_status === "APPROVED",
            images: parsedImages,
            services: serviceList,
            stylists: stylistList,
            amenities: dynamicAmenities,
            offers: dynamicOffers,
            reviews: dynReviews,
            ratingBreakdown: apiData.rating_breakdown || null,
            openingHours: dynamicOpeningHours,
            offDays: Array.isArray(apiData.off_days) ? apiData.off_days : [],
          });

          if (serviceList.length > 0) {
            setSelectedServices([serviceList[0]]);
          }
        }
      } catch (err) {
        console.error("Failed to load salon details for ID:", id, err);
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          setFetchError(
            err.response?.data?.error ||
            err.response?.data?.message ||
            err.message ||
            "Unable to connect to the salon service. Please ensure the backend is running."
          );
        }
        setSalon(null);
      } finally {
        setLoading(false);
      }
    }, [id]);

  useEffect(() => {
    fetchSalonDetails();
  }, [fetchSalonDetails]);

  // Toast Helper
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2800);
  };

  
  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => {
      let mins = 45;
      if (typeof s.duration === "number") {
        mins = s.duration;
      } else if (typeof s.duration === "string") {
        const durStr = s.duration.toLowerCase();
        const hrMatch = durStr.match(/(\d+)\s*(?:hr|hour|hrs|hours)/);
        const minMatch = durStr.match(/(\d+)\s*(?:min|minute|mins|minutes|m\b)/);

        if (hrMatch || minMatch) {
          const hours = hrMatch ? parseInt(hrMatch[1], 10) : 0;
          const minutes = minMatch ? parseInt(minMatch[1], 10) : 0;
          mins = hours * 60 + minutes;
        } else {
          const m = durStr.match(/\d+/);
          if (m) mins = parseInt(m[0], 10);
        }
      }
      return sum + (mins > 0 ? mins : 45);
    }, 0);
  }, [selectedServices]);

  const handleToggleService = (service) => {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === service.id);
      if (exists) {
        if (prev.length <= 1) {
          showToast("At least one service must be selected.");
          return prev;
        }
        showToast(`Removed "${service.name}".`);
        return prev.filter((s) => s.id !== service.id);
      } else {
        showToast(`Added "${service.name}" (${service.duration})!`);
        return [...prev, service];
      }
    });
  };

  const handleRemoveService = (serviceId) => {
    setSelectedServices((prev) => {
      if (prev.length <= 1) {
        showToast("At least one service must be selected.");
        return prev;
      }
      const s = prev.find((x) => x.id === serviceId);
      if (s) showToast(`Removed "${s.name}".`);
      return prev.filter((x) => x.id !== serviceId);
    });
  };

  const formatOfferDiscount = (offer) => {
    const dType = offer.discount_type || offer.discountType;
    const dVal = offer.discount_value || offer.discountValue;
    const maxD = offer.max_discount_amount;
    if (dType === "PERCENTAGE") {
      const cap = maxD ? ` (up to ₹${Number(maxD)})` : "";
      return `${Number(dVal)}% OFF${cap}`;
    }
    if (dType === "FIXED_PRICE") {
      return `Fixed ₹${Number(dVal).toLocaleString("en-IN")}`;
    }
    return `₹${Number(dVal).toLocaleString("en-IN")} OFF`;
  };

  const getOfferTypeMeta = (type) => {
    switch (type) {
      case "COMBO":
        return { label: "Combo Deal", cls: "combo" };
      case "FIRST_BOOKING":
        return { label: "First Booking", cls: "first_booking" };
      case "SERVICE":
        return { label: "Service Special", cls: "service" };
      case "FESTIVAL":
        return { label: "Festival Deal", cls: "festival" };
      default:
        return { label: "Coupon Offer", cls: "coupon" };
    }
  };

  const billSummary = useMemo(() => {
    const subtotal = selectedServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    const taxRate = 0.05; // 5% GST
    const taxes = Math.round(subtotal * taxRate);
    
    let discount = 0;
    if (appliedCoupon) {
      const minSpend = Number(appliedCoupon.minSpend || appliedCoupon.min_spend || 0);
      if (subtotal >= minSpend) {
        const dType = appliedCoupon.discount_type || appliedCoupon.discountType;
        const dVal = Number(appliedCoupon.discount_value ?? appliedCoupon.discountValue ?? 0);
        const maxD = appliedCoupon.max_discount_amount ? Number(appliedCoupon.max_discount_amount) : null;

        if (dType === "FIXED_PRICE" || (appliedCoupon.fixedPrice !== null && appliedCoupon.fixedPrice !== undefined)) {
          const fixedPrice = Number(appliedCoupon.fixedPrice ?? dVal);
          discount = Math.max(0, subtotal - fixedPrice);
        } else if (dType === "PERCENTAGE" || appliedCoupon.discountRate) {
          const rate = appliedCoupon.discountRate ? Number(appliedCoupon.discountRate) : (dVal / 100);
          let calcD = Math.round(subtotal * rate);
          if (maxD && calcD > maxD) calcD = maxD;
          discount = Math.min(subtotal, calcD);
        } else if (dType === "FLAT" || appliedCoupon.discountFixed || appliedCoupon.discount) {
          let calcD = Number(appliedCoupon.discountFixed || appliedCoupon.discount || dVal);
          if (maxD && calcD > maxD) calcD = maxD;
          discount = Math.min(subtotal, calcD);
        }
      }
    }

    const total = Math.max(0, subtotal + taxes - discount);

    return {
      subtotal,
      taxes,
      discount,
      total,
      totalDurationMinutes,
    };
  }, [selectedServices, appliedCoupon, totalDurationMinutes]);

  // Invalidate coupon if subtotal falls below required minSpend
  useEffect(() => {
    if (appliedCoupon) {
      const minSpend = Number(appliedCoupon.minSpend || appliedCoupon.min_spend || 0);
      if (billSummary.subtotal < minSpend) {
        setAppliedCoupon(null);
        showToast(`Coupon ${appliedCoupon.code} removed: minimum spend of ₹${minSpend} required.`);
      }
    }
  }, [billSummary.subtotal, appliedCoupon]);

  const handleApplyCoupon = (coupon) => {
    const minSpend = Number(coupon.minSpend || coupon.min_spend || 0);
    if (billSummary.subtotal < minSpend) {
      showToast(`Add treatments worth ₹${minSpend} to apply ${coupon.code}`);
      return;
    }

    // For combo offers, check if missing combo treatments exist
    const isCombo = coupon.offer_type === "COMBO" || coupon.offerType === "COMBO";
    if (isCombo && coupon.services_detail?.length > 0) {
      const selectedIds = new Set(selectedServices.map((s) => String(s.id)));
      const missing = coupon.services_detail.filter((cs) => !selectedIds.has(String(cs.id)));
      if (missing.length > 0) {
        const toAdd = missing.map((m) => {
          const found = salon.services?.find((s) => String(s.id) === String(m.id));
          return (
            found || {
              id: m.id,
              name: m.name,
              price: Number(m.price) || 0,
              duration: m.duration || 45,
            }
          );
        });
        setSelectedServices((prev) => [...prev, ...toAdd]);
        setAppliedCoupon(coupon);
        showToast(`Added ${missing.length} bundle treatment(s) and applied ${coupon.code}! 🎉`);
        return;
      }
    }

    setAppliedCoupon(coupon);
    showToast(`Coupon ${coupon.code} applied successfully! 🎉`);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    showToast("Coupon removed.");
  };

  // Synchronize favorites state with server or local storage
  useEffect(() => {
    if (!salon?.id) return;
    const token = localStorage.getItem("access_token");
    if (token) {
      api
        .get("/accounts/customer/favorites/")
        .then((res) => {
          const list = res.data?.favorites || [];
          const exists = list.some((f) => String(f.id) === String(salon.id));
          setIsSaved(exists);
        })
        .catch(() => {
          try {
            const stored = JSON.parse(localStorage.getItem("guest_saved_salons") || "[]");
            setIsSaved(stored.includes(salon.id));
          } catch {
            // ignore
          }
        });
    } else {
      try {
        const stored = JSON.parse(localStorage.getItem("guest_saved_salons") || "[]");
        setIsSaved(stored.includes(salon.id));
      } catch {
        // ignore
      }
    }
  }, [salon?.id]);

  const handleShare = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          showToast("Salon link copied to clipboard! 📋");
        })
        .catch(() => {
          showToast("Share URL: " + window.location.href);
        });
    } else {
      showToast("Share URL: " + window.location.href);
    }
  };

  const handleSaveToggle = async () => {
    const token = localStorage.getItem("access_token");
    if (token && salon?.id) {
      try {
        const res = await api.post("/accounts/customer/toggle-favorite/", {
          salon_id: salon.id,
        });
        const isFav = Boolean(res.data?.is_favorite);
        setIsSaved(isFav);
        showToast(isFav ? "Saved to your favorite salons! ❤️" : "Removed from favorites.");
        return;
      } catch (err) {
        console.error("Failed to toggle favorite on backend:", err);
      }
    }

    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      const stored = JSON.parse(localStorage.getItem("guest_saved_salons") || "[]");
      const updated = nextSaved
        ? Array.from(new Set([...stored, salon?.id]))
        : stored.filter((x) => x !== salon?.id);
      localStorage.setItem("guest_saved_salons", JSON.stringify(updated));
    } catch {
      // ignore
    }
    showToast(nextSaved ? "Saved to your favorite salons! ❤️" : "Removed from favorites.");
  };

  
  const availableCategories = useMemo(() => {
    const list = salon?.services || [];
    const cats = new Set(list.map((s) => s.category || "General"));
    return ["All", ...Array.from(cats)];
  }, [salon?.services]);

  const categoryCounts = useMemo(() => {
    const list = salon?.services || [];
    const counts = { All: list.length };
    list.forEach((s) => {
      const cat = s.category || "General";
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [salon?.services]);

  const filteredServices = useMemo(() => {
    const list = salon?.services || [];
    return list.filter((s) => {
      const catMatch =
        selectedServiceCategory === "All" ||
        (s.category || "General") === selectedServiceCategory;
      const q = serviceSearchQuery.trim().toLowerCase();
      const searchMatch =
        !q ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q)) ||
        (s.category && s.category.toLowerCase().includes(q));
      return catMatch && searchMatch;
    });
  }, [salon?.services, selectedServiceCategory, serviceSearchQuery]);

  const slotCounts = useMemo(() => {
    let morning = 0;
    let afternoon = 0;
    let evening = 0;
    dynamicSlots.forEach((s) => {
      const h = parseInt((s.time || "").split(":")[0], 10);
      if (!isNaN(h)) {
        if (h < 12) morning++;
        else if (h < 17) afternoon++;
        else evening++;
      }
    });
    return { all: dynamicSlots.length, morning, afternoon, evening };
  }, [dynamicSlots]);

  const filteredSlots = useMemo(() => {
    if (slotTimeFilter === "all") return dynamicSlots;
    return dynamicSlots.filter((s) => {
      const h = parseInt((s.time || "").split(":")[0], 10);
      if (isNaN(h)) return true;
      if (slotTimeFilter === "morning") return h < 12;
      if (slotTimeFilter === "afternoon") return h >= 12 && h < 17;
      if (slotTimeFilter === "evening") return h >= 17;
      return true;
    });
  }, [dynamicSlots, slotTimeFilter]);

  const filteredReviews = useMemo(() => {
    const list = salon?.reviews || [];
    if (!reviewFilterRating) return list;
    return list.filter((r) => Number(r.rating) === Number(reviewFilterRating));
  }, [salon?.reviews, reviewFilterRating]);

  const bookingCompletion = useMemo(() => {
    let completed = 0;
    if (selectedServices.length > 0) completed++;
    if (dateSlots[selectedDateIdx] && !dateSlots[selectedDateIdx].isOffDay) completed++;
    if (selectedStylist) completed++;
    if (selectedTimeSlot) completed++;
    return completed;
  }, [selectedServices, selectedDateIdx, dateSlots, selectedStylist, selectedTimeSlot]);

  
  const handleTabClick = (tabKey, elementId) => {
    setActiveTab(tabKey);
    if (tabKey && openSections[tabKey] !== undefined) {
      setOpenSections((prev) => ({ ...prev, [tabKey]: true }));
    }
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        const yOffset = -120;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
    }, 50);
  };

  if (loading && !salon) {
    return (
      <div className="salon-detail-page">
        <CustomerHeader />
        <div
          className="salon-detail-loading-wrap"
          style={{
            minHeight: "65vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            textAlign: "center",
            padding: "40px 20px",
          }}
        >
          <div
            className="salon-detail-spinner"
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid rgba(16, 185, 129, 0.15)",
              borderTopColor: "#10b981",
              borderRadius: "50%",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <h3 style={{ fontSize: "1.25rem", fontWeight: "600", color: "#1e293b", margin: 0 }}>
            Loading Salon Details…
          </h3>
          <p style={{ color: "#64748b", fontSize: "0.95rem", margin: 0 }}>
            Fetching verified treatments, specialists, and available appointment slots.
          </p>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="salon-detail-page">
        <CustomerHeader />
        <div
          className="salon-detail-not-found"
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "60px 20px",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🔍</div>
          <h2 style={{ fontSize: "1.85rem", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            Salon Not Found
          </h2>
          <p style={{ color: "#64748b", maxWidth: "480px", marginBottom: "28px", lineHeight: "1.6" }}>
            The requested salon could not be located. It may have been unpublished, relocated, or the link may be invalid.
          </p>
          <Link
            to="/customer/salons"
            style={{
              display: "inline-block",
              background: "#10b981",
              color: "#ffffff",
              padding: "12px 28px",
              borderRadius: "8px",
              fontWeight: "600",
              textDecoration: "none",
              boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)",
            }}
          >
            ← Explore Available Salons
          </Link>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  if (fetchError || (!loading && !salon)) {
    return (
      <div className="salon-detail-page">
        <CustomerHeader />
        <div
          className="salon-detail-not-found"
          style={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "60px 20px",
          }}
        >
          <div style={{ fontSize: "3.5rem", marginBottom: "16px" }}>⚠️</div>
          <h2 style={{ fontSize: "1.85rem", fontWeight: "700", color: "#1e293b", marginBottom: "8px" }}>
            Unable to Load Salon Details
          </h2>
          <p style={{ color: "#64748b", maxWidth: "480px", marginBottom: "28px", lineHeight: "1.6" }}>
            {fetchError || "Something went wrong while connecting to the salon server."}
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
            <button
              onClick={() => fetchSalonDetails()}
              style={{
                display: "inline-block",
                background: "#047857",
                color: "#ffffff",
                padding: "12px 28px",
                borderRadius: "8px",
                fontWeight: "600",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(4, 120, 87, 0.3)",
              }}
            >
              🔄 Try Again
            </button>
            <Link
              to="/customer/salons"
              style={{
                display: "inline-block",
                background: "#f1f5f9",
                color: "#334155",
                padding: "12px 28px",
                borderRadius: "8px",
                fontWeight: "600",
                textDecoration: "none",
                border: "1px solid #cbd5e1",
              }}
            >
              ← Explore Other Salons
            </Link>
          </div>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  return (
    <div className="salon-detail-page">
      <CustomerHeader />

      {toastMessage && (
        <div className="salon-detail-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}

      <section className="salon-detail-topbar">
        <div className="salon-detail-container topbar-flex">
          <nav className="detail-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/customer/home">Home</Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/customer/salons">Salons</Link>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-active">{salon.name}</span>
          </nav>

          <div className="detail-top-actions">
            <button
              type="button"
              className="top-action-book-btn"
              onClick={() => scrollToBooking()}
              title="Book Appointment at this Salon"
            >
              <span>📅 Book Appointment</span>
              <span className="top-action-book-arrow">→</span>
            </button>

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

      <section className="salon-gallery-section">
        <div className="salon-detail-container">
          <div className={`salon-gallery-mosaic ${salon.images.length === 1 ? "is-single-photo" : ""}`}>
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
                <span>✦ Verified Partner</span>
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

            {/* Right Thumbnail Grid (only if more than 1 image) */}
            {salon.images.length > 1 && (
              <div className="gallery-thumbnails-grid">
                {salon.images.slice(1, 5).map((imgUrl, idx) => {
                  const isLastThumb = idx === 3;
                  return (
                    <div
                      key={idx}
                      className={`gallery-thumb-item ${isLastThumb && salon.images.length > 5 ? "has-overlay" : ""}`}
                      onClick={() => {
                        setActivePhotoIdx(idx + 1);
                        setIsGalleryOpen(true);
                      }}
                    >
                      <img src={imgUrl} alt={`${salon.name} view ${idx + 2}`} />
                      {isLastThumb && salon.images.length > 5 && (
                        <div className="gallery-more-overlay">
                          <span>+{salon.images.length - 4} More</span>
                          <small>Photos</small>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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

            {salon.tagline && <p className="salon-tagline">{salon.tagline}</p>}

            <div className="headline-meta-row">
              <div className="meta-pill rating-pill">
                <span className="star-icon">★</span>
                <span className="score-val">{salon.reviewsCount > 0 ? salon.rating : "New"}</span>
                <span className="review-count">({salon.reviewsCount} review{salon.reviewsCount === 1 ? "" : "s"})</span>
              </div>

              <div className={`meta-pill status-pill ${salon.status?.toLowerCase().includes("closed") ? "status-closed" : ""}`} style={salon.status?.toLowerCase().includes("closed") ? { borderColor: "#fca5a5", background: "#fef2f2" } : {}}>
                <span className={`status-dot ${!salon.status?.toLowerCase().includes("closed") ? "status-dot--pulse" : ""}`} style={salon.status?.toLowerCase().includes("closed") ? { background: "#ef4444", boxShadow: "0 0 0 3px rgba(239, 68, 68, 0.2)" } : {}}></span>
                <span style={salon.status?.toLowerCase().includes("closed") ? { color: "#dc2626", fontWeight: "600" } : {}}>{salon.status}</span>
              </div>

              <div className="meta-pill price-pill">
                <span>{salon.priceTier}</span>
              </div>

              <div className="meta-pill location-pill">
                <span>📍 {[salon.landmark, salon.address, salon.city, salon.state].filter(Boolean).join(", ") || "Location details on booking"}</span>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(`${salon.name} ${salon.address} ${salon.city}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="directions-link"
                >
                  Get Directions ↗
                </a>
              </div>

              <button
                type="button"
                className="meta-pill-book-shortcut"
                onClick={() => scrollToBooking()}
                title="Jump directly to appointment slot booking"
              >
                <span className="live-sparkle">⚡</span>
                <span>Book Appointment</span>
                <span className="shortcut-arrow">→</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Quick-Jump Navigation Bar */}
      <nav className="detail-subnav-sticky" aria-label="Salon Sections">
        <div className="salon-detail-container subnav-inner">
          <div className="subnav-tabs-group">
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

          <div className="subnav-right-actions">
            <button
              type="button"
              className="subnav-book-cta-btn"
              onClick={() => scrollToBooking()}
              title="Jump to Book Appointment"
            >
              <span>📅 Book Appointment</span>
              {selectedServices.length > 0 && (
                <span className="subnav-book-pill">
                  {selectedServices.length} Svc • ₹{billSummary.total.toLocaleString("en-IN")}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main 2-Column Content Area */}
      <main className="salon-detail-body">
        <div className="salon-detail-container main-grid-layout">
          
          {/* LEFT COLUMN: Services, Team, Amenities, Offers, Reviews */}
          <div className="detail-main-col">

            {/* 1. Services Section */}
            <section id="services-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("services")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Services & Treatments</h2>
                    <span className="section-badge-pill">{filteredServices.length} Available</span>
                  </div>
                  <p className="section-subtitle">
                    Select one or more services to curate your personalized appointment.
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.services ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("services");
                  }}
                  aria-expanded={openSections.services}
                  title={openSections.services ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.services ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.services && (
                <div className="section-collapsible-body">
                  {/* Interactive Service Search & Filter Toolbar */}
                  <div className="services-toolbar-row">
                    <div className="service-search-box">
                      <svg className="search-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="Search treatments by name or category..."
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        className="service-search-input"
                      />
                      {serviceSearchQuery && (
                        <button
                          type="button"
                          className="service-search-clear-btn"
                          onClick={() => setServiceSearchQuery("")}
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
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
                        <span>{cat}</span>
                        <span className="cat-count-badge">{categoryCounts[cat] || 0}</span>
                      </button>
                    ))}
                  </div>

                  {/* Services List or Empty State */}
                  {filteredServices.length === 0 ? (
                    <div className="empty-search-state">
                      <span className="empty-search-icon">✨</span>
                      <h4>{salon.services.length === 0 ? "No services listed yet" : `No services match "${serviceSearchQuery || selectedServiceCategory}"`}</h4>
                      <p>
                        {salon.services.length === 0
                          ? "This salon has not published their services list yet. Please check back later."
                          : "Try searching for a different keyword or reset filters to see all available treatments."}
                      </p>
                      {salon.services.length > 0 && (
                        <button
                          type="button"
                          className="reset-search-btn"
                          onClick={() => {
                            setServiceSearchQuery("");
                            setSelectedServiceCategory("All");
                          }}
                        >
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </section>

            {/* 2. Stylists & Specialists Section */}
            <section id="stylists-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("stylists")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Stylists & Specialists</h2>
                    <span className="section-badge-pill">{salon.stylists.length} Specialists</span>
                  </div>
                  <p className="section-subtitle">
                    Opt for your preferred artist or let us assign the top specialist on duty.
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.stylists ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("stylists");
                  }}
                  aria-expanded={openSections.stylists}
                  title={openSections.stylists ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.stylists ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.stylists && (
                <div className="section-collapsible-body">
                  {salon.stylists.length === 0 ? (
                    <div className="reviews-empty-state" style={{ padding: "36px 16px" }}>
                      <div className="reviews-empty-icon">💇</div>
                      <h4 className="reviews-empty-title">Specialists Assigned at Check-in</h4>
                      <p className="reviews-empty-desc">
                        Dedicated specialists at this salon will be allocated to your service automatically when you arrive.
                      </p>
                    </div>
                  ) : (
                    <div className="stylists-grid">
                      {salon.stylists.map((stylist) => {
                      const isSelected = selectedStylist?.id === stylist.id;
                      const currentIsoDate = dateSlots[selectedDateIdx]?.isoDate;
                      const matchedEligible = eligibleWorkers.find((ew) => String(ew.id) === String(stylist.id));
                      const doesSelectedService = Boolean(!selectedServices[0] || matchedEligible);
                      const advanceBookingsCount = matchedEligible?.advance_bookings_count || 0;
                      const hasAdvanceBookings = Boolean(matchedEligible?.has_advance_bookings);
                      const isFullyBooked = Boolean(matchedEligible?.is_fully_booked);

                      const isStylistOnLeave =
                        matchedEligible?.is_on_leave ||
                        (Array.isArray(stylist.approvedLeaves) &&
                          currentIsoDate &&
                          stylist.approvedLeaves.includes(currentIsoDate));

                      return (
                        <div key={stylist.id} className={`stylist-card ${isSelected ? "stylist-selected" : ""} ${isStylistOnLeave ? "stylist-on-leave" : ""}`}>
                          <div className="stylist-avatar-wrap">
                            <img src={stylist.image} alt={stylist.name} />
                            <div className="stylist-rating-badge">★ {stylist.rating}</div>
                          </div>

                          <div className="stylist-info">
                            <h4 className="stylist-name">{stylist.name}</h4>
                            <p className="stylist-role">{stylist.role}</p>
                            <p className="stylist-exp">{stylist.experience ? `${stylist.experience} • ` : ""}{stylist.reviewsCount} review{stylist.reviewsCount === 1 ? "" : "s"}</p>
                            <p className="stylist-specialty">{stylist.specialty}</p>

                            {/* Service Capability & Advance Booking Status */}
                            <div className="stylist-status-stack">
                              {!doesSelectedService ? (
                                <span className="stylist-status-chip stylist-status-chip--not-performed">
                                  ✕ Does not perform {selectedServices[0]?.name}
                                </span>
                              ) : (
                                <span className="stylist-status-chip stylist-status-chip--performed">
                                  ✓ Performs {selectedServices[0]?.name}
                                </span>
                              )}

                              {doesSelectedService && (
                                hasAdvanceBookings ? (
                                  <span className="stylist-status-chip stylist-status-chip--advance-booked">
                                    📌 {advanceBookingsCount} advance booking{advanceBookingsCount > 1 ? "s" : ""} on {dateSlots[selectedDateIdx]?.dayName}
                                  </span>
                                ) : (
                                  <span className="stylist-status-chip stylist-status-chip--clear">
                                    ✓ No advance bookings on this date
                                  </span>
                                )
                              )}
                            </div>

                            {isStylistOnLeave ? (
                              <div className="stylist-notice-box stylist-notice-box--leave">
                                🔒 On Leave on Selected Date
                              </div>
                            ) : isFullyBooked ? (
                              <div className="stylist-notice-box stylist-notice-box--booked">
                                ⚠️ Fully Booked on Selected Date
                              </div>
                            ) : !doesSelectedService ? (
                              <button
                                type="button"
                                disabled
                                className="stylist-disabled-btn"
                              >
                                Service Not Provided
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`stylist-select-btn ${isSelected ? "selected-btn" : ""}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedStylist("auto");
                                    showToast("Deselected stylist. Switched back to Auto-Assign.");
                                  } else {
                                    setSelectedStylist(matchedEligible || stylist);
                                    showToast(`Selected stylist: ${stylist.name}! Pick your time slot.`);
                                    scrollToBooking("slots");
                                  }
                                }}
                              >
                                {isSelected ? "✓ Stylist Selected" : "Select Stylist"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                </div>
              )}
            </section>

            {/* 3. Amenities & Facilities Section */}
            <section id="amenities-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("amenities")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Facilities & Guest Amenities</h2>
                    <span className="section-badge-pill">{salon.amenities.length} Amenities</span>
                  </div>
                  <p className="section-subtitle">
                    Designed for your comfort, wellness, and utmost peace of mind.
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.amenities ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("amenities");
                  }}
                  aria-expanded={openSections.amenities}
                  title={openSections.amenities ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.amenities ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.amenities && (
                <div className="section-collapsible-body">
                  {salon.amenities.length === 0 ? (
                    <div className="reviews-empty-state" style={{ padding: "32px 16px" }}>
                      <div className="reviews-empty-icon">🌿</div>
                      <h4 className="reviews-empty-title">Amenities Information Coming Soon</h4>
                      <p className="reviews-empty-desc">
                        This salon has not listed specific facilities or amenities yet.
                      </p>
                    </div>
                  ) : (
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
                  )}
                </div>
              )}
            </section>

            {/* 4. Exclusive Offers Section */}
            <section id="offers-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("offers")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Exclusive Salon Offers & Coupons</h2>
                    <span className="section-badge-pill">{salon.offers.length} Offers</span>
                  </div>
                  <p className="section-subtitle">
                    Apply promo codes directly to receive instant checkout savings.
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.offers ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("offers");
                  }}
                  aria-expanded={openSections.offers}
                  title={openSections.offers ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.offers ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.offers && (
                <div className="section-collapsible-body">
                  {salon.offers.length === 0 ? (
                    <div className="reviews-empty-state" style={{ padding: "32px 16px" }}>
                      <div className="reviews-empty-icon">🏷️</div>
                      <h4 className="reviews-empty-title">No Active Offers Right Now</h4>
                      <p className="reviews-empty-desc">
                        There are currently no active promotional coupons available for this salon. Regular competitive rates apply.
                      </p>
                    </div>
                  ) : (
                    <div className="offers-cards-grid">
                      {salon.offers.map((offer) => {
                        const isCurrentApplied = appliedCoupon?.code === offer.code;
                        const meta = getOfferTypeMeta(offer.offer_type || offer.offerType);
                        const isCombo = (offer.offer_type || offer.offerType) === "COMBO";
                        const comboItems = offer.services_detail || [];
                        const selectedIds = new Set(selectedServices.map((s) => String(s.id)));
                        const missingComboCount = isCombo ? comboItems.filter((cs) => !selectedIds.has(String(cs.id))).length : 0;
                        const minSpendVal = Number(offer.min_spend || offer.minSpend || 0);

                        return (
                          <div key={offer.code || offer.id} className={`coupon-card ${isCurrentApplied ? "coupon-applied" : ""}`}>
                            <div className="coupon-left">
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginBottom: "6px" }}>
                                <span className={`bk-offer-type-tag ${meta.cls}`}>{meta.label}</span>
                                <div className="coupon-badge" style={{ margin: 0 }}>CODE: {offer.code}</div>
                              </div>
                              <h4 className="coupon-title">{offer.title}</h4>
                              {(offer.desc || offer.description) && (
                                <p className="coupon-desc">{offer.desc || offer.description}</p>
                              )}

                              {/* Combo inclusions */}
                              {isCombo && comboItems.length > 0 && (
                                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                                    Included in Deal:
                                  </span>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                    {comboItems.map((cs) => {
                                      const isSelected = selectedIds.has(String(cs.id));
                                      return (
                                        <span
                                          key={cs.id}
                                          style={{
                                            fontSize: "0.72rem",
                                            padding: "2px 6px",
                                            borderRadius: "4px",
                                            background: isSelected ? "#ecfdf5" : "#f1f5f9",
                                            color: isSelected ? "#065f46" : "#475569",
                                            border: isSelected ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {isSelected ? "✓" : "+"} {cs.name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {minSpendVal > 0 && (
                                <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "6px" }}>
                                  Min spend: ₹{minSpendVal.toLocaleString("en-IN")}
                                </div>
                              )}
                            </div>

                            <div className="coupon-right" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", flexShrink: 0 }}>
                              <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#065f46" }}>
                                {formatOfferDiscount(offer)}
                              </span>

                              {isCurrentApplied ? (
                                <button
                                  type="button"
                                  className="coupon-apply-btn"
                                  onClick={handleRemoveCoupon}
                                  style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}
                                >
                                  Applied ✓ (Remove)
                                </button>
                              ) : isCombo && missingComboCount > 0 ? (
                                <button
                                  type="button"
                                  className="coupon-apply-btn"
                                  onClick={() => {
                                    handleApplyCoupon(offer);
                                    scrollToBooking();
                                  }}
                                  title="Add bundle items and apply offer"
                                >
                                  + Add Combo ({missingComboCount}) & Apply
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="coupon-apply-btn"
                                  onClick={() => {
                                    handleApplyCoupon(offer);
                                    scrollToBooking();
                                  }}
                                >
                                  Apply Code
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 5. Client Reviews & Ratings */}
            <section id="reviews-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("reviews")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Client Reviews & Experiences</h2>
                    <span className="section-badge-pill">{salon.reviewsCount > 0 ? `${salon.reviewsCount} Reviews (${salon.rating}★)` : "0 Reviews"}</span>
                  </div>
                  <p className="section-subtitle">
                    Real, verified feedback from customers who visited this location.
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.reviews ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("reviews");
                  }}
                  aria-expanded={openSections.reviews}
                  title={openSections.reviews ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.reviews ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.reviews && (
                <div className="section-collapsible-body">
                  {/* Overall Ratings Summary Card */}
                  <div className="rating-overview-card">
                    <div className="overview-score-box">
                      <span className="big-score">{salon.reviewsCount > 0 ? salon.rating : "—"}</span>
                      <div className="stars-gold">★★★★★</div>
                      <span className="total-reviews-label">
                        {salon.reviewsCount > 0
                          ? `Based on ${salon.reviewsCount} verified visit${salon.reviewsCount === 1 ? "" : "s"}`
                          : "No verified reviews yet"}
                      </span>
                      {reviewFilterRating > 0 && (
                        <button
                          type="button"
                          className="reset-star-filter-link"
                          onClick={() => setReviewFilterRating(0)}
                        >
                          Clear Filter (Show All)
                        </button>
                      )}
                    </div>

                    <div className="overview-bars-box">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const pct = salon.ratingBreakdown?.[star]?.percentage ?? 0;
                        const isSelectedStar = reviewFilterRating === star;
                        return (
                          <div
                            key={star}
                            className={`rating-bar-row ${isSelectedStar ? "rating-bar-selected" : ""}`}
                            onClick={() => setReviewFilterRating((prev) => (prev === star ? 0 : star))}
                            title={`Filter by ${star} Star reviews (click to toggle)`}
                          >
                            <span className="star-bar-label">{star} Star{star > 1 ? "s" : ""}</span>
                            <div className="progress-track">
                              <div className="progress-fill" style={{ width: `${pct}%` }}></div>
                            </div>
                            <span className="star-bar-pct">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Star Filter Banner */}
                  {reviewFilterRating > 0 && (
                    <div className="review-filter-active-bar">
                      <span>
                        Showing <strong>{reviewFilterRating} Star</strong> reviews ({filteredReviews.length})
                      </span>
                      <button
                        type="button"
                        className="btn-clear-review-filter"
                        onClick={() => setReviewFilterRating(0)}
                      >
                        ✕ Show All
                      </button>
                    </div>
                  )}

                  {/* Reviews List */}
                  {filteredReviews.length === 0 ? (
                    <div className="reviews-empty-state">
                      <div className="reviews-empty-icon">⭐</div>
                      <h4 className="reviews-empty-title">
                        {reviewFilterRating > 0 ? `No ${reviewFilterRating}-Star Reviews Found` : "No Reviews Yet"}
                      </h4>
                      <p className="reviews-empty-desc">
                        {reviewFilterRating > 0
                          ? "There are currently no reviews matching this specific star rating."
                          : "Be the first verified client to review this salon after completing an appointment!"}
                      </p>
                      {reviewFilterRating > 0 && (
                        <button
                          type="button"
                          className="reset-search-btn"
                          onClick={() => setReviewFilterRating(0)}
                        >
                          View All Reviews
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="reviews-list">
                      {filteredReviews.map((rev) => (
                        <div key={rev.id} className="review-card">
                          <div className="review-header">
                            <div className="reviewer-info">
                              {rev.avatar ? (
                                <img
                                  src={rev.avatar}
                                  alt={rev.author}
                                  className="reviewer-avatar"
                                />
                              ) : (
                                <div className="reviewer-avatar">{rev.initial}</div>
                              )}
                              <div>
                                <h4 className="reviewer-name">{rev.author}</h4>
                                <span className="review-treatment-tag">Treatment: {rev.treatment}</span>
                              </div>
                            </div>
                            <div className="review-meta">
                              <div className="review-stars">
                                {"★".repeat(Math.max(0, Math.min(5, Math.round(Number(rev.rating) || 0))))}
                              </div>
                              <span className="review-date">{rev.date}</span>
                            </div>
                          </div>
                          {rev.comment && <p className="review-comment">“{rev.comment}”</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 6. Location & Working Hours */}
            <section id="location-section" className="content-card-section">
              <div
                className="section-header-row collapsible-header"
                onClick={() => toggleSection("location")}
              >
                <div>
                  <div className="section-title-wrap">
                    <h2 className="section-title">Location & Operating Hours</h2>
                    <span className="section-badge-pill">{salon.city || "Location"}, {salon.state || "India"}</span>
                  </div>
                  <p className="section-subtitle">
                    {salon.landmark
                      ? `Located near ${salon.landmark}, ${salon.city}.`
                      : `Easily accessible in ${salon.city}, ${salon.state}.`}
                  </p>
                </div>

                <button
                  type="button"
                  className={`section-toggle-btn ${openSections.location ? "is-expanded" : "is-collapsed"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSection("location");
                  }}
                  aria-expanded={openSections.location}
                  title={openSections.location ? "Collapse section" : "Expand section"}
                >
                  <span className="toggle-btn-text">{openSections.location ? "Collapse" : "Open"}</span>
                  <span className="toggle-arrow-circle">
                    <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </button>
              </div>

              {openSections.location && (
                <div className="section-collapsible-body">
                  <div className="location-details-grid">
                    <div className="hours-card">
                      <h4 className="card-subheading">Operating Hours</h4>
                      {salon.openingHours.length === 0 ? (
                        <p style={{ color: "#64748b", fontSize: "0.9rem", padding: "12px 0" }}>
                          Operating hours not specified. Please contact the salon directly.
                        </p>
                      ) : (
                        <ul className="hours-list">
                          {salon.openingHours.map((slot) => (
                            <li key={slot.day} className={`hours-item ${slot.isToday ? "today-highlight" : ""}`}>
                              <span className="day-name">{slot.day} {slot.isToday && <span className="today-pill">Today</span>}</span>
                              <span className="hours-val" style={slot.isOpen === false || slot.hours?.includes("Holiday") ? { color: "#dc2626", fontWeight: "600" } : {}}>{slot.hours}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="address-contact-card">
                      <h4 className="card-subheading">Contact & Address</h4>
                      <div className="address-block">
                        <p className="salon-full-address">
                          <strong>{salon.name}</strong><br />
                          {salon.landmark && <>{salon.landmark}<br /></>}
                          {[salon.address, salon.city, salon.state].filter(Boolean).join(", ")}{salon.pincode ? ` – ${salon.pincode}` : ""}
                        </p>
                        <div className="contact-methods">
                          {salon.phone && <p>📞 Phone: <a href={`tel:${salon.phone}`}>{salon.phone}</a></p>}
                          {salon.email && <p>✉️ Email: <a href={`mailto:${salon.email}`}>{salon.email}</a></p>}
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
                </div>
              )}
            </section>

          </div>

          {/* RIGHT STICKY COLUMN: Appointment Booking Drawer */}
          <aside className="detail-sidebar-col">
            <div className="sticky-booking-card" id="booking-card-anchor">
              <div
                className="booking-card-header collapsible-header"
                onClick={() => toggleSection("booking")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div className="booking-card-header-icon-box">📅</div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                      <h2 className="section-title">Book Appointment</h2>
                      <span className="section-badge-pill" style={{ background: "#dcfce7", color: "#166534" }}>⚡ Instant</span>
                    </div>
                    <p className="section-subtitle">
                      ★ {salon.reviewsCount > 0 ? salon.rating : "New"} ({salon.reviewsCount} reviews) • {salon.name}
                    </p>
                  </div>
                </div>

                <div className="booking-card-header-actions">
                  <button
                    type="button"
                    className={`section-toggle-btn ${openSections.booking ? "is-expanded" : "is-collapsed"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSection("booking");
                    }}
                    aria-expanded={openSections.booking}
                    title={openSections.booking ? "Collapse Book Appointment" : "Expand Book Appointment"}
                  >
                    <span className="toggle-btn-text">{openSections.booking ? "Collapse" : "Open"}</span>
                    <span className="toggle-arrow-circle">
                      <svg className="toggle-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>

              {/* Interactive Booking Progress Step Indicator */}
              <div className="booking-progress-container">
                <div className="booking-progress-info">
                  <span className="progress-step-text">
                    {bookingCompletion === 4
                      ? "✓ All details selected — Ready to book!"
                      : `Step ${bookingCompletion + 1} of 4: ${
                          !selectedServices[0]
                            ? "Select a Treatment"
                            : !dateSlots[selectedDateIdx] || dateSlots[selectedDateIdx].isOffDay
                            ? "Select an Open Date"
                            : !selectedStylist
                            ? "Choose Specialist"
                            : "Pick Time Slot"
                        }`}
                  </span>
                  <span className="progress-pct-text">{bookingCompletion} / 4 Done</span>
                </div>
                <div className="booking-progress-bar">
                  <div
                    className="booking-progress-bar-fill"
                    style={{ width: `${(bookingCompletion / 4) * 100}%` }}
                  />
                </div>
              </div>

              {!openSections.booking ? (
                <div className="booking-card-collapsed-summary" onClick={() => toggleSection("booking")}>
                  <div className="collapsed-summary-content">
                    <span className="collapsed-summary-service">
                      {selectedServices[0]?.name || "Select Service & Slot"}
                    </span>
                    <span className="collapsed-summary-meta">
                      {dateSlots[selectedDateIdx]?.dayName} {dateSlots[selectedDateIdx]?.dateNum} • {selectedTimeSlot || "No Time"}
                    </span>
                    <span className="collapsed-summary-price">
                      ₹{billSummary.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <span className="collapsed-summary-action">Tap to Open & Book ↗</span>
                </div>
              ) : (
                <div className="booking-card-body-content">
                  {/* STEP 1: Select Service */}
                  <div className="booking-step-block step-block-active">
                    <div
                      className="step-accordion-header"
                      onClick={() => toggleBookingStep("service")}
                    >
                      <div className="step-header-left">
                        <span className="step-num-badge badge-done">1</span>
                        <span className="step-title-text">Treatments / Services</span>
                      </div>
                      <div className="step-header-right">
                        <span className="step-summary-pill" title={`${selectedServices.length} Selected`}>
                          {selectedServices.length} Selected ({totalDurationMinutes}m)
                        </span>
                        <span className={`step-accordion-chevron ${openBookingSteps.service ? "is-expanded" : "is-collapsed"}`}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </span>
                      </div>
                    </div>

                    {openBookingSteps.service && (
                      <div className="step-accordion-body">
                        {selectedServices.length === 0 ? (
                          <div className="empty-services-prompt">
                            <p>No service selected yet.</p>
                            <small>Please choose one or more services from the menu on the left.</small>
                          </div>
                        ) : (
                          <div>
                            {/* Selected Services Stack */}
                            <div className="selected-services-stack" style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                              {selectedServices.map((svc) => (
                                <div key={svc.id} className="selected-service-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                  <div className="selected-service-info" style={{ flex: 1, minWidth: 0, paddingRight: "8px" }}>
                                    <strong className="selected-srv-name" style={{ fontSize: "0.85rem", color: "#0f172a", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {svc.name}
                                    </strong>
                                    <span className="selected-srv-dur" style={{ fontSize: "0.75rem", color: "#64748b" }}>⏱ {svc.duration}</span>
                                  </div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span className="selected-srv-price" style={{ fontWeight: 700, color: "#047857", fontSize: "0.86rem" }}>
                                      ₹{Number(svc.price).toLocaleString("en-IN")}
                                    </span>
                                    {selectedServices.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveService(svc.id)}
                                        title={`Remove ${svc.name}`}
                                        style={{
                                          background: "none",
                                          border: "none",
                                          color: "#94a3b8",
                                          fontSize: "14px",
                                          cursor: "pointer",
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Summary banner */}
                            <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: "8px", padding: "6px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.78rem", color: "#065f46", marginBottom: "10px" }}>
                              <span>✨ <strong>{selectedServices.length} Treatment{selectedServices.length > 1 ? "s" : ""}</strong></span>
                              <span>⏱ Total: <strong>{totalDurationMinutes} mins</strong></span>
                            </div>

                            {/* Add More Service Switcher / Selector */}
                            {salon.services.some((s) => !selectedServices.some((sel) => sel.id === s.id)) && (
                              <div className="service-switcher-wrapper">
                                <label className="service-switcher-label">
                                  + Add Another Treatment
                                </label>
                                <select
                                  className="service-switcher-select"
                                  value=""
                                  onChange={(e) => {
                                    const found = salon.services.find((s) => String(s.id) === String(e.target.value));
                                    if (found) {
                                      handleToggleService(found);
                                    }
                                  }}
                                >
                                  <option value="" disabled>Choose service to add…</option>
                                  {salon.services
                                    .filter((s) => !selectedServices.some((sel) => sel.id === s.id))
                                    .map((s) => (
                                      <option key={s.id} value={s.id}>
                                        + {s.name} ({s.duration}) — ₹{s.price}
                                      </option>
                                    ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

            {/* STEP 2: Select Date */}
            <div className="booking-step-block step-block-active">
              <div
                className="step-accordion-header"
                onClick={() => toggleBookingStep("date")}
              >
                <div className="step-header-left">
                  <span className="step-num-badge badge-done">2</span>
                  <span className="step-title-text">Select Date</span>
                </div>
                <div className="step-header-right">
                  {dateSlots[selectedDateIdx] && (
                    <span className="step-summary-pill">
                      {dateSlots[selectedDateIdx].dayName} {dateSlots[selectedDateIdx].dateNum} {dateSlots[selectedDateIdx].monthStr}
                    </span>
                  )}
                  <span className={`step-accordion-chevron ${openBookingSteps.date ? "is-expanded" : "is-collapsed"}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {openBookingSteps.date && (
                <div className="step-accordion-body">
                  <div className="date-pills-scroller">
                    {dateSlots.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        className={`date-pill ${selectedDateIdx === d.id ? "date-active" : ""} ${d.isOffDay ? "date-offday" : ""}`}
                        onClick={() => {
                          setSelectedDateIdx(d.id);
                        }}
                      >
                        <span className="date-dayname">{d.dayName}</span>
                        <span className="date-number">{d.dateNum}</span>
                        <span className="date-month">{d.monthStr}</span>
                        {d.isOffDay && (
                          <span className="date-closed-badge">
                            CLOSED
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {dateSlots[selectedDateIdx]?.isOffDay && (
                    <div className="booking-alert-banner booking-alert-banner--danger">
                      🔒 Salon is closed on this date ({dateSlots[selectedDateIdx]?.offDayReason || "Scheduled Closure"}). Please select another date.
                    </div>
                  )}
                </div>
              )}
            </div>

              {/* STEP 3: Select Stylist */}
              <div className="booking-step-block step-block-active">
                <div
                  className="step-accordion-header"
                  onClick={() => toggleBookingStep("stylist")}
                >
                  <div className="step-header-left">
                    <span className={`step-num-badge ${selectedStylist ? "badge-done" : "badge-active"}`}>
                      {selectedStylist ? "✓" : "3"}
                    </span>
                    <span className="step-title-text">Select Stylist</span>
                  </div>
                  <div className="step-header-right">
                    <span className={`step-summary-pill ${!selectedStylist ? "step-summary-pill--warning" : ""}`}>
                      {selectedStylist === "auto"
                        ? selectedSlotObj?.assigned_worker?.name
                          ? `Auto (${selectedSlotObj.assigned_worker.name})`
                          : "Auto-Assign"
                        : selectedStylist && typeof selectedStylist === "object"
                        ? selectedStylist.name
                        : "Select a Stylist"}
                    </span>
                    <span className={`step-accordion-chevron ${openBookingSteps.stylist ? "is-expanded" : "is-collapsed"}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  </div>
                </div>

                {openBookingSteps.stylist && (
                  <div className="step-accordion-body">
                  {/* Selected Stylist Banner */}
                  <div className="selected-stylist-banner">
                    {selectedStylist && typeof selectedStylist === "object" ? (
                      <div className="stylist-assigned-row stylist-assigned-column">
                        <div className="stylist-assigned-main">
                          <img src={selectedStylist.image} alt={selectedStylist.name} className="assigned-avatar" />
                          <div className="assigned-text">
                            <span className="assigned-name">{selectedStylist.name}</span>
                            <span className="assigned-role">{selectedStylist.role}</span>
                          </div>
                          <button
                            type="button"
                            className="change-stylist-link"
                            onClick={() => {
                              setSelectedStylist("auto");
                              setSelectedTimeSlot("");
                              setSelectedSlotObj(null);
                              setOpenBookingSteps((prev) => ({ ...prev, stylist: true }));
                            }}
                          >
                            Change
                          </button>
                        </div>

                        <div className={`assigned-advance-info ${selectedStylist.has_advance_bookings ? "assigned-advance-info--booked" : "assigned-advance-info--available"}`}>
                          {selectedStylist.has_advance_bookings ? (
                            <>
                              <strong>📌 {selectedStylist.advance_bookings_count} Advance Booking{selectedStylist.advance_bookings_count > 1 ? "s" : ""}:</strong>
                              <span>Booked slots are automatically hidden below</span>
                            </>
                          ) : (
                            <span>✓ Fully available on this date — all slots open!</span>
                          )}
                        </div>
                      </div>
                    ) : selectedStylist === "auto" ? (
                      <div className="stylist-assigned-row">
                        <div className="stylist-assigned-main">
                          <div className="assigned-avatar-placeholder">✦</div>
                          <div className="assigned-text">
                            <span className="assigned-name">Auto-Assign Active</span>
                            <span className="assigned-role">Showing all slots where at least one stylist is free</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="change-stylist-link"
                          onClick={() => {
                            setOpenBookingSteps((prev) => ({ ...prev, stylist: true }));
                            showToast("Choose a specialist from the list below.");
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="stylist-assigned-row">
                        <div className="assigned-avatar-placeholder assigned-avatar-placeholder--warning">!</div>
                        <div className="assigned-text">
                          <span className="assigned-name assigned-name--warning">No Stylist Selected</span>
                          <span className="assigned-role">Please choose a specialist below or select Auto-Assign</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Eligible Stylists Quick List */}
                  {eligibleWorkersLoading ? (
                    <div className="sidebar-loading-text">
                      Loading available stylists for this date…
                    </div>
                  ) : (
                    <div className="side-stylists-list">
                      {/* Auto-Assign Option */}
                      <div
                        className={`side-stylist-card ${selectedStylist === "auto" ? "side-stylist-card--selected" : ""}`}
                        onClick={() => {
                          setSelectedStylist("auto");
                          setSelectedTimeSlot("");
                          setSelectedSlotObj(null);
                        }}
                      >
                        <div className="stylist-assigned-main">
                          <span className="side-stylist-auto-title">
                            ✦ Auto-Assign (Any Available Specialist)
                          </span>
                        </div>
                        <span className={`side-stylist-badge ${selectedStylist === "auto" ? "side-stylist-badge--active" : "side-stylist-badge--idle"}`}>
                          {selectedStylist === "auto" ? "✓ Selected" : "Auto-Assign"}
                        </span>
                      </div>

                      {/* Workers List */}
                      {eligibleWorkers.map((st) => {
                        const isChosen = typeof selectedStylist === "object" && selectedStylist?.id === st.id;
                        const isUnavailable = st.is_on_leave || st.is_weekly_off || st.is_fully_booked || st.is_available === false;

                        return (
                          <div
                            key={st.id}
                            className={`side-stylist-card ${isChosen ? "side-stylist-card--selected" : ""} ${isUnavailable ? "side-stylist-card--disabled" : ""}`}
                            onClick={() => {
                              if (!isUnavailable) {
                                setSelectedStylist(st);
                                setSelectedTimeSlot("");
                                setSelectedSlotObj(null);
                              }
                            }}
                          >
                            <div className="stylist-assigned-main">
                              <img src={st.image} alt={st.name} className="side-stylist-avatar" />
                              <div className="side-stylist-info">
                                <div className="side-stylist-name">{st.name}</div>
                                <div className="side-stylist-role">{st.role}</div>
                              </div>
                            </div>

                            <div className="side-stylist-status-col">
                              {isChosen ? (
                                <span className="side-stylist-badge side-stylist-badge--selected">
                                  ✓ Selected
                                </span>
                              ) : st.is_on_leave ? (
                                <span className="side-stylist-badge side-stylist-badge--leave">
                                  On Leave
                                </span>
                              ) : st.is_weekly_off ? (
                                <span className="side-stylist-badge side-stylist-badge--off">
                                  Weekly Off
                                </span>
                              ) : st.is_fully_booked ? (
                                <span className="side-stylist-badge side-stylist-badge--booked">
                                  Fully Booked
                                </span>
                              ) : st.has_advance_bookings ? (
                                <span className="side-stylist-badge side-stylist-badge--advance">
                                  📌 {st.advance_bookings_count} Booked
                                </span>
                              ) : (
                                <span className="side-stylist-badge side-stylist-badge--available">
                                  ✓ Available ({st.available_slots_count} slots)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* STEP 4: Available Time Slots */}
            <div className="booking-step-block step-block-active">
              <div
                className="step-accordion-header"
                onClick={() => toggleBookingStep("slots")}
              >
                <div className="step-header-left">
                  <span className={`step-num-badge ${selectedTimeSlot ? "badge-done" : "badge-active"}`}>
                    {selectedTimeSlot ? "✓" : "4"}
                  </span>
                  <span className="step-title-text">Available Time Slots</span>
                </div>
                <div className="step-header-right">
                  {selectedTimeSlot && (
                    <span className="step-summary-pill">
                      🕒 {selectedTimeSlot}
                    </span>
                  )}
                  <span className={`step-accordion-chevron ${openBookingSteps.slots ? "is-expanded" : "is-collapsed"}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </span>
                </div>
              </div>

              {openBookingSteps.slots && (
                <div className="step-accordion-body">
                  {!selectedStylist ? (
                    <div className="slots-unselected-prompt">
                      <div className="slots-unselected-icon">✂️</div>
                      <div className="slots-unselected-title">
                        Select a Stylist to View Available Slots
                      </div>
                      <div className="slots-unselected-desc">
                        Choose a specialist from the list above or select Auto-Assign to view real-time available time slots.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="slots-showing-subtitle">
                        Showing slots for:{" "}
                        <strong className="slots-showing-name">
                          {selectedStylist === "auto"
                            ? selectedSlotObj?.assigned_worker?.name
                              ? `Auto-Assign: ${selectedSlotObj.assigned_worker.name}`
                              : "Any Available Specialist (Auto-Assign)"
                            : selectedStylist.name}
                        </strong>
                      </div>

                      {dateSlots[selectedDateIdx]?.isOffDay ? (
                        <div className="booking-alert-banner booking-alert-banner--danger">
                          <div className="booking-alert-banner-title">
                            🔒 Salon Closed on this Date
                          </div>
                          <div>
                            {dateSlots[selectedDateIdx]?.offDayReason || "Salon is closed on this date"}. Please select another date.
                          </div>
                        </div>
                      ) : slotClosedReason ? (
                        <div className="booking-alert-banner booking-alert-banner--danger">
                          🔒 Salon Closed: {slotClosedReason}
                        </div>
                      ) : slotWorkerUnavailableReason ? (
                        <div className="booking-alert-banner booking-alert-banner--warning">
                          <div className="booking-alert-banner-title">⚠️ Specialist Unavailable</div>
                          <div>{slotWorkerUnavailableReason}</div>
                          {selectedStylist !== "auto" && (
                            <button
                              type="button"
                              className="btn-switch-auto-assign btn-switch-auto-assign--warning"
                              onClick={() => setSelectedStylist("auto")}
                            >
                              Switch to Auto-Assign
                            </button>
                          )}
                        </div>
                      ) : slotsLoading ? (
                        <div className="sidebar-loading-text">
                          Loading available slots…
                        </div>
                      ) : dynamicSlots.length === 0 ? (
                        <div className="booking-alert-banner booking-alert-banner--warning">
                          No time slots available for this stylist on this date.
                          {selectedStylist !== "auto" && (
                            <div className="btn-switch-auto-assign-wrap">
                              <button
                                type="button"
                                className="btn-switch-auto-assign"
                                onClick={() => setSelectedStylist("auto")}
                              >
                                Try Auto-Assign
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          {/* Time-of-day Filter Segmented Tabs */}
                          <div className="slot-tod-tabs">
                            {[
                              { id: "all", label: "All", count: slotCounts.all },
                              { id: "morning", label: "Morning", icon: "🌅", count: slotCounts.morning },
                              { id: "afternoon", label: "Afternoon", icon: "☀️", count: slotCounts.afternoon },
                              { id: "evening", label: "Evening", icon: "🌙", count: slotCounts.evening },
                            ].map((tod) => (
                              <button
                                key={tod.id}
                                type="button"
                                className={`slot-tod-tab ${slotTimeFilter === tod.id ? "active" : ""}`}
                                onClick={() => setSlotTimeFilter(tod.id)}
                              >
                                {tod.icon && <span className="tod-icon">{tod.icon}</span>}
                                <span>{tod.label}</span>
                                <span className="tod-badge">{tod.count}</span>
                              </button>
                            ))}
                          </div>

                          {filteredSlots.length === 0 ? (
                            <div className="empty-tod-slots">
                              <p>No available slots in the {slotTimeFilter} session.</p>
                              <button
                                type="button"
                                className="show-all-slots-link"
                                onClick={() => setSlotTimeFilter("all")}
                              >
                                View All Available Slots ({dynamicSlots.length})
                              </button>
                            </div>
                          ) : (
                            <div className="time-slots-grid">
                              {filteredSlots.map((s) => {
                                const isSelected = selectedSlotObj?.time === s.time || selectedTimeSlot === s.time_display;
                                return (
                                  <button
                                    key={s.time}
                                    type="button"
                                    disabled={!s.available}
                                    title={!s.available ? (s.reason ? `Unavailable (${s.reason})` : "Slot unavailable") : `${s.time_display} - ${s.end_time_display}`}
                                    className={`time-slot-btn ${isSelected ? "time-active" : ""}`}
                                    onClick={() => {
                                      if (s.available) {
                                        setSelectedSlotObj(s);
                                        setSelectedTimeSlot(s.time_display || s.time);
                                      }
                                    }}
                                  >
                                    <span className="slot-time-text">{s.time_display}</span>
                                    {s.end_time_display && s.available && (
                                      <span className="slot-end-time">until {s.end_time_display}</span>
                                    )}
                                    {!s.available && (
                                      <span className="slot-unavailable-reason">
                                        - {s.reason === "Break" ? "Break" : "Booked"}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Auto-Assigned Specialist Info Banner */}
                          {selectedSlotObj && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px 14px",
                                background: "#ecfdf5",
                                border: "1px solid #a7f3d0",
                                borderRadius: "8px",
                                marginTop: "16px",
                              }}
                            >
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "50%",
                                  overflow: "hidden",
                                  background: "#047857",
                                  color: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "bold",
                                  fontSize: "1.1rem",
                                  flexShrink: 0,
                                }}
                              >
                                {selectedSlotObj.assigned_worker?.profile_photo ? (
                                  <img
                                    src={selectedSlotObj.assigned_worker.profile_photo}
                                    alt={selectedSlotObj.assigned_worker.name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <span>✦</span>
                                )}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "#065f46", fontWeight: 700 }}>
                                  {selectedStylist === "auto" ? "✦ Auto-Assigned Specialist" : "Selected Specialist"}
                                </div>
                                <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#064e3b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {selectedSlotObj.assigned_worker?.name || (typeof selectedStylist === "object" ? selectedStylist.name : "Salon Specialist")}
                                  {selectedSlotObj.assigned_worker?.station && (
                                    <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#047857" }}> • {selectedSlotObj.assigned_worker.station}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* STEP 5: Pricing Breakdown */}
            <div className="bill-breakdown-card">
              {selectedServices.map((svc) => (
                <div key={svc.id} className="bill-row" style={{ fontSize: "0.82rem", color: "#334155" }}>
                  <span>{svc.name} <small style={{ color: "#64748b" }}>({svc.duration})</small></span>
                  <span style={{ fontWeight: 600 }}>₹{Number(svc.price).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="bill-row" style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px" }}>
                <span>Subtotal ({selectedServices.length} treatment{selectedServices.length > 1 ? "s" : ""})</span>
                <span style={{ fontWeight: 600 }}>₹{billSummary.subtotal.toLocaleString("en-IN")}</span>
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

              {/* Advance Booking Policy Notice */}
              {/* <div className="bill-advance-notice">
                <div className="bill-advance-row">
                  <span className="advance-label">💵 Advance Booking Token:</span>
                  <span className="advance-amount">₹100</span>
                </div>
                <div className="advance-subtext">
                  ₹100 advance deducted from total • Remaining ₹{Math.max(0, billSummary.total - 100).toLocaleString("en-IN")} payable at salon after service.
                </div>
              </div> */}
            </div>

            {bookingError && (
              <div className="booking-error-banner">
                <span>⚠️ {bookingError}</span>
                <button
                  type="button"
                  onClick={() => setBookingError("")}
                  className="booking-error-dismiss-btn"
                  title="Dismiss"
                >
                  ✕
                </button>
              </div>
            )}

            {/* STEP 6: Primary Action CTA */}
            <button
              type="button"
              className={`proceed-booking-cta ${bookingCompletion === 4 ? "proceed-booking-cta--ready" : ""}`}
              disabled={
                loading ||
                selectedServices.length === 0 ||
                dateSlots[selectedDateIdx]?.isOffDay ||
                Boolean(slotClosedReason) ||
                Boolean(slotWorkerUnavailableReason) ||
                !selectedStylist ||
                slotsLoading ||
                !selectedTimeSlot
              }
              onClick={() => {
                setBookingError("");
                const dateObj = dateSlots[selectedDateIdx];
                const params = new URLSearchParams();
                if (selectedServices.length > 0) {
                  params.set("service_ids", selectedServices.map((s) => s.id).join(","));
                  params.set("service_id", selectedServices[0].id);
                }
                if (dateObj?.isoDate) params.set("date", dateObj.isoDate);
                else if (dateObj?.fullDateStr) params.set("date", dateObj.fullDateStr);

                const workerId =
                  selectedStylist && typeof selectedStylist === "object"
                    ? selectedStylist.id
                    : selectedSlotObj?.assigned_worker?.id || "auto";
                if (workerId) params.set("worker_id", workerId);

                const slotTime =
                  selectedSlotObj?.time ||
                  dynamicSlots.find((s) => s.time_display === selectedTimeSlot)?.time ||
                  selectedTimeSlot;
                if (slotTime) params.set("time", slotTime);

                if (appliedCoupon?.code) params.set("coupon", appliedCoupon.code);

                const basePath = window.location.pathname.startsWith("/customer/")
                  ? `/customer/salons/${salon.id}/book`
                  : `/salons/${salon.id}/book`;
                navigate(`${basePath}?${params.toString()}`);
              }}
            >
              <span className="proceed-cta-icon">{bookingCompletion === 4 ? "⚡" : "👉"}</span>
              <span className="proceed-cta-text">
                {selectedServices.length === 0
                  ? "Select a Treatment to Begin"
                  : dateSlots[selectedDateIdx]?.isOffDay
                  ? "Salon Closed on Selected Date"
                  : slotClosedReason
                  ? "Salon Closed"
                  : slotWorkerUnavailableReason
                  ? "Specialist Unavailable"
                  : !selectedStylist
                  ? "Select a Stylist or Auto-Assign"
                  : slotsLoading
                  ? "Loading Available Slots…"
                  : !selectedTimeSlot
                  ? "Pick a Time Slot"
                  : `Proceed to Book Appointment (₹${billSummary.total.toLocaleString("en-IN")})`}
              </span>
              {bookingCompletion === 4 && <span className="cta-arrow">→</span>}
            </button>

            <div className="cancellation-policy-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Free cancellation up to 2 hours before appointment</span>
            </div>
          </div>
        )}
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



      {/* Interactive Mobile Bottom Booking Bar */}
      <aside className="mobile-bottom-booking-bar" aria-label="Quick Booking Bar">
        <div className="mobile-bottom-bar-inner">
          <div className="mobile-bar-info">
            <span className="mobile-bar-service-title">
              {selectedServices[0]?.name || "Select a Treatment"}
            </span>
            <div className="mobile-bar-meta-row">
              <span className="mobile-bar-total">₹{billSummary.total.toLocaleString("en-IN")}</span>
              <span className="mobile-bar-sep">•</span>
              <span className="mobile-bar-slot">
                {selectedTimeSlot ? `${dateSlots[selectedDateIdx]?.dayName} ${selectedTimeSlot}` : "Choose time slot"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="mobile-bar-action-btn"
            onClick={() => scrollToBooking()}
          >
            <span>
              {bookingCompletion === 4
                ? "Book Now ⚡"
                : selectedServices.length === 0
                ? "Select Treatment →"
                : "Select Slot →"}
            </span>
          </button>
        </div>
      </aside>

      <CustomerFooter />
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
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
    }
    
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
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedStylist, setSelectedStylist] = useState(null); 
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [selectedSlotObj, setSelectedSlotObj] = useState(null);
  const [slotWorkerUnavailableReason, setSlotWorkerUnavailableReason] = useState(null);
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [confirmedBookingData, setConfirmedBookingData] = useState(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.first_name || stored.last_name) {
        setClientName(`${stored.first_name || ""} ${stored.last_name || ""}`.trim());
      }
      if (stored.email) setClientEmail(stored.email);
      if (stored.phone_number || stored.phone) setClientPhone(stored.phone_number || stored.phone || "");
    } catch {}
  }, []);

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

  const activeService = selectedServices[0] || null;
  const activeDateObj = dateSlots[selectedDateIdx] || null;

  // 1. Fetch workers that perform the selected service & check their schedule / availability on the chosen date
  useEffect(() => {
    let isMounted = true;

    if (!salon?.id || !activeService?.id || !activeDateObj || loading) {
      setEligibleWorkers([]);
      return;
    }

    async function loadEligibleWorkers() {
      setEligibleWorkersLoading(true);
      try {
        const params = {
          service_id: activeService.id,
          date: activeDateObj.isoDate,
        };

        const res = await api.get(`/bookings/salons/${salon.id}/workers/`, { params });
        if (isMounted) {
          const rawWorkers = res.data?.workers || [];
          const formatted = rawWorkers.map((w, index) => ({
            id: w.id,
            name: w.name,
            role: w.specialization || "Master Stylist",
            experience: w.experience || "3+ yrs exp",
            rating: 4.9,
            reviewsCount: 30 + index * 5,
            image: w.profile_photo ? resolveImageUrl(w.profile_photo) : (DEFAULT_SALON_DATA.stylists[index % DEFAULT_SALON_DATA.stylists.length]?.image || ""),
            specialty: w.station ? `Station: ${w.station}` : "Certified Specialist",
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
  }, [salon?.id, activeService?.id, activeDateObj?.isoDate, loading]);

  // 2. Fetch available slots based on Selected Worker (or Auto-assign) and Service Duration
  useEffect(() => {
    let isMounted = true;

    // Do NOT fetch or show slots until a stylist (or Auto-Assign) is chosen
    if (!activeService?.id || !activeDateObj || !salon?.id || loading || !selectedStylist) {
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
          service_id: activeService.id,
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
  }, [salon?.id, activeService?.id, activeDateObj?.isoDate, activeDateObj?.isOffDay, selectedStylist, loading]);

  const handleConfirmBookingSubmit = async () => {
    const activeService = selectedServices[0];
    const activeDateObj = dateSlots[selectedDateIdx];
    if (!activeService) {
      setBookingError("Please select a service.");
      return;
    }
    if (!selectedStylist) {
      setBookingError("Please select a stylist (or choose Auto-Assign).");
      return;
    }
    if (!clientName.trim()) {
      setBookingError("Please enter your name.");
      return;
    }
    const slotTime = selectedSlotObj?.time || (
      dynamicSlots.find(s => s.time_display === selectedTimeSlot)?.time
    );
    if (!slotTime) {
      setBookingError("Please select an available time slot.");
      return;
    }
    setBookingError("");
    setIsSubmittingBooking(true);
    try {
      const payload = {
        salon_id: Number(salon.id),
        service_id: activeService.id,
        booking_date: activeDateObj.isoDate,
        start_time: slotTime,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim(),
        notes: bookingNotes.trim(),
      };
      if (selectedStylist && typeof selectedStylist === "object" && selectedStylist.id) {
        payload.worker_id = Number(selectedStylist.id);
      }
      const response = await api.post("/bookings/create/", payload);
      setConfirmedBookingData(response.data.booking);
      setBookingSuccess(true);
      showToast("Appointment booked successfully! 🎉");
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.detail || "Booking failed. Please try another slot.";
      setBookingError(errMsg);
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  // Fetch Salon Data from backend 
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
                price: parsedPrice || 500,
                description:
                  s.description || "Signature premium treatment tailored to your wellness needs.",
                badge: index === 0 ? "Popular" : null,
              };
            });
          } else {
            serviceList = DEFAULT_SALON_DATA.services;
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

          
          if (serviceList.length > 0) {
            setSelectedServices([serviceList[0]]);
          }
        }
      } catch (err) {
        
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

  
  const handleToggleService = (service) => {
    setSelectedServices([service]);
    showToast(`Selected "${service.name}" (${service.duration})!`);
  };

 
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

  
  const handleApplyCoupon = (coupon) => {
    if (billSummary.subtotal < coupon.minSpend) {
      showToast(`Add items worth ₹${coupon.minSpend} to apply ${coupon.code}`);
      return;
    }
    setAppliedCoupon(coupon);
    showToast(`Coupon ${coupon.code} applied successfully! 🎉`);
  };

  
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      showToast("Salon link copied to clipboard! 📋");
    } else {
      showToast("Share URL: " + window.location.href);
    }
  };

  
  const handleSaveToggle = () => {
    setIsSaved(!isSaved);
    showToast(!isSaved ? "Saved to your favorite salons! ❤️" : "Removed from favorites.");
  };

  
  const availableCategories = useMemo(() => {
    const cats = new Set(salon.services.map((s) => s.category || "General"));
    return ["All", ...Array.from(cats)];
  }, [salon.services]);

  const filteredServices = useMemo(() => {
    if (selectedServiceCategory === "All") return salon.services;
    return salon.services.filter((s) => (s.category || "General") === selectedServiceCategory);
  }, [salon.services, selectedServiceCategory]);

  
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

      
      {toastMessage && (
        <div className="salon-detail-toast" role="status">
          <span>{toastMessage}</span>
        </div>
      )}

     
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
                        <p className="stylist-exp">{stylist.experience} • {stylist.reviewsCount} reviews</p>
                        <p className="stylist-specialty">{stylist.specialty}</p>

                        {/* Service Capability & Advance Booking Status */}
                        <div style={{ marginTop: "6px", marginBottom: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {!doesSelectedService ? (
                            <span style={{ fontSize: "0.72rem", color: "#b45309", background: "#fef3c7", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                              ✕ Does not perform {selectedServices[0]?.name}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.72rem", color: "#166534", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                              ✓ Performs {selectedServices[0]?.name}
                            </span>
                          )}

                          {doesSelectedService && (
                            hasAdvanceBookings ? (
                              <span style={{ fontSize: "0.72rem", color: "#0369a1", background: "#e0f2fe", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                📌 {advanceBookingsCount} advance booking{advanceBookingsCount > 1 ? "s" : ""} on {dateSlots[selectedDateIdx]?.dayName}
                              </span>
                            ) : (
                              <span style={{ fontSize: "0.72rem", color: "#15803d", background: "#f0fdf4", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                ✓ No advance bookings on this date
                              </span>
                            )
                          )}
                        </div>

                        {isStylistOnLeave ? (
                          <div style={{
                            background: "#fef2f2",
                            color: "#dc2626",
                            border: "1px solid #fecaca",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textAlign: "center",
                            marginTop: "8px"
                          }}>
                            🔒 On Leave on Selected Date
                          </div>
                        ) : isFullyBooked ? (
                          <div style={{
                            background: "#fffbeb",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            textAlign: "center",
                            marginTop: "8px"
                          }}>
                            ⚠️ Fully Booked on Selected Date
                          </div>
                        ) : !doesSelectedService ? (
                          <button
                            type="button"
                            disabled
                            style={{
                              width: "100%",
                              padding: "8px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "#f1f5f9",
                              color: "#94a3b8",
                              fontSize: "0.82rem",
                              cursor: "not-allowed"
                            }}
                          >
                            Service Not Provided
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`stylist-select-btn ${isSelected ? "selected-btn" : ""}`}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedStylist(null);
                                showToast("Deselected stylist. Please select a specialist or Auto-Assign.");
                              } else {
                                setSelectedStylist(matchedEligible || stylist);
                                showToast(`Selected stylist: ${stylist.name}!`);
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
                <div>
                  <h3 className="booking-card-title">Book Appointment</h3>
                  <small style={{ color: "#6ee7b7", fontSize: "0.78rem" }}>{salon.name}</small>
                </div>
                <span className="booking-instant-badge">Instant Confirmation</span>
              </div>

              {/* STEP 1: Select Service */}
              <div className="booking-step-block step-block-active">
                <div className="step-accordion-header" style={{ cursor: "default" }}>
                  <div className="step-header-left">
                    <span className="step-num-badge badge-done">1</span>
                    <span className="step-title-text">Treatment / Service</span>
                  </div>
                  <div className="step-header-right">
                    {selectedServices[0] && (
                      <span className="step-summary-pill" title={selectedServices[0].name}>
                        {selectedServices[0].name}
                      </span>
                    )}
                  </div>
                </div>

                <div className="step-accordion-body" style={{ display: "block" }}>
                  {selectedServices.length === 0 ? (
                    <div className="empty-services-prompt" style={{ padding: "12px", border: "1px dashed #d1d5db", borderRadius: "8px" }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#b45309" }}>No service selected yet.</p>
                      <small style={{ fontSize: "0.75rem", color: "#6b7280" }}>Please choose a service from the menu on the left.</small>
                    </div>
                  ) : (
                    <div>
                      <div className="selected-service-row" style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "10px 12px", borderRadius: "8px" }}>
                        <div className="selected-service-info">
                          <strong className="selected-srv-name" style={{ color: "#166534" }}>{selectedServices[0].name}</strong>
                          <span className="selected-srv-dur" style={{ color: "#15803d", fontWeight: 600 }}>⏱ {selectedServices[0].duration}</span>
                        </div>
                        <div className="selected-service-price-wrap">
                          <span className="selected-srv-price" style={{ color: "#166534", fontWeight: 700 }}>₹{selectedServices[0].price.toLocaleString("en-IN")}</span>
                        </div>
                      </div>
                      {salon.services.length > 1 && (
                        <div style={{ marginTop: "8px" }}>
                          <label style={{ display: "block", fontSize: "0.72rem", color: "#64748b", marginBottom: "4px", fontWeight: 600 }}>
                            Switch Service:
                          </label>
                          <select
                            className="service-switcher-select"
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              fontSize: "0.82rem",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              background: "#ffffff",
                              color: "#334155"
                            }}
                            value={selectedServices[0]?.id || ""}
                            onChange={(e) => {
                              const found = salon.services.find((s) => String(s.id) === String(e.target.value));
                              if (found) {
                                setSelectedServices([found]);
                                showToast(`Selected "${found.name}" (${found.duration})`);
                              }
                            }}
                          >
                            {salon.services.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.duration}) — ₹{s.price}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Select Date */}
              <div className="booking-step-block step-block-active" style={{ marginTop: "12px" }}>
                <div className="step-accordion-header" style={{ cursor: "default" }}>
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
                  </div>
                </div>

                <div className="step-accordion-body" style={{ display: "block" }}>
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
                          <span style={{ fontSize: "9px", background: "#fef2f2", color: "#dc2626", borderRadius: "4px", padding: "1px 4px", marginTop: "2px", fontWeight: "700" }}>
                            CLOSED
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                  {dateSlots[selectedDateIdx]?.isOffDay && (
                    <div style={{
                      marginTop: "8px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "6px",
                      padding: "8px 12px",
                      fontSize: "0.82rem",
                      color: "#991b1b",
                      fontWeight: 600,
                    }}>
                      🔒 Salon is closed on this date ({dateSlots[selectedDateIdx]?.offDayReason || "Scheduled Closure"}). Please select another date.
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 3: Select Stylist */}
              <div className="booking-step-block step-block-active" style={{ marginTop: "12px" }}>
                <div className="step-accordion-header" style={{ cursor: "default" }}>
                  <div className="step-header-left">
                    <span className={`step-num-badge ${selectedStylist ? "badge-done" : "badge-active"}`}>
                      {selectedStylist ? "✓" : "3"}
                    </span>
                    <span className="step-title-text">Select Stylist</span>
                  </div>
                  <div className="step-header-right">
                    <span className="step-summary-pill" style={!selectedStylist ? { background: "#fef3c7", color: "#92400e", fontWeight: 700 } : {}}>
                      {selectedStylist === "auto"
                        ? "Auto-Assign"
                        : selectedStylist && typeof selectedStylist === "object"
                        ? selectedStylist.name
                        : "Select a Stylist"}
                    </span>
                  </div>
                </div>

                <div className="step-accordion-body" style={{ display: "block" }}>
                  {/* Selected Stylist Banner / Active Info */}
                  <div className="selected-stylist-banner" style={{ marginBottom: "8px" }}>
                    {selectedStylist && typeof selectedStylist === "object" ? (
                      <div className="stylist-assigned-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <img src={selectedStylist.image} alt={selectedStylist.name} className="assigned-avatar" />
                          <div className="assigned-text" style={{ flex: 1 }}>
                            <span className="assigned-name">{selectedStylist.name}</span>
                            <span className="assigned-role">{selectedStylist.role}</span>
                          </div>
                          <button
                            type="button"
                            className="change-stylist-link"
                            onClick={() => {
                              setSelectedStylist(null);
                              setSelectedTimeSlot("");
                              setSelectedSlotObj(null);
                            }}
                          >
                            Change
                          </button>
                        </div>

                        <div style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "0.76rem",
                          background: selectedStylist.has_advance_bookings ? "#eff6ff" : "#f0fdf4",
                          border: selectedStylist.has_advance_bookings ? "1px solid #bfdbfe" : "1px solid #bbf7d0",
                          color: selectedStylist.has_advance_bookings ? "#1e40af" : "#15803d",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap"
                        }}>
                          {selectedStylist.has_advance_bookings ? (
                            <>
                              <strong>📌 {selectedStylist.advance_bookings_count} Advance Booking{selectedStylist.advance_bookings_count > 1 ? "s" : ""} on date:</strong>
                              <span>Booked slots are automatically hidden below</span>
                            </>
                          ) : (
                            <span>✓ Fully available on this date — all slots open!</span>
                          )}
                        </div>
                      </div>
                    ) : selectedStylist === "auto" ? (
                      <div className="stylist-assigned-row" style={{ justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
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
                            setSelectedStylist(null);
                            setSelectedTimeSlot("");
                            setSelectedSlotObj(null);
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="stylist-assigned-row">
                        <div className="assigned-avatar-placeholder" style={{ background: "#fef3c7", color: "#b45309" }}>!</div>
                        <div className="assigned-text">
                          <span className="assigned-name" style={{ color: "#92400e" }}>No Stylist Selected</span>
                          <span className="assigned-role">Please choose a specialist below or select Auto-Assign</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Eligible Stylists Quick List */}
                  {eligibleWorkersLoading ? (
                    <div style={{ fontSize: "0.78rem", color: "#64748b", padding: "8px 0" }}>
                      Loading available stylists for this date…
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
                      {/* Auto-Assign Option */}
                      <button
                        type="button"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: selectedStylist === "auto" ? "2px solid #059669" : "1px solid #cbd5e1",
                          background: selectedStylist === "auto" ? "#ecfdf5" : "#ffffff",
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease"
                        }}
                        onClick={() => {
                          setSelectedStylist("auto");
                          setSelectedTimeSlot("");
                          setSelectedSlotObj(null);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: selectedStylist === "auto" ? "#059669" : "#334155" }}>
                            ✦ Auto-Assign (Any Available Specialist)
                          </span>
                        </div>
                        <span style={{
                          fontSize: "0.7rem",
                          color: selectedStylist === "auto" ? "#059669" : "#64748b",
                          fontWeight: 600,
                          background: selectedStylist === "auto" ? "#d1fae5" : "#f1f5f9",
                          padding: "2px 6px",
                          borderRadius: "4px"
                        }}>
                          {selectedStylist === "auto" ? "✓ Selected" : "Auto-Assign"}
                        </span>
                      </button>

                      {/* Workers List */}
                      {eligibleWorkers.map((st) => {
                        const isChosen = typeof selectedStylist === "object" && selectedStylist?.id === st.id;
                        const isUnavailable = st.is_on_leave || st.is_weekly_off || st.is_fully_booked || st.is_available === false;

                        return (
                          <div
                            key={st.id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: isChosen ? "2px solid #059669" : "1px solid #cbd5e1",
                              background: isChosen ? "#ecfdf5" : isUnavailable ? "#f8fafc" : "#ffffff",
                              cursor: isUnavailable ? "not-allowed" : "pointer",
                              opacity: isUnavailable ? 0.6 : 1,
                              transition: "all 0.15s ease"
                            }}
                            onClick={() => {
                              if (!isUnavailable) {
                                setSelectedStylist(st);
                                setSelectedTimeSlot("");
                                setSelectedSlotObj(null);
                              }
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <img src={st.image} alt={st.name} style={{ width: "28px", height: "28px", borderRadius: "50%", objectFit: "cover" }} />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1e293b" }}>{st.name}</div>
                                <div style={{ fontSize: "0.72rem", color: "#64748b" }}>{st.role}</div>
                              </div>
                            </div>

                            <div style={{ textAlign: "right" }}>
                              {isChosen ? (
                                <span style={{ background: "#059669", color: "#ffffff", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  ✓ Selected
                                </span>
                              ) : st.is_on_leave ? (
                                <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  On Leave
                                </span>
                              ) : st.is_weekly_off ? (
                                <span style={{ background: "#fee2e2", color: "#dc2626", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  Weekly Off
                                </span>
                              ) : st.is_fully_booked ? (
                                <span style={{ background: "#fef3c7", color: "#b45309", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                                  Fully Booked
                                </span>
                              ) : st.has_advance_bookings ? (
                                <span style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                                  📌 {st.advance_bookings_count} Booked
                                </span>
                              ) : (
                                <span style={{ background: "#dcfce7", color: "#15803d", fontSize: "0.68rem", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
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
              </div>

              {/* STEP 4: Available Time Slots */}
              <div className="booking-step-block step-block-active" style={{ marginTop: "12px" }}>
                <div className="step-accordion-header" style={{ cursor: "default" }}>
                  <div className="step-header-left">
                    <span className={`step-num-badge ${selectedTimeSlot ? "badge-done" : "badge-active"}`}>
                      {selectedTimeSlot ? "✓" : "4"}
                    </span>
                    <span className="step-title-text">Available Time Slots</span>
                  </div>
                  <div className="step-header-right">
                    {selectedTimeSlot && (
                      <span className="step-summary-pill" style={{ background: "#d1fae5", color: "#065f46", fontWeight: 700 }}>
                        🕒 {selectedTimeSlot}
                      </span>
                    )}
                  </div>
                </div>

                <div className="step-accordion-body" style={{ display: "block" }}>
                  {!selectedStylist ? (
                    <div style={{
                      background: "#f8fafc",
                      border: "1px dashed #cbd5e1",
                      borderRadius: "8px",
                      padding: "16px",
                      textAlign: "center",
                      color: "#64748b"
                    }}>
                      <div style={{ fontSize: "1.3rem", marginBottom: "4px" }}>✂️</div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e293b", marginBottom: "4px" }}>
                        Select a Stylist to View Available Slots
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Choose a specialist from the list above or select Auto-Assign to view real-time available time slots.
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: "0.74rem", color: "#64748b", marginBottom: "8px" }}>
                        Showing slots for: <strong style={{ color: "#047857" }}>{selectedStylist === "auto" ? "Any Available Specialist (Auto-Assign)" : selectedStylist.name}</strong>
                      </div>

                      {dateSlots[selectedDateIdx]?.isOffDay ? (
                        <div style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "14px",
                          textAlign: "center",
                          color: "#991b1b"
                        }}>
                          <div style={{ fontWeight: "700", marginBottom: "4px", fontSize: "0.9rem" }}>
                            🔒 Salon Closed on this Date
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "#b91c1c" }}>
                            {dateSlots[selectedDateIdx]?.offDayReason || "Salon is closed on this date"}. Please select another date.
                          </div>
                        </div>
                      ) : slotClosedReason ? (
                        <div style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "8px",
                          padding: "14px",
                          textAlign: "center",
                          color: "#991b1b",
                          fontSize: "0.85rem",
                          fontWeight: 600,
                        }}>
                          🔒 Salon Closed: {slotClosedReason}
                        </div>
                      ) : slotWorkerUnavailableReason ? (
                        <div style={{
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: "8px",
                          padding: "14px",
                          textAlign: "center",
                          color: "#92400e",
                          fontSize: "0.85rem"
                        }}>
                          <div style={{ fontWeight: 600, marginBottom: "4px" }}>⚠️ Specialist Unavailable</div>
                          <div>{slotWorkerUnavailableReason}</div>
                          <button
                            type="button"
                            style={{
                              marginTop: "8px",
                              background: "#d97706",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "4px",
                              padding: "4px 10px",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                              fontWeight: 600
                            }}
                            onClick={() => setSelectedStylist("auto")}
                          >
                            Switch to Auto-Assign
                          </button>
                        </div>
                      ) : slotsLoading ? (
                        <div style={{ padding: "16px", textAlign: "center", color: "#6b7280", fontSize: "0.85rem" }}>
                          Loading available slots…
                        </div>
                      ) : dynamicSlots.length === 0 ? (
                        <div style={{
                          background: "#fffbeb",
                          border: "1px solid #fde68a",
                          borderRadius: "8px",
                          padding: "14px",
                          textAlign: "center",
                          color: "#92400e",
                          fontSize: "0.85rem"
                        }}>
                          No time slots available for this stylist on this date.
                          {selectedStylist !== "auto" && (
                            <div style={{ marginTop: "8px" }}>
                              <button
                                type="button"
                                style={{
                                  background: "#059669",
                                  color: "#ffffff",
                                  border: "none",
                                  borderRadius: "4px",
                                  padding: "4px 10px",
                                  fontSize: "0.75rem",
                                  cursor: "pointer",
                                  fontWeight: 600
                                }}
                                onClick={() => setSelectedStylist("auto")}
                              >
                                Try Auto-Assign
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="time-slots-grid">
                          {dynamicSlots.map((s) => {
                            const isSelected = selectedSlotObj?.time === s.time || selectedTimeSlot === s.time_display;
                            return (
                              <button
                                key={s.time}
                                type="button"
                                disabled={!s.available}
                                title={!s.available ? (s.reason ? `Unavailable (${s.reason})` : "Slot unavailable") : `${s.time_display} - ${s.end_time_display}`}
                                className={`time-slot-btn ${isSelected ? "time-active" : ""} ${!s.available ? "time-slot-disabled" : ""}`}
                                style={!s.available ? { opacity: 0.55, cursor: "not-allowed" } : {}}
                                onClick={() => {
                                  if (s.available) {
                                    setSelectedSlotObj(s);
                                    setSelectedTimeSlot(s.time_display || s.time);
                                  }
                                }}
                              >
                                <span>{s.time_display}</span>
                                {!s.available && (
                                  <span style={{ fontSize: "0.68rem", opacity: 0.85, fontWeight: 500, display: "block" }}>
                                    - Unavailable{s.reason === "Break" ? " (Break)" : ""}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* STEP 5: Pricing Breakdown */}
              <div className="bill-breakdown-card" style={{ marginTop: "12px" }}>
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

              {/* STEP 6: Primary Action CTA */}
              <button
                type="button"
                className="proceed-booking-cta"
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
                  setShowBookingModal(true);
                }}
              >
                <span>
                  {dateSlots[selectedDateIdx]?.isOffDay
                    ? "Salon Closed on Selected Date"
                    : slotClosedReason
                    ? "Salon Closed"
                    : slotWorkerUnavailableReason
                    ? "Specialist Unavailable"
                    : !selectedStylist
                    ? "Select a Stylist"
                    : slotsLoading
                    ? "Loading Slots…"
                    : !selectedTimeSlot
                    ? "Select a Time Slot"
                    : "Confirm Booking"}
                </span>
                {!dateSlots[selectedDateIdx]?.isOffDay && !slotClosedReason && !slotWorkerUnavailableReason && selectedStylist && !slotsLoading && selectedTimeSlot && (
                  <span className="cta-arrow">→</span>
                )}
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

      {/* MODAL 2: Appointment Confirmation Modal (Direct DB Booking) */}
      {showBookingModal && (
        <div className="booking-modal-backdrop" onClick={() => !bookingSuccess && !isSubmittingBooking && setShowBookingModal(false)}>
          <div className="booking-modal-dialog" onClick={(e) => e.stopPropagation()}>
            {!bookingSuccess ? (
              <>
                <div className="booking-modal-header">
                  <div className="modal-title-wrap">
                    <h3>Confirm Your Appointment</h3>
                    <p>{salon.name} • {salon.city}</p>
                  </div>
                  <button className="modal-close-btn" disabled={isSubmittingBooking} onClick={() => setShowBookingModal(false)}>✕</button>
                </div>

                <div className="booking-modal-body" style={{ maxHeight: "75vh", overflowY: "auto" }}>
                  {/* Recap */}
                  <div className="booking-summary-recap">
                    <div className="recap-item">
                      <span className="recap-label">📅 Date & Time</span>
                      <strong className="recap-val">
                        {dateSlots[selectedDateIdx]?.fullDateStr} at {selectedTimeSlot}
                        {selectedSlotObj?.end_time_display ? ` → ${selectedSlotObj.end_time_display}` : ""}
                      </strong>
                    </div>

                    <div className="recap-item">
                      <span className="recap-label">👤 Stylist</span>
                      <strong className="recap-val">{selectedStylist ? selectedStylist.name : "Any Available Worker"}</strong>
                    </div>

                    <div className="recap-item">
                      <span className="recap-label">✂ Selected Service</span>
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

                  {/* Customer Input Fields */}
                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <h4 style={{ margin: "0 0 4px 0", fontSize: "0.95rem", color: "#1e293b", fontWeight: 700 }}>
                      Your Contact Details
                    </h4>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                        Full Name <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rahul Sharma"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.85rem"
                        }}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={clientPhone}
                          onChange={(e) => setClientPhone(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Email Address
                        </label>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.85rem"
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                        Special Notes / Requests (optional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Any preferences or allergy details…"
                        value={bookingNotes}
                        onChange={(e) => setBookingNotes(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.85rem",
                          resize: "vertical"
                        }}
                      />
                    </div>

                    {bookingError && (
                      <div style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#991b1b",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        fontSize: "0.82rem",
                        fontWeight: 600
                      }}>
                        ⚠️ {bookingError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="booking-modal-footer">
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    disabled={isSubmittingBooking}
                    onClick={() => setShowBookingModal(false)}
                  >
                    Back to Edit
                  </button>
                  <button
                    type="button"
                    className="modal-confirm-btn"
                    disabled={isSubmittingBooking}
                    onClick={handleConfirmBookingSubmit}
                  >
                    {isSubmittingBooking ? "Reserving Slot…" : "Confirm & Reserve Slot"}
                  </button>
                </div>
              </>
            ) : (
              <div className="booking-success-box">
                <div className="success-checkmark-circle">✓</div>
                <h3>Appointment Confirmed!</h3>
                <p>
                  Your reservation at <strong>{salon.name}</strong> for{" "}
                  <strong>{dateSlots[selectedDateIdx]?.fullDateStr} at {selectedTimeSlot}</strong> has been successfully booked in our system.
                </p>
                <div className="success-booking-ref">
                  Booking Reference: <strong>BMS-{confirmedBookingData?.id || Math.floor(100000 + Math.random() * 900000)}</strong>
                </div>
                {confirmedBookingData?.worker_name && (
                  <div style={{ fontSize: "0.85rem", color: "#047857", fontWeight: 600 }}>
                    Assigned Specialist: {confirmedBookingData.worker_name}
                  </div>
                )}
                <div className="success-modal-actions" style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <button
                    type="button"
                    className="success-home-btn"
                    onClick={() => {
                      setShowBookingModal(false);
                      setBookingSuccess(false);
                      navigate("/customer/my-bookings");
                    }}
                  >
                    View My Bookings
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

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/booking.css";

/* ─── helpers ─────────────────────────────────────────────────── */
function fmt12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatDateDisplay(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

function formatFullDateDisplay(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

function formatConfirmedDate(isoStr) {
  if (!isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoStr;
  }
}

function getCancellationNotice(bookingDate, startTimeStr) {
  if (!bookingDate || !startTimeStr) return "up to 2 hours prior to start";
  try {
    const [h, m] = startTimeStr.split(":").map(Number);
    const d = new Date(bookingDate);
    d.setHours(h - 2, m, 0, 0);
    const timeStr = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `until ${timeStr} on ${dateStr} (up to 2 hours prior to start)`;
  } catch {
    return "up to 2 hours prior to start";
  }
}

function getGoogleCalendarUrl(booking, currentSalon) {
  if (!booking) return "#";
  const dateClean = (booking.booking_date || "").replace(/-/g, "");
  const startTimeClean = (booking.start_time || "10:00:00").replace(/:/g, "").slice(0, 4);
  const endTimeClean = (booking.end_time || "11:00:00").replace(/:/g, "").slice(0, 4);
  const dates = `${dateClean}T${startTimeClean}00/${dateClean}T${endTimeClean}00`;
  const title = encodeURIComponent(`Appointment at ${currentSalon?.name || "BookMySalon"}`);
  const details = encodeURIComponent(
    `Service: ${booking.service_display_name || booking.service_name || "Salon Treatment"}\nSpecialist: ${booking.worker_name || "Assigned Specialist"}\nBooking Ref: #SAL${booking.id}`
  );
  const location = encodeURIComponent(
    `${currentSalon?.name || ""}, ${currentSalon?.landmark ? currentSalon.landmark + ", " : ""}${currentSalon?.address || ""}, ${currentSalon?.city || ""}`
  );
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

function buildNextDays(n = 30) {
  const days = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    days.push({
      iso: `${yyyy}-${mm}-${dd}`,
      label:
        i === 0
          ? "Today"
          : i === 1
          ? "Tomorrow"
          : d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }),
      dayShort: d.toLocaleDateString("en-IN", { weekday: "short" }),
      dateNum: dd,
      monthShort: d.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return days;
}

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BookingPage() {
  const { id: salonId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  /* meta */
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);

  /* booking data */
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [offDays, setOffDays] = useState([]); // [{date, reason}]
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [closedInfo, setClosedInfo] = useState(null);
  const [workerUnavailableInfo, setWorkerUnavailableInfo] = useState(null);

  /* selections (Step 4 is Review Your Booking, Step 5 is Success Receipt) */
  const [step, setStep] = useState(4);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null); // worker id, "any", or null
  const [selectedSlot, setSelectedSlot] = useState(null);

  const selectedService = selectedServices[0] || null;

  /* customer info */
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [notes, setNotes] = useState("");

  /* voucher / discounts */
  const [voucherCode, setVoucherCode] = useState(searchParams.get("coupon") || "SUMMERGLOW");
  const [appliedVoucher, setAppliedVoucher] = useState({ code: "SUMMERGLOW", discount: 50 });

  /* payment modal & options */
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("ONLINE"); // "PAY_AT_SALON" or "ONLINE"
  const [onlineTab, setOnlineTab] = useState("upi"); // "upi", "cards", "netbanking"
  const [isTokenOnly, setIsTokenOnly] = useState(false);
  const [upiIdInput, setUpiIdInput] = useState("");
  const [isVpaVerified, setIsVpaVerified] = useState(false);

  /* submit & results */
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [copiedBookingId, setCopiedBookingId] = useState(false);
  const [error, setError] = useState("");

  const days = buildNextDays(30);

  /* ── Multi-Service Duration & Financial Calculations ─── */
  const totalDurationMinutes = useMemo(() => {
    return selectedServices.reduce((sum, s) => {
      let mins = 45;
      if (typeof s.duration === "number") mins = s.duration;
      else if (typeof s.duration === "string") {
        const m = s.duration.match(/\d+/);
        if (m) mins = parseInt(m[0], 10);
      }
      return sum + mins;
    }, 0);
  }, [selectedServices]);

  const serviceSubtotal = useMemo(() => {
    return selectedServices.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
  }, [selectedServices]);

  const taxAmount = useMemo(() => {
    return Math.round(serviceSubtotal * 0.05); // 5% GST & Hygiene Safety
  }, [serviceSubtotal]);

  const discountAmount = useMemo(() => {
    if (!appliedVoucher || !serviceSubtotal) return 0;
    if (appliedVoucher.discountRate) {
      return Math.round(serviceSubtotal * appliedVoucher.discountRate);
    }
    if (appliedVoucher.discount) {
      return Math.min(serviceSubtotal, appliedVoucher.discount);
    }
    return 0;
  }, [appliedVoucher, serviceSubtotal]);

  const totalPayable = useMemo(() => {
    return Math.max(0, serviceSubtotal + taxAmount - discountAmount);
  }, [serviceSubtotal, taxAmount, discountAmount]);

  const payableNowAmount = useMemo(() => {
    if (isTokenOnly && paymentMethod === "ONLINE") {
      return Math.min(100, totalPayable);
    }
    return totalPayable;
  }, [isTokenOnly, paymentMethod, totalPayable]);

  function handleToggleService(svc) {
    setSelectedServices((prev) => {
      const exists = prev.some((s) => s.id === svc.id);
      if (exists) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((s) => s.id !== svc.id);
      } else {
        return [...prev, svc];
      }
    });
  }

  /* ── Load salon + services + off-days ─── */
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const [salonRes, servicesRes, offDaysRes] = await Promise.all([
          api.get(`/salons/${salonId}/`),
          api.get(`/bookings/salons/${salonId}/services/`),
          api.get(`/bookings/salons/${salonId}/off-days/`),
        ]);
        setSalon(salonRes.data);
        const svcList = servicesRes.data.services || [];
        setServices(svcList);
        setOffDays(offDaysRes.data.off_days || []);

        const preServiceIds = searchParams.get("service_ids");
        const preServiceId = searchParams.get("service_id");

        let initialSelected = [];
        if (preServiceIds) {
          const ids = preServiceIds.split(",").map((x) => x.trim());
          initialSelected = svcList.filter((s) => ids.includes(String(s.id)));
        } else if (preServiceId) {
          const found = svcList.find((s) => String(s.id) === String(preServiceId));
          if (found) initialSelected = [found];
        }

        if (initialSelected.length > 0) {
          setSelectedServices(initialSelected);
        } else if (svcList.length > 0) {
          setSelectedServices([svcList[0]]);
        }

        const preDate = searchParams.get("date");
        if (preDate) {
          setSelectedDate(preDate);
        }

        const preWorkerId = searchParams.get("worker_id");
        if (preWorkerId) {
          if (preWorkerId === "auto" || preWorkerId === "any") {
            setSelectedWorker("any");
          } else {
            setSelectedWorker(String(preWorkerId));
          }
        }

        const preTime = searchParams.get("time");
        if (preTime) {
          const normTime = preTime.trim();
          setSelectedSlot({
            time: normTime,
            time_display: fmt12(normTime) || normTime,
            available: true,
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [salonId, searchParams]);

  /* ── Load eligible workers when services + date selected ─── */
  useEffect(() => {
    if (selectedServices.length === 0 || !selectedDate) return;
    const params = {
      service_id: selectedServices[0]?.id,
      service_ids: selectedServices.map((s) => s.id).join(","),
      date: selectedDate,
    };

    api
      .get(`/bookings/salons/${salonId}/workers/`, { params })
      .then((r) => setWorkers(r.data.workers || []))
      .catch(console.error);
  }, [selectedServices, selectedDate, salonId]);

  /* ── Load slots when worker (or any) + date + services selected ─── */
  const fetchSlots = useCallback(async () => {
    if (selectedServices.length === 0 || !selectedDate || !selectedWorker) return;
    setSlotsLoading(true);
    setClosedInfo(null);
    setWorkerUnavailableInfo(null);
    try {
      const params = {
        salon_id: salonId,
        service_id: selectedServices[0]?.id,
        service_ids: selectedServices.map((s) => s.id).join(","),
        date: selectedDate,
      };
      if (selectedWorker && selectedWorker !== "any" && selectedWorker !== "auto") {
        params.worker_id = selectedWorker;
      }
      const r = await api.get("/bookings/slots/", { params });
      if (r.data.closed) {
        setClosedInfo({ reason: r.data.reason || "Salon is closed on this date." });
      } else if (r.data.worker_unavailable) {
        setWorkerUnavailableInfo({ reason: r.data.reason || "Specialist is unavailable on this date." });
      } else {
        const loadedSlots = r.data.slots || [];
        setSlots(loadedSlots);

        // Pre-select or enrich time slot if provided via URL
        const preTime = searchParams.get("time");
        if (preTime) {
          const norm = preTime.trim().toLowerCase();
          const found = loadedSlots.find(
            (s) =>
              s.time.toLowerCase() === norm ||
              s.time_display?.toLowerCase() === norm ||
              fmt12(s.time).toLowerCase() === norm
          );
          if (found) {
            setSelectedSlot(found);
          }
        }
      }
    } catch (e) {
      console.error("Error loading slots:", e);
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedServices, selectedDate, selectedWorker, salonId, searchParams]);

  useEffect(() => {
    if (selectedDate && selectedWorker) {
      fetchSlots();
    }
  }, [selectedDate, selectedWorker, fetchSlots]);

  /* ── Prefill user info if logged in ─── */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.first_name || stored.last_name) {
        setClientName(`${stored.first_name || ""} ${stored.last_name || ""}`.trim());
      }
      if (stored.email) setClientEmail(stored.email);
      if (stored.phone) setClientPhone(stored.phone);
    } catch {}
  }, []);

  /* ── Helpers ─── */
  function isOffDay(iso) {
    return offDays.some((o) => o.date === iso);
  }
  function offDayReason(iso) {
    return offDays.find((o) => o.date === iso)?.reason || "Salon Closed";
  }

  const selectedWorkerObj = useMemo(() => {
    if (!selectedWorker || selectedWorker === "any") return null;
    return workers.find((x) => String(x.id) === String(selectedWorker)) || null;
  }, [selectedWorker, workers]);

  function workerLabel() {
    if (!selectedWorker) return "None selected";
    if (selectedWorker === "any" || selectedWorker === "auto") {
      if (selectedSlot?.assigned_worker?.name) {
        return `Auto-Assign: ${selectedSlot.assigned_worker.name}`;
      }
      return "Auto-Assign (Any Available Specialist)";
    }
    return selectedWorkerObj ? selectedWorkerObj.name : "Specialist";
  }

  function handleApplyVoucher() {
    const code = voucherCode.trim().toUpperCase();
    if (!code) {
      setAppliedVoucher(null);
      return;
    }
    if (code === "SUMMERGLOW") {
      setAppliedVoucher({ code: "SUMMERGLOW", discount: 50 });
    } else if (code === "FIRSTSPA") {
      setAppliedVoucher({ code: "FIRSTSPA", discount: 200 });
    } else if (code === "LUXE20") {
      const rateDiscount = Math.round(serviceSubtotal * 0.2);
      setAppliedVoucher({ code: "LUXE20", discountRate: 0.2, discount: rateDiscount });
    } else if (code === "WELCOME50") {
      setAppliedVoucher({ code: "WELCOME50", discount: 50 });
    } else if (code === "FLAT100") {
      setAppliedVoucher({ code: "FLAT100", discount: 100 });
    } else {
      setAppliedVoucher({ code, discount: 50 });
    }
  }

  /* ── Open Payment Modal after reviewing booking ─── */
  function handleProceedToPaymentModal() {
    if (!clientName.trim()) {
      setError("Please enter your name in the contact details section.");
      return;
    }
    setError("");
    setShowPaymentModal(true);
  }

  /* ── Final Booking Confirmation inside Payment Modal ─── */
  async function handleFinalBookingSubmit() {
    if (selectedServices.length === 0) {
      setError("Please select at least one service.");
      return;
    }
    if (!clientName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setError("");
    setSubmitting(true);

    const payload = {
      salon_id: Number(salonId),
      service_id: selectedServices[0].id,
      service_ids: selectedServices.map((s) => s.id),
      booking_date: selectedDate,
      start_time: selectedSlot.time,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      client_email: clientEmail.trim(),
      notes: notes.trim(),
      payment_method: paymentMethod,
      is_token_only: Boolean(isTokenOnly && paymentMethod === "ONLINE"),
      payment_type: (isTokenOnly && paymentMethod === "ONLINE") ? "ADVANCE" : "FULL",
      voucher_code: appliedVoucher?.code || "",
    };
    if (selectedWorker && selectedWorker !== "any" && selectedWorker !== "auto") {
      payload.worker_id = Number(selectedWorker);
    } else if (selectedSlot?.assigned_worker?.id) {
      payload.worker_id = Number(selectedSlot.assigned_worker.id);
    }

    // 1. PAY AT SALON
    if (paymentMethod === "PAY_AT_SALON") {
      try {
        const r = await api.post("/bookings/create/", payload);
        setBookingResult(r.data.booking);
        setShowPaymentModal(false);
        setStep(5); // confirmed receipt screen
      } catch (e) {
        const detail =
          e?.response?.data?.error ||
          e?.response?.data?.detail ||
          "Booking failed. The slot may have just been taken. Please choose another slot.";
        setError(detail);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // 2. ONLINE PAYMENT (Razorpay)
    try {
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded && !window.Razorpay) {
        throw new Error("Unable to load Razorpay checkout SDK. Please choose Pay at Salon or check your connection.");
      }

      // Create Razorpay Order & reserve slot
      const orderRes = await api.post("/bookings/create-razorpay-order/", payload);
      const orderData = orderRes.data;

      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: orderData.salon_name || salon?.name || "BookMySalon",
        description: `${orderData.service_name} Appointment`,
        order_id: orderData.razorpay_order_id,
        prefill: {
          name: orderData.client_name,
          email: orderData.client_email,
          contact: orderData.client_phone,
        },
        theme: {
          color: "#1b4332",
        },
        handler: async function (response) {
          try {
            setSubmitting(true);
            const verifyPayload = {
              ...payload,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            };
            const endpoint = (orderData.booking_id && orderData.booking_id !== 0)
              ? `/bookings/${orderData.booking_id}/verify-razorpay/`
              : `/bookings/verify-razorpay/`;
            const verifyRes = await api.post(endpoint, verifyPayload);
            setBookingResult(verifyRes.data.booking);
            setShowPaymentModal(false);
            setStep(5); // confirmed receipt screen
          } catch (verErr) {
            setError(
              verErr?.response?.data?.error ||
                "Payment was successful, but booking confirmation failed. Please contact support with payment ID " +
                  response.razorpay_payment_id
            );
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: function () {
            setSubmitting(false);
            setError("Online payment was cancelled or closed. You can retry with Razorpay or select Pay at Salon.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        setSubmitting(false);
        setError(
          `Payment failed: ${response.error?.description || "Transaction was declined."}. You can retry with Razorpay or select Pay at Salon.`
        );
      });
      rzp.open();
    } catch (e) {
      const detail =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        e?.message ||
        "Could not initiate online payment. Please try again.";
      setError(detail);
      setSubmitting(false);
    }
  }

  /* ──────────────────────────────────────────── render ── */
  if (loading) {
    return (
      <div className="bk-page">
        <CustomerHeader />
        <div className="bk-loading">
          <div className="bk-spinner" />
          <p>Loading salon details…</p>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  /* ── STEP 5: Success Receipt Screen ─── */
  if (step === 5 && bookingResult) {
    const bookingIdCode = `#SAL${bookingResult.id}`;
    const salonName = salon?.name || bookingResult.salon_name || "Exclusive Salon";
    const salonRating = salon?.rating || "4.9";
    const salonReviews = salon?.reviews_count || salon?.reviewsCount || "128";
    const salonAddress = [salon?.landmark, salon?.address, salon?.city].filter(Boolean).join(", ") || "100 ft Road, Indiranagar, Bengaluru";
    
    // Service name & details
    const serviceTitle = bookingResult.service_display_name || bookingResult.service_name || selectedServices[0]?.name || "Classic Haircut & Styling";
    const durationMins = totalDurationMinutes || bookingResult.duration_minutes || (selectedServices[0]?.duration ? parseInt(selectedServices[0].duration, 10) : 30) || 30;
    const serviceCategory = selectedServices[0]?.category || "Styling & Botanical Scalp Wash";
    const serviceSubDesc = `${durationMins} mins • ${serviceCategory}`;

    // Dedicated Specialist
    const matchedWorker = (workers || []).find((w) => String(w.id) === String(bookingResult.worker || selectedWorker));
    const workerName = bookingResult.worker_name || matchedWorker?.name || selectedSlot?.assigned_worker?.name || "Rahul Kumar";
    const workerRole = matchedWorker?.specialization || "Master Hair Specialist";
    const workerRating = matchedWorker?.rating || "4.98";
    const workerAvatar = bookingResult.worker_photo
      ? resolveImageUrl(bookingResult.worker_photo)
      : (matchedWorker?.profile_photo
          ? resolveImageUrl(matchedWorker.profile_photo)
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(workerName)}&background=047857&color=ffffff&size=100`);

    // Date & Time
    const dateFormatted = formatConfirmedDate(bookingResult.booking_date);
    const timeFormatted = `${fmt12(bookingResult.start_time)} IST`;

    // Payment calculations & breakdown
    const totalAmount = Number(bookingResult.total_amount != null ? bookingResult.total_amount : bookingResult.service_price || 0);
    const advancePaid = Number(bookingResult.advance_amount || (isTokenOnly ? 100 : totalAmount));
    const isAdvanceOnly = Boolean(bookingResult.is_advance_paid && !bookingResult.is_fully_paid);
    const remainingAmount = Number(bookingResult.remaining_amount || Math.max(0, totalAmount - advancePaid));

    const paymentValText = bookingResult.payment_method === "ONLINE"
      ? (isAdvanceOnly ? `Paid Advance: ₹${advancePaid.toLocaleString("en-IN")}` : `Paid Online: ₹${totalAmount.toLocaleString("en-IN")}`)
      : `Pay at Salon: ₹${totalAmount.toLocaleString("en-IN")}`;

    const paymentSubText = bookingResult.payment_method === "ONLINE"
      ? (isAdvanceOnly ? `Advance Paid • ₹${remainingAmount.toLocaleString("en-IN")} at salon` : "Total Paid in Full")
      : "Pay at counter after service";

    // Salon cover photo & map
    const salonCover = resolveImageUrl(salon?.cover_image || salon?.images?.[0]) || "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";
    const branchName = salon?.landmark || `${salon?.city || "Indiranagar"} Branch`;
    const branchAddressSnippet = salon?.address || "100ft Road, Indiranagar";
    const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(`${salonName} ${salonAddress}`)}`;
    const googleCalUrl = getGoogleCalendarUrl(bookingResult, salon);

    // Support phone & links
    const supportPhone = salon?.phone || "+91 80 1234 5678";
    const cleanPhone = supportPhone.replace(/[^\d]/g, "");
    const waUrl = `https://wa.me/${cleanPhone || "918012345678"}?text=${encodeURIComponent(`Hello, I have an appointment with ${salonName} (Booking ID: ${bookingIdCode}).`)}`;

    const cancellationDeadlineText = getCancellationNotice(bookingResult.booking_date, bookingResult.start_time);

    return (
      <div className="bk-page">
        <CustomerHeader />
        <main className="bk-success-wrap">
          <div className="bk-confirm-container">
            {/* Top Stepper Breadcrumb */}
            <div className="bk-confirm-breadcrumbs">
              Service Selection • Summary • Payment • Confirmed
              Service Selection • Summary • Payment • <span className="bk-confirm-breadcrumb-active">Confirmed</span>
            </div>

            {/* Checkmark Circle Icon */}
            <div className="bk-confirm-check-outer" aria-hidden="true">
              <div className="bk-confirm-check-inner">✓</div>
            </div>

            {/* Main Headline */}
            <h1 className="bk-confirm-title">
              Booking Confirmed!
              <span className="bk-confirm-title-check">✓</span> Booking Confirmed!
            </h1>

            {/* Subtitle */}
            <p className="bk-confirm-sub">
              Your appointment is locked in with <strong>{salonName}</strong>. Confirmation sent via SMS & WhatsApp.
            </p>

            {/* Copyable Booking ID Pill */}
            <button
              type="button"
              className={`bk-confirm-id-pill ${copiedBookingId ? "copied" : ""}`}
              onClick={() => {
                if (navigator?.clipboard?.writeText) {
                  navigator.clipboard.writeText(bookingIdCode).then(() => {
                    setCopiedBookingId(true);
                    setTimeout(() => setCopiedBookingId(false), 2200);
                  });
                }
              }}
              title="Click to copy booking ID"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Booking ID: <strong>{bookingIdCode}</strong> ({copiedBookingId ? "Copied! ✓" : "Tap to copy"})</span>
            </button>

            {/* Main Two-Column Card */}
            <div className="bk-confirm-card">
              {/* Left Sub-Column */}
              <div className="bk-confirm-left">
                <div>
                  <div className="bk-confirm-card-toprow">
                    <span className="bk-confirm-tag-confirmed">CONFIRMED APPOINTMENT</span>
                    <span className="bk-confirm-tag-rating">★ {salonRating} ({salonReviews})</span>
                  </div>

                  <h2 className="bk-confirm-salon-name">{salonName}</h2>
                  <p className="bk-confirm-salon-addr">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{salonAddress}</span>
                  </p>
                </div>

                {/* Reserved Service & Dedicated Specialist Grid */}
                <div className="bk-confirm-features-grid">
                  <div className="bk-confirm-feature-item">
                    <div className="bk-confirm-feature-icon-box" aria-hidden="true">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <line x1="20" y1="4" x2="8.12" y2="15.88" />
                        <line x1="14.47" y1="14.48" x2="20" y2="20" />
                        <line x1="8.12" y1="8.12" x2="12" y2="12" />
                      </svg>
                    </div>
                    <div className="bk-confirm-feature-info">
                      <span className="bk-confirm-feature-label">RESERVED SERVICE</span>
                      <strong className="bk-confirm-feature-title" title={serviceTitle}>{serviceTitle}</strong>
                      <span className="bk-confirm-feature-sub">{serviceSubDesc}</span>
                    </div>
                  </div>

                  <div className="bk-confirm-feature-item">
                    <img
                      src={workerAvatar}
                      alt={workerName}
                      className="bk-confirm-worker-avatar"
                      onError={(e) => {
                        e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(workerName)}&background=047857&color=ffffff&size=100`;
                      }}
                    />
                    <div className="bk-confirm-feature-info">
                      <span className="bk-confirm-feature-label">DEDICATED SPECIALIST</span>
                      <strong className="bk-confirm-feature-title">{workerName}</strong>
                      <span className="bk-confirm-feature-sub">{workerRole} • ★ {workerRating}</span>
                    </div>
                  </div>
                </div>

                {/* Date & Time + Payment Status */}
                <div className="bk-confirm-boxes-grid">
                  <div className="bk-confirm-box">
                    <div className="bk-confirm-box-icon" aria-hidden="true">
                      📅
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div className="bk-confirm-box-content">
                      <span className="bk-confirm-box-label">Date & Time</span>
                      <span className="bk-confirm-box-val">{dateFormatted}</span>
                      <span className="bk-confirm-box-sub">{timeFormatted}</span>
                    </div>
                  </div>

                  <div className="bk-confirm-box">
                    <div className="bk-confirm-box-icon" aria-hidden="true">
                      💳
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 11 12 14 22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                    </div>
                    <div className="bk-confirm-box-content">
                      <span className="bk-confirm-box-label">Payment Status</span>
                      <span className="bk-confirm-box-val">{paymentValText}</span>
                      <span className="bk-confirm-box-sub">{paymentSubText}</span>
                    </div>
                  </div>
                </div>

                {/* GST Tax Invoice Line */}
                <div className="bk-confirm-invoice-row">
                  <div className="bk-confirm-invoice-left">
                    <span>🧾</span>
                    <span>Official GST Tax Invoice #{String(bookingResult.id || 1042).padStart(6, "0")}</span>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>Official GST Tax Invoice #INV-{String(bookingResult.id || 889312).padStart(6, "0")}</span>
                  </div>
                  <button
                    type="button"
                    className="bk-confirm-invoice-link"
                    onClick={() => window.print()}
                    title="Print or save PDF receipt"
                  >
                    Download PDF ↗
                  </button>
                </div>
              </div>

              {/* Right Sub-Column */}
              <div className="bk-confirm-right">
                {/* Salon Photo Card with Map Pill */}
                <div className="bk-confirm-photo-card">
                  <img
                    src={salonCover}
                    alt={salonName}
                    className="bk-confirm-photo-img"
                    onError={(e) => {
                      e.currentTarget.src = "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=80";
                    }}
                  />
                  <div className="bk-confirm-photo-overlay">
                    <div className="bk-confirm-photo-text">
                      <span className="bk-confirm-photo-branch">{branchName}</span>
                      <span className="bk-confirm-photo-snippet">{branchAddressSnippet}</span>
                    </div>
                    <a
                      href={mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="bk-confirm-photo-mapbtn"
                      title="Open in Google Maps"
                    >
                      <span>↗ Map</span>
                    </a>
                  </div>
                </div>

                {/* Action Buttons Stack */}
                <div className="bk-confirm-actions-stack">
                  <button
                    type="button"
                    className="bk-confirm-btn-primary"
                    onClick={() => navigate("/customer/my-bookings")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span>View Booking</span>
                  </button>

                  <a
                    href={mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bk-confirm-btn-secondary"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    <span>Get Directions</span>
                  </a>

                  <a
                    href={googleCalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="bk-confirm-btn-secondary"
                    title="Add appointment to Google Calendar"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>Add to Calendar (Google / Apple)</span>
                  </a>
                </div>

                {/* Need Assistance Row */}
                <div className="bk-confirm-help-row">
                  <div className="bk-confirm-help-left">
                    <span className="bk-confirm-help-label">Need assistance?</span>
                    <a href={`tel:${cleanPhone}`} className="bk-confirm-help-phone">{supportPhone}</a>
                  </div>
                  <div className="bk-confirm-help-btns">
                    <a href={`tel:${cleanPhone}`} className="bk-confirm-help-iconbtn" title="Call Salon Helpline">
                      📞
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </a>
                    <a href={waUrl} target="_blank" rel="noreferrer" className="bk-confirm-help-iconbtn" title="Chat on WhatsApp">
                      💬
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom 3 Highlights Grid */}
            <div className="bk-confirm-highlights-grid">
              <div className="bk-confirm-highlight-card">
                <div className="bk-confirm-highlight-iconbox mint" aria-hidden="true">
                  🌿
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12A10 10 0 0 1 12 2z" />
                    <path d="M8 12c2-3 6-3 8 0" />
                    <line x1="12" y1="9" x2="12" y2="15" />
                  </svg>
                </div>
                <h3 className="bk-confirm-highlight-title">Arrival Experience</h3>
                <p className="bk-confirm-highlight-desc">
                  Please arrive 10 minutes prior to unwind with a complimentary herbal welcome tea while your sanitized styling suite is prepared.
                </p>
              </div>

              <div className="bk-confirm-highlight-card">
                <div className="bk-confirm-highlight-iconbox amber" aria-hidden="true">
                  🕒
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h3 className="bk-confirm-highlight-title">Cancellation Policy</h3>
                <p className="bk-confirm-highlight-desc">
                  Free cancellation or rescheduling is available {cancellationDeadlineText}.
                </p>
              </div>

              <div className="bk-confirm-highlight-card">
                <div className="bk-confirm-highlight-iconbox teal" aria-hidden="true">
                  🛡️
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <h3 className="bk-confirm-highlight-title">Clean & Pure Standards</h3>
                <p className="bk-confirm-highlight-desc">
                  Hospital-grade autoclave tool sterilization and botanical aromatherapies are standard for every styling appointment.
                </p>
              </div>
            </div>

            {/* Bottom Return & Assurance */}
            <div className="bk-confirm-return-footer">
              <button
                type="button"
                className="bk-confirm-return-link"
                onClick={() => navigate("/customer/home")}
              >
                ← Back to Home or Explore More Services
              </button>
              <p className="bk-confirm-guarantee-note">
                BookMySalon guarantees seamless appointment scheduling across premier city salons.
              </p>
            </div>
          </div>
        </main>
        <CustomerFooter />
      </div>
    );
  }

  /* ── Review Your Booking Screen ─── */
  return (
    <div className="bk-page">
      <CustomerHeader />

      <div className="bk-container" style={{ maxWidth: "1160px" }}>
        {!selectedService || !selectedSlot || !selectedDate ? (
          <div className="bk-review-empty-card" style={{ textAlign: "center", padding: "80px 20px", background: "#ffffff", borderRadius: "16px", border: "1px solid #e2e8f0", margin: "40px auto", maxWidth: "600px" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>📅</div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0f172a", marginBottom: "8px" }}>
              No Appointment Selected
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", maxWidth: "480px", margin: "0 auto 24px" }}>
              Please select your treatment, date, and time slot on the salon details page before reviewing your booking.
            </p>
            <button
              type="button"
              className="bk-btn-primary"
              onClick={() => navigate(`/customer/salons/${salonId}`)}
              style={{ padding: "12px 28px", borderRadius: "10px", fontWeight: 700, margin: "0 auto", display: "inline-block" }}
            >
              ← Go to Salon Page
            </button>
          </div>
        ) : (
          <div className="bk-review-wrap">
              {/* Breadcrumbs Navigation */}
              <div className="bk-breadcrumbs-nav">
                <span
                  className="bk-breadcrumb-step"
                  onClick={() => navigate(`/customer/salons/${salonId}`)}
                  style={{ cursor: "pointer" }}
                  title="Return to Salon Page"
                >
                  <span className="bk-breadcrumb-num">1</span> Salon & Services
                </span>
                <span className="bk-breadcrumb-sep">/</span>
                <span className="bk-breadcrumb-step bk-breadcrumb-step--active">
                  <span className="bk-breadcrumb-num">2</span> Review Booking
                  <span className="bk-breadcrumb-dot">•</span>
                </span>
                <span className="bk-breadcrumb-sep">/</span>
                <span className="bk-breadcrumb-step">
                  <span className="bk-breadcrumb-num">3</span> Payment & Confirmation
                </span>
              </div>

              {/* Title & Subtitle */}
              <div className="bk-review-header">
                <h1 className="bk-review-title">Review Your Booking</h1>
                <p className="bk-review-subtitle">
                  Please review your selected session and salon details before moving to secure checkout.
                </p>
              </div>

              {/* Two-Column Grid */}
              <div className="bk-review-grid">
                {/* Left Column: Salon Card, Treatment Card, Trust Badges */}
                <div className="bk-review-left">
                  {/* Card 1: Salon Card */}
                  <div className="bk-salon-summary-card">
                    <img
                      src={
                        salon?.images?.[0]
                          ? resolveImageUrl(salon.images[0])
                          : "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={salon?.name || "Salon"}
                      className="bk-salon-summary-thumb"
                    />
                    <div className="bk-salon-summary-info">
                      <span className="bk-salon-pill-badge">PREMIER WELLNESS DESTINATION</span>
                      <h2 className="bk-salon-summary-name">{salon?.name || "ABC Salon & Spa"}</h2>
                      <div className="bk-salon-summary-rating">
                        <span className="bk-salon-star">★</span>
                        <strong>{salon?.rating || 4.8}</strong>
                        <span>({salon?.reviewsCount || "520+"} verified reviews)</span>
                      </div>
                      <div className="bk-salon-summary-addr">
                        <span>📍</span>
                        <span>
                          {salon?.address || "100 ft Road, Indiranagar"}, {salon?.city || "Bengaluru"}
                        </span>
                      </div>
                      <div className="bk-salon-summary-footer">
                        <span className="bk-salon-dir-link">🧭 View Directions</span>
                        <span className="bk-salon-valet-tag">Valet parking available</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Selected Treatment Card */}
                  <div className="bk-treatment-card">
                    <div className="bk-treatment-card-header">
                      <span className="bk-treatment-label">
                        {selectedServices.length > 1 ? `SELECTED TREATMENTS (${selectedServices.length})` : "SELECTED TREATMENT"}
                      </span>
                      <span className="bk-treatment-cat-pill">
                        {selectedServices.length > 1 ? "Curated Package" : (selectedService.category || "Precision Styling")}
                      </span>
                    </div>

                    {selectedServices.length === 1 ? (
                      <>
                        <div className="bk-treatment-title-row">
                          <h3 className="bk-treatment-name">{selectedService.name}</h3>
                          <div className="bk-treatment-price-wrap">
                            <div className="bk-treatment-price">
                              ₹{Number(selectedService.price).toLocaleString("en-IN")}
                            </div>
                            <div className="bk-treatment-duration">{selectedService.duration} mins</div>
                          </div>
                        </div>

                        <p className="bk-treatment-desc">
                          {selectedService.description ||
                            "Precision scissor cut & organic botanical wash with invigorating scalp acupressure massage."}
                        </p>
                      </>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "10px 0" }}>
                        {selectedServices.map((svc) => (
                          <div
                            key={svc.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "10px 14px",
                              background: "#f8fafc",
                              borderRadius: "8px",
                              border: "1px solid #e2e8f0",
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: "0.92rem", color: "#0f172a", display: "block" }}>
                                {svc.name}
                              </strong>
                              <span style={{ fontSize: "0.76rem", color: "#64748b" }}>
                                ⏱ {svc.duration} mins • {svc.category || "Service"}
                              </span>
                            </div>
                            <span style={{ fontWeight: 700, color: "#1b4332", fontSize: "0.92rem" }}>
                              ₹{Number(svc.price).toLocaleString("en-IN")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stylist Sub-card */}
                    <div className="bk-stylist-row">
                      <div className="bk-stylist-left">
                        <div className="bk-stylist-avatar-wrap">
                          {selectedWorkerObj?.profile_photo ? (
                            <img
                              src={resolveImageUrl(selectedWorkerObj.profile_photo)}
                              alt={selectedWorkerObj.name}
                              className="bk-stylist-img"
                            />
                          ) : (
                            <div className="bk-stylist-avatar-fallback">
                              {selectedWorker === "any" ? "✦" : selectedWorkerObj?.name?.[0] || "R"}
                            </div>
                          )}
                          <div className="bk-stylist-check-badge">✓</div>
                        </div>

                        <div className="bk-stylist-meta">
                          <div className="bk-stylist-name-line">
                            <span className="bk-stylist-name">{workerLabel()}</span>
                            <span className="bk-stylist-tag">Top Rated</span>
                          </div>
                          <span className="bk-stylist-role">
                            {selectedWorkerObj?.specialization || "Master Hair Specialist"} •{" "}
                            {selectedWorkerObj?.experience || "8+ yrs experience"}
                          </span>
                          <span className="bk-stylist-sub">
                            Specializes in textured cuts & scalp balance
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="bk-stylist-change-btn"
                        onClick={() => navigate(`/customer/salons/${salonId}`)}
                        title="Change specialist on salon page"
                      >
                        Change
                      </button>
                    </div>

                    {/* 3-Tile Stats Grid */}
                    <div className="bk-stats-3col">
                      <div className="bk-stat-tile">
                        <div className="bk-stat-tile-icon">📅</div>
                        <div className="bk-stat-tile-content">
                          <span className="bk-stat-tile-label">APPOINTMENT DATE</span>
                          <span className="bk-stat-tile-val">{formatDateDisplay(selectedDate)}</span>
                        </div>
                      </div>

                      <div className="bk-stat-tile">
                        <div className="bk-stat-tile-icon">🕐</div>
                        <div className="bk-stat-tile-content">
                          <span className="bk-stat-tile-label">SLOT TIME</span>
                          <span className="bk-stat-tile-val">{selectedSlot.time_display}</span>
                        </div>
                      </div>

                      <div className="bk-stat-tile">
                        <div className="bk-stat-tile-icon">⏱</div>
                        <div className="bk-stat-tile-content">
                          <span className="bk-stat-tile-label">TOTAL DURATION</span>
                          <span className="bk-stat-tile-val">{totalDurationMinutes} Minutes</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Trust Assurances */}
                  <div className="bk-trust-2col">
                    <div className="bk-trust-item">
                      <div className="bk-trust-icon">📅</div>
                      <div>
                        <div className="bk-trust-title">FREE CANCELLATION</div>
                        <p className="bk-trust-desc">
                          Full refund or reschedule without penalty up to 2 hours prior to the slot.
                        </p>
                      </div>
                    </div>

                    <div className="bk-trust-item">
                      <div className="bk-trust-icon">🌿</div>
                      <div>
                        <div className="bk-trust-title">100% PURITY & BOTANICAL</div>
                        <p className="bk-trust-desc">
                          Strictly cruelty-free, organic compounds used for all hair cleansings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Contact Details, Payment Summary, Concierge */}
                <div className="bk-review-right">
                  {/* Contact Info Card */}
                  <div className="bk-review-contact-card">
                    <h3 className="bk-review-contact-title">Your Details</h3>
                    <div className="bk-review-contact-form">
                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Full Name <span style={{ color: "#dc2626" }}>*</span>
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Rahul Sharma"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Phone
                          </label>
                          <input
                            type="tel"
                            placeholder="+91 98765 43210"
                            value={clientPhone}
                            onChange={(e) => setClientPhone(e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                            Email
                          </label>
                          <input
                            type="email"
                            placeholder="you@example.com"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                          Notes / Preferences (optional)
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Allergies, preferences…"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Payment Summary Box */}
                  <div className="bk-payment-summary-box">
                    <h3 className="bk-payment-summary-title">Payment Summary</h3>

                    {selectedServices.map((svc) => (
                      <div key={svc.id} className="bk-ps-line">
                        <span>
                          {svc.name} ({svc.duration} mins)
                        </span>
                        <strong>₹{Number(svc.price).toLocaleString("en-IN")}</strong>
                      </div>
                    ))}

                    <div className="bk-ps-line" style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "6px", marginTop: "4px" }}>
                      <span>Subtotal ({selectedServices.length} treatment{selectedServices.length > 1 ? "s" : ""})</span>
                      <strong>₹{serviceSubtotal.toLocaleString("en-IN")}</strong>
                    </div>

                    <div className="bk-ps-line">
                      <span>GST & Hygiene Safety (5%)</span>
                      <strong>₹{taxAmount.toLocaleString("en-IN")}</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div className="bk-ps-line bk-ps-line--discount">
                        <span>🏷 Voucher Discount ({appliedVoucher?.code})</span>
                        <strong>-₹{discountAmount}</strong>
                      </div>
                    )}

                    <div className="bk-ps-divider" />

                    <div className="bk-ps-total-row">
                      <div className="bk-ps-total-label-wrap">
                        <span className="bk-ps-total-label">TOTAL PAYABLE NOW</span>
                        {discountAmount > 0 && (
                          <span className="bk-ps-savings-pill">
                            🏷 You saved ₹{discountAmount}
                          </span>
                        )}
                      </div>
                      <div className="bk-ps-total-amount">
                        ₹{totalPayable.toLocaleString("en-IN")}
                      </div>
                    </div>

                    {/* Voucher Input */}
                    <div className="bk-voucher-wrap">
                      <label className="bk-voucher-label">Have a gift voucher or code?</label>
                      <div className="bk-voucher-input-group">
                        <input
                          type="text"
                          className="bk-voucher-input"
                          placeholder="e.g. SUMMERGLOW"
                          value={voucherCode}
                          onChange={(e) => setVoucherCode(e.target.value)}
                        />
                        <button
                          type="button"
                          className={`bk-voucher-btn ${appliedVoucher ? "bk-voucher-btn--applied" : ""}`}
                          onClick={handleApplyVoucher}
                        >
                          {appliedVoucher ? "Applied" : "Apply"}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          borderRadius: "10px",
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "10px",
                        }}
                      >
                        <div style={{ color: "#b91c1c", fontSize: "0.82rem", fontWeight: 600, flex: 1 }}>
                          ⚠️ {error}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setError("");
                            setShowPaymentModal(true);
                          }}
                          style={{
                            background: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 12px",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          Retry Payment
                        </button>
                      </div>
                    )}

                    {/* CTA Button to open Payment Method modal */}
                    <button
                      type="button"
                      className="bk-proceed-payment-cta"
                      onClick={handleProceedToPaymentModal}
                    >
                      Proceed to Payment • ₹{totalPayable.toLocaleString("en-IN")} →
                    </button>

                    <div className="bk-secure-badge-sub">
                      <span>🔒</span>
                      <span>Encrypted 256-bit bank-grade secure checkout</span>
                    </div>
                  </div>

                  {/* Concierge Card */}
                  <div className="bk-concierge-card">
                    <div className="bk-concierge-left">
                      <span>🎧</span>
                      <span>Need assistance with your booking?</span>
                    </div>
                    <span className="bk-concierge-link">Contact Concierge</span>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>

      {/* ==========================================================================
          PAYMENT METHOD MODAL (Matching Reference Image 2)
          ========================================================================== */}
      {showPaymentModal && selectedService && selectedSlot && (
        <div
          className="bk-pay-modal-backdrop"
          onClick={() => !submitting && setShowPaymentModal(false)}
        >
          <div
            className="bk-pay-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bk-pay-modal-header">
              <div>
                <h2 className="bk-pay-modal-title">Payment Method</h2>
                <p className="bk-pay-modal-sub">
                  Select your preferred payment method to secure your appointment at{" "}
                  <strong>{salon?.name || "ABC Salon & Spa"}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="bk-pay-modal-close-btn"
                disabled={submitting}
                onClick={() => setShowPaymentModal(false)}
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Two Columns */}
            <div className="bk-pay-modal-body">
              {/* Left Column: Payment Options */}
              <div className="bk-pay-modal-left">
                {/* Option 1: Pay at Salon */}
                <div
                  className={`bk-pay-opt-card ${paymentMethod === "PAY_AT_SALON" ? "bk-pay-opt-card--selected" : ""}`}
                  onClick={() => {
                    setPaymentMethod("PAY_AT_SALON");
                    setError("");
                  }}
                >
                  <div className="bk-pay-opt-top">
                    <div className="bk-pay-opt-radio-wrap">
                      <div className="bk-pay-radio-dot">
                        {paymentMethod === "PAY_AT_SALON" && <div className="bk-pay-radio-inner" />}
                      </div>
                      <span className="bk-pay-opt-title">Pay at Salon</span>
                      <span className="bk-pay-opt-badge bk-pay-opt-badge--gray">ZERO ADVANCE</span>
                    </div>
                    <span className="bk-pay-opt-icon">🏪</span>
                  </div>

                  <p className="bk-pay-opt-desc">
                    Settle your bill via Cash, UPI, or Card directly at the salon counter after your treatment.
                  </p>

                  <div className="bk-pay-opt-bullet">
                    ✓ Guaranteed reservation. No upfront payment required.
                  </div>
                </div>

                {/* Option 2: Online Payment */}
                <div
                  className={`bk-pay-opt-card ${paymentMethod === "ONLINE" ? "bk-pay-opt-card--selected" : ""}`}
                  onClick={() => {
                    setPaymentMethod("ONLINE");
                    setError("");
                  }}
                >
                  <div className="bk-pay-opt-top">
                    <div className="bk-pay-opt-radio-wrap">
                      <div className="bk-pay-radio-dot">
                        {paymentMethod === "ONLINE" && <div className="bk-pay-radio-inner" />}
                      </div>
                      <span className="bk-pay-opt-title">Online Payment</span>
                      <span className="bk-pay-opt-badge bk-pay-opt-badge--green">
                        INSTANT CONFIRMATION
                      </span>
                    </div>
                    <span className="bk-pay-opt-icon">💳</span>
                  </div>

                  <p className="bk-pay-opt-desc">
                    Fast-track check-in with contactless digital payment. Guaranteed priority slot.
                  </p>

                  {/* Online Payment Sub-options (when selected) */}
                  {paymentMethod === "ONLINE" && (
                    <div className="bk-online-subbox" onClick={(e) => e.stopPropagation()}>
                      {/* Tabs */}
                      <div className="bk-sub-tabs">
                        <button
                          type="button"
                          className={`bk-sub-tab ${onlineTab === "upi" ? "bk-sub-tab--active" : ""}`}
                          onClick={() => setOnlineTab("upi")}
                        >
                          UPI / QR Code
                        </button>
                        <button
                          type="button"
                          className={`bk-sub-tab ${onlineTab === "cards" ? "bk-sub-tab--active" : ""}`}
                          onClick={() => setOnlineTab("cards")}
                        >
                          Cards (Visa/Master/RuPay)
                        </button>
                        <button
                          type="button"
                          className={`bk-sub-tab ${onlineTab === "netbanking" ? "bk-sub-tab--active" : ""}`}
                          onClick={() => setOnlineTab("netbanking")}
                        >
                          Net Banking & Wallets
                        </button>
                      </div>

                      {/* Quick UPI Apps */}
                      <div className="bk-quick-upi-apps">
                        <span className="bk-upi-app-pill">
                          <span className="bk-upi-app-dot" style={{ background: "#4285F4" }} />
                          Google Pay
                        </span>
                        <span className="bk-upi-app-pill">
                          <span className="bk-upi-app-dot" style={{ background: "#5f259f" }} />
                          PhonePe
                        </span>
                        <span className="bk-upi-app-pill">
                          <span className="bk-upi-app-dot" style={{ background: "#00baf2" }} />
                          Paytm UPI
                        </span>
                        <span className="bk-upi-app-pill">
                          <span className="bk-upi-app-dot" style={{ background: "#ea580c" }} />
                          BHIM
                        </span>
                      </div>

                      {/* Tab 1: UPI / QR Code */}
                      {onlineTab === "upi" && (
                        <div className="bk-upi-qr-section">
                          <div className="bk-qr-box">
                            <div className="bk-qr-placeholder">
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0f172a" strokeWidth="1.5">
                                <rect x="3" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="3" width="7" height="7" rx="1" />
                                <rect x="14" y="14" width="7" height="7" rx="1" />
                                <rect x="3" y="14" width="7" height="7" rx="1" />
                                <path d="M7 7h.01M17 7h.01M7 17h.01M17 17h.01" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                            </div>
                            <span className="bk-qr-subtext">Scan with any UPI App</span>
                          </div>

                          <div className="bk-vpa-box">
                            <span className="bk-vpa-label">Or enter Virtual Payment Address (UPI ID)</span>
                            <div className="bk-vpa-input-wrap">
                              <input
                                type="text"
                                className="bk-vpa-input"
                                placeholder="yourname@oksbi / mobilenumber@upi"
                                value={upiIdInput}
                                onChange={(e) => {
                                  setUpiIdInput(e.target.value);
                                  setIsVpaVerified(false);
                                }}
                              />
                              <button
                                type="button"
                                className="bk-vpa-verify-btn"
                                onClick={() => {
                                  if (upiIdInput.includes("@")) {
                                    setIsVpaVerified(true);
                                  }
                                }}
                              >
                                {isVpaVerified ? "✓ Verified" : "Verify"}
                              </button>
                            </div>
                            <span className="bk-vpa-subnote">
                              <span>🔒</span>
                              <span>Payment request will be sent to your mobile device via Razorpay</span>
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Cards */}
                      {onlineTab === "cards" && (
                        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.82rem", color: "#475569" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "8px" }}>
                            <span style={{ fontWeight: 700, color: "#1e293b" }}>Supported Cards:</span>
                            <span>💳 Visa</span>
                            <span>💳 MasterCard</span>
                            <span>💳 RuPay</span>
                            <span>💳 Maestro</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748b" }}>
                            Card payment details are entered securely directly inside Razorpay's PCI-DSS compliant payment gateway.
                          </p>
                        </div>
                      )}

                      {/* Tab 3: NetBanking */}
                      {onlineTab === "netbanking" && (
                        <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "0.82rem", color: "#475569" }}>
                          <p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#1e293b" }}>
                            Supported Banks & Wallets:
                          </p>
                          <p style={{ margin: 0, fontSize: "0.76rem", color: "#64748b" }}>
                            HDFC, SBI, ICICI, Axis, Kotak, PayZapp, Mobikwik, and all major Indian net banking accounts.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Optional Advance Checkbox Box */}
                <div className="bk-token-box">
                  <input
                    type="checkbox"
                    id="tokenOnlyCheckbox"
                    className="bk-token-checkbox"
                    checked={isTokenOnly}
                    onChange={(e) => setIsTokenOnly(e.target.checked)}
                  />
                  <label htmlFor="tokenOnlyCheckbox" className="bk-token-text" style={{ cursor: "pointer" }}>
                    <span className="bk-token-title">Pay token advance only (₹100 now)</span>
                    <p className="bk-token-desc">
                      Reserve the stylist for ₹100 today. Settle the remaining ₹
                      {Math.max(0, totalPayable - 100)} comfortably at salon counter after your service.
                    </p>
                  </label>
                </div>

                {/* Assurance notes */}
                <div style={{ display: "flex", gap: "16px", fontSize: "0.74rem", color: "#64748b", marginTop: "4px" }}>
                  <span>✓ Free cancellation up to 2 hours prior</span>
                  <span>✓ 100% Purity & Botanical Guarantee</span>
                </div>
              </div>

              {/* Right Column: Mini Booking Summary inside Modal */}
              <div className="bk-pay-modal-right">
                <div>
                  <div className="bk-modal-salon-line">
                    <h4 className="bk-modal-salon-title">{salon?.name || "ABC Salon & Spa"}</h4>
                    <span className="bk-modal-salon-rating">★ {salon?.rating || 4.8}</span>
                  </div>
                  <p className="bk-modal-salon-loc">
                    📍 {salon?.address || "Indiranagar"}, {salon?.city || "Bengaluru"}
                  </p>
                </div>

                {/* Selected Service Snippet */}
                <div className="bk-modal-svc-card">
                  <div className="bk-modal-svc-top">
                    <div>
                      <span className="bk-modal-svc-name">
                        ✂ {selectedServices.map((s) => s.name).join(" + ")}
                      </span>
                      <div className="bk-modal-svc-sub">
                        {totalDurationMinutes} mins total • {selectedServices.length} treatment{selectedServices.length > 1 ? "s" : ""}
                      </div>
                    </div>
                    <span className="bk-modal-svc-price">
                      ₹{serviceSubtotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="bk-modal-svc-stylist">
                    <span>👤</span>
                    <span>{workerLabel()}</span>
                  </div>
                </div>

                {/* Date & Time pill */}
                <div className="bk-modal-time-badge">
                  <span>📅</span>
                  <span>
                    {formatFullDateDisplay(selectedDate)} at {selectedSlot.time_display}
                  </span>
                </div>

                {/* Bill Breakdown */}
                <div className="bk-modal-bill-breakdown">
                  {selectedServices.map((svc) => (
                    <div key={svc.id} className="bk-modal-bill-line" style={{ fontSize: "0.8rem" }}>
                      <span>{svc.name}</span>
                      <span>₹{Number(svc.price).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="bk-modal-bill-line" style={{ borderTop: "1px dashed #e2e8f0", paddingTop: "4px" }}>
                    <span>Subtotal</span>
                    <strong>₹{serviceSubtotal.toLocaleString("en-IN")}</strong>
                  </div>

                  <div className="bk-modal-bill-line">
                    <span>GST & Hygiene Safety (5%)</span>
                    <strong>₹{taxAmount.toLocaleString("en-IN")}</strong>
                  </div>

                  {discountAmount > 0 && (
                    <div className="bk-modal-bill-line bk-modal-bill-line--discount">
                      <span>Voucher Discount ({appliedVoucher?.code})</span>
                      <strong>-₹{discountAmount}</strong>
                    </div>
                  )}

                  <div className="bk-modal-bill-divider" />

                  <div className="bk-modal-bill-total">
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>
                      Total Payable Now
                    </span>
                    <span className="bk-modal-bill-total-amount">
                      ₹{payableNowAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="bk-modal-tax-note">Inclusive of 5% GST & all charges</p>
                </div>

                {/* Error Banner with Try Again Button */}
                {error && (
                  <div className="bk-modal-error-wrap">
                    <span style={{ flex: 1 }}>⚠️ {error}</span>
                    <button
                      type="button"
                      className="bk-modal-try-again-btn"
                      onClick={handleFinalBookingSubmit}
                      disabled={submitting}
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Modal CTA Button */}
                <button
                  type="button"
                  className="bk-modal-submit-cta"
                  disabled={submitting}
                  onClick={handleFinalBookingSubmit}
                >
                  {submitting
                    ? "Processing…"
                    : paymentMethod === "ONLINE"
                    ? `🔒 Pay ₹${payableNowAmount.toLocaleString("en-IN")} & Confirm Booking`
                    : "✓ Confirm Booking (Pay at Salon)"}
                </button>

                <div className="bk-modal-secure-note">
                  <span>🔒</span>
                  <span>256-bit bank grade encryption • PCI-DSS Compliant</span>
                </div>

                {/* Direct Telephone Support */}
                <div className="bk-modal-call-salon">
                  <span>Questions? Call salon directly</span>
                  <a
                    href={`tel:${salon?.phone || "+918012345678"}`}
                    className="bk-modal-call-link"
                  >
                    {salon?.phone || "+91 80 1234 5678"}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CustomerFooter />
    </div>
  );
}

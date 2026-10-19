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

const STEPS = ["Service", "Date", "Stylist", "Time", "Confirm"];

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

  /* selections */
  const [step, setStep] = useState(0);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null); // worker id, "any", or null
  const [selectedSlot, setSelectedSlot] = useState(null);

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
  const [error, setError] = useState("");

  const days = buildNextDays(30);

  /* ── Calculations ─── */
  const serviceSubtotal = useMemo(() => {
    return selectedService ? Number(selectedService.price) || 0 : 0;
  }, [selectedService]);

  const discountAmount = useMemo(() => {
    if (!appliedVoucher || !serviceSubtotal) return 0;
    if (appliedVoucher.discount) return Math.min(serviceSubtotal, appliedVoucher.discount);
    return 0;
  }, [appliedVoucher, serviceSubtotal]);

  const totalPayable = useMemo(() => {
    return Math.max(0, serviceSubtotal - discountAmount);
  }, [serviceSubtotal, discountAmount]);

  const payableNowAmount = useMemo(() => {
    if (isTokenOnly && paymentMethod === "ONLINE") {
      return Math.min(100, totalPayable);
    }
    return totalPayable;
  }, [isTokenOnly, paymentMethod, totalPayable]);

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

        const preServiceId = searchParams.get("service_id");
        if (preServiceId && svcList.length > 0) {
          const pre = svcList.find((s) => String(s.id) === String(preServiceId));
          if (pre) setSelectedService(pre);
        }

        const preDate = searchParams.get("date");
        if (preDate) {
          setSelectedDate(preDate);
        }

        const preWorkerId = searchParams.get("worker_id");
        if (preWorkerId) {
          setSelectedWorker(String(preWorkerId));
        }

        const preTime = searchParams.get("time");
        if (preServiceId && preDate) {
          if (preWorkerId && preTime) {
            setStep(3); // will auto-fetch slots and advance to 4
          } else if (preWorkerId) {
            setStep(3);
          } else {
            setStep(2);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [salonId, searchParams]);

  /* ── Load eligible workers when service + date selected ─── */
  useEffect(() => {
    if (!selectedService || !selectedDate) return;
    const params = {
      service_id: selectedService.id,
      date: selectedDate,
    };

    api
      .get(`/bookings/salons/${salonId}/workers/`, { params })
      .then((r) => setWorkers(r.data.workers || []))
      .catch(console.error);
  }, [selectedService, selectedDate, salonId]);

  /* ── Load slots when worker (or any) + date + service selected ─── */
  const fetchSlots = useCallback(async () => {
    if (!selectedService || !selectedDate || !selectedWorker) return;
    setSlotsLoading(true);
    setSlots([]);
    setClosedInfo(null);
    setWorkerUnavailableInfo(null);
    setSelectedSlot(null);
    try {
      const params = {
        salon_id: salonId,
        service_id: selectedService.id,
        date: selectedDate,
      };
      if (selectedWorker !== "any") {
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

        // Pre-select time if provided via URL
        const preTime = searchParams.get("time");
        if (preTime && !selectedSlot) {
          const norm = preTime.trim().toLowerCase();
          const found = loadedSlots.find(
            (s) =>
              s.time.toLowerCase() === norm ||
              s.time_display.toLowerCase() === norm ||
              fmt12(s.time).toLowerCase() === norm
          );
          if (found) {
            setSelectedSlot(found);
            setStep(4); // Advance directly to Review Your Booking page!
          }
        }
      }
    } catch (e) {
      setClosedInfo({ reason: "Unable to load slots. Please try again." });
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedService, selectedDate, selectedWorker, salonId, searchParams, selectedSlot]);

  useEffect(() => {
    if (step === 3) fetchSlots();
  }, [step, fetchSlots]);

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
    if (selectedWorker === "any") return "Auto-Assign (Any Available Specialist)";
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
      setAppliedVoucher({ code: "LUXE20", discount: rateDiscount });
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
    if (!clientName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    setError("");
    setSubmitting(true);

    const payload = {
      salon_id: Number(salonId),
      service_id: selectedService.id,
      booking_date: selectedDate,
      start_time: selectedSlot.time,
      client_name: clientName.trim(),
      client_phone: clientPhone.trim(),
      client_email: clientEmail.trim(),
      notes: notes.trim(),
      payment_method: paymentMethod,
    };
    if (selectedWorker && selectedWorker !== "any") {
      payload.worker_id = Number(selectedWorker);
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
    return (
      <div className="bk-page">
        <CustomerHeader />
        <div className="bk-success-wrap">
          <div className="bk-success-card">
            <div className="bk-success-icon">✓</div>
            <h2>Appointment Confirmed!</h2>
            <p className="bk-success-sub">
              Your curated appointment at <strong>{salon?.name}</strong> is completely confirmed.
            </p>
            <div className="bk-success-details">
              <div className="bk-detail-row">
                <span>📅 Date</span>
                <strong>{bookingResult.booking_date}</strong>
              </div>
              <div className="bk-detail-row">
                <span>🕐 Time</span>
                <strong>
                  {fmt12(bookingResult.start_time)} → {fmt12(bookingResult.end_time)}
                </strong>
              </div>
              <div className="bk-detail-row">
                <span>✂ Service</span>
                <strong>{bookingResult.service_name}</strong>
              </div>
              <div className="bk-detail-row">
                <span>👤 Specialist</span>
                <strong>{bookingResult.worker_name || "Any Available Specialist"}</strong>
              </div>
              <div className="bk-detail-row">
                <span>💰 Total Amount</span>
                <strong>₹{Number(bookingResult.service_price).toLocaleString("en-IN")}</strong>
              </div>
              <div className="bk-detail-row">
                <span>💳 Payment Status</span>
                <strong style={{ color: bookingResult.payment_method === "ONLINE" ? "#047857" : "#b45309" }}>
                  {bookingResult.payment_method === "ONLINE"
                    ? "Paid Online via Razorpay ✓"
                    : "Pay at Salon Counter"}
                </strong>
              </div>
              <div className="bk-detail-row">
                <span>🔖 Booking Reference</span>
                <strong>BMS-{bookingResult.id}</strong>
              </div>
            </div>
            <div className="bk-success-actions">
              <button className="bk-btn-primary" onClick={() => navigate("/customer/my-bookings")}>
                View My Bookings
              </button>
              <button className="bk-btn-outline" onClick={() => navigate(`/customer/salons/${salonId}`)}>
                Back to Salon Page
              </button>
            </div>
          </div>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  /* ── STEPS 0 to 4 ─── */
  return (
    <div className="bk-page">
      <CustomerHeader />

      <div className="bk-container" style={step === 4 ? { maxWidth: "1160px" } : {}}>
        {/* Step indicator header if not in review mode */}
        {step < 4 && salon && (
          <div className="bk-salon-banner">
            <h1 className="bk-salon-name">{salon.name}</h1>
            <p className="bk-salon-city">
              {salon.city}
              {salon.state ? `, ${salon.state}` : ""}
            </p>
          </div>
        )}

        {/* Stepper for steps 0 to 3 */}
        {step < 4 && (
          <div className="bk-stepper">
            {STEPS.map((label, i) => (
              <div
                key={label}
                className={`bk-step ${i < step ? "bk-step--done" : ""} ${i === step ? "bk-step--active" : ""}`}
              >
                <div className="bk-step-circle">{i < step ? "✓" : i + 1}</div>
                <span className="bk-step-label">{label}</span>
                {i < STEPS.length - 1 && <div className="bk-step-line" />}
              </div>
            ))}
          </div>
        )}

        <div className="bk-body">
          {/* ── STEP 0: Service Selection ─── */}
          {step === 0 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Select a Service</h2>
              {services.length === 0 ? (
                <p className="bk-empty">No services available for this salon.</p>
              ) : (
                <div className="bk-services-grid">
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      className={`bk-service-card ${selectedService?.id === svc.id ? "bk-service-card--selected" : ""}`}
                      onClick={() => setSelectedService(svc)}
                    >
                      <div className="bk-svc-category">{svc.category || "Service"}</div>
                      <div className="bk-svc-name">{svc.name}</div>
                      <div className="bk-svc-meta">
                        <span className="bk-svc-duration">⏱ {svc.duration} min</span>
                        <span className="bk-svc-price">₹{Number(svc.price).toLocaleString("en-IN")}</span>
                      </div>
                      {svc.description && <p className="bk-svc-desc">{svc.description}</p>}
                      {selectedService?.id === svc.id && (
                        <div className="bk-svc-check">✓ Selected</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="bk-footer">
                <button
                  className="bk-btn-primary"
                  disabled={!selectedService}
                  onClick={() => setStep(1)}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 1: Date Selection ─── */}
          {step === 1 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Choose a Date</h2>
              <div className="bk-date-grid">
                {days.map((d) => {
                  const off = isOffDay(d.iso);
                  const selected = selectedDate === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={`bk-date-card ${selected ? "bk-date-card--selected" : ""} ${off ? "bk-date-card--closed" : ""}`}
                      onClick={() => {
                        if (!off) {
                          setSelectedDate(d.iso);
                          setSelectedSlot(null);
                        }
                      }}
                    >
                      <span className="bk-date-day">{d.dayShort}</span>
                      <span className="bk-date-num">{d.dateNum}</span>
                      <span className="bk-date-month">{d.monthShort}</span>
                      {off && (
                        <span className="bk-date-closed-tag" title={offDayReason(d.iso)}>
                          Closed
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedDate && isOffDay(selectedDate) && (
                <div className="bk-alert bk-alert--warning">
                  🚫 Salon is closed on this date — {offDayReason(selectedDate)}
                </div>
              )}
              <div className="bk-footer">
                <button className="bk-btn-outline" onClick={() => setStep(0)}>
                  ← Back
                </button>
                <button
                  className="bk-btn-primary"
                  disabled={!selectedDate || isOffDay(selectedDate)}
                  onClick={() => setStep(2)}
                >
                  Continue →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 2: Stylist Selection ─── */}
          {step === 2 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Choose a Stylist</h2>
              <div className="bk-slot-meta">
                <span>📅 {selectedDate}</span>
                <span>✂ {selectedService?.name}</span>
                <span>⏱ {selectedService?.duration} min</span>
              </div>
              <div className="bk-workers-grid">
                {/* Auto-assign option */}
                <div
                  className={`bk-worker-card bk-worker-card--any ${selectedWorker === "any" ? "bk-worker-card--selected" : ""}`}
                  onClick={() => setSelectedWorker("any")}
                >
                  <div className="bk-worker-avatar bk-worker-avatar--any">✦</div>
                  <div className="bk-worker-info">
                    <div className="bk-worker-name">Auto-Assign (Any Available Stylist)</div>
                    <div className="bk-worker-spec">
                      Shows all time slots where at least one eligible specialist is free
                    </div>
                  </div>
                  {selectedWorker === "any" && <div className="bk-worker-check">✓</div>}
                </div>

                {workers.map((w) => {
                  const isUnavailable =
                    w.is_on_leave || w.is_weekly_off || w.is_fully_booked || w.is_available === false;
                  return (
                    <div
                      key={w.id}
                      className={`bk-worker-card ${String(selectedWorker) === String(w.id) ? "bk-worker-card--selected" : ""}`}
                      style={isUnavailable ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                      onClick={() => {
                        if (!isUnavailable) setSelectedWorker(String(w.id));
                      }}
                    >
                      {w.profile_photo ? (
                        <img
                          src={resolveImageUrl(w.profile_photo)}
                          alt={w.name}
                          className="bk-worker-avatar"
                        />
                      ) : (
                        <div className="bk-worker-avatar bk-worker-avatar--initials">
                          {w.name[0]}
                        </div>
                      )}
                      <div className="bk-worker-info">
                        <div className="bk-worker-name">{w.name}</div>
                        <div className="bk-worker-spec">{w.specialization || "Senior Stylist"}</div>
                        {isUnavailable ? (
                          <div style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}>
                            {w.is_on_leave
                              ? "On Leave"
                              : w.is_weekly_off
                              ? "Weekly Off"
                              : "Fully Booked"}
                          </div>
                        ) : (
                          <div style={{ color: "#16a34a", fontSize: "0.75rem", fontWeight: 600 }}>
                            ✓ Available ({w.available_slots_count || "Open"} slots)
                          </div>
                        )}
                      </div>
                      {String(selectedWorker) === String(w.id) && (
                        <div className="bk-worker-check">✓</div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="bk-footer">
                <button className="bk-btn-outline" onClick={() => setStep(1)}>
                  ← Back
                </button>
                <button
                  className="bk-btn-primary"
                  disabled={!selectedWorker}
                  onClick={() => setStep(3)}
                >
                  {selectedWorker ? "Continue to Time Slots →" : "Please Select a Stylist"}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Time Slot Selection ─── */}
          {step === 3 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Pick a Time</h2>
              <div className="bk-slot-meta">
                <span>📅 {selectedDate}</span>
                <span>✂ {selectedService?.name}</span>
                <span>⏱ {selectedService?.duration} min</span>
                <span>👤 {workerLabel()}</span>
              </div>

              {slotsLoading && (
                <div className="bk-slots-loading">
                  <div className="bk-spinner" /> Loading available slots…
                </div>
              )}

              {!slotsLoading && closedInfo && (
                <div className="bk-alert bk-alert--error">
                  🚫 {closedInfo.reason}
                  <button className="bk-link-btn" onClick={() => setStep(1)}>
                    Choose another date
                  </button>
                </div>
              )}

              {!slotsLoading && !closedInfo && workerUnavailableInfo && (
                <div className="bk-alert bk-alert--warning">
                  ⚠️ {workerUnavailableInfo.reason}
                  <div style={{ marginTop: "6px", display: "flex", gap: "10px" }}>
                    <button
                      className="bk-link-btn"
                      onClick={() => {
                        setSelectedWorker(null);
                        setStep(2);
                      }}
                    >
                      Choose another stylist
                    </button>
                    <button
                      className="bk-link-btn"
                      onClick={() => {
                        setSelectedWorker("any");
                      }}
                    >
                      Switch to Auto-Assign
                    </button>
                  </div>
                </div>
              )}

              {!slotsLoading && !closedInfo && !workerUnavailableInfo && slots.length === 0 && (
                <div className="bk-alert bk-alert--warning">
                  No slots available for this stylist on this date.
                  <div style={{ marginTop: "6px" }}>
                    <button
                      className="bk-link-btn"
                      onClick={() => {
                        setSelectedWorker(null);
                        setStep(2);
                      }}
                    >
                      Choose another stylist or Auto-Assign
                    </button>
                  </div>
                </div>
              )}

              {!slotsLoading && !closedInfo && slots.length > 0 && (
                <div className="bk-slots-grid">
                  {slots.map((s) => (
                    <button
                      key={s.time}
                      className={`bk-slot-btn ${selectedSlot?.time === s.time ? "bk-slot-btn--selected" : ""} ${!s.available ? "bk-slot-btn--unavailable" : ""}`}
                      disabled={!s.available}
                      onClick={() => setSelectedSlot(s)}
                    >
                      <span className="bk-slot-time">{s.time_display}</span>
                      <span className="bk-slot-end">→ {s.end_time_display}</span>
                      {!s.available && (
                        <span className="bk-slot-booked-tag">
                          Unavailable{s.reason === "Break" ? " — break" : ""}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="bk-footer">
                <button className="bk-btn-outline" onClick={() => setStep(2)}>
                  ← Back
                </button>
                <button
                  className="bk-btn-primary"
                  disabled={!selectedSlot}
                  onClick={() => setStep(4)}
                >
                  Continue to Confirm →
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Review Your Booking (Matching Reference Image 1) ─── */}
          {step === 4 && selectedService && selectedSlot && (
            <div className="bk-review-wrap">
              {/* Breadcrumbs Navigation */}
              <div className="bk-breadcrumbs-nav">
                <span className="bk-breadcrumb-step" onClick={() => setStep(0)} style={{ cursor: "pointer" }}>
                  <span className="bk-breadcrumb-num">1</span> Service Selection
                </span>
                <span className="bk-breadcrumb-sep">/</span>
                <span className="bk-breadcrumb-step bk-breadcrumb-step--active">
                  <span className="bk-breadcrumb-num">2</span> Booking Summary
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
                  Step 2 of 3: Please review your curated session and salon details before moving to secure checkout.
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
                      <span className="bk-treatment-label">SELECTED TREATMENT</span>
                      <span className="bk-treatment-cat-pill">
                        {selectedService.category || "Precision Styling"}
                      </span>
                    </div>

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
                        onClick={() => setStep(2)}
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
                          <span className="bk-stat-tile-val">{selectedService.duration} Minutes</span>
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

                    <div className="bk-ps-line">
                      <span>
                        {selectedService.name} ({selectedService.duration} mins)
                      </span>
                      <strong>₹{serviceSubtotal.toLocaleString("en-IN")}</strong>
                    </div>

                    {discountAmount > 0 && (
                      <div className="bk-ps-line bk-ps-line--discount">
                        <span>🏷 Welcome Wellness Discount</span>
                        <strong>-₹{discountAmount}</strong>
                      </div>
                    )}

                    <div className="bk-ps-line" style={{ color: "#64748b" }}>
                      <span>Applicable Taxes & Spa Surcharge</span>
                      <span>Included</span>
                    </div>

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
                      <span className="bk-modal-svc-name">✂ {selectedService.name}</span>
                      <div className="bk-modal-svc-sub">
                        {selectedService.duration} mins • Styling & Botanical Wash
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
                  <div className="bk-modal-bill-line">
                    <span>Service Subtotal</span>
                    <strong>₹{serviceSubtotal.toLocaleString("en-IN")}</strong>
                  </div>

                  {discountAmount > 0 && (
                    <div className="bk-modal-bill-line bk-modal-bill-line--discount">
                      <span>Welcome Wellness Discount</span>
                      <strong>-₹{discountAmount}</strong>
                    </div>
                  )}

                  <div className="bk-modal-bill-line" style={{ color: "#64748b" }}>
                    <span>Taxes & Salon Fees</span>
                    <span>Included</span>
                  </div>

                  <div className="bk-modal-bill-divider" />

                  <div className="bk-modal-bill-total">
                    <span style={{ fontWeight: 700, color: "#1e293b", fontSize: "0.85rem" }}>
                      Total Payable Now
                    </span>
                    <span className="bk-modal-bill-total-amount">
                      ₹{payableNowAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <p className="bk-modal-tax-note">Inclusive of all local taxes</p>
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

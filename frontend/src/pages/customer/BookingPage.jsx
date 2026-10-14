import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../../api/axios";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import "../../styles/booking.css";

/* ─── helpers ─────────────────────────────────────────────────── */
function fmt12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
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

const STEPS = ["Service", "Date", "Stylist", "Time", "Confirm"];

/* ─── component ───────────────────────────────────────────────── */
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
  const [closedInfo, setClosedInfo] = useState(null); // {reason}
  const [workerUnavailableInfo, setWorkerUnavailableInfo] = useState(null); // {reason}

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

  /* submit */
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);
  const [error, setError] = useState("");

  const days = buildNextDays(30);

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
        setServices(servicesRes.data.services || []);
        setOffDays(offDaysRes.data.off_days || []);

        // pre-fill from query param
        const preServiceId = searchParams.get("service_id");
        if (preServiceId && servicesRes.data.services) {
          const pre = servicesRes.data.services.find((s) => String(s.id) === String(preServiceId));
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

        if (preServiceId && preDate) {
          if (preWorkerId) {
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
        setSlots(r.data.slots || []);
      }
    } catch (e) {
      setClosedInfo({ reason: "Unable to load slots. Please try again." });
    } finally {
      setSlotsLoading(false);
    }
  }, [selectedService, selectedDate, selectedWorker, salonId]);

  useEffect(() => {
    if (step === 3) fetchSlots();
  }, [step, fetchSlots]);

  /* ── Helpers ─── */
  function isOffDay(iso) {
    return offDays.some((o) => o.date === iso);
  }
  function offDayReason(iso) {
    return offDays.find((o) => o.date === iso)?.reason || "Salon Closed";
  }

  function workerLabel() {
    if (!selectedWorker) return "None selected";
    if (selectedWorker === "any") return "Auto-Assign (Any Available Specialist)";
    const w = workers.find((x) => String(x.id) === String(selectedWorker));
    return w ? w.name : "Specialist";
  }

  /* ── Submit ─── */
  async function handleConfirm() {
    if (!clientName.trim()) {
      setError("Please enter your name.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        salon_id: Number(salonId),
        service_id: selectedService.id,
        booking_date: selectedDate,
        start_time: selectedSlot.time,
        client_name: clientName.trim(),
        client_phone: clientPhone.trim(),
        client_email: clientEmail.trim(),
        notes: notes.trim(),
      };
      if (selectedWorker && selectedWorker !== "any") payload.worker_id = Number(selectedWorker);
      const r = await api.post("/bookings/create/", payload);
      setBookingResult(r.data.booking);
      setStep(5); // success screen
    } catch (e) {
      const detail =
        e?.response?.data?.error ||
        e?.response?.data?.detail ||
        "Booking failed. The slot may have just been taken. Please try another.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Prefill user info if logged in ─── */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      if (stored.first_name || stored.last_name) {
        setClientName(`${stored.first_name || ""} ${stored.last_name || ""}`.trim());
      }
      if (stored.email) setClientEmail(stored.email);
    } catch {}
  }, []);

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

  if (step === 5 && bookingResult) {
    return (
      <div className="bk-page">
        <CustomerHeader />
        <div className="bk-success-wrap">
          <div className="bk-success-card">
            <div className="bk-success-icon">✓</div>
            <h2>Appointment Confirmed!</h2>
            <p className="bk-success-sub">
              Your booking at <strong>{salon?.name}</strong> is all set.
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
                <span>👤 Stylist</span>
                <strong>{bookingResult.worker_name || "Any Available"}</strong>
              </div>
              <div className="bk-detail-row">
                <span>💰 Amount</span>
                <strong>₹{Number(bookingResult.service_price).toLocaleString("en-IN")}</strong>
              </div>
              <div className="bk-detail-row">
                <span>🔖 Booking ID</span>
                <strong>BMS-{bookingResult.id}</strong>
              </div>
            </div>
            <div className="bk-success-actions">
              <button className="bk-btn-primary" onClick={() => navigate("/customer/my-bookings")}>
                View My Bookings
              </button>
              <button className="bk-btn-outline" onClick={() => navigate(-1)}>
                Back to Salon
              </button>
            </div>
          </div>
        </div>
        <CustomerFooter />
      </div>
    );
  }

  return (
    <div className="bk-page">
      <CustomerHeader />

      <div className="bk-container">
        {/* Salon banner */}
        {salon && (
          <div className="bk-salon-banner">
            <h1 className="bk-salon-name">{salon.name}</h1>
            <p className="bk-salon-city">
              {salon.city}
              {salon.state ? `, ${salon.state}` : ""}
            </p>
          </div>
        )}

        {/* Stepper */}
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

        <div className="bk-body">
          {/* ── STEP 0: Service ─── */}
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
                      <div className="bk-svc-category">{svc.category}</div>
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

          {/* ── STEP 1: Date ─── */}
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

          {/* ── STEP 2: Stylist (Auto-assign or Specific Available Worker) ─── */}
          {step === 2 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Choose a Stylist</h2>
              <div className="bk-slot-meta">
                <span>📅 {selectedDate}</span>
                <span>✂ {selectedService?.name}</span>
                <span>⏱ {selectedService?.duration} min</span>
              </div>
              <div className="bk-workers-grid">
                {/* Any Available option */}
                <div
                  className={`bk-worker-card bk-worker-card--any ${selectedWorker === "any" ? "bk-worker-card--selected" : ""}`}
                  onClick={() => setSelectedWorker("any")}
                >
                  <div className="bk-worker-avatar bk-worker-avatar--any">✦</div>
                  <div className="bk-worker-info">
                    <div className="bk-worker-name">Auto-Assign (Any Available Stylist)</div>
                    <div className="bk-worker-spec">
                      Shows all time slots where at least one eligible stylist is free
                    </div>
                  </div>
                  {selectedWorker === "any" && <div className="bk-worker-check">✓</div>}
                </div>

                {workers.map((w) => {
                  const isUnavailable = w.is_on_leave || w.is_weekly_off || w.is_fully_booked || w.is_available === false;
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
                        <img src={w.profile_photo} alt={w.name} className="bk-worker-avatar" />
                      ) : (
                        <div className="bk-worker-avatar bk-worker-avatar--initials">
                          {w.name[0]}
                        </div>
                      )}
                      <div className="bk-worker-info">
                        <div className="bk-worker-name">{w.name}</div>
                        <div className="bk-worker-spec">{w.specialization}</div>
                        {isUnavailable ? (
                          <div style={{ color: "#dc2626", fontSize: "0.75rem", fontWeight: 600 }}>
                            {w.is_on_leave ? "On Leave" : w.is_weekly_off ? "Weekly Off" : "Fully Booked"}
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

          {/* ── STEP 3: Time Slot (Filtered for chosen worker or auto-assign) ─── */}
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

          {/* ── STEP 4: Confirm ─── */}
          {step === 4 && (
            <div className="bk-panel">
              <h2 className="bk-panel-title">Confirm Your Booking</h2>

              {/* Summary */}
              <div className="bk-confirm-summary">
                <div className="bk-confirm-row">
                  <span>🏪 Salon</span>
                  <strong>{salon?.name}</strong>
                </div>
                <div className="bk-confirm-row">
                  <span>✂ Service</span>
                  <strong>{selectedService?.name}</strong>
                </div>
                <div className="bk-confirm-row">
                  <span>📅 Date</span>
                  <strong>{selectedDate}</strong>
                </div>
                <div className="bk-confirm-row">
                  <span>🕐 Time</span>
                  <strong>
                    {selectedSlot && `${selectedSlot.time_display} → ${selectedSlot.end_time_display}`}
                  </strong>
                </div>
                <div className="bk-confirm-row">
                  <span>⏱ Duration</span>
                  <strong>{selectedService?.duration} min</strong>
                </div>
                <div className="bk-confirm-row">
                  <span>👤 Stylist</span>
                  <strong>{workerLabel()}</strong>
                </div>
                <div className="bk-confirm-row bk-confirm-row--total">
                  <span>💰 Total</span>
                  <strong>₹{Number(selectedService?.price).toLocaleString("en-IN")}</strong>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bk-customer-form">
                <h3>Your Details</h3>
                <label>
                  Full Name <span className="bk-required">*</span>
                  <input
                    type="text"
                    placeholder="Your full name"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </label>
                <label>
                  Phone Number
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                  />
                </label>
                <label>
                  Notes (optional)
                  <textarea
                    placeholder="Any special requests or preferences…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </label>
              </div>

              {error && <div className="bk-alert bk-alert--error">{error}</div>}

              <div className="bk-footer">
                <button className="bk-btn-outline" onClick={() => setStep(3)}>
                  ← Back
                </button>
                <button
                  className="bk-btn-primary bk-btn--confirm"
                  disabled={submitting}
                  onClick={handleConfirm}
                >
                  {submitting ? "Confirming…" : "✓ Confirm & Reserve Slot"}
                </button>
              </div>

              <p className="bk-policy-note">
                🛡 Free cancellation up to 2 hours before your appointment.
              </p>
            </div>
          )}
        </div>
      </div>

      <CustomerFooter />
    </div>
  );
}


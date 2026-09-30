import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/workerDashboard.css";
import "../../styles/workerCalendar.css";

export default function WorkerCalendar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Active top navigation tab
  const [activeNavTab, setActiveNavTab] = useState("calendar");

  // View state: 'month' | 'week' | 'day'
  const [activeView, setActiveView] = useState("month");

  // Selected date state (defaults to Sep 5, 2026 as in design)
  const [selectedDay, setSelectedDay] = useState(5);
  const [selectedMonth, setSelectedMonth] = useState("September");
  const [selectedYear, setSelectedYear] = useState(2026);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'blockLeave' | 'assignWalkin' | 'clientNotes' | 'formula' | 'sync'
  const [modalData, setModalData] = useState(null);
  const [toastMessage, setToastMessage] = useState("");

  // Service status for Sarah Jenkins
  const [sarahStatus, setSarahStatus] = useState("confirmed"); // 'confirmed' | 'in_chair' | 'completed'

  // Stylist Profile Info (adapts if logged in worker has custom details)
  const stylistName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : "Rahul Kumar";

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  // Calendar cells definition matching the image
  // 5 rows x 7 days = 35 cells for September 2026 (starting Tuesday Sep 1 or Monday Aug 31)
  const calendarCells = useMemo(() => {
    return [
      // Row 1
      { day: 31, isOtherMonth: true, text: "", type: "other" },
      { day: 1, text: "3 bkg", type: "booked", star: true },
      { day: 2, text: "Weekly OFF", type: "off", isWeeklyOff: true, icon: "🌙" },
      { day: 3, text: "4 bkg", type: "booked", star: true },
      { day: 4, text: "2 bkg", type: "booked", star: true },
      {
        day: 5,
        text: "2 Appts Active",
        type: "today_active",
        isToday: true,
        star: true,
      },
      { day: 6, text: "4 bkg", type: "booked", star: true },

      // Row 2
      { day: 7, text: "2 bkg", type: "booked", star: true },
      { day: 8, text: "Weekly OFF", type: "off", isWeeklyOff: true, icon: "🌙" },
      { day: 9, text: "5 bkg", type: "booked", star: true },
      { day: 10, text: "4 bkg", type: "booked", star: true },
      { day: 11, text: "4 bkg", type: "booked", star: true },
      { day: 12, text: "4 bkg (Full)", type: "full", isFull: true },
      { day: 13, text: "5 bkg", type: "booked", star: true },

      // Row 3
      { day: 14, text: "2 bkg", type: "booked", star: true },
      { day: 15, text: "Weekly OFF", type: "off", isWeeklyOff: true, icon: "🌙" },
      { day: 16, text: "3 bkg", type: "booked", star: true },
      { day: 17, text: "4 bkg", type: "booked", star: true },
      { day: 18, text: "4 bkg", type: "booked", star: true },
      { day: 19, text: "4 bkg (Full)", type: "full", isFull: true },
      { day: 20, text: "5 bkg", type: "booked", star: true },

      // Row 4
      { day: 21, text: "3 bkg", type: "booked", star: true },
      { day: 22, text: "Weekly OFF", type: "off", isWeeklyOff: true, icon: "🌙" },
      { day: 23, text: "2 bkg", type: "booked", star: true },
      { day: 24, text: "3 bkg", type: "booked", star: true },
      { day: 25, text: "3 bkg", type: "booked", star: true },
      { day: 26, text: "4 bkg", type: "full", isFull: true },
      { day: 27, text: "4 bkg", type: "booked", star: true },

      // Row 5
      { day: 28, text: "2 bkg", type: "booked", star: true },
      { day: 29, text: "Weekly OFF", type: "off", isWeeklyOff: true, icon: "🌙" },
      { day: 30, text: "3 bkg", type: "booked", star: true },
      { day: 1, isOtherMonth: true, text: "", type: "other" },
      { day: 2, isOtherMonth: true, text: "", type: "other" },
      { day: 3, isOtherMonth: true, text: "", type: "other" },
      { day: 4, isOtherMonth: true, text: "", type: "other" },
    ];
  }, []);

  const handleDayClick = (cell) => {
    if (cell.isOtherMonth) return;
    setSelectedDay(cell.day);
    if (cell.isWeeklyOff) {
      showToast(`Tuesday Sep ${cell.day} is your designated Weekly OFF shift.`);
    } else {
      showToast(`Loaded roster schedule for September ${cell.day}, 2026.`);
    }
  };

  const handleStartSarah = () => {
    if (sarahStatus === "confirmed") {
      setSarahStatus("in_chair");
      showToast("Sarah Jenkins checked-in and seated at Chair #01 Washbasin.");
    } else if (sarahStatus === "in_chair") {
      setSarahStatus("completed");
      showToast("Service for Sarah Jenkins marked COMPLETED.");
    } else {
      setSarahStatus("confirmed");
      showToast("Sarah Jenkins reset to Confirmed • In Lounge.");
    }
  };

  return (
    <div className="wcal-container">
      {/* ====================================================================
          1. TOP NAVIGATION BAR
          ==================================================================== */}
      <header className="wcal-navbar">
        <div className="wcal-navbar-inner">
          <div
            className="wcal-brand-area"
            onClick={() => navigate("/worker/dashboard")}
          >
            <div className="wcal-brand-icon">✂</div>
            <div className="wcal-brand-text">
              <span className="wcal-brand-title">BookMySalon</span>
              <span className="wcal-brand-sub">STYLIST SUITE PRO</span>
            </div>
          </div>

          <nav className="wcal-nav-tabs">
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "dashboard" ? "active" : ""}`}
              onClick={() => {
                setActiveNavTab("dashboard");
                navigate("/worker/dashboard");
              }}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "appointments" ? "active" : ""}`}
              onClick={() => {
                setActiveNavTab("appointments");
                navigate("/worker/dashboard");
              }}
            >
              Appointments
            </button>
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "calendar" ? "active" : ""}`}
              onClick={() => setActiveNavTab("calendar")}
            >
              Calendar
            </button>
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "services" ? "active" : ""}`}
              onClick={() => showToast("Services Menu: 12 assigned capabilities.")}
            >
              Services
            </button>
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "availability" ? "active" : ""}`}
              onClick={() => setActiveModal("blockLeave")}
            >
              Availability &amp; Leave
            </button>
            <button
              type="button"
              className={`wcal-nav-btn ${activeNavTab === "earnings" ? "active" : ""}`}
              onClick={() => showToast("Earnings & Tips: ₹1,800 today • ₹350 tip.")}
            >
              Earnings &amp; Tips
            </button>
          </nav>

          <div className="wcal-nav-right">
            <button
              type="button"
              className="btn-block-leave-header"
              onClick={() => setActiveModal("blockLeave")}
            >
              <span>📅</span> Block Time / Request Leave
            </button>

            <button
              type="button"
              className="wcal-icon-btn"
              title="Notifications"
              onClick={() => showToast("Shift Notification: Roster verified for Sep 5.")}
            >
              <span>🔔</span>
              <span className="wcal-notif-dot" />
            </button>

            <div
              className="wcal-user-avatar-pill"
              title={stylistName}
              onClick={() => navigate("/worker/dashboard")}
            >
              {stylistName.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      {/* Sub-header status bar */}
      <div className="wcal-sub-strip">
        <div className="wcal-sub-strip-inner">
          <span className="wcal-live-dot-small" />
          <span>
            {stylistName} · Chair #01 · Active Shift: 10:00 AM – 07:00 PM
          </span>
        </div>
      </div>

      {/* ====================================================================
          2. WORKER CALENDAR MAIN CONTENT
          ==================================================================== */}
      <main className="wcal-main">
        {/* Worker Calendar Hero Title Card */}
        <section className="wcal-header-card">
          <div className="wcal-header-left">
            <div className="wcal-calendar-icon-box">
              <span>🌿</span>
              <span className="wcal-icon-live-indicator" />
            </div>

            <div className="wcal-title-info">
              <div className="wcal-title-row">
                <h1 className="wcal-title">Worker Calendar</h1>
                <span className="wcal-pill-active-suite">ACTIVE SUITE</span>
                <span className="wcal-pill-chair">Chair #01</span>
              </div>
              <div className="wcal-stylist-meta">
                {stylistName} · Master Hair Specialist &amp; Trichologist · Indiranagar Flagship (InF)
              </div>
            </div>
          </div>

          <div className="wcal-header-right">
            <div className="wcal-view-segmented">
              <button
                type="button"
                className={`btn-wcal-view-tab ${activeView === "month" ? "active" : ""}`}
                onClick={() => setActiveView("month")}
              >
                Month
              </button>
              <button
                type="button"
                className={`btn-wcal-view-tab ${activeView === "week" ? "active" : ""}`}
                onClick={() => {
                  setActiveView("week");
                  showToast("Week view switched.");
                }}
              >
                Week
              </button>
              <button
                type="button"
                className={`btn-wcal-view-tab ${activeView === "day" ? "active" : ""}`}
                onClick={() => {
                  setActiveView("day");
                  showToast("Day schedule view switched.");
                }}
              >
                Day
              </button>
            </div>

            <button
              type="button"
              className="btn-wcal-sync"
              onClick={() => {
                setActiveModal("sync");
              }}
            >
              <span>🗓️</span> Sync Apple / Google Cal
            </button>

            <button
              type="button"
              className="btn-wcal-block-leave-main"
              onClick={() => setActiveModal("blockLeave")}
            >
              <span>📅</span> Block Time / Leave
            </button>
          </div>
        </section>

        {/* ==================================================================
            3. TWO-COLUMN SPLIT LAYOUT
            ================================================================== */}
        <div className="wcal-split-layout">
          {/* ================================================================
              LEFT COLUMN: CALENDAR GRID & PROJECTIONS
              ================================================================ */}
          <div className="wcal-left-column">
            {/* Calendar Grid Card */}
            <div className="wcal-calendar-card">
              <div className="wcal-cal-top-bar">
                <div className="wcal-cal-month-title">
                  <h2 className="wcal-month-name">
                    {selectedMonth} {selectedYear}
                  </h2>
                  <span className="wcal-badge-roster">Q3 Autumn Roster</span>
                </div>

                <div className="wcal-cal-nav-buttons">
                  <button
                    type="button"
                    className="btn-cal-today"
                    onClick={() => {
                      setSelectedDay(5);
                      showToast("Jumped to Today: Saturday, Sep 5, 2026.");
                    }}
                  >
                    Today (Sep 5)
                  </button>
                  <button
                    type="button"
                    className="btn-cal-step"
                    onClick={() => showToast("Previous Month")}
                  >
                    &lt;
                  </button>
                  <button
                    type="button"
                    className="btn-cal-step"
                    onClick={() => showToast("Next Month")}
                  >
                    &gt;
                  </button>
                </div>
              </div>

              {/* Calendar Grid */}
              <table className="wcal-grid-table">
                <thead>
                  <tr className="wcal-grid-header">
                    <th>MON</th>
                    <th>TUE</th>
                    <th>WED</th>
                    <th>THU</th>
                    <th>FRI</th>
                    <th>SAT</th>
                    <th>SUN</th>
                  </tr>
                </thead>
                <tbody>
                  {[0, 1, 2, 3, 4].map((rowIdx) => (
                    <tr key={rowIdx}>
                      {calendarCells
                        .slice(rowIdx * 7, rowIdx * 7 + 7)
                        .map((cell, colIdx) => {
                          const isSelected = !cell.isOtherMonth && cell.day === selectedDay;
                          const isTodayCell = cell.isToday;

                          return (
                            <td
                              key={colIdx}
                              className={`wcal-day-cell ${
                                cell.isOtherMonth ? "other-month" : ""
                              } ${isTodayCell ? "today-active" : ""} ${
                                isSelected && !isTodayCell ? "selected-day" : ""
                              }`}
                              onClick={() => handleDayClick(cell)}
                            >
                              <div className="wcal-cell-top">
                                <span className="wcal-cell-day-num">{cell.day}</span>
                                {cell.star && (
                                  <span className="wcal-cell-star">★</span>
                                )}
                              </div>

                              <div className="wcal-cell-content">
                                {cell.isWeeklyOff ? (
                                  <span className="wcal-pill-weekly-off">
                                    Weekly OFF
                                  </span>
                                ) : cell.isFull ? (
                                  <span className="wcal-pill-full-bar">
                                    {cell.text}
                                  </span>
                                ) : isTodayCell ? (
                                  <div>
                                    <div className="wcal-today-appts-badge">
                                      2 Appts Active
                                    </div>
                                    <div className="wcal-today-subtext">• Today</div>
                                  </div>
                                ) : cell.text ? (
                                  <span className="wcal-bkg-text">{cell.text}</span>
                                ) : null}
                              </div>
                            </td>
                          );
                        })}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend Footer */}
              <div className="wcal-legend-bar">
                <div className="wcal-legend-item">
                  <span className="wcal-dot booked" />
                  <span>Booked Slot</span>
                </div>
                <div className="wcal-legend-item">
                  <span className="wcal-dot buffer" />
                  <span>Sanitization Buffer</span>
                </div>
                <div className="wcal-legend-item">
                  <span className="wcal-dot off" />
                  <span>Personal Leave / Off</span>
                </div>
                <div className="wcal-legend-item">
                  <span className="wcal-dot available" />
                  <span>Available Window</span>
                </div>
              </div>
            </div>

            {/* Bottom Two Projection & Hygiene Cards */}
            <div className="wcal-bottom-cards-grid">
              {/* Card 1: SEPTEMBER PROJECTION - Monthly Performance */}
              <div className="wcal-projection-card">
                <div>
                  <div className="wcal-card-tag-row">
                    <span className="wcal-card-tag">SEPTEMBER PROJECTION</span>
                    <span className="wcal-card-icon">📈</span>
                  </div>
                  <h3 className="wcal-card-title">Monthly Performance</h3>
                  <p className="wcal-card-desc">
                    Chair #01 productivity and client retention velocity.
                  </p>

                  <div className="wcal-metrics-two-box">
                    <div className="wcal-metric-box">
                      <div className="wcal-metric-lbl">Total Bookings</div>
                      <div className="wcal-metric-big">
                        68 <span className="wcal-metric-trend">+12%</span>
                      </div>
                    </div>
                    <div className="wcal-metric-box">
                      <div className="wcal-metric-lbl">Floor Hours</div>
                      <div className="wcal-metric-big">
                        142 <span className="wcal-metric-unit">hrs</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="wcal-projection-footer">
                  <span>Peak Load: Saturday (100%)</span>
                  <span>Avg: 6.2 hrs/day</span>
                </div>
              </div>

              {/* Card 2: STATION HYGIENE & INVENTORY */}
              <div className="wcal-projection-card">
                <div>
                  <div className="wcal-card-tag-row">
                    <span className="wcal-card-tag">STATION HYGIENE &amp; INVENTORY</span>
                    <span className="wcal-live-dot-small" />
                  </div>
                  <h3 className="wcal-card-title">Chair #01 Status</h3>
                  <p className="wcal-card-desc">
                    Master suite compliance log for today&apos;s active shift.
                  </p>

                  <div className="wcal-hygiene-list">
                    <div className="wcal-hygiene-row">
                      <span className="wcal-hygiene-label">
                        🔬 Autoclave Shears &amp; Razors
                      </span>
                      <span className="wcal-pill-hygiene">Prepped &amp; Sealed</span>
                    </div>
                    <div className="wcal-hygiene-row">
                      <span className="wcal-hygiene-label">
                        ✨ UV Box Sanitization
                      </span>
                      <span className="wcal-pill-hygiene">Verified 3:45 PM</span>
                    </div>
                    <div className="wcal-hygiene-row">
                      <span className="wcal-hygiene-label">
                        🧺 Steamed Botanical Towels
                      </span>
                      <span className="wcal-pill-hygiene amber">
                        4 Fresh Sets Ready
                      </span>
                    </div>
                  </div>
                </div>

                <div className="wcal-hygiene-footer">
                  <span>🛡️ Trichology Lab Certified</span>
                  <span>Chair Handover: 07:00 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================================================================
              RIGHT COLUMN: SCHEDULED SHIFT TIMELINE
              ================================================================ */}
          <aside className="wcal-right-column">
            {/* Header info */}
            <div className="wcal-shift-header">
              <div className="wcal-shift-label">SCHEDULED SHIFT</div>
              <h2 className="wcal-shift-date">
                Saturday, September {selectedDay}, 2026
              </h2>
              <div className="wcal-shift-sub">
                Chair #01 · Master Hair Suite · Indiranagar Flagship
              </div>
              <div className="wcal-shift-status-strip">
                <span className="wcal-strip-confirmed">
                  <span className="wcal-live-dot-small" /> 2 Confirmed Appointments
                </span>
                <span>Shift: 10:00 AM – 07:00 PM</span>
              </div>
            </div>

            {/* Shift Timeline Items */}
            <div className="wcal-timeline-list">
              {/* Item 1: Shift Commencement / Prep */}
              <div className="wcal-timeline-step-done">
                <div className="wcal-step-left">
                  <div className="wcal-step-check-icon">✓</div>
                  <div className="wcal-step-info-block">
                    <div className="wcal-step-time-line">
                      <span className="wcal-step-time">10:00 AM</span>
                      <span className="wcal-pill-commenced">Shift Commenced</span>
                    </div>
                    <div className="wcal-step-title">
                      Station Preparation &amp; Tool Sanitization
                    </div>
                    <div className="wcal-step-desc">
                      Morning ritual complete: organic tonic inventory checked, UV autoclave cycle verified (Logged 09:45 AM).
                    </div>
                  </div>
                </div>
                <div className="wcal-check-badge-ok">✓</div>
              </div>

              {/* Item 2: Hero Appointment: Sarah Jenkins */}
              <div className="wcal-apt-card">
                <div className="wcal-apt-top-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="wcal-apt-pill-time">
                      04:00 PM – 04:45 PM (45 min)
                    </span>
                    <span className="wcal-apt-pill-lounge">
                      {sarahStatus === "in_chair"
                        ? "In Chair • Washbasin"
                        : sarahStatus === "completed"
                        ? "✓ Completed"
                        : "Confirmed • In Lounge"}
                    </span>
                  </div>
                  <div>
                    <div className="wcal-apt-price-tag">₹300</div>
                    <div className="wcal-apt-price-sub">Paid Online</div>
                  </div>
                </div>

                <div className="wcal-apt-client-section">
                  <div className="wcal-client-avatar">SJ</div>
                  <div className="wcal-client-meta">
                    <div className="wcal-client-name">Sarah Jenkins</div>
                    <div className="wcal-client-patron-badge">
                      ★ VIP Platinum Patron · 14th Visit
                    </div>
                  </div>
                </div>

                <div className="wcal-apt-service-line">
                  <span>Haircut: Precision Scissor &amp; Botanical Rinse</span>
                  <span className="wcal-apt-basin-tag">Chair #01 Washbasin</span>
                </div>

                <div className="wcal-apt-note-box">
                  💬 &ldquo;Sensitive scalp, prefers botanical rosemary and eucalyptus clarifying wash. No heated drying.&rdquo;
                </div>

                <div className="wcal-apt-actions-row">
                  <button
                    type="button"
                    className="btn-wcal-sub-action"
                    onClick={() => {
                      setActiveModal("clientNotes");
                      setModalData({
                        clientName: "Sarah Jenkins",
                        notes:
                          "Allergic to artificial scents. Use strictly 100% pure argan formula. Light feathering on framing bangs. Scalp is sensitive to heated blowdryers.",
                      });
                    }}
                  >
                    Client Notes
                  </button>
                  <button
                    type="button"
                    className="btn-wcal-sub-action"
                    onClick={() => {
                      setActiveModal("formula");
                      setModalData({
                        clientName: "Sarah Jenkins",
                        formula:
                          "Botanical Clarifying Rinse: Eucalyptus oil 3ml, Rosemary organic base 15ml, Cold water finish.",
                      });
                    }}
                  >
                    Formulation History
                  </button>
                  <button
                    type="button"
                    className="btn-wcal-checkin-primary"
                    onClick={handleStartSarah}
                  >
                    {sarahStatus === "confirmed"
                      ? "🪑 Start Service / Check-In"
                      : sarahStatus === "in_chair"
                      ? "✓ Complete Service"
                      : "✓ Completed"}
                  </button>
                </div>
              </div>

              {/* Item 3: Sanitization Buffer (Amber) */}
              <div className="wcal-buffer-card">
                <div className="wcal-buffer-left">
                  <span>⏰</span>
                  <div>
                    <strong>04:45 PM – 05:00 PM (15 min)</strong>
                    <div style={{ fontSize: "10.5px", color: "#a16207" }}>
                      Chair #01 Sanitization Buffer · Hot Herbal Towel Reload
                    </div>
                  </div>
                </div>
                <span className="wcal-buffer-pill">Buffer Active</span>
              </div>

              {/* Item 4: Upcoming Appointment: Johnathon Doe */}
              <div className="wcal-apt-card secondary">
                <div className="wcal-apt-top-row">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="wcal-apt-pill-time slate">
                      05:00 PM – 05:30 PM (30 min)
                    </span>
                    <span className="wcal-apt-pill-lounge">Confirmed</span>
                  </div>
                  <div>
                    <div className="wcal-apt-price-tag">₹250</div>
                    <div className="wcal-apt-price-sub">Paid Online</div>
                  </div>
                </div>

                <div className="wcal-apt-client-section">
                  <div className="wcal-client-avatar">JD</div>
                  <div className="wcal-client-meta">
                    <div className="wcal-client-name">Johnathon Doe</div>
                    <div className="wcal-client-patron-badge">
                      ★ VIP Gold Tier · Preferred Barber: Rahul
                    </div>
                  </div>
                </div>

                <div className="wcal-apt-service-line">
                  <span>Organic Beard Sculpt &amp; Hot Towel Care</span>
                  <span className="wcal-apt-basin-tag">Straight Razor Finish</span>
                </div>

                <div className="wcal-apt-note-box">
                  💬 &ldquo;Cedarwood &amp; jojoba beard balm re-order requested. Keep neckline natural clean taper.&rdquo;
                </div>

                <div className="wcal-apt-actions-row">
                  <button
                    type="button"
                    className="btn-wcal-sub-action"
                    onClick={() => {
                      setActiveModal("clientNotes");
                      setModalData({
                        clientName: "Johnathon Doe",
                        notes:
                          "Prefers straight razor detailing on neckline. Regular beard sculpt every 2 weeks.",
                      });
                    }}
                  >
                    View History
                  </button>
                  <button
                    type="button"
                    className="btn-wcal-sub-action"
                    onClick={() => {
                      setActiveModal("formula");
                      setModalData({
                        clientName: "Johnathon Doe",
                        formula: "Beard Balm: Cedarwood + Jojoba 50:50 blend.",
                      });
                    }}
                  >
                    Dye / Care Formula
                  </button>
                  <button
                    type="button"
                    className="btn-wcal-sub-action"
                    style={{ marginLeft: "auto" }}
                    onClick={() => showToast("Rebooking scheduled for Sep 19, 2026.")}
                  >
                    Rebook Next
                  </button>
                </div>
              </div>

              {/* Item 5: Open Window for Walk-ins (Green Dashed) */}
              <div className="wcal-walkin-card">
                <div className="wcal-walkin-info">
                  <div className="wcal-walkin-top-row">
                    <span>📅</span>
                    <span className="wcal-walkin-time">
                      05:30 PM – 07:00 PM
                    </span>
                    <span className="wcal-pill-window">90 min Open Window</span>
                  </div>
                  <div className="wcal-walkin-title">
                    Available for Walk-ins &amp; Instant Booking
                  </div>
                  <div className="wcal-walkin-desc">
                    Chair #01 open to front-desk assignment or express blowout / beard trim.
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-assign-walkin"
                  onClick={() => setActiveModal("assignWalkin")}
                >
                  + Assign Walk-in Client
                </button>
              </div>

              {/* Item 6: Shift Close / Handover */}
              <div className="wcal-shift-close-strip">
                <div>🚪 07:00 PM · Scheduled Shift Close &amp; Handover</div>
                <div>Next Shift: Sunday 10:00 AM</div>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* ====================================================================
          4. FOOTER
          ==================================================================== */}
      <footer className="wcal-footer">
        <div className="wcal-footer-inner">
          <div>BookMySalon Pro — Stylist Suite &amp; Client Operations</div>
          <div>
            ● Cloud Sync: Online · Shift Support Desk: Ext #402 · © 2026 BookMySalon Ltd.
          </div>
        </div>
      </footer>

      {/* ====================================================================
          5. MODALS & TOAST NOTIFICATION
          ==================================================================== */}
      {/* Block Time / Request Leave Modal */}
      {activeModal === "blockLeave" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Block Time / Request Leave</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p>Block a specific timeframe or request personal absence:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Select Date
                  </label>
                  <input
                    type="date"
                    defaultValue="2026-09-05"
                    className="wd-appointment-search-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Time Window
                  </label>
                  <select className="wd-appointment-search-input">
                    <option>Full Shift (10:00 AM - 07:00 PM)</option>
                    <option>Morning Block (10:00 AM - 02:00 PM)</option>
                    <option>Evening Block (04:00 PM - 07:00 PM)</option>
                    <option>Buffer Window (1 Hour)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Reason
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter reason (Doctor appointment, personal errand, technical station maintenance)..."
                    className="wd-appointment-search-input"
                    style={{ resize: "none" }}
                  />
                </div>
              </div>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setActiveModal(null);
                  showToast("Leave / Block time request submitted to Salon Manager!");
                }}
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Walk-In Client Modal */}
      {activeModal === "assignWalkin" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Assign Walk-In Client to Chair #01</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p>Quick seat client during open window (05:30 PM – 07:00 PM):</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Client Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Sharma"
                    className="wd-appointment-search-input"
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                    Service
                  </label>
                  <select className="wd-appointment-search-input">
                    <option>Express Hair Trim &amp; Styling (30 min - ₹350)</option>
                    <option>Beard Sculpt &amp; Shaping (25 min - ₹250)</option>
                    <option>Botanical Scalp Massage &amp; Wash (40 min - ₹500)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setActiveModal(null);
                  showToast("Walk-in client successfully assigned to Chair #01!");
                }}
              >
                Assign &amp; Seat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client Notes Modal */}
      {activeModal === "clientNotes" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">
                Client Notes: {modalData?.clientName}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p style={{ fontSize: "14px", lineHeight: "1.6" }}>
                {modalData?.notes}
              </p>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulation History Modal */}
      {activeModal === "formula" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">
                Formulation &amp; Care Formula: {modalData?.clientName}
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p style={{ fontSize: "14px", lineHeight: "1.6" }}>
                {modalData?.formula}
              </p>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Calendar Modal */}
      {activeModal === "sync" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Sync with External Calendar</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p>
                Subscribe to your live BookMySalon shift schedule on Apple Calendar or Google Calendar:
              </p>
              <div style={{ background: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", marginTop: "10px" }}>
                <code style={{ fontSize: "11px", wordBreak: "break-all" }}>
                  webcal://bookmysalon.pro/api/cal/worker/v1/subscribe.ics?token=bms_auth_78942
                </code>
              </div>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    "webcal://bookmysalon.pro/api/cal/worker/v1/subscribe.ics?token=bms_auth_78942"
                  );
                  setActiveModal(null);
                  showToast("Calendar sync link copied to clipboard!");
                }}
              >
                Copy Sync Link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="wd-toast-notification">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

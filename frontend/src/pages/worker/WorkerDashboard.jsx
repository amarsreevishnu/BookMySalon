import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import WorkerHeader from "../../components/worker/WorkerHeader";
import WorkerSalonBanner from "../../components/worker/WorkerSalonBanner";
import "../../styles/workerDashboard.css";

const formatLocalDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [activeNavTab, setActiveNavTab] = useState("dashboard");

  const [activeDateTab, setActiveDateTab] = useState("today"); 
  const [activeSegmentTab, setActiveSegmentTab] = useState("upcoming"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [activeModal, setActiveModal] = useState(null); 
  const [activeModalData, setActiveModalData] = useState(null);

  const [serviceStatus, setServiceStatus] = useState("prepped"); 
  
  const [assignedBookings, setAssignedBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => new Date());

  const handleNavTabChange = (tab) => {
    setActiveNavTab(tab);
    if (tab === "appointments") {
      setActiveDateTab("all");
    } else if (tab === "dashboard") {
      setActiveDateTab("today");
    }
  };

  useEffect(() => {
    if (location.state?.view === "all") {
      setActiveDateTab("all");
      setActiveNavTab("appointments");
    }
  }, [location.state]);

  const [salonInfo, setSalonInfo] = useState({
    id: null,
    name: "Salon",
    category: "",
    address: "",
    city: "",
    phone: "",
  });

  const [workerData, setWorkerData] = useState(null);
  const [latestReview, setLatestReview] = useState(null);
  const [kpiStats, setKpiStats] = useState({
    total_bookings: 0,
    today_bookings: 0,
    completed_bookings: 0,
    in_progress_bookings: 0,
    upcoming_bookings: 0,
    settled_earnings: 0,
  });

  const stylistProfile = useMemo(() => {
    const defaultName = "Specialist";
    const name =
      workerData?.full_name ||
      (user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : defaultName);

    return {
      name,
      roleBadge: workerData?.specialization || "Senior Specialist",
      chair: workerData?.station || "Chair #01 Station",
      shift: workerData?.shift_hours?.start
        ? `Shift: ${workerData.shift_hours.start} - ${workerData.shift_hours.end}`
        : "Shift: 10:00 AM - 07:00 PM",
      stationStatus: "Prepped & Active",
      workloadNote: `Assigned Station at ${salonInfo.name}`,
      avatar:
        workerData?.profile_photo ||
        "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=160&q=80",
    };
  }, [user, workerData, salonInfo.name]);

  const fetchDashboard = async () => {
    try {
      const res = await api.get("/salons/worker/dashboard/");
      if (res.data) {
        if (res.data.salon) {
          setSalonInfo(res.data.salon);
        }
        if (res.data.worker) {
          setWorkerData(res.data.worker);
        }
        if (res.data.kpi_stats) {
          setKpiStats(res.data.kpi_stats);
        }
        if (Array.isArray(res.data.assigned_bookings)) {
          setAssignedBookings(res.data.assigned_bookings);
        }
        if (res.data.latest_review) {
          setLatestReview(res.data.latest_review);
        }
      }
    } catch (err) {
      console.warn("Using baseline stylist suite design data:", err?.message);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const { todayStr, tomorrowStr, weekStartStr, weekEndStr, selectedDateStr } = useMemo(() => {
    const now = new Date();
    const todayStr = formatLocalDate(now);

    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = formatLocalDate(tom);

    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = formatLocalDate(weekEnd);

    const selStr = selectedDate ? formatLocalDate(selectedDate) : todayStr;
    return { todayStr, tomorrowStr, weekStartStr: todayStr, weekEndStr, selectedDateStr: selStr };
  }, [selectedDate]);

  const dateFilteredBookings = useMemo(() => {
    if (!assignedBookings || assignedBookings.length === 0) return [];

    return assignedBookings.filter((b) => {
      if (!b.booking_date) return true;
      if (activeDateTab === "today") {
        return b.booking_date === todayStr;
      }
      if (activeDateTab === "tomorrow") {
        return b.booking_date === tomorrowStr;
      }
      if (activeDateTab === "week") {
        return b.booking_date >= weekStartStr && b.booking_date <= weekEndStr;
      }
      if (activeDateTab === "custom") {
        return b.booking_date === selectedDateStr;
      }
      return true; // "all"
    });
  }, [assignedBookings, activeDateTab, todayStr, tomorrowStr, weekStartStr, weekEndStr, selectedDateStr]);

  const { heroAppointment, upcomingQueue, completedList } = useMemo(() => {
    if (!dateFilteredBookings || dateFilteredBookings.length === 0) {
      return { heroAppointment: null, upcomingQueue: [], completedList: [] };
    }

    // 1. In-progress booking first
    const inProg = dateFilteredBookings.find((b) => b.status === "IN_PROGRESS");
    // 2. Or first confirmed / pending booking
    const firstUpcoming = dateFilteredBookings.find(
      (b) => b.status === "CONFIRMED" || b.status === "PENDING"
    );
    const activeHero = inProg || firstUpcoming || null;

    let hero = null;
    if (activeHero) {
      const rawTime = activeHero.start_time || activeHero.booking_time || "10:00";
      let formattedHour = "10:00";
      let formattedAmpm = "AM";
      if (rawTime.includes(":")) {
        const parts = rawTime.split(":");
        const h = parseInt(parts[0], 10);
        const m = parts[1].substring(0, 2);
        formattedHour = `${h % 12 || 12}:${m}`;
        formattedAmpm = h >= 12 ? "PM" : "AM";
      }

      hero = {
        rawId: activeHero.id,
        id: `apt-${activeHero.id}`,
        appId: `APPID: #${activeHero.id}`,
        clientName: activeHero.client_name || "Client",
        badgeTier: activeHero.status === "IN_PROGRESS" ? "IN CHAIR NOW" : "CONFIRMED CLIENT",
        serviceName: activeHero.service_name || "Salon Service",
        duration: activeHero.duration || "45 mins",
        price: `₹${Math.round(activeHero.service_price || 0)}`,
        paymentStatus:
          activeHero.payment_status === "PAID"
            ? "Paid Online"
            : activeHero.payment_method === "SALON"
            ? "Pay at Salon"
            : "Pending Payment",
        startTime: formattedHour,
        ampm: formattedAmpm,
        arrivalText: activeHero.status === "IN_PROGRESS" ? "In Service" : "On Schedule",
        loungeStatus:
          activeHero.status === "IN_PROGRESS"
            ? `CURRENTLY AT ${activeHero.station || "CHAIR #01"}`
            : `CURRENTLY IN LOUNGE • PREPPED FOR ${activeHero.station || "CHAIR #01"}`,
        clientNote: activeHero.notes || "Client appointment confirmed via BookMySalon.",
        phone: activeHero.client_phone || "+91 98450 12345",
        rawStatus: activeHero.status,
      };
    }

    const remainingUpcoming = dateFilteredBookings
      .filter((b) => b.id !== activeHero?.id && (b.status === "CONFIRMED" || b.status === "PENDING"))
      .map((b, idx) => {
        const rawTime = b.start_time || b.booking_time || "10:00";
        let timeDisplay = b.booking_time || rawTime;
        if (rawTime.includes(":") && !rawTime.includes("AM") && !rawTime.includes("PM")) {
          const parts = rawTime.split(":");
          const h = parseInt(parts[0], 10);
          const m = parts[1].substring(0, 2);
          timeDisplay = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
        }
        return {
          rawId: b.id,
          id: `apt-q-${b.id}`,
          refCode: `#BMS-${b.id}`,
          time: timeDisplay,
          timeLabel: idx === 0 ? "NEXT" : "LATER",
          clientName: b.client_name,
          statusTag: b.status === "CONFIRMED" ? "Confirmed" : "Pending",
          serviceName: b.service_name,
          meta: `${b.duration || "45 min"} • ₹${Math.round(b.service_price || 0)} • ${b.station || "Station"}`,
          prepNotes: b.notes || "Standard service prep.",
          phone: b.client_phone,
          rawStatus: b.status,
          bookingDate: b.booking_date,
        };
      });

    const completed = dateFilteredBookings
      .filter((b) => b.status === "COMPLETED")
      .map((b) => {
        const rawTime = b.start_time || b.booking_time || "10:00";
        let timeDisplay = b.booking_time || rawTime;
        if (rawTime.includes(":") && !rawTime.includes("AM") && !rawTime.includes("PM")) {
          const parts = rawTime.split(":");
          const h = parseInt(parts[0], 10);
          const m = parts[1].substring(0, 2);
          timeDisplay = `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
        }
        return {
          rawId: b.id,
          id: `apt-c-${b.id}`,
          refCode: `#BMS-${b.id}`,
          time: timeDisplay,
          clientName: b.client_name,
          badgeTier: "COMPLETED",
          serviceName: b.service_name,
          servicePrice: b.service_price,
          paymentMethod: b.payment_method,
          paymentStatus: b.payment_status,
          meta: `${b.duration || "45 min"} • ₹${Math.round(b.service_price || 0)} • Settled`,
          clientNote: b.notes || "Service completed smoothly.",
          hasReceipt: true,
          hasRebook: false,
          rawStatus: b.status,
        };
      });

    return { heroAppointment: hero, upcomingQueue: remainingUpcoming, completedList: completed };
  }, [dateFilteredBookings]);

  useEffect(() => {
    if (heroAppointment) {
      if (heroAppointment.rawStatus === "IN_PROGRESS") {
        setServiceStatus("in_progress");
      } else {
        setServiceStatus("prepped");
      }
    } else {
      setServiceStatus("prepped");
    }
  }, [heroAppointment]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleStartService = async () => {
    if (!heroAppointment) {
      showToast("No active appointment in queue.");
      return;
    }

    try {
      if (heroAppointment.rawStatus === "IN_PROGRESS") {
        await api.patch(`/salons/worker/bookings/${heroAppointment.rawId}/status/`, {
          status: "COMPLETED",
        });
        showToast(`Service for ${heroAppointment.clientName} completed! Station reset.`);
      } else {
        await api.patch(`/salons/worker/bookings/${heroAppointment.rawId}/status/`, {
          status: "IN_PROGRESS",
        });
        showToast(`${heroAppointment.clientName} seated at ${stylistProfile.chair}! Service IN PROGRESS.`);
      }
      await fetchDashboard();
    } catch (err) {
      console.error("Failed to update status:", err);
      showToast(err.response?.data?.error || "Failed to update appointment status.");
    }
  };

  const handleSeatQueueBooking = async (queueItem) => {
    try {
      await api.patch(`/salons/worker/bookings/${queueItem.rawId}/status/`, {
        status: "IN_PROGRESS",
      });
      showToast(`${queueItem.clientName} seated! Service marked IN PROGRESS.`);
      await fetchDashboard();
    } catch (err) {
      console.error("Failed to seat client:", err);
      showToast(err.response?.data?.error || "Failed to seat client.");
    }
  };

  const handleCompleteQueueBooking = async (queueItem) => {
    try {
      await api.patch(`/salons/worker/bookings/${queueItem.rawId}/status/`, {
        status: "COMPLETED",
      });
      showToast(`Appointment for ${queueItem.clientName} marked as COMPLETED! 🎉`);
      await fetchDashboard();
    } catch (err) {
      console.error("Failed to complete appointment:", err);
      showToast(err.response?.data?.error || "Failed to complete appointment.");
    }
  };

  const handleCallClientToChair = () => {
    if (!heroAppointment) {
      showToast("No client is currently waiting in queue.");
      return;
    }
    showToast(`Paging Reception Lounge: ${heroAppointment.clientName} called to ${stylistProfile.chair}.`);
  };

  const handlePrintRunSheet = () => {
    window.print();
  };

  
  const filteredUpcoming = useMemo(() => {
    if (!searchQuery.trim()) return upcomingQueue;
    const q = searchQuery.toLowerCase();
    return upcomingQueue.filter(
      (item) =>
        item.clientName.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        item.refCode.toLowerCase().includes(q)
    );
  }, [upcomingQueue, searchQuery]);

  
  const filteredCompleted = useMemo(() => {
    if (!searchQuery.trim()) return completedList;
    const q = searchQuery.toLowerCase();
    return completedList.filter(
      (item) =>
        item.clientName.toLowerCase().includes(q) ||
        item.serviceName.toLowerCase().includes(q) ||
        (item.refCode && item.refCode.toLowerCase().includes(q))
    );
  }, [completedList, searchQuery]);

  return (
    <div className="wd-container">
      <WorkerHeader
        activeTab={activeNavTab}
        onTabChange={handleNavTabChange}
        salonInfo={salonInfo}
        stylistProfile={stylistProfile}
        extraNavItems={
          <>
                      
            {/* <button
              type="button"
              className={`wd-nav-tab ${activeNavTab === "payouts" ? "active" : ""}`}
              onClick={() => {
                setActiveNavTab("payouts");
                showToast("Payouts: ₹1,800 settled today • ₹350 tips pending.");
              }}
            >
              Payouts
            </button> */}
          </>
        }
      />

     
      <main className="wd-main">
        
        <WorkerSalonBanner salonInfo={salonInfo} />

       
        <section className="wd-stylist-hero-card">
          <div className="wd-stylist-left">
            <div className="wd-avatar-wrapper">
              <img
                src={stylistProfile.avatar}
                alt={stylistProfile.name}
                className="wd-stylist-avatar"
              />
              <div className="wd-duty-badge">
                <span className="wd-duty-dot" />
                <span>ON DUTY</span>
              </div>
            </div>

            <div className="wd-stylist-details">
              <div className="wd-name-row">
                <h1 className="wd-stylist-name">{stylistProfile.name}</h1>
                <span className="wd-specialist-badge">{stylistProfile.roleBadge}</span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "3px 9px",
                    borderRadius: "999px",
                    border: "1px solid #fde68a",
                  }}
                  title="Stylist Client Rating"
                >
                  ★ {workerData?.rating || "5.0"} ({workerData?.reviews_count || 0} reviews)
                </span>
              </div>
              <div className="wd-station-info-row">
                <span>{stylistProfile.chair}</span>
                <span>•</span>
                <strong>{salonInfo.name}</strong>
                <span>•</span>
                <span>{stylistProfile.shift}</span>
                <span>•</span>
                <span className="wd-prepped-status">✓ {stylistProfile.stationStatus}</span>
              </div>
              <div className="wd-workload-subtext">{stylistProfile.workloadNote}</div>
            </div>
          </div>

          {/* <div className="wd-stylist-actions">
            <button
              type="button"
              className="btn-station-log"
              onClick={() => setActiveModal("stationCare")}
            >
              <span>⚖️</span> Station Care &amp; Log
            </button>
            <button
              type="button"
              className="btn-concierge-desk"
              onClick={() => setActiveModal("concierge")}
            >
              <span>🎧</span> Contact Concierge Desk
            </button>
          </div> */}
        </section>

        
        <section className="wd-kpi-grid">
          {/* Card 1: Today's Appointments */}
          <div className="wd-kpi-card">
            <div>
              <div className="wd-kpi-top-row">
                <span className="wd-kpi-title">TODAY&apos;S APPOINTMENTS</span>
                <span className="wd-kpi-icon">📅</span>
              </div>
              <div className="wd-kpi-val">{kpiStats.today_bookings ?? (upcomingQueue.length + completedList.length + (heroAppointment ? 1 : 0))} Total</div>
              <div className="wd-kpi-subtext">
                {kpiStats.completed_bookings ?? completedList.length} Completed • {serviceStatus === "in_progress" ? "1 In-Chair" : (heroAppointment ? "1 Prepped" : "0 Prepped")} • {kpiStats.upcoming_bookings ?? upcomingQueue.length} Upcoming
              </div>
            </div>
            <div className="wd-kpi-trend">
              <span>🏛️</span> {salonInfo.name}
            </div>
          </div>

          {/* Card 2: Settled Earnings */}
          <div className="wd-kpi-card">
            <div>
              <div className="wd-kpi-top-row">
                <span className="wd-kpi-title">SETTLED EARNINGS</span>
                <span className="wd-kpi-icon">💳</span>
              </div>
              <div className="wd-kpi-val">₹{Math.round(kpiStats.settled_earnings || 0).toLocaleString("en-IN")}</div>
              <div className="wd-kpi-subtext">Completed &amp; paid sessions</div>
            </div>
            <div className="wd-kpi-trend">
              <span>📈</span> {kpiStats.completed_bookings ?? completedList.length} Sessions Settled
            </div>
          </div>

          {/* Card 3: Turnaround Rate */}
          <div className="wd-kpi-card">
            <div>
              <div className="wd-kpi-top-row">
                <span className="wd-kpi-title">CHAIR TURNAROUND RATE</span>
                <span className="wd-kpi-icon">🎚️</span>
              </div>
              <div className="wd-kpi-val">98% On-Time</div>
              <div className="wd-kpi-subtext">Avg. consultation-turnaround: 4 mins</div>
            </div>
            <div className="wd-kpi-trend">
              <span>✓</span> {stylistProfile.chair} Benchmark: Top 5%
            </div>
          </div>

          {/* Card 4: Lounge Client */}
          <div className="wd-kpi-card lounge-card">
            {heroAppointment ? (
              <>
                <div>
                  <div className="wd-lounge-header">
                    <span className="wd-lounge-pill">
                      <span className="wd-duty-dot" />
                      {heroAppointment.rawStatus === "IN_PROGRESS" ? "IN SERVICE" : "WAITING AT LOUNGE"}
                    </span>
                    <span className="wd-lounge-time">{heroAppointment.startTime} {heroAppointment.ampm}</span>
                  </div>
                  <div className="wd-lounge-client">{heroAppointment.clientName}</div>
                  <div className="wd-lounge-service">{heroAppointment.serviceName} • {heroAppointment.price}</div>
                </div>
                <div className="wd-lounge-footer">
                  <span className="wd-lounge-note">{heroAppointment.phone || "On Schedule"}</span>
                  <button
                    type="button"
                    className="btn-call-chair-link"
                    onClick={handleCallClientToChair}
                  >
                    Call Chair &rarr;
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div className="wd-lounge-header">
                  <span className="wd-lounge-pill" style={{ background: "#f3f4f6", color: "#6b7280" }}>
                    CHAIR AVAILABLE
                  </span>
                </div>
                <div className="wd-lounge-client" style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}>
                  No client in chair
                </div>
                <div className="wd-lounge-service" style={{ fontSize: "12px", color: "#9ca3af" }}>
                  Station is prepped &amp; ready
                </div>
              </div>
            )}
          </div>
        </section>
 
        <div className="wd-split-layout">    
          <div className="wd-left-feed">
            <div className="wd-date-toolbar">
              <div className="wd-date-row-1">
                <div className="wd-date-stepper">
                  <button
                    type="button"
                    className="btn-date-step"
                    title="Previous Day"
                    onClick={() => {
                      const prev = new Date(selectedDate);
                      prev.setDate(prev.getDate() - 1);
                      setSelectedDate(prev);
                      setActiveDateTab("custom");
                    }}
                  >
                    &lt;
                  </button>
                  <span className="wd-date-label">
                    {selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <button
                    type="button"
                    className="btn-date-step"
                    title="Next Day"
                    onClick={() => {
                      const next = new Date(selectedDate);
                      next.setDate(next.getDate() + 1);
                      setSelectedDate(next);
                      setActiveDateTab("custom");
                    }}
                  >
                    &gt;
                  </button>
                </div>

                <div className="wd-quick-date-pills">
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "today" ? "active" : ""}`}
                    onClick={() => {
                      setSelectedDate(new Date());
                      setActiveDateTab("today");
                    }}
                  >
                    Today ({assignedBookings.filter((b) => b.booking_date === todayStr).length})
                  </button>
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "tomorrow" ? "active" : ""}`}
                    onClick={() => {
                      const tom = new Date();
                      tom.setDate(tom.getDate() + 1);
                      setSelectedDate(tom);
                      setActiveDateTab("tomorrow");
                    }}
                  >
                    Tomorrow ({assignedBookings.filter((b) => b.booking_date === tomorrowStr).length})
                  </button>
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "week" ? "active" : ""}`}
                    onClick={() => setActiveDateTab("week")}
                  >
                    This Week
                  </button>
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "all" ? "active" : ""}`}
                    onClick={() => setActiveDateTab("all")}
                  >
                    All ({assignedBookings.length})
                  </button>
                  <button
                    type="button"
                    className="btn-calendar-picker"
                    title="Select Date"
                    onClick={() => navigate("/worker/calendar")}
                  >
                    🗓️
                  </button>
                </div>
              </div>

              <div className="wd-date-row-2">
                <div className="wd-appointment-search-wrapper">
                  <span className="wd-search-icon-sub">🔍</span>
                  <input
                    type="text"
                    className="wd-appointment-search-input"
                    placeholder="Search client, ID, service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="btn-filter-settings"
                  title="Filter appointments"
                  onClick={() => showToast("Filter preferences active.")}
                >
                  🎛️
                </button>
              </div>

              {/* Segmented Status Tabs */}
              <div className="wd-status-segmented-tabs">
                <button
                  type="button"
                  className={`btn-segment-tab ${activeSegmentTab === "upcoming" ? "active" : ""}`}
                  onClick={() => setActiveSegmentTab("upcoming")}
                >
                  Upcoming &amp; In-Chair ({upcomingQueue.length + (heroAppointment ? 1 : 0)})
                </button>
                <button
                  type="button"
                  className={`btn-segment-tab ${activeSegmentTab === "completed" ? "active" : ""}`}
                  onClick={() => setActiveSegmentTab("completed")}
                >
                  Completed ({completedList.length})
                </button>
                <button
                  type="button"
                  className={`btn-segment-tab ${activeSegmentTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveSegmentTab("all")}
                >
                  All Scheduled ({upcomingQueue.length + (heroAppointment ? 1 : 0) + completedList.length})
                </button>
              </div>
            </div>

            {/* Highlighted Hero Appointment Card */}
            {(activeSegmentTab === "upcoming" || activeSegmentTab === "all") && (
              heroAppointment ? (
                <div className="wd-hero-apt-card">
                  {/* Top strip */}
                  <div className="wd-hero-apt-strip">
                    <span className="wd-hero-apt-tag">
                      <span className="wd-duty-dot" />
                      {heroAppointment.loungeStatus}
                    </span>
                    <span className="wd-hero-apt-arrival">{heroAppointment.arrivalText}</span>
                  </div>

                  {/* Main Card Body */}
                  <div className="wd-hero-apt-body">
                    <div className="wd-time-start-box">
                      <span className="wd-time-start-label">START</span>
                      <span className="wd-time-start-hour">{heroAppointment.startTime}</span>
                      <span className="wd-time-start-ampm">{heroAppointment.ampm}</span>
                    </div>

                    <div className="wd-hero-apt-info">
                      <div className="wd-hero-client-row">
                        <h2 className="wd-hero-client-name">{heroAppointment.clientName}</h2>
                        <span className="wd-pill-platinum">★ {heroAppointment.badgeTier}</span>
                      </div>
                      <div className="wd-hero-appid">{heroAppointment.appId}</div>
                      <div className="wd-hero-service-title">{heroAppointment.serviceName}</div>
                      <div className="wd-hero-service-meta">
                        <span>⏱ {heroAppointment.duration}</span>
                        <span>•</span>
                        <strong style={{ color: "#111827" }}>{heroAppointment.price}</strong>
                        <span className="wd-pill-paid-online">{heroAppointment.paymentStatus}</span>
                      </div>
                    </div>

                    <div className="wd-hero-apt-actions">
                      <button
                        type="button"
                        className={`btn-start-seat-chair ${
                          serviceStatus === "in_progress" ? "complete" : ""
                        }`}
                        onClick={handleStartService}
                      >
                        {serviceStatus === "in_progress"
                          ? "✓ Mark Service Completed"
                          : `🪑 Start Service / Seat at ${stylistProfile.chair}`}
                      </button>

                      <div className="wd-hero-secondary-buttons">
                        <button
                          type="button"
                          className="btn-hero-sub"
                          onClick={() => {
                            setActiveModal("hairProfile");
                            setActiveModalData(heroAppointment);
                          }}
                        >
                          📋 Hair Profile
                        </button>
                        <button
                          type="button"
                          className="btn-hero-sub"
                          onClick={() => {
                            showToast(`Ping sent to front desk concierge for ${heroAppointment.clientName}.`);
                          }}
                        >
                          🔔 Ping Desk
                        </button>
                        <button
                          type="button"
                          className="btn-hero-sub ready"
                          onClick={() => {
                            showToast(`Station notified: Stylist is 100% ready for ${heroAppointment.clientName}.`);
                          }}
                        >
                          ✓ Ready for You
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="wd-client-scalp-note">
                    <span className="wd-note-icon">👜</span>
                    <div>
                      <strong>Client Hair &amp; Scalp Note:</strong> &ldquo;
                      {heroAppointment.clientNote}&rdquo;
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #e5e7eb",
                    padding: "32px 24px",
                    textAlign: "center",
                    marginBottom: "16px",
                  }}
                >
                  <div style={{ fontSize: "36px", marginBottom: "8px" }}>🪑</div>
                  <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#111827" }}>
                    No Active Appointment in Chair
                  </h3>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6b7280" }}>
                    {stylistProfile.chair} is clean and ready. Any upcoming client bookings will appear below.
                  </p>
                  {assignedBookings.length > 0 && activeDateTab !== "all" && (
                    <div style={{ marginTop: "14px" }}>
                      <button
                        type="button"
                        onClick={() => setActiveDateTab("all")}
                        style={{
                          padding: "8px 16px",
                          background: "#111827",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                        }}
                      >
                        <span>📋 View All Assigned Appointments ({assignedBookings.length})</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

            {/* Upcoming Queue List */}
            {(activeSegmentTab === "upcoming" || activeSegmentTab === "all") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredUpcoming.length === 0 && !heroAppointment ? (
                  <div style={{ padding: "32px 16px", textAlign: "center", color: "#6b7280", background: "#ffffff", borderRadius: "14px", border: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: "28px", marginBottom: "6px" }}>☕</div>
                    <p style={{ margin: 0, fontWeight: 600, color: "#111827", fontSize: "14px" }}>
                      No upcoming appointments scheduled for this date
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
                      Use the date selector above or view all appointments in your queue.
                    </p>
                    {assignedBookings.length > 0 && activeDateTab !== "all" && (
                      <div style={{ marginTop: "14px" }}>
                        <button
                          type="button"
                          onClick={() => setActiveDateTab("all")}
                          style={{
                            padding: "8px 16px",
                            background: "#111827",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <span>📋 View All Assigned Appointments ({assignedBookings.length})</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredUpcoming.map((item) => (
                    <div key={item.id} className="wd-queue-card">
                      <div className="wd-queue-left">
                        <div className="wd-time-badge-small">
                          <div className="wd-badge-next-label">{item.timeLabel}</div>
                          <div className="wd-badge-next-time">{item.time}</div>
                        </div>

                        <div className="wd-queue-info">
                          <div className="wd-queue-name-line">
                            <span className="wd-queue-name">{item.clientName}</span>
                            <span className="wd-queue-tag">{item.refCode}</span>
                            <span
                              className={
                                item.statusTag.includes("Confirmed")
                                  ? "wd-tag-confirmed"
                                  : "wd-tag-final"
                              }
                            >
                              {item.statusTag}
                            </span>
                          </div>
                          <div className="wd-queue-service">{item.serviceName}</div>
                          <div className="wd-queue-meta">
                            {item.bookingDate ? `${item.bookingDate} • ` : ""}{item.meta}
                          </div>
                        </div>
                      </div>

                      <div className="wd-queue-right">
                        {item.rawStatus !== "IN_PROGRESS" && (
                          <button
                            type="button"
                            className="btn-start-seat-chair"
                            style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "8px" }}
                            onClick={() => handleSeatQueueBooking(item)}
                          >
                            🪑 Seat
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-start-seat-chair"
                          style={{
                            padding: "6px 12px",
                            fontSize: "12px",
                            borderRadius: "8px",
                            background: "#16a34a",
                            color: "#ffffff",
                            border: "none",
                            cursor: "pointer",
                            fontWeight: 600,
                          }}
                          onClick={() => handleCompleteQueueBooking(item)}
                          title="Mark appointment as completed"
                        >
                          ✓ Complete
                        </button>
                        <button
                          type="button"
                          className="btn-prep-notes"
                          onClick={() => {
                            setActiveModal("prepNotes");
                            setActiveModalData(item);
                          }}
                        >
                          View Notes
                        </button>
                        <button
                          type="button"
                          className="btn-icon-kebab"
                          title="More options"
                          onClick={() => showToast(`Actions for ${item.clientName}`)}
                        >
                          ⋮
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Completed Sessions Today Section */}
            {(activeSegmentTab === "completed" || activeSegmentTab === "all") && (
              <section className="wd-completed-section">
                <div className="wd-completed-header">
                  <h3 className="wd-completed-title">
                    COMPLETED SESSIONS ({filteredCompleted.length})
                  </h3>
                </div>

                {filteredCompleted.length === 0 ? (
                  <div style={{ padding: "24px 16px", textAlign: "center", color: "#6b7280", background: "#f9fafb", borderRadius: "12px" }}>
                    <p style={{ margin: 0, fontSize: "13px" }}>No completed sessions yet for this period.</p>
                  </div>
                ) : (
                  filteredCompleted.map((comp) => {
                  if (comp.isCompact) {
                    return (
                      <div key={comp.id} className="wd-completed-row-compact">
                        <div className="wd-row-time">{comp.time}</div>
                        <div className="wd-row-client-service">
                          <strong>{comp.clientName}</strong> • {comp.serviceName}
                        </div>
                        <div className="wd-row-settlement">{comp.settlement}</div>
                        <div className="wd-row-check-badge">✓ Completed</div>
                      </div>
                    );
                  }

                  return (
                    <div key={comp.id} className="wd-completed-card">
                      <div className="wd-completed-top">
                        <div className="wd-completed-left">
                          <div className="wd-time-completed-box">
                            <span className="wd-completed-time-text">{comp.time}</span>
                            <span className="wd-completed-check-tag">✓ Completed</span>
                          </div>

                          <div className="wd-completed-info">
                            <div className="wd-completed-name-row">
                              <span className="wd-completed-name">{comp.clientName}</span>
                              {comp.badgeTier === "VIP SOCIETY" && (
                                <span className="wd-badge-vip">{comp.badgeTier}</span>
                              )}
                              {comp.badgeTier === "REGULAR MEMBER" && (
                                <span className="wd-badge-regular">{comp.badgeTier}</span>
                              )}
                              <span className="wd-queue-tag">{comp.refCode}</span>
                            </div>
                            <div className="wd-completed-service">{comp.serviceName}</div>
                            <div className="wd-completed-meta">{comp.meta}</div>
                          </div>
                        </div>

                        <div className="wd-completed-actions">
                          <button
                            type="button"
                            className="btn-completed-sub"
                            onClick={() => {
                              setActiveModal("prepNotes");
                              setActiveModalData({
                                clientName: comp.clientName,
                                prepNotes: comp.clientNote || "No additional session notes.",
                              });
                            }}
                          >
                            View Notes
                          </button>

                          {comp.hasReceipt && (
                            <button
                              type="button"
                              className="btn-completed-sub"
                              onClick={() => {
                                setActiveModal("receiptLog");
                                setActiveModalData(comp);
                              }}
                            >
                              🧾 Receipt Log
                            </button>
                          )}

                          {comp.hasRebook && (
                            <button
                              type="button"
                              className="btn-completed-sub"
                              onClick={() => showToast(`Rebooking initiated for ${comp.clientName}`)}
                            >
                              Rebook ⌵
                            </button>
                          )}

                          {comp.hasBillSettled && (
                            <span className="btn-completed-sub settled">Bill Settled ✓</span>
                          )}

                          <button
                            type="button"
                            className="btn-icon-kebab"
                            onClick={() => showToast(`Options for ${comp.clientName}`)}
                          >
                            ⋮
                          </button>
                        </div>
                      </div>

                      {comp.clientNote && (
                        <div className="wd-completed-client-note">
                          Client Note: &ldquo;{comp.clientNote}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                }))}
              </section>
            )}
          </div>

          <aside className="wd-right-sidebar">           
            <div className="wd-sidebar-card">
              <div className="wd-sidebar-card-header">
                <h3 className="wd-sidebar-title">
                  <span>🪑</span> Chair #01 Live Station
                </h3>
                <span className="wd-pill-ready">READY</span>
              </div>

              <div className="wd-sanitization-box">
                <div className="wd-sanitization-top">
                  <span>Sanitization Audit</span>
                  <span className="wd-audit-passed">✓ Passed</span>
                </div>
                <div className="wd-sanitization-desc">
                  Station #01 Cleaned &amp; Autoclaved shears prepped for 4:00 PM appointment.
                </div>
                <div className="wd-sanitization-logtime">Log Time: 03:45 PM by Renu (A)</div>
              </div>

              <div className="wd-station-links">
                <button
                  type="button"
                  className="wd-station-link-item"
                  onClick={() => {
                    setActiveModal("stationCare");
                  }}
                >
                  <span>🧴 Log Dye / Product Used</span>
                  <span>&gt;</span>
                </button>

                <button
                  type="button"
                  className="wd-station-link-item"
                  onClick={() => {
                    showToast("Towel restock request sent to laundry backroom.");
                  }}
                >
                  <span>🧺 Request Fresh Towel / Restock</span>
                  <span className="wd-link-count-sub">(4 left)</span>
                </button>

                <button
                  type="button"
                  className="wd-station-link-item"
                  onClick={() => setActiveModal("concierge")}
                >
                  <span>🎧 Contact Concierge Desk</span>
                  <span>&gt;</span>
                </button>
              </div>
            </div>

            
            <div className="wd-sidebar-card">
              <div className="wd-sidebar-card-header">
                <h3 className="wd-sidebar-title">Client Ratings &amp; Reviews</h3>
                <span className="wd-feedback-stars-badge">{workerData?.rating || "5.0"} ★</span>
              </div>

              {latestReview ? (
                <div className="wd-feedback-quote-box">
                  <div className="wd-stars-display">{"★".repeat(latestReview.rating)}</div>
                  <p className="wd-quote-text">
                    &ldquo;{latestReview.comment || `Great service! Client rated ${latestReview.rating} stars.`}&rdquo;
                  </p>
                  <div className="wd-feedback-footer">
                    <span className="wd-prev-client">Client: {latestReview.author}</span>
                    <span className="wd-pill-tip">{latestReview.service_name}</span>
                  </div>
                </div>
              ) : completedList.length > 0 ? (
                <div className="wd-feedback-quote-box">
                  <div className="wd-stars-display">★★★★★</div>
                  <p className="wd-quote-text">
                    &ldquo;{completedList[0].clientNote || `Great service by ${stylistProfile.name}! Very satisfied.`}&rdquo;
                  </p>
                  <div className="wd-feedback-footer">
                    <span className="wd-prev-client">Client: {completedList[0].clientName}</span>
                    <span className="wd-pill-tip">{completedList[0].serviceName}</span>
                  </div>
                </div>
              ) : (
                <div className="wd-feedback-quote-box" style={{ textAlign: "center", padding: "14px 8px" }}>
                  <p className="wd-quote-text" style={{ fontStyle: "normal", color: "#64748b", margin: 0 }}>
                    {workerData?.reviews_count ? `${workerData.reviews_count} verified reviews received.` : "No client reviews recorded yet for appointments."}
                  </p>
                </div>
              )}

              <div className="wd-tips-total-row">
                <span className="wd-tips-label">Settled Earnings Today</span>
                <span className="wd-tips-amount">₹{Math.round(kpiStats.settled_earnings || 0).toLocaleString("en-IN")}</span>
              </div>
            </div>

            <div className="wd-sidebar-card">
              <div className="wd-sidebar-card-header">
                <h3 className="wd-sidebar-title">
                  <span>📦</span> Station Inventory
                </h3>
                <span className="wd-pill-restock-soon" style={{ background: "#ecfdf5", color: "#065f46" }}>Ready</span>
              </div>

              <div className="wd-inventory-item-row">
                <span>Station Styling Supplies</span>
                <span style={{ color: "#16a34a", fontWeight: 600 }}>Stocked</span>
              </div>
              <p className="wd-inventory-subtext">
                All styling products and essentials verified for {stylistProfile.chair}
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/*  FIXED STICKY BOTTOM ACTION BAR  */}
      <footer className="wd-sticky-bar">
        <div className="wd-sticky-bar-inner">
          <div className="wd-sticky-left">
            <span className="wd-live-beacon" />
            <span className="wd-sticky-stylist">{stylistProfile.name} • {stylistProfile.chair}</span>
            <span>✦</span>
            <span className="wd-sticky-next">
              {heroAppointment ? (
                <>Next Up: <strong>{heroAppointment.clientName} ({heroAppointment.startTime} {heroAppointment.ampm})</strong> at {salonInfo.name}</>
              ) : (
                <>Queue: <strong>No appointments waiting</strong> at {salonInfo.name}</>
              )}
            </span>
          </div>

          <div className="wd-sticky-actions">
            <button
              type="button"
              className="btn-sticky-print"
              onClick={handlePrintRunSheet}
            >
              <span>🖨️</span> Print Day Run Sheet
            </button>
            {heroAppointment && (
              <button
                type="button"
                className="btn-sticky-call"
                onClick={handleCallClientToChair}
              >
                <span>🪑</span> Call {heroAppointment.clientName} to Chair
              </button>
            )}
          </div>
        </div>
      </footer>

      {/*  MODALS */}
     
      {activeModal === "hairProfile" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Client Hair &amp; Scalp Profile</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <div style={{ marginBottom: "14px" }}>
                <strong style={{ fontSize: "16px", color: "#0f172a" }}>
                  {activeModalData?.clientName || "Client"}
                </strong>
                <span
                  style={{
                    marginLeft: "8px",
                    background: "#fef3c7",
                    color: "#92400e",
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "10px",
                  }}
                >
                  {activeModalData?.clientTier || activeModalData?.statusTag || "CONFIRMED"}
                </span>
              </div>
              <p>
                <strong>Service Booked:</strong> {activeModalData?.serviceName || "Salon Service"}
              </p>
              <p>
                <strong>Scheduled Slot:</strong>{" "}
                {activeModalData?.time || (activeModalData?.startTime ? `${activeModalData.startTime} ${activeModalData.ampm || ""}` : "Today")}
              </p>
              <p>
                <strong>Assigned Chair:</strong> {activeModalData?.station || stylistProfile.chair || "Main Floor"}
              </p>
              <p>
                <strong>Contact Phone:</strong> {activeModalData?.phone || "Not provided"}
              </p>
              <p>
                <strong>Client Instructions &amp; Notes:</strong>{" "}
                <span style={{ color: "#334155" }}>
                  {activeModalData?.clientNote || activeModalData?.prepNotes || "No specific scalp sensitivities or instructions logged."}
                </span>
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: "#16a34a", fontWeight: 700 }}>
                  {activeModalData?.rawStatus || "CONFIRMED"}
                </span>
              </p>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Station Care & Log Modal */}
      {activeModal === "stationCare" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Station Care &amp; Sanitization Log</h3>
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
                <strong>Assigned Station:</strong> Chair #01 Main Floor
              </p>
              <p>
                <strong>Sanitization Standard:</strong> Class-A Hospital Grade Sterilization
              </p>
              <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <p style={{ margin: "0 0 6px" }}>✓ Shears autoclaved at 2:30 PM</p>
                <p style={{ margin: "0 0 6px" }}>✓ Station leather wiped with antibacterial solution</p>
                <p style={{ margin: "0 0 6px" }}>✓ Cape and neck strips replenished (12 fresh)</p>
                <p style={{ margin: 0 }}>✓ Assistant rinse bench checked by Renu (A)</p>
              </div>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => {
                  setActiveModal(null);
                  showToast("Station Care log updated and verified!");
                }}
              >
                Confirm Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Concierge Desk Modal */}
      {activeModal === "concierge" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Concierge Desk Direct Line</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setActiveModal(null)}
              >
                ✕
              </button>
            </div>
            <div className="wd-modal-body">
              <p>Quick message to Reception &amp; Hospitality team:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                <button
                  type="button"
                  className="btn-station-log"
                  style={{ justifyContent: "center" }}
                  onClick={() => {
                    setActiveModal(null);
                    showToast("Concierge notified: Please serve herbal tea to next client.");
                  }}
                >
                  🍵 Serve Beverage to Waiting Client
                </button>
                <button
                  type="button"
                  className="btn-station-log"
                  style={{ justifyContent: "center" }}
                  onClick={() => {
                    setActiveModal(null);
                    showToast("Concierge notified: Running 5 minutes behind schedule.");
                  }}
                >
                  ⏱ 5 Mins Delay Advisory
                </button>
                <button
                  type="button"
                  className="btn-station-log"
                  style={{ justifyContent: "center" }}
                  onClick={() => {
                    setActiveModal(null);
                    showToast("Concierge notified: Please assist with checkout billing.");
                  }}
                >
                  💳 Counter Checkout Support Needed
                </button>
              </div>
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

      {/* Prep Notes Modal */}
      {activeModal === "prepNotes" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">
                Session Preparation Notes: {activeModalData?.clientName}
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
                {activeModalData?.prepNotes || "No notes available for this session."}
              </p>
            </div>
            <div className="wd-modal-footer">
              <button
                type="button"
                className="btn-modal-primary"
                onClick={() => setActiveModal(null)}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Log Modal */}
      {activeModal === "receiptLog" && (
        <div className="wd-modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="wd-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="wd-modal-header">
              <h3 className="wd-modal-title">Receipt &amp; Payment Record</h3>
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
                <strong>Client:</strong> {activeModalData?.clientName || "Client"}
              </p>
              <p>
                <strong>Service:</strong> {activeModalData?.serviceName || "Service"}
              </p>
              <p>
                <strong>Booking Ref:</strong> {activeModalData?.refCode || (activeModalData?.rawId ? `#BMS-${activeModalData.rawId}` : "N/A")}
              </p>
              <p>
                <strong>Amount Settled:</strong> ₹{Math.round(activeModalData?.servicePrice || 0) || activeModalData?.price || "0.00"}
              </p>
              <p>
                <strong>Payment Method:</strong> {activeModalData?.paymentMethod === "SALON" ? "Pay at Salon" : "Online Payment"}
              </p>
              <p>
                <strong>Status:</strong>{" "}
                <span style={{ color: "#15803d", fontWeight: 700 }}>
                  {activeModalData?.paymentStatus === "PAID" || activeModalData?.rawStatus === "COMPLETED" ? "Settled Successfully" : "Payment Pending"}
                </span>
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


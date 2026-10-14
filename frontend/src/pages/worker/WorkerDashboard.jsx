import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import WorkerHeader from "../../components/worker/WorkerHeader";
import WorkerSalonBanner from "../../components/worker/WorkerSalonBanner";
import "../../styles/workerDashboard.css";

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [activeNavTab, setActiveNavTab] = useState("appointments");

  const [activeDateTab, setActiveDateTab] = useState("today"); 
  const [activeSegmentTab, setActiveSegmentTab] = useState("upcoming"); 
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const [activeModal, setActiveModal] = useState(null); 
  const [activeModalData, setActiveModalData] = useState(null);

  const [serviceStatus, setServiceStatus] = useState("prepped"); 
  
  const defaultHeroAppointment = {
    id: "apt-101",
    appId: "APPID: #101",
    clientName: "Pooja Sharma",
    badgeTier: "CONFIRMED CLIENT",
    serviceName: "Haircut & Botanical Styling",
    duration: "45 mins",
    price: "₹550",
    paymentStatus: "Paid Online",
    startTime: "10:30",
    ampm: "AM",
    arrivalText: "Arrived: On Schedule",
    loungeStatus: "CURRENTLY IN LOUNGE • PREPPED FOR STATION #01",
    clientNote: "Client prefers rosemary scalp wash and medium heat blow-dry.",
    phone: "+91 98450 12345",
  };

  const defaultUpcomingQueue = [
    {
      id: "apt-queue-102",
      refCode: "#BMS-102",
      time: "02:00 PM",
      timeLabel: "NEXT",
      clientName: "Karthik Menon",
      statusTag: "Confirmed",
      serviceName: "Deep Scalp Therapy & Wash",
      meta: "60 min • ₹850 • Pre-paid UPI",
      prepNotes: "Regular client. Prefers warm water and gentle crown massage.",
    },
  ];

  const defaultCompletedList = [
    {
      id: "apt-comp-100",
      refCode: "#BMS-100",
      time: "09:30 AM",
      clientName: "Ananya Reddy",
      badgeTier: "REGULAR MEMBER",
      serviceName: "Express Glow Facial & Blowdry",
      meta: "45 min duration • ₹1,200 • Paid Online",
      clientNote: "Sensitive skin. Organic aloe base applied.",
      hasReceipt: true,
      hasRebook: true,
    },
  ];


  const [salonInfo, setSalonInfo] = useState({
    id: null,
    name: "Indiranagar Flagship Salon",
    category: "Hair, Beauty & Aesthetics",
    address: "100ft Road, Indiranagar",
    city: "Bengaluru",
    phone: "+91 98450 54321",
  });

  const [workerData, setWorkerData] = useState(null);
  const [kpiStats, setKpiStats] = useState({
    total_bookings: 2,
    today_bookings: 2,
    completed_bookings: 1,
    in_progress_bookings: 0,
    upcoming_bookings: 1,
  });

  const [heroAppointment, setHeroAppointment] = useState(defaultHeroAppointment);
  const [upcomingQueue, setUpcomingQueue] = useState(defaultUpcomingQueue);
  const [completedList, setCompletedList] = useState(defaultCompletedList);

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

 
  useEffect(() => {
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

          const assigned = res.data.assigned_bookings || [];
          if (assigned.length > 0) {
            const inProg = assigned.find((b) => b.status === "IN_PROGRESS");
            const firstUpcoming = assigned.find(
              (b) => b.status === "CONFIRMED" || b.status === "PENDING"
            );
            const activeOrNext = inProg || firstUpcoming || assigned[0];

            if (activeOrNext) {
              setHeroAppointment({
                id: `apt-${activeOrNext.id}`,
                appId: `APPID: #${activeOrNext.id}`,
                clientName: activeOrNext.client_name || "Client",
                badgeTier: "CONFIRMED CLIENT",
                serviceName: activeOrNext.service_name || "Salon Service",
                duration: activeOrNext.duration || "45 mins",
                price: `₹${activeOrNext.service_price || "550"}`,
                paymentStatus: "Paid Online",
                startTime: activeOrNext.booking_time
                  ? activeOrNext.booking_time.split(" ")[0]
                  : "10:30",
                ampm:
                  activeOrNext.booking_time && activeOrNext.booking_time.includes("PM")
                    ? "PM"
                    : "AM",
                arrivalText: "Arrived: On Schedule",
                loungeStatus: `CURRENTLY IN LOUNGE • PREPPED FOR ${activeOrNext.station || "CHAIR #01"}`,
                clientNote: activeOrNext.notes || "Client prefers standard salon protocol.",
                phone: activeOrNext.client_phone || "+91 98450 12345",
              });
              if (activeOrNext.status === "IN_PROGRESS") {
                setServiceStatus("in_progress");
              }
            }

            
            const otherUpcoming = assigned.filter(
              (b) => b.id !== activeOrNext?.id && (b.status === "CONFIRMED" || b.status === "PENDING")
            );
            if (otherUpcoming.length > 0) {
              setUpcomingQueue(
                otherUpcoming.slice(0, 2).map((b, idx) => ({
                  id: `apt-q-${b.id}`,
                  refCode: `#BMS-${b.id}`,
                  time: b.booking_time || "02:00 PM",
                  timeLabel: idx === 0 ? "NEXT" : "LATER",
                  clientName: b.client_name,
                  statusTag: b.status === "CONFIRMED" ? "Confirmed" : "Pending",
                  serviceName: b.service_name,
                  meta: `${b.duration || "45 min"} • ₹${b.service_price} • ${b.station || "Station"}`,
                  prepNotes: b.notes || "Standard service prep.",
                }))
              );
            } else {
              setUpcomingQueue([]);
            }

            
            const completed = assigned.filter((b) => b.status === "COMPLETED");
            if (completed.length > 0) {
              setCompletedList(
                completed.slice(0, 2).map((b) => ({
                  id: `apt-c-${b.id}`,
                  refCode: `#BMS-${b.id}`,
                  time: b.booking_time || "09:30 AM",
                  clientName: b.client_name,
                  badgeTier: "COMPLETED",
                  serviceName: b.service_name,
                  meta: `${b.duration || "45 min"} • ₹${b.service_price} • Settled`,
                  clientNote: b.notes || "Service completed smoothly.",
                  hasReceipt: true,
                  hasRebook: false,
                }))
              );
            }
          }
        }
      } catch (err) {
        console.warn("Using baseline stylist suite design data:", err?.message);
      }
    };
    fetchDashboard();
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  
  const handleStartService = async () => {
    if (serviceStatus === "prepped") {
      setServiceStatus("in_progress");
      showToast(`${heroAppointment.clientName} seated at ${stylistProfile.chair}! Service marked IN PROGRESS.`);
    } else if (serviceStatus === "in_progress") {
      setServiceStatus("completed");
      showToast(`Service for ${heroAppointment.clientName} completed successfully! Added to Today's Completed.`);
    } else {
      setServiceStatus("prepped");
      showToast(`${stylistProfile.chair} reset and prepped for next appointment.`);
    }
  };

  const handleCallClientToChair = () => {
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
        onTabChange={setActiveNavTab}
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
              <div className="wd-kpi-val">{kpiStats.today_bookings ?? (upcomingQueue.length + completedList.length + 1)} Total</div>
              <div className="wd-kpi-subtext">
                {kpiStats.completed_bookings ?? completedList.length} Completed • {serviceStatus === "in_progress" ? "1 In-Chair" : "1 Prepped"} • {kpiStats.upcoming_bookings ?? upcomingQueue.length} Next
              </div>
            </div>
            <div className="wd-kpi-trend">
              <span>🏛️</span> {salonInfo.name}
            </div>
          </div>

         
          <div className="wd-kpi-card">
            <div>
              <div className="wd-kpi-top-row">
                <span className="wd-kpi-title">SETTLED EARNINGS TODAY</span>
                <span className="wd-kpi-icon">💳</span>
              </div>
              <div className="wd-kpi-val">₹1,800</div>
              <div className="wd-kpi-subtext">+₹350 tips awaiting settlement</div>
            </div>
            <div className="wd-kpi-trend">
              <span>📈</span> Standard Day Performance
            </div>
          </div>

         
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

          
          <div className="wd-kpi-card lounge-card">
            <div>
              <div className="wd-lounge-header">
                <span className="wd-lounge-pill">
                  <span className="wd-duty-dot" />
                  WAITING AT LOUNGE
                </span>
                <span className="wd-lounge-time">{heroAppointment.startTime} {heroAppointment.ampm}</span>
              </div>
              <div className="wd-lounge-client">{heroAppointment.clientName}</div>
              <div className="wd-lounge-service">{heroAppointment.serviceName} • {heroAppointment.price}</div>
            </div>
            <div className="wd-lounge-footer">
              <span className="wd-lounge-note">Warm green tea served</span>
              <button
                type="button"
                className="btn-call-chair-link"
                onClick={handleCallClientToChair}
              >
                Call Chair &rarr;
              </button>
            </div>
          </div>
        </section>
 
        <div className="wd-split-layout">    
          <div className="wd-left-feed">
            <div className="wd-date-toolbar">
              <div className="wd-date-row-1">
                <div className="wd-date-stepper">
                  <button type="button" className="btn-date-step" title="Previous Day">
                    &lt;
                  </button>
                  <span className="wd-date-label">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  <button type="button" className="btn-date-step" title="Next Day">
                    &gt;
                  </button>
                </div>

                <div className="wd-quick-date-pills">
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "today" ? "active" : ""}`}
                    onClick={() => setActiveDateTab("today")}
                  >
                    Today ({upcomingQueue.length + (heroAppointment ? 1 : 0) + completedList.length})
                  </button>
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "tomorrow" ? "active" : ""}`}
                    onClick={() => setActiveDateTab("tomorrow")}
                  >
                    Tomorrow
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
                      {serviceStatus === "prepped"
                        ? "🪑 Start Service / Seat at Chair #01"
                        : serviceStatus === "in_progress"
                        ? "✓ Mark Service Completed"
                        : "✓ Completed • Reset Chair"}
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
            )}

            {/* Upcoming Queue List */}
            {(activeSegmentTab === "upcoming" || activeSegmentTab === "all") && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredUpcoming.map((item) => (
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
                        <div className="wd-queue-meta">{item.meta}</div>
                      </div>
                    </div>

                    <div className="wd-queue-right">
                      <button
                        type="button"
                        className="btn-prep-notes"
                        onClick={() => {
                          setActiveModal("prepNotes");
                          setActiveModalData(item);
                        }}
                      >
                        View Prep Notes
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
                ))}
              </div>
            )}

            {/* Completed Sessions Today Section */}
            {(activeSegmentTab === "completed" || activeSegmentTab === "all") && (
              <section className="wd-completed-section">
                <div className="wd-completed-header">
                  <h3 className="wd-completed-title">
                    COMPLETED SESSIONS TODAY ({filteredCompleted.length})
                  </h3>
                </div>

                {filteredCompleted.map((comp) => {
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
                })}
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
                <h3 className="wd-sidebar-title">Today&apos;s Client Feedback</h3>
                <span className="wd-feedback-stars-badge">5.0 ★</span>
              </div>

              <div className="wd-feedback-quote-box">
                <div className="wd-stars-display">★★★★★</div>
                <p className="wd-quote-text">
                  &ldquo;Rahul is an absolute master with textured hair! Sharp exact finish! Love it.&rdquo;
                </p>
                <div className="wd-feedback-footer">
                  <span className="wd-prev-client">Previous Client: K. Gautham</span>
                  <span className="wd-pill-tip">+₹100 tip</span>
                </div>
              </div>

              <div className="wd-tips-total-row">
                <span className="wd-tips-label">Total Tips Earned Today</span>
                <span className="wd-tips-amount">₹350.00</span>
              </div>
            </div>

            <div className="wd-sidebar-card">
              <div className="wd-sidebar-card-header">
                <h3 className="wd-sidebar-title">
                  <span>📦</span> Chair Inventory Alert
                </h3>
                <span className="wd-pill-restock-soon">Restock Soon</span>
              </div>

              <div className="wd-inventory-item-row">
                <span>Pure Argan Scalp Elixir</span>
                <span className="wd-inventory-critical">1 bottle left</span>
              </div>
              <p className="wd-inventory-subtext">
                Auto-requisition sent to backroom store at 2:50 PM
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
              Next Up: <strong>{heroAppointment.clientName} ({heroAppointment.startTime} {heroAppointment.ampm})</strong> at {salonInfo.name}
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
            <button
              type="button"
              className="btn-sticky-call"
              onClick={handleCallClientToChair}
            >
              <span>🪑</span> Call {heroAppointment.clientName} to Chair
            </button>
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
                  {activeModalData?.clientName || "Sarah Jenkins"}
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
                  PLATINUM PASSION
                </span>
              </div>
              <p>
                <strong>Hair Texture:</strong> Fine to Medium, Natural Wave (2B)
              </p>
              <p>
                <strong>Scalp Condition:</strong> Sensitive, prone to dry redness
              </p>
              <p>
                <strong>Allergies &amp; Sensitivities:</strong>{" "}
                <span style={{ color: "#e11d48", fontWeight: 600 }}>
                  Allergic to artificial scents &amp; sulfates.
                </span>
              </p>
              <p>
                <strong>Preferred Formula:</strong> 100% Pure Organic Argan Scalp Elixir &amp; Botanical Color Rinse.
              </p>
              <p>
                <strong>Last Visit:</strong> August 12, 2026 — Balayage Gloss Refresh
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
                <strong>Client:</strong> {activeModalData?.clientName}
              </p>
              <p>
                <strong>Service:</strong> {activeModalData?.serviceName}
              </p>
              <p>
                <strong>Payment Ref:</strong> UPI - Ref #8217
              </p>
              <p>
                <strong>Amount Settled:</strong> ₹500.00
              </p>
              <p>
                <strong>Status:</strong> <span style={{ color: "#15803d", fontWeight: 700 }}>Settled Successfully</span>
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


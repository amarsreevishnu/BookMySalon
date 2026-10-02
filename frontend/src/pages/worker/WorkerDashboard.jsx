import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import "../../styles/workerDashboard.css";

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // Top navbar profile menu & logout confirm states
  const profileMenuRef = useRef(null);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Active top navigation tab
  const [activeNavTab, setActiveNavTab] = useState("appointments");

  // Filter and view controls
  const [activeDateTab, setActiveDateTab] = useState("today"); // 'today' | 'tomorrow' | 'week'
  const [activeSegmentTab, setActiveSegmentTab] = useState("upcoming"); // 'upcoming' | 'completed' | 'all'
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'hairProfile' | 'stationCare' | 'concierge' | 'prepNotes' | 'receiptLog'
  const [activeModalData, setActiveModalData] = useState(null);

  // In-chair / active service status
  const [serviceStatus, setServiceStatus] = useState("prepped"); // 'prepped' | 'in_progress' | 'completed'

  // Reference / default mock dataset matching the user's uploaded reference image
  const defaultHeroAppointment = {
    id: "apt-hero-8214",
    appId: "APPID: #8214",
    clientName: "Sarah Jenkins",
    badgeTier: "PLATINUM PASSION",
    serviceName: "Hair Styling • Botanical Balayage & Blowdry Styling",
    duration: "45 mins duration",
    price: "₹580",
    paymentStatus: "Paid Online",
    startTime: "4:00",
    ampm: "PM",
    arrivalText: "Arrived: 03:50 PM (10 mins early)",
    loungeStatus: "CURRENTLY IN LOUNGE • PREPPED FOR CHAIR #01",
    clientNote:
      'Allergic to artificial scents. Use strictly 100% pure argan formula. Light feathering on framing bangs.',
    phone: "+91 98450 12345",
  };

  const defaultUpcomingQueue = [
    {
      id: "apt-queue-6495",
      refCode: "#BMS-6495",
      time: "5:00 PM",
      timeLabel: "NEXT",
      clientName: "Ananya Deshmukh",
      statusTag: "Confirmed (SMS Checked)",
      serviceName: "Deep Conditioning Keratin Spa & Glow Styling",
      meta: "45 min • ₹850 • Counter Settlement",
      prepNotes:
        "Prefers gentle steam. Avoid high temperature near crown. Scalp type: sensitive normal.",
    },
    {
      id: "apt-queue-6496",
      refCode: "#BMS-6496",
      time: "6:15 PM",
      timeLabel: "NEXT",
      clientName: "Rohan Kapoor",
      statusTag: "Shift Final Service",
      serviceName: "Beard Trim & Quick Refresh Cut",
      meta: "30 min • ₹350 • Pre-paid Card",
      prepNotes:
        "Requested square neckline shaping. Zero fade along sideburns. Warm towel post trim.",
    },
  ];

  const defaultCompletedList = [
    {
      id: "apt-comp-6492",
      refCode: "#BMS-6492",
      time: "09:30 AM",
      clientName: "John (Johnathan Doe)",
      badgeTier: "VIP SOCIETY",
      serviceName: "Haircut + Precision Scissor-Comb & Botanical Scalp Wash",
      meta: "45 min duration • ₹500 • Paid Online (UPI - Ref #8217)",
      clientNote: 'Sensitive scalp, prefers botanical rosemary rinse.',
      hasReceipt: true,
      hasRebook: true,
    },
    {
      id: "apt-comp-3472",
      refCode: "#GTS-3472",
      time: "11:00 AM",
      clientName: "Alex (Alex Fernandes)",
      badgeTier: "REGULAR MEMBER",
      serviceName: "Beard + Organic Beard Sculpt & Hot Towel Treatment",
      meta: "30 min duration • ₹350 Cash Settled at Counter",
      clientNote: 'Beard balm re-order requested. Disemnecking razor finish.',
      hasBillSettled: true,
    },
    {
      id: "apt-comp-3",
      time: "12:30 PM",
      clientName: "Vishnu Prasad",
      serviceName: "Haircut & Styling",
      settlement: "₹350 • Settled via Google Pay in-lounge",
      isCompact: true,
    },
    {
      id: "apt-comp-4",
      time: "02:00 PM",
      clientName: "Sameer Khan",
      serviceName: "Express Beard Trim",
      settlement: "₹150 • Cash • ₹50 Tip Added",
      isCompact: true,
    },
  ];

  // Dynamic state populated by backend or reference data
  const [heroAppointment, setHeroAppointment] = useState(defaultHeroAppointment);
  const [upcomingQueue, setUpcomingQueue] = useState(defaultUpcomingQueue);
  const [completedList, setCompletedList] = useState(defaultCompletedList);

  // Stylist Profile Info (defaults to Rahul Kumar as in image, or user's name if logged in)
  const stylistProfile = useMemo(() => {
    const defaultName = "Rahul Kumar";
    const name = user?.first_name
      ? `${user.first_name} ${user.last_name || ""}`.trim()
      : defaultName;

    return {
      name,
      roleBadge: "Master Trichologist & Hair Specialist",
      chair: "Chair #01 Station",
      shift: "Shift: 10:00 AM - 07:00 PM",
      stationStatus: "Prepped & Cleared",
      workloadNote:
        "Station Workload: 8/10 FTR • Assistant rinse & botaniqs bench loaded for 4:00 PM appointment",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
    };
  }, [user]);

  // Load backend data if available, adapting seamlessly
  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get("/salons/worker/dashboard/");
        if (res.data) {
          const assigned = res.data.assigned_bookings || [];
          if (assigned.length > 0) {
            const inProg = assigned.find((b) => b.status === "IN_PROGRESS");
            const firstUpcoming = assigned.find(
              (b) => b.status === "CONFIRMED" || b.status === "PENDING"
            );
            const activeOrNext = inProg || firstUpcoming;

            if (activeOrNext) {
              setHeroAppointment({
                id: `apt-${activeOrNext.id}`,
                appId: `APPID: #${activeOrNext.id}`,
                clientName: activeOrNext.client_name || "Client",
                badgeTier: "PLATINUM PASSION",
                serviceName: activeOrNext.service_name || "Salon Styling",
                duration: activeOrNext.duration || "45 mins",
                price: `₹${activeOrNext.service_price || "580"}`,
                paymentStatus: "Paid Online",
                startTime: activeOrNext.booking_time ? activeOrNext.booking_time.split(" ")[0] : "4:00",
                ampm: activeOrNext.booking_time && activeOrNext.booking_time.includes("PM") ? "PM" : "AM",
                arrivalText: "Arrived: On Schedule",
                loungeStatus: "CURRENTLY IN LOUNGE • PREPPED FOR CHAIR #01",
                clientNote: activeOrNext.notes || defaultHeroAppointment.clientNote,
                phone: activeOrNext.client_phone || "+91 98450 12345",
              });
              if (activeOrNext.status === "IN_PROGRESS") {
                setServiceStatus("in_progress");
              }
            }
          }
        }
      } catch (err) {
        console.warn("Using high-fidelity stylist suite design data:", err?.message);
      }
    };
    fetchDashboard();
  }, []);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileDropdown(false);
      }
    };
    if (showProfileDropdown) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [showProfileDropdown]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    navigate("/login");
  };

  // Handlers for hero appointment actions
  const handleStartService = async () => {
    if (serviceStatus === "prepped") {
      setServiceStatus("in_progress");
      showToast(`Sarah Jenkins seated at Chair #01! Service marked IN PROGRESS.`);
    } else if (serviceStatus === "in_progress") {
      setServiceStatus("completed");
      showToast(`Service for Sarah Jenkins completed successfully! Added to Today's Completed.`);
    } else {
      setServiceStatus("prepped");
      showToast(`Chair #01 reset and prepped for next appointment.`);
    }
  };

  const handleCallSarahToChair = () => {
    showToast(`Paging Reception Lounge: Sarah Jenkins called to Chair #01.`);
  };

  const handlePrintRunSheet = () => {
    window.print();
  };

  // Filtered upcoming appointments based on search query
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

  // Filtered completed appointments based on search query
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
      {/* ====================================================================
          1. TOP NAVIGATION BAR
          ==================================================================== */}
      <header className="wd-navbar">
        <div className="wd-navbar-inner">
          <div className="wd-navbar-left">
            <div className="wd-brand-link" onClick={() => navigate("/worker/dashboard")}>
              <div className="wd-brand-icon">✻</div>
              <div>
                <span className="wd-brand-title">BookMySalon Pro</span>
                <span className="wd-brand-sub">— Stylist Suite</span>
              </div>
            </div>

            {/* Global Search Input */}
            <div className="wd-nav-search-box">
              <span className="wd-nav-search-icon">🔍</span>
              <input
                type="text"
                className="wd-nav-search-input"
                placeholder="Search clients, s..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Navigation Tabs */}
            <nav className="wd-nav-links">
              <button
                type="button"
                className={`wd-nav-tab ${activeNavTab === "appointments" ? "active" : ""}`}
                onClick={() => setActiveNavTab("appointments")}
              >
                Appointments
              </button>
              <button
                type="button"
                className="wd-nav-tab"
                onClick={() => navigate("/worker/calendar")}
              >
                Calendar
              </button>
              <button
                type="button"
                className={`wd-nav-tab ${activeNavTab === "station" ? "active" : ""}`}
                onClick={() => {
                  setActiveNavTab("station");
                  setActiveModal("stationCare");
                }}
              >
                Chair #01 Station
              </button>
              <button
                type="button"
                className={`wd-nav-tab ${activeNavTab === "profiles" ? "active" : ""}`}
                onClick={() => {
                  setActiveNavTab("profiles");
                  setActiveModal("hairProfile");
                  setActiveModalData(heroAppointment);
                }}
              >
                Client Hair Profiles
              </button>
              <button
                type="button"
                className={`wd-nav-tab ${activeNavTab === "inventory" ? "active" : ""}`}
                onClick={() => {
                  setActiveNavTab("inventory");
                  showToast("Inventory & Ops Log: 1 bottle Pure Argan Elixir remaining in Station 01.");
                }}
              >
                Inventory &amp; Ops Log
              </button>
              <button
                type="button"
                className={`wd-nav-tab ${activeNavTab === "payouts" ? "active" : ""}`}
                onClick={() => {
                  setActiveNavTab("payouts");
                  showToast("Payouts: ₹1,800 settled today • ₹350 tips pending.");
                }}
              >
                Payouts
              </button>
            </nav>
          </div>

          <div className="wd-navbar-right">
            {/* Round Worker Avatar with Dropdown */}
            <div className="wd-nav-profile-menu-wrap" ref={profileMenuRef}>
              <button
                type="button"
                className="wd-nav-profile-btn"
                onClick={() => setShowProfileDropdown((prev) => !prev)}
                title="Specialist Profile & Options"
                aria-expanded={showProfileDropdown}
              >
                <img
                  src={stylistProfile.avatar}
                  alt={stylistProfile.name}
                  className="wd-nav-profile-img"
                />
                <span className="wd-nav-profile-status-dot" title="On Duty" />
              </button>

              {showProfileDropdown && (
                <div className="wd-nav-profile-dropdown">
                  <div className="wd-dropdown-header">
                    <img
                      src={stylistProfile.avatar}
                      alt={stylistProfile.name}
                      className="wd-dropdown-avatar"
                    />
                    <div className="wd-dropdown-user-info">
                      <div className="wd-dropdown-name">{stylistProfile.name}</div>
                      <div className="wd-dropdown-role">{stylistProfile.roleBadge}</div>
                      <div className="wd-dropdown-email">
                        {user?.email || "worker@bookmysalon.com"}
                      </div>
                    </div>
                  </div>

                  <div className="wd-dropdown-divider" />

                  <div className="wd-dropdown-meta-item">
                    <span className="wd-meta-icon">📍</span>
                    <span>{stylistProfile.chair}</span>
                  </div>
                  <div className="wd-dropdown-meta-item">
                    <span className="wd-meta-icon">⏰</span>
                    <span>{stylistProfile.shift}</span>
                  </div>

                  <div className="wd-dropdown-divider" />

                  <button
                    type="button"
                    className="wd-dropdown-item wd-dropdown-logout-btn"
                    onClick={() => {
                      setShowProfileDropdown(false);
                      setShowLogoutConfirm(true);
                    }}
                  >
                    <span className="wd-dropdown-icon">🚪</span>
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ====================================================================
          2. MAIN CONTENT
          ==================================================================== */}
      <main className="wd-main">
        {/* ==================================================================
            3. SPECIALIST PROFILE HERO CARD
            ================================================================== */}
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
                <span>{stylistProfile.shift}</span>
                <span>•</span>
                <span className="wd-prepped-status">✓ {stylistProfile.stationStatus}</span>
              </div>
              <div className="wd-workload-subtext">{stylistProfile.workloadNote}</div>
            </div>
          </div>

          <div className="wd-stylist-actions">
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
          </div>
        </section>

        {/* ==================================================================
            4. 4 KPI SUMMARY CARDS
            ================================================================== */}
        <section className="wd-kpi-grid">
          {/* Card 1: Today's Appointments */}
          <div className="wd-kpi-card">
            <div>
              <div className="wd-kpi-top-row">
                <span className="wd-kpi-title">TODAY&apos;S APPOINTMENTS</span>
                <span className="wd-kpi-icon">📅</span>
              </div>
              <div className="wd-kpi-val">8 Total</div>
              <div className="wd-kpi-subtext">5 Completed • 1 In Queue • 2 Next</div>
            </div>
            <div className="wd-kpi-trend">
              <span>📈</span> +12% vs last Saturday
            </div>
          </div>

          {/* Card 2: Settled Earnings Today */}
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
              <span>📈</span> +8% target achieved
            </div>
          </div>

          {/* Card 3: Chair Turnaround Rate */}
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
              <span>✓</span> Station #01 Benchmark: Top 5%
            </div>
          </div>

          {/* Card 4: Waiting at Lounge (Dynamic Hero Callout) */}
          <div className="wd-kpi-card lounge-card">
            <div>
              <div className="wd-lounge-header">
                <span className="wd-lounge-pill">
                  <span className="wd-duty-dot" />
                  WAITING AT LOUNGE
                </span>
                <span className="wd-lounge-time">4:00 PM</span>
              </div>
              <div className="wd-lounge-client">Sarah Jenkins</div>
              <div className="wd-lounge-service">Balayage &amp; Dry-In • Booked 3:30 PM</div>
            </div>
            <div className="wd-lounge-footer">
              <span className="wd-lounge-note">Warm green tea served</span>
              <button
                type="button"
                className="btn-call-chair-link"
                onClick={handleCallSarahToChair}
              >
                Call Chair &rarr;
              </button>
            </div>
          </div>
        </section>

        {/* ==================================================================
            5. MAIN SPLIT LAYOUT (LEFT FEED & RIGHT SIDEBAR)
            ================================================================== */}
        <div className="wd-split-layout">
          {/* ================================================================
              LEFT COLUMN: DATE BAR, HERO CARD, QUEUE & COMPLETED SESSIONS
              ================================================================ */}
          <div className="wd-left-feed">
            {/* Date & Filter Toolbar */}
            <div className="wd-date-toolbar">
              <div className="wd-date-row-1">
                <div className="wd-date-stepper">
                  <button type="button" className="btn-date-step" title="Previous Day">
                    &lt;
                  </button>
                  <span className="wd-date-label">Today, Saturday, Sep 5, 2026</span>
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
                    Today (8)
                  </button>
                  <button
                    type="button"
                    className={`btn-quick-date ${activeDateTab === "tomorrow" ? "active" : ""}`}
                    onClick={() => setActiveDateTab("tomorrow")}
                  >
                    Tomorrow (4)
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
                  Upcoming &amp; In-Chair (3)
                </button>
                <button
                  type="button"
                  className={`btn-segment-tab ${activeSegmentTab === "completed" ? "active" : ""}`}
                  onClick={() => setActiveSegmentTab("completed")}
                >
                  Completed (5)
                </button>
                <button
                  type="button"
                  className={`btn-segment-tab ${activeSegmentTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveSegmentTab("all")}
                >
                  All Scheduled (8)
                </button>
              </div>
            </div>

            {/* Highlighted Hero Appointment Card (Sarah Jenkins) */}
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
                          showToast("Ping sent to front desk concierge for Sarah Jenkins.");
                        }}
                      >
                        🔔 Ping Desk
                      </button>
                      <button
                        type="button"
                        className="btn-hero-sub ready"
                        onClick={() => {
                          showToast("Station notified: Stylist is 100% ready for Sarah.");
                        }}
                      >
                        ✓ Ready for You
                      </button>
                    </div>
                  </div>
                </div>

                {/* Scalp & Client Note Callout */}
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

          {/* ================================================================
              RIGHT COLUMN: CHAIR STATION, FEEDBACK & INVENTORY
              ================================================================ */}
          <aside className="wd-right-sidebar">
            {/* Card 1: Chair #01 Live Station */}
            <div className="wd-sidebar-card">
              <div className="wd-sidebar-card-header">
                <h3 className="wd-sidebar-title">
                  <span>🪑</span> Chair #01 Live Station
                </h3>
                <span className="wd-pill-ready">READY</span>
              </div>

              {/* Sanitization Audit Box */}
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

              {/* Action links */}
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

            {/* Card 2: Today's Client Feedback */}
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

            {/* Card 3: Chair Inventory Alert */}
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

      {/* ====================================================================
          6. FIXED STICKY BOTTOM ACTION BAR
          ==================================================================== */}
      <footer className="wd-sticky-bar">
        <div className="wd-sticky-bar-inner">
          <div className="wd-sticky-left">
            <span className="wd-live-beacon" />
            <span className="wd-sticky-stylist">{stylistProfile.name} ({stylistProfile.chair.split(" ")[0]} #{stylistProfile.chair.split("#")[1] || "01"})</span>
            <span>✦</span>
            <span className="wd-sticky-next">
              Next Up: <strong>Sarah Jenkins (4:00 PM)</strong> in Reception Lounge
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
              onClick={handleCallSarahToChair}
            >
              <span>🪑</span> Call Sarah to Chair #01
            </button>
          </div>
        </div>
      </footer>

      {/* ====================================================================
          7. MODALS
          ==================================================================== */}
      {/* Hair Profile Modal */}
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

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div
          className="wd-modal-overlay"
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            className="wd-modal-box"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "420px", textAlign: "center" }}
          >
            <div style={{ padding: "28px 24px 20px" }}>
              <div className="wd-logout-modal-icon-circle">
                <img
                  src={stylistProfile.avatar}
                  alt={stylistProfile.name}
                  className="wd-logout-modal-avatar"
                />
              </div>

              <h3
                style={{
                  margin: "16px 0 8px",
                  fontSize: "18px",
                  fontWeight: "700",
                  color: "var(--wd-text-primary, #0f172a)",
                }}
              >
                Confirm Logout
              </h3>
              <p
                style={{
                  margin: "0 0 20px",
                  fontSize: "13.5px",
                  color: "var(--wd-text-muted, #64748b)",
                  lineHeight: "1.5",
                }}
              >
                Are you sure you want to log out of Stylist Suite? Any unstarted services will remain in queue.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  style={{
                    padding: "9px 22px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#dc2626",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(220, 38, 38, 0.25)",
                  }}
                  onClick={handleLogout}
                >
                  Yes, Logout
                </button>
              </div>
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


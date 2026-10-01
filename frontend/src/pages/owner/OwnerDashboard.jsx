import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import "../../styles/ownerDashboard.css";

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const searchInputRef = useRef(null);
  // Worker management state
  const [workersList, setWorkersList] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerFilterRole, setWorkerFilterRole] = useState("all");
  const [workerFilterStatus, setWorkerFilterStatus] = useState("all");
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [workerSuccessModal, setWorkerSuccessModal] = useState(null);
  const [workerForm, setWorkerForm] = useState({
    full_name: "", email: "", phone_number: "", specialization: "Senior Hair Stylist",
    experience: "1-2 Years (Junior Stylist)", profile_photo: "", password: "",
  });

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return workersList.filter((w) => {
      const matchesSearch = !q || [w.full_name, w.email, w.phone_number, w.specialization]
        .some((v) => String(v || "").toLowerCase().includes(q));
      const role = String(w.specialization || "").toLowerCase();
      const matchesRole = workerFilterRole === "all" ||
        (workerFilterRole === "hair" && role.includes("hair")) ||
        (workerFilterRole === "color" && role.includes("color")) ||
        (workerFilterRole === "spa" && (role.includes("spa") || role.includes("massage"))) ||
        (workerFilterRole === "skin" && (role.includes("skin") || role.includes("facial"))) ||
        (workerFilterRole === "nail" && role.includes("nail")) ||
        (workerFilterRole === "barber" && role.includes("barber"));
      const matchesStatus = workerFilterStatus === "all" ||
        (workerFilterStatus === "active" && w.is_active) ||
        (workerFilterStatus === "inactive" && !w.is_active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [workersList, workerSearch, workerFilterRole, workerFilterStatus]);

  const fetchWorkers = async () => {
    setLoadingWorkers(true);
    try {
      const res = await api.get("/salons/owner/workers/");
      const data = res.data;
      setWorkersList(Array.isArray(data) ? data : (data.results || data.workers || []));
    } catch (err) {
      setWorkerError(err.response?.data?.detail || "Could not load workers. Check the workers API endpoint.");
    } finally {
      setLoadingWorkers(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setWorkerForm((prev) => ({ ...prev, profile_photo: String(reader.result || "") }));
    reader.onerror = () => setWorkerError("Could not read the selected image.");
    reader.readAsDataURL(file);
  };

  const handleAddWorkerSubmit = async (e) => {
    e.preventDefault();
    setWorkerError("");
    setSubmittingWorker(true);
    try {
      const res = await api.post("/salons/owner/workers/", workerForm);
      const data = res.data;
      const worker = data.worker || data;
      setWorkersList((prev) => [worker, ...prev.filter((w) => w.id !== worker.id)]);
      setWorkerSuccessModal({
        name: worker.full_name || workerForm.full_name,
        email: worker.email || workerForm.email,
        password: data.password || workerForm.password || "Use the password set during creation",
      });
      setWorkerForm({
        full_name: "", email: "", phone_number: "", specialization: "Senior Hair Stylist",
        experience: "1-2 Years (Junior Stylist)", profile_photo: "", password: "",
      });
      setIsAddWorkerOpen(false);
    } catch (err) {
      const data = err.response?.data;
      setWorkerError(typeof data === "string" ? data : data?.detail || Object.values(data || {}).flat().join(" ") || "Failed to create worker.");
    } finally {
      setSubmittingWorker(false);
    }
  };

  const handleToggleWorkerStatus = async (workerId, isActive) => {
    try {
      const res = await api.patch(`/salons/owner/workers/${workerId}/`, { is_active: !isActive });
      const updated = res.data;
      setWorkersList((prev) => prev.map((w) => w.id === workerId ? { ...w, ...updated, is_active: updated.is_active ?? !isActive } : w));
    } catch (err) {
      setWorkerError(err.response?.data?.detail || "Could not update worker status.");
    }
  };

  const handleCopyCredentials = () => {
    if (!workerSuccessModal) return;
    navigator.clipboard?.writeText(
      `Name: ${workerSuccessModal.name}\nEmail: ${workerSuccessModal.email}\nPassword: ${workerSuccessModal.password}`
    );
    setToastMessage("Worker credentials copied.");
  };


  // for Modal 
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  
  

  // Active sub-navigation tab
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  // Modals
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [isBlockChairOpen, setIsBlockChairOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // Form states
  const [walkInForm, setWalkInForm] = useState({
    client_name: "",
    phone: "",
    service: "Haircut & Styling",
    stylist: "Rahul Sharma",
    station: "Station 01",
    duration: "45 mins",
  });

  const [blockChairForm, setBlockChairForm] = useState({
    station: "Station 03",
    reason: "Sanitization & Deep Cleaning",
    duration: "45 mins",
  });

  // Dynamic Greeting based on real local time
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 17) return "Good Afternoon 👋";
    return "Good Evening 👋";
  }, []);

  // Formatted date (e.g. "Today, 24 Oct")
  const formattedToday = useMemo(() => {
    const d = new Date();
    const day = d.getDate();
    const month = d.toLocaleString("default", { month: "short" });
    return `Today, ${day} ${month}`;
  }, []);

  // Dashboard Data State (with comprehensive defaults matching reference image)
  const [dashboardData, setDashboardData] = useState({
    salon_info: {
      id: 4,
      name: "ABC Salon & Spa - Indiranagar Flagship",
      city: "Indiranagar Flagship",
      category: "Hair & Styling • Spa",
      outlet_code: "#04",
      is_open: true,
      approval_status: "APPROVED",
    },
    kpi_stats: {
      bookings: { value: 24, trend: "+12% vs yesterday", trend_type: "positive" },
      revenue: { value: 8450, formatted: "₹8,450", trend: "+18% target pacing", trend_type: "positive" },
      completed: { value: 15, trend: "+9% turnaround", trend_type: "positive" },
      cancelled: { value: 2, trend: "-1% low attrition", trend_type: "warning" },
      upcoming: { value: 7, trend: "+8% booked slots", trend_type: "positive" },
    },
    today_schedule: [
      {
        id: 101,
        time: "10:00",
        period: "AM",
        client_name: "Vishnu Prasad",
        station: "Station 01",
        stylist: "Rahul",
        service: "Haircut & Styling",
        duration: "45 mins",
        status: "In Progress",
        status_type: "in-progress",
        action_label: "Check In",
        action_type: "primary",
      },
      {
        id: 102,
        time: "10:30",
        period: "AM",
        client_name: "Meera Nair",
        station: "Station 02",
        stylist: "Anjali",
        service: "Hydra Facial",
        duration: "60 mins",
        status: "Arrived",
        status_type: "arrived",
        action_label: "Seat Client",
        action_type: "warm",
      },
      {
        id: 103,
        time: "11:00",
        period: "AM",
        client_name: "Vikram Singhania",
        station: "Station 03",
        stylist: "Rahul",
        service: "Royal Beard Sculpt",
        duration: "30 mins",
        status: "Confirmed",
        status_type: "confirmed",
        action_label: "Send Reminder",
        action_type: "outline",
      },
    ],
    staff_on_duty: [
      {
        id: 1,
        name: "Rahul Sharma",
        station: "Station 01",
        role: "Senior Hair Stylist",
        rating: 4.9,
        booked_count: 8,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80",
        is_active: true,
      },
      {
        id: 2,
        name: "Anjali Sen",
        station: "Station 02",
        role: "Skin & Spa Specialist",
        rating: 4.95,
        booked_count: 6,
        avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80",
        is_active: true,
      },
    ],
    revenue_progression: {
      peak_window: "11 AM - 1 PM",
      daily_accrued: "₹8,450",
      target: "₹12,000",
      hours: [
        { time: "9 AM", amount: "₹650", height: "35%", color: "#bde5d2", is_peak: false },
        { time: "10 AM", amount: "₹1,400", height: "60%", color: "#8ec3a7", is_peak: false },
        { time: "11 AM", amount: "₹2,600", height: "92%", color: "#295541", is_peak: true },
        { time: "12 PM", amount: "₹2,100", height: "80%", color: "#477660", is_peak: false },
        { time: "1 PM", amount: "₹1,100", height: "50%", color: "#f3cb87", is_peak: false },
        { time: "2 PM", amount: "₹600", height: "25%", color: "#e9ecef", is_peak: false },
      ],
    },
    popular_services: [
      {
        id: 1,
        name: "Haircut & Styling",
        icon: "✂",
        bookings: 32,
        contribution_pct: 58,
        color: "#2b5a45",
        avg_price: "₹450",
      },
      {
        id: 2,
        name: "Facial & Cleanups",
        icon: "💆",
        bookings: 18,
        contribution_pct: 32,
        color: "#635339",
        avg_price: "₹1,200",
      },
      {
        id: 3,
        name: "Spa & Hair Rituals",
        icon: "🌸",
        bookings: 12,
        contribution_pct: 21,
        color: "#734139",
        avg_price: "₹1,650",
      },
    ],
  });

  // Auto-dismiss toast
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Load dynamic data from Backend if accessible
  useEffect(() => {
    const fetchOwnerData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await api.get("/salons/owner/dashboard/", config);
        if (res.data) {
          setDashboardData((prev) => ({
            ...prev,
            salon_info: { ...prev.salon_info, ...(res.data.salon_info || {}) },
            kpi_stats: { ...prev.kpi_stats, ...(res.data.kpi_stats || {}) },
            staff_on_duty: res.data.staff_on_duty && res.data.staff_on_duty.length > 0 ? res.data.staff_on_duty : prev.staff_on_duty,
            popular_services: res.data.popular_services && res.data.popular_services.length > 0 ? res.data.popular_services : prev.popular_services,
          }));
        }
      } catch (err) {
        // Fallback gracefully to curated mockup data
        console.log("Using studio defaults for owner dashboard");
      }
    };
    fetchOwnerData();
  }, []);

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle appointment action button clicks
  const handleAppointmentAction = (appointmentId, currentAction) => {
    setDashboardData((prev) => {
      const updatedSchedule = prev.today_schedule.map((item) => {
        if (item.id !== appointmentId) return item;

        if (currentAction === "Seat Client") {
          setToastMessage(`Seated ${item.client_name} at ${item.station}. Service in progress!`);
          return {
            ...item,
            status: "In Progress",
            status_type: "in-progress",
            action_label: "Check In",
            action_type: "primary",
          };
        } else if (currentAction === "Check In") {
          setToastMessage(`${item.client_name} checked in! Session active.`);
          return {
            ...item,
            status: "Completed",
            status_type: "confirmed",
            action_label: "Done ✓",
            action_type: "outline",
          };
        } else if (currentAction === "Send Reminder") {
          setToastMessage(`SMS & WhatsApp appointment reminder sent to ${item.client_name}!`);
          return {
            ...item,
            action_label: "Reminder Sent",
            action_type: "outline",
          };
        }
        return item;
      });

      return {
        ...prev,
        today_schedule: updatedSchedule,
      };
    });
  };

  // Submit Quick Walk-In
  const handleQuickWalkInSubmit = (e) => {
    e.preventDefault();
    if (!walkInForm.client_name.trim()) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const formattedHour = (hours % 12 || 12).toString().padStart(2, "0");
    const period = hours >= 12 ? "PM" : "AM";

    const newAppointment = {
      id: Date.now(),
      time: `${formattedHour}:${minutes}`,
      period: period,
      client_name: walkInForm.client_name.trim(),
      station: walkInForm.station,
      stylist: walkInForm.stylist.split(" ")[0],
      service: walkInForm.service,
      duration: walkInForm.duration,
      status: "In Progress",
      status_type: "in-progress",
      action_label: "Check In",
      action_type: "primary",
    };

    setDashboardData((prev) => ({
      ...prev,
      kpi_stats: {
        ...prev.kpi_stats,
        bookings: {
          ...prev.kpi_stats.bookings,
          value: prev.kpi_stats.bookings.value + 1,
        },
      },
      today_schedule: [newAppointment, ...prev.today_schedule],
    }));

    setToastMessage(`Walk-in for ${walkInForm.client_name} registered successfully at ${walkInForm.station}!`);
    setWalkInForm({
      client_name: "",
      phone: "",
      service: "Haircut & Styling",
      stylist: "Rahul Sharma",
      station: "Station 01",
      duration: "45 mins",
    });
    setIsWalkInOpen(false);
  };

  // Submit Block Chair
  const handleBlockChairSubmit = (e) => {
    e.preventDefault();
    setToastMessage(`${blockChairForm.station} blocked for ${blockChairForm.duration} (${blockChairForm.reason}).`);
    setIsBlockChairOpen(false);
  };

  // Filtered schedule based on search
  const filteredSchedule = useMemo(() => {
    if (!searchQuery.trim()) return dashboardData.today_schedule;
    const q = searchQuery.toLowerCase();
    return dashboardData.today_schedule.filter(
      (item) =>
        item.client_name.toLowerCase().includes(q) ||
        item.service.toLowerCase().includes(q) ||
        item.stylist.toLowerCase().includes(q) ||
        item.station.toLowerCase().includes(q)
    );
  }, [dashboardData.today_schedule, searchQuery]);

  const navTabs = [
    "Dashboard",
    "Salon",
    "Bookings",
    "Services",
    "Workers",
    "Schedule",
    "Customers",
    "Offers",
    "Revenue",
    "Reviews",
    "Settings",
  ];

  return (
    <div className="owner-studio-container">
      {/* Toast feedback */}
      {toastMessage && (
        <div className="studio-toast">
          <span>✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --------------------------------------------------------------------
          REUSABLE OWNER SUITE NAVBAR
          -------------------------------------------------------------------- */}
      <OwnerNavbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "Workers") {
            fetchWorkers();
          } else if (tab !== "Dashboard") {
            setToastMessage(`Switched view to ${tab}`);
          }
        }}
        searchQuery={searchQuery}
        onSearchChange={(e) => setSearchQuery(e.target.value)}
        onQuickWalkIn={() => setIsWalkInOpen(true)}
        onExportReport={() => setIsExportOpen(true)}
        onNotificationsClick={() => setToastMessage("All notifications up to date.")}
        workersCount={workersList.length}
      />

      {/* --------------------------------------------------------------------
          MAIN DASHBOARD BODY
          -------------------------------------------------------------------- */}
      <main className="studio-main-body">
        {activeTab === "Workers" ? (
          /* ================================================================
             WORKERS MANAGEMENT VIEW
             ================================================================ */
          <div className="owner-workers-view">
            {/* Hero Header Banner */}
            <div className="workers-hero-banner">
              <div>
                <h1 className="workers-hero-title">Salon Team & Stylists</h1>
                <p className="workers-hero-subtitle">
                  Manage professional staff, active status, specializations and assigned client bookings.
                  Worker accounts can log in to view their assigned appointments.
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-add-worker-primary"
                  style={{ background: "#ffffff", color: "#1e392a", border: "1px solid #c9d8cf" }}
                  onClick={() => navigate("/owner/workers")}
                >
                  <span>👥</span>
                  <span>Full Worker Roster</span>
                </button>
                <button
                  type="button"
                  className="btn-add-worker-primary"
                  onClick={() => navigate("/owner/add-worker")}
                >
                  <span>➕</span>
                  <span>Add Worker</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="workers-controls-bar">
              <div className="workers-controls-left">
                <input
                  type="text"
                  className="workers-search-input"
                  placeholder="Search worker by name, email, phone, role..."
                  value={workerSearch}
                  onChange={(e) => setWorkerSearch(e.target.value)}
                />

                <select
                  className="workers-filter-select"
                  value={workerFilterRole}
                  onChange={(e) => setWorkerFilterRole(e.target.value)}
                >
                  <option value="all">All Specializations</option>
                  <option value="hair">Hair Styling</option>
                  <option value="color">Colorist</option>
                  <option value="spa">Spa & Massage</option>
                  <option value="skin">Skin & Facial</option>
                  <option value="nail">Nails</option>
                  <option value="barber">Barber</option>
                </select>
              </div>

              <div className="workers-status-tabs">
                <button
                  type="button"
                  className={`workers-tab-btn ${workerFilterStatus === "all" ? "active" : ""}`}
                  onClick={() => setWorkerFilterStatus("all")}
                >
                  All ({workersList.length})
                </button>
                <button
                  type="button"
                  className={`workers-tab-btn ${workerFilterStatus === "active" ? "active" : ""}`}
                  onClick={() => setWorkerFilterStatus("active")}
                >
                  Active ({workersList.filter((w) => w.is_active).length})
                </button>
                <button
                  type="button"
                  className={`workers-tab-btn ${workerFilterStatus === "inactive" ? "active" : ""}`}
                  onClick={() => setWorkerFilterStatus("inactive")}
                >
                  Inactive ({workersList.filter((w) => !w.is_active).length})
                </button>
              </div>
            </div>

            {/* Workers Cards Grid */}
            {loadingWorkers ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#627267" }}>
                <p>Loading salon staff members...</p>
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #e8edea",
                }}
              >
                <div style={{ fontSize: "42px", marginBottom: "12px" }}>👥</div>
                <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#1d2922" }}>
                  {workersList.length === 0 ? "No Salon Workers Added Yet" : "No Matching Workers Found"}
                </h3>
                <p
                  style={{
                    margin: "0 0 20px",
                    fontSize: "14px",
                    color: "#627267",
                    maxWidth: "480px",
                    marginInline: "auto",
                  }}
                >
                  {workersList.length === 0
                    ? "Add stylists and staff members to your salon. They will receive worker credentials to log in and manage assigned appointments."
                    : "No workers match your filter or search query. Try clearing filters."}
                </p>
                {workersList.length === 0 ? (
                  <button
                    type="button"
                    className="btn-add-worker-primary"
                    style={{ margin: "0 auto" }}
                    onClick={() => navigate("/owner/add-worker")}
                  >
                    <span>➕ Add First Worker</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-modal-cancel"
                    onClick={() => {
                      setWorkerSearch("");
                      setWorkerFilterRole("all");
                      setWorkerFilterStatus("all");
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="workers-grid">
                {filteredWorkers.map((worker) => (
                  <div key={worker.id} className="worker-profile-card">
                    <div>
                      <div className="worker-card-top">
                        {worker.profile_photo ? (
                          <img
                            src={worker.profile_photo}
                            alt={worker.full_name}
                            className="worker-card-avatar"
                          />
                        ) : (
                          <div className="worker-card-avatar">
                            {worker.full_name?.charAt(0).toUpperCase() || "W"}
                          </div>
                        )}

                        <div className="worker-card-info">
                          <h3 className="worker-card-name">{worker.full_name}</h3>
                          <span className="worker-card-role">
                            {worker.specialization || "Salon Stylist"}
                          </span>
                          <div className="worker-tags-row">
                            {worker.experience && (
                              <span className="worker-tag-pill">
                                ⏳ {worker.experience}
                              </span>
                            )}
                            <span
                              className={`worker-status-badge ${
                                worker.is_active ? "active" : "inactive"
                              }`}
                            >
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  background: worker.is_active ? "#1e824c" : "#888",
                                }}
                              />
                              {worker.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="worker-card-body">
                        <div className="worker-contact-row">
                          <span>📧</span>
                          <span>{worker.email}</span>
                        </div>
                        {worker.phone_number && (
                          <div className="worker-contact-row">
                            <span>📞</span>
                            <span>{worker.phone_number}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="worker-card-footer">
                      <div className="worker-bookings-counter">
                        📅 {worker.assigned_bookings_count ?? 0} Bookings
                      </div>

                      <button
                        type="button"
                        className={`btn-toggle-worker ${
                          worker.is_active ? "deactivate" : "activate"
                        }`}
                        onClick={() =>
                          handleToggleWorkerStatus(worker.id, worker.is_active)
                        }
                      >
                        {worker.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "Dashboard" ? (
          <>
            {/* Banner Row: Greeting & Operations State */}
        <div className="studio-banner-row">
          <div>
            <div className="studio-live-badge">
              <span className="live-pulse-dot" />
              <span>Salon Open • Live Operations</span>
            </div>
            <h1 className="studio-greeting-title">{greeting}</h1>
            <p className="studio-greeting-subtitle">
              {dashboardData.salon_info.name} • {formattedToday}
            </p>
          </div>

          <button
            type="button"
            className="btn-block-chair"
            onClick={() => setIsBlockChairOpen(true)}
          >
            <span>🪑</span>
            <span>Block Chair</span>
          </button>
        </div>

        {/* ------------------------------------------------------------------
            5 KPI SUMMARY CARDS
            ------------------------------------------------------------------ */}
        <section className="studio-kpi-grid">
          {/* 1. BOOKINGS */}
          <div className="studio-kpi-card">
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">BOOKINGS</span>
              <span className="studio-kpi-icon">📅</span>
            </div>
            <div className="studio-kpi-value">{dashboardData.kpi_stats.bookings.value}</div>
            <div className="studio-kpi-trend positive">
              <span>↗</span>
              <span>{dashboardData.kpi_stats.bookings.trend}</span>
            </div>
          </div>

          {/* 2. REVENUE */}
          <div className="studio-kpi-card">
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">REVENUE</span>
              <span className="studio-kpi-icon">🪙</span>
            </div>
            <div className="studio-kpi-value">{dashboardData.kpi_stats.revenue.formatted}</div>
            <div className="studio-kpi-trend positive">
              <span>↗</span>
              <span>{dashboardData.kpi_stats.revenue.trend}</span>
            </div>
          </div>

          {/* 3. COMPLETED */}
          <div className="studio-kpi-card">
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">COMPLETED</span>
              <span className="studio-kpi-icon">✓</span>
            </div>
            <div className="studio-kpi-value">{dashboardData.kpi_stats.completed.value}</div>
            <div className="studio-kpi-trend positive">
              <span>↗</span>
              <span>{dashboardData.kpi_stats.completed.trend}</span>
            </div>
          </div>

          {/* 4. CANCELLED */}
          <div className="studio-kpi-card">
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">CANCELLED</span>
              <span className="studio-kpi-icon" style={{ color: "#c0392b" }}>✕</span>
            </div>
            <div className="studio-kpi-value">{dashboardData.kpi_stats.cancelled.value}</div>
            <div className="studio-kpi-trend warning">
              <span>↘</span>
              <span>{dashboardData.kpi_stats.cancelled.trend}</span>
            </div>
          </div>

          {/* 5. UPCOMING */}
          <div className="studio-kpi-card">
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">UPCOMING</span>
              <span className="studio-kpi-icon">⏱</span>
            </div>
            <div className="studio-kpi-value">{dashboardData.kpi_stats.upcoming.value}</div>
            <div className="studio-kpi-trend positive">
              <span>↗</span>
              <span>{dashboardData.kpi_stats.upcoming.trend}</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------
            MAIN 2-COLUMN GRID
            ------------------------------------------------------------------ */}
        <div className="studio-dashboard-grid">
          {/* ===================== LEFT COLUMN ===================== */}
          <div className="studio-grid-left">
            {/* Widget 1: Today's Schedule */}
            <section className="studio-widget-card">
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>📅</span>
                  <h2 className="studio-widget-title">Today&apos;s Schedule</h2>
                </div>
                <span className="studio-widget-badge">
                  Live appointments ({filteredSchedule.length} active)
                </span>
              </div>

              <div className="schedule-list">
                {filteredSchedule.map((item) => (
                  <div key={item.id} className="schedule-item-card">
                    {/* Time block */}
                    <div className="schedule-time-box">
                      <span className="schedule-time-value">{item.time}</span>
                      <span className="schedule-time-period">{item.period || "AM"}</span>
                    </div>

                    {/* Customer & Service Info */}
                    <div className="schedule-client-info">
                      <div className="schedule-client-name-row">
                        <span className="schedule-client-name">{item.client_name}</span>
                        <span className="schedule-station-tag">{item.station}</span>
                      </div>
                      <div className="schedule-service-desc">
                        {item.stylist} • {item.service} • {item.duration}
                      </div>
                    </div>

                    {/* Status & Action */}
                    <div className="schedule-actions-group">
                      <span className={`schedule-status-pill ${item.status_type || "confirmed"}`}>
                        {item.status === "In Progress" && "● "}
                        {item.status}
                      </span>

                      <button
                        type="button"
                        className={`btn-schedule-action ${item.action_type || "primary"}`}
                        onClick={() => handleAppointmentAction(item.id, item.action_label)}
                      >
                        {item.action_label}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Widget 2: Staff On Duty Today */}
            <section className="studio-widget-card">
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>👥</span>
                  <h2 className="studio-widget-title">Staff On Duty Today</h2>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-add-worker-small"
                    style={{ background: "#ffffff", color: "#1e392a", border: "1px solid #c9d8cf" }}
                    onClick={() => navigate("/owner/workers")}
                  >
                    Manage Roster
                  </button>
                  <button
                    type="button"
                    className="btn-add-worker-small"
                    onClick={() => navigate("/owner/add-worker")}
                  >
                    + Add Worker
                  </button>
                  <span className="studio-widget-badge pill">
                    {dashboardData.staff_on_duty.length} Stylists
                  </span>
                </div>
              </div>

              <div className="staff-duty-grid">
                {dashboardData.staff_on_duty.map((staff) => (
                  <div key={staff.id} className="staff-card">
                    <div className="staff-avatar-wrapper">
                      {staff.avatar ? (
                        <img src={staff.avatar} alt={staff.name} className="staff-avatar-img" />
                      ) : (
                        <div
                          className="staff-avatar-img"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#eef7f2",
                            color: "#1e392a",
                            fontWeight: "bold",
                            fontSize: "14px",
                          }}
                        >
                          {staff.name?.charAt(0).toUpperCase() || "S"}
                        </div>
                      )}
                      {staff.is_active && <span className="staff-online-dot" />}
                    </div>

                    <div className="staff-info">
                      <div className="staff-name-row">
                        <span className="staff-name">{staff.name}</span>
                        <span className="staff-station-pill">{staff.station}</span>
                      </div>
                      <span className="staff-role-desc">{staff.role}</span>
                      <div className="staff-metric-row">
                        <span className="staff-rating-star">★ {staff.rating}</span>
                        <span>•</span>
                        <span>{staff.booked_count} booked today</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* ===================== RIGHT COLUMN ===================== */}
          <div className="studio-grid-right">
            {/* Widget 3: Revenue Progression */}
            <section className="studio-widget-card">
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>📊</span>
                  <h2 className="studio-widget-title">Revenue Progression</h2>
                </div>
                <span className="studio-widget-badge pill">
                  Peak: {dashboardData.revenue_progression.peak_window}
                </span>
              </div>

              <p className="revenue-widget-subtitle">
                Daily trend • {dashboardData.revenue_progression.daily_accrued} accrued
              </p>

              {/* Chart Pillars */}
              <div className="revenue-chart-container">
                {dashboardData.revenue_progression.hours.map((col, idx) => (
                  <div
                    key={idx}
                    className="revenue-chart-bar-group"
                    title={`${col.time}: ${col.amount}`}
                  >
                    {col.is_peak && (
                      <span className="peak-tag-badge">Peak</span>
                    )}
                    <div
                      className="revenue-bar-pillar"
                      style={{
                        height: col.height,
                        backgroundColor: col.color,
                      }}
                    />
                    <span className="revenue-bar-label">{col.time}</span>
                  </div>
                ))}
              </div>

              {/* Chart Legend & Target */}
              <div className="revenue-legend-row">
                <div className="revenue-legend-items">
                  <div className="legend-item">
                    <span className="legend-dot pos" />
                    <span>Direct / In-Salon POS</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-dot online" />
                    <span>Advance / Online</span>
                  </div>
                </div>

                <div className="revenue-target-text">
                  Target: {dashboardData.revenue_progression.target}
                </div>
              </div>
            </section>

            {/* Widget 4: Popular Services */}
            <section className="studio-widget-card">
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>✨</span>
                  <h2 className="studio-widget-title">Popular Services</h2>
                </div>
                <span className="studio-widget-badge">
                  Top categories today
                </span>
              </div>

              <div className="popular-services-list">
                {dashboardData.popular_services.map((service) => (
                  <div key={service.id} className="popular-service-item">
                    <div className="service-item-top">
                      <div className="service-title-with-icon">
                        <span>{service.icon}</span>
                        <span>{service.name}</span>
                      </div>
                      <span className="service-booking-count">{service.bookings} bookings</span>
                    </div>

                    <div className="service-progress-track">
                      <div
                        className="service-progress-fill"
                        style={{
                          width: `${service.contribution_pct}%`,
                          backgroundColor: service.color,
                        }}
                      />
                    </div>

                    <div className="service-item-bottom">
                      <span>Contribution: {service.contribution_pct}% of volume</span>
                      <span className="service-avg-price">Avg. {service.avg_price}</span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="btn-manage-catalog"
                onClick={() => {
                  setActiveTab("Services");
                  setToastMessage("Opening Service Catalog & Tariff Manager...");
                }}
              >
                <span>Manage Service Catalog & Tariffs</span>
                <span>→</span>
              </button>
            </section>
          </div>
        </div>
          </>
        ) : (
          /* ================================================================
             OTHER STUDIO TABS (PLACEHOLDER & QUICK JUMP)
             ================================================================ */
          <div
            style={{
              textAlign: "center",
              padding: "60px 20px",
              background: "#ffffff",
              borderRadius: "16px",
              border: "1px solid #e8edea",
            }}
          >
            <h3 style={{ margin: "0 0 8px", fontSize: "18px", color: "#1d2922" }}>
              {activeTab} Management
            </h3>
            <p style={{ color: "#627267", margin: "0 0 16px" }}>
              This section is part of your salon studio operations.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setActiveTab("Dashboard")}
              >
                ← Back to Dashboard
              </button>
              <button
                type="button"
                className="btn-add-worker-primary"
                onClick={() => navigate("/owner/workers")}
              >
                View Salon Workers
              </button>
            </div>
          </div>
        )}
      </main>


      {/* --------------------------------------------------------------------
          STUDIO FOOTER
          -------------------------------------------------------------------- */}
      <footer className="studio-footer">
        <div className="studio-footer-inner">
          <div>
            BookMySalon Business Edition • {dashboardData.salon_info.city} Outlet {dashboardData.salon_info.outlet_code}
          </div>
          <div className="sync-status-indicator">
            <span className="sync-dot" />
            <span>All systems operational • Sync active</span>
          </div>
        </div>
      </footer>

      {/* --------------------------------------------------------------------
          MODAL: QUICK WALK-IN
          -------------------------------------------------------------------- */}
      {isWalkInOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsWalkInOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Register Quick Walk-In</h3>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setIsWalkInOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickWalkInSubmit}>
              <div className="studio-modal-body">
                <div className="modal-input-group">
                  <label htmlFor="client_name">Client Full Name *</label>
                  <input
                    id="client_name"
                    type="text"
                    required
                    placeholder="e.g. Arjun Kapoor"
                    value={walkInForm.client_name}
                    onChange={(e) => setWalkInForm({ ...walkInForm, client_name: e.target.value })}
                    autoFocus
                  />
                </div>

                <div className="modal-input-group">
                  <label htmlFor="client_phone">Contact Phone</label>
                  <input
                    id="client_phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                  />
                </div>

                <div className="modal-row-split">
                  <div className="modal-input-group">
                    <label htmlFor="walkin_service">Service</label>
                    <select
                      id="walkin_service"
                      value={walkInForm.service}
                      onChange={(e) => setWalkInForm({ ...walkInForm, service: e.target.value })}
                    >
                      <option value="Haircut & Styling">Haircut & Styling</option>
                      <option value="Hydra Facial">Hydra Facial</option>
                      <option value="Royal Beard Sculpt">Royal Beard Sculpt</option>
                      <option value="Head & Shoulder Massage">Head & Shoulder Massage</option>
                      <option value="Deep Condition Spa">Deep Condition Spa</option>
                    </select>
                  </div>

                  <div className="modal-input-group">
                    <label htmlFor="walkin_stylist">Stylist</label>
                    <select
                      id="walkin_stylist"
                      value={walkInForm.stylist}
                      onChange={(e) => setWalkInForm({ ...walkInForm, stylist: e.target.value })}
                    >
                      <option value="Rahul Sharma">Rahul Sharma (Station 01)</option>
                      <option value="Anjali Sen">Anjali Sen (Station 02)</option>
                    </select>
                  </div>
                </div>

                <div className="modal-row-split">
                  <div className="modal-input-group">
                    <label htmlFor="walkin_station">Station</label>
                    <select
                      id="walkin_station"
                      value={walkInForm.station}
                      onChange={(e) => setWalkInForm({ ...walkInForm, station: e.target.value })}
                    >
                      <option value="Station 01">Station 01</option>
                      <option value="Station 02">Station 02</option>
                      <option value="Station 03">Station 03</option>
                      <option value="Station 04">Station 04</option>
                    </select>
                  </div>

                  <div className="modal-input-group">
                    <label htmlFor="walkin_duration">Duration</label>
                    <select
                      id="walkin_duration"
                      value={walkInForm.duration}
                      onChange={(e) => setWalkInForm({ ...walkInForm, duration: e.target.value })}
                    >
                      <option value="30 mins">30 mins</option>
                      <option value="45 mins">45 mins</option>
                      <option value="60 mins">60 mins</option>
                      <option value="90 mins">90 mins</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="studio-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsWalkInOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit">
                  Confirm & Assign Seat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: BLOCK CHAIR
          -------------------------------------------------------------------- */}
      {isBlockChairOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsBlockChairOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Block Station / Chair</h3>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setIsBlockChairOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBlockChairSubmit}>
              <div className="studio-modal-body">
                <div className="modal-input-group">
                  <label htmlFor="block_station">Select Station</label>
                  <select
                    id="block_station"
                    value={blockChairForm.station}
                    onChange={(e) => setBlockChairForm({ ...blockChairForm, station: e.target.value })}
                  >
                    <option value="Station 01">Station 01 (Hair Styling Bar)</option>
                    <option value="Station 02">Station 02 (Facial & Spa Pod)</option>
                    <option value="Station 03">Station 03 (Men Grooming Chair)</option>
                    <option value="Station 04">Station 04 (Pedicure Lounge)</option>
                  </select>
                </div>

                <div className="modal-input-group">
                  <label htmlFor="block_reason">Reason</label>
                  <select
                    id="block_reason"
                    value={blockChairForm.reason}
                    onChange={(e) => setBlockChairForm({ ...blockChairForm, reason: e.target.value })}
                  >
                    <option value="Sanitization & Deep Cleaning">Sanitization & Deep Cleaning</option>
                    <option value="Stylist Break / Lunch Shift">Stylist Break / Lunch Shift</option>
                    <option value="Equipment Maintenance">Equipment Maintenance</option>
                    <option value="Reserved for VIP Booking">Reserved for VIP Booking</option>
                  </select>
                </div>

                <div className="modal-input-group">
                  <label htmlFor="block_duration">Duration</label>
                  <select
                    id="block_duration"
                    value={blockChairForm.duration}
                    onChange={(e) => setBlockChairForm({ ...blockChairForm, duration: e.target.value })}
                  >
                    <option value="30 mins">30 mins</option>
                    <option value="45 mins">45 mins</option>
                    <option value="1 hour">1 hour</option>
                    <option value="2 hours">2 hours</option>
                    <option value="Rest of the day">Rest of the day</option>
                  </select>
                </div>
              </div>

              <div className="studio-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsBlockChairOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit" style={{ background: "#6d4c41" }}>
                  Block Chair
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: EXPORT DAILY REPORT
          -------------------------------------------------------------------- */}
      {isExportOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsExportOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Export Daily Studio Report</h3>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setIsExportOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="studio-modal-body">
              <div style={{ background: "#f8faf9", padding: "14px", borderRadius: "8px", border: "1px solid #e2e8e5" }}>
                <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: "13px" }}>
                  {dashboardData.salon_info.name}
                </p>
                <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#627267" }}>
                  Operations Summary for {formattedToday}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                  <div>Total Bookings: <strong>{dashboardData.kpi_stats.bookings.value}</strong></div>
                  <div>Completed: <strong>{dashboardData.kpi_stats.completed.value}</strong></div>
                  <div>Gross Revenue: <strong>{dashboardData.kpi_stats.revenue.formatted}</strong></div>
                  <div>Cancelled: <strong>{dashboardData.kpi_stats.cancelled.value}</strong></div>
                </div>
              </div>

              <p style={{ fontSize: "11px", color: "#8a9990", margin: "4px 0 0" }}>
                Ready to download as formatted PDF or CSV for accounting & salon audit.
              </p>
            </div>

            <div className="studio-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setIsExportOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={() => {
                  window.print();
                  setIsExportOpen(false);
                }}
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: ADD NEW WORKER
          -------------------------------------------------------------------- */}
      {isAddWorkerOpen && (
        <div
          className="studio-modal-backdrop"
          onClick={() => setIsAddWorkerOpen(false)}
        >
          <div
            className="studio-modal-card"
            style={{ maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="studio-modal-header">
              <div>
                <h3 className="studio-modal-title">Add Salon Worker</h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#627267" }}>
                  Create a worker account with authentication & salon assignment.
                </p>
              </div>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setIsAddWorkerOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddWorkerSubmit}>
              <div
                className="studio-modal-body"
                style={{ maxHeight: "70vh", overflowY: "auto" }}
              >
                {workerError && (
                  <div className="worker-error-banner">
                    ⚠️ {workerError}
                  </div>
                )}

                {/* 1. Full Name */}
                <div className="form-group">
                  <label className="form-label">
                    Full Name <span style={{ color: "#c0392b" }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Priya Sharma"
                    required
                    value={workerForm.full_name}
                    onChange={(e) =>
                      setWorkerForm({ ...workerForm, full_name: e.target.value })
                    }
                  />
                </div>

                {/* 2. Email & 3. Phone Number */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Email (Login ID) <span style={{ color: "#c0392b" }}>*</span>
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="priya@gmail.com"
                      required
                      value={workerForm.email}
                      onChange={(e) =>
                        setWorkerForm({ ...workerForm, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Phone Number <span style={{ color: "#c0392b" }}>*</span>
                    </label>
                    <input
                      type="tel"
                      className="form-input"
                      placeholder="+91 98765 43210"
                      required
                      value={workerForm.phone_number}
                      onChange={(e) =>
                        setWorkerForm({
                          ...workerForm,
                          phone_number: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 4. Specialization & 5. Experience */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                  }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Specialization <span style={{ color: "#c0392b" }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={workerForm.specialization}
                      onChange={(e) =>
                        setWorkerForm({
                          ...workerForm,
                          specialization: e.target.value,
                        })
                      }
                    >
                      <option value="Senior Hair Stylist">Senior Hair Stylist</option>
                      <option value="Hair Stylist & Barber">Hair Stylist & Barber</option>
                      <option value="Colorist & Chemical Specialist">
                        Colorist & Chemical Specialist
                      </option>
                      <option value="Skin & Esthetics Specialist">
                        Skin & Esthetics Specialist
                      </option>
                      <option value="Spa & Massage Therapist">
                        Spa & Massage Therapist
                      </option>
                      <option value="Nail Art & Manicurist">Nail Art & Manicurist</option>
                      <option value="Bridal Makeup & Styling">
                        Bridal Makeup & Styling
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Experience <span style={{ color: "#c0392b" }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={workerForm.experience}
                      onChange={(e) =>
                        setWorkerForm({ ...workerForm, experience: e.target.value })
                      }
                    >
                      <option value="1-2 Years (Junior Stylist)">
                        1-2 Years (Junior)
                      </option>
                      <option value="3-5 Years (Mid-level)">
                        3-5 Years (Mid-level)
                      </option>
                      <option value="5+ Years (Senior Stylist)">
                        5+ Years (Senior)
                      </option>
                      <option value="8+ Years (Master Stylist)">
                        8+ Years (Master)
                      </option>
                    </select>
                  </div>
                </div>

                {/* 6. Profile Photo */}
                <div className="form-group">
                  <label className="form-label">Profile Photo</label>
                  <div className="worker-photo-uploader">
                    {workerForm.profile_photo ? (
                      <img
                        src={workerForm.profile_photo}
                        alt="Preview"
                        className="photo-preview-circle"
                      />
                    ) : (
                      <div className="photo-preview-circle">📷</div>
                    )}
                    <div style={{ flex: 1 }}>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        style={{ fontSize: "12px" }}
                      />
                      <p
                        style={{
                          margin: "4px 0 0",
                          fontSize: "11px",
                          color: "#8a9990",
                        }}
                      >
                        Upload photo file or paste image URL below
                      </p>
                    </div>
                  </div>
                  <input
                    type="url"
                    className="form-input"
                    style={{ marginTop: "8px" }}
                    placeholder="Or paste photo URL (https://...)"
                    value={
                      workerForm.profile_photo.startsWith("data:")
                        ? ""
                        : workerForm.profile_photo
                    }
                    onChange={(e) =>
                      setWorkerForm({
                        ...workerForm,
                        profile_photo: e.target.value,
                      })
                    }
                  />
                </div>

                {/* 7. Password */}
                <div className="form-group">
                  <label className="form-label">Worker Account Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={workerForm.password}
                    onChange={(e) =>
                      setWorkerForm({ ...workerForm, password: e.target.value })
                    }
                  />
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "11px",
                      color: "#627267",
                    }}
                  >
                    Worker will use this email and password to log in and view assigned bookings.
                  </p>
                </div>
              </div>

              <div className="studio-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setIsAddWorkerOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={submittingWorker}
                >
                  {submittingWorker ? "Creating Account..." : "Create worker account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------
          MODAL: WORKER ADDED SUCCESSFULLY
          -------------------------------------------------------------------- */}
      {workerSuccessModal && (
        <div
          className="studio-modal-backdrop"
          onClick={() => setWorkerSuccessModal(null)}
        >
          <div
            className="studio-modal-card"
            style={{ maxWidth: "480px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="studio-modal-header"
              style={{ borderBottom: "none", paddingBottom: "0" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>🎉</span>
                <h3 className="studio-modal-title" style={{ color: "#1e824c" }}>
                  Worker Added Successfully!
                </h3>
              </div>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={() => setWorkerSuccessModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="studio-modal-body">
              <p
                style={{
                  fontSize: "13px",
                  color: "#496353",
                  margin: "0 0 12px",
                }}
              >
                The worker account has been created and assigned to your salon. Provide these login credentials to the worker:
              </p>

              <div className="worker-credentials-list">
                <div className="worker-cred-item">
                  <span style={{ color: "#627267" }}>Full Name:</span>
                  <span style={{ fontWeight: 600 }}>
                    {workerSuccessModal.name}
                  </span>
                </div>
                <div className="worker-cred-item">
                  <span style={{ color: "#627267" }}>Email:</span>
                  <strong>{workerSuccessModal.email}</strong>
                </div>
                <div className="worker-cred-item">
                  <span style={{ color: "#627267" }}>Password:</span>
                  <strong>{workerSuccessModal.password}</strong>
                </div>
                <div className="worker-cred-item">
                  <span style={{ color: "#627267" }}>Login Portal:</span>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "#1e392a",
                      fontWeight: 600,
                    }}
                  >
                    Worker Studio (/login)
                  </span>
                </div>
              </div>
            </div>

            <div className="studio-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={handleCopyCredentials}
              >
                📋 Copy Credentials
              </button>
              <button
                type="button"
                className="btn-modal-submit"
                onClick={() => setWorkerSuccessModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerBanner from "../../components/owner/OwnerBanner";
import OwnerBookingsTab from "../../components/owner/OwnerBookingsTab";
import OwnerReviewsTab from "../../components/owner/OwnerReviewsTab";
import OwnerRevenueTab from "../../components/owner/OwnerRevenueTab";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import "../../styles/ownerDashboard.css";

const formatLocalDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ */
/* Count-up hook — animates numeric values on mount                    */
/* ------------------------------------------------------------------ */
function CountUp({ end = 0, duration = 900, prefix = "", suffix = "", decimals = 0 }) {
  const [val, setVal] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    const target = Number(end) || 0;
    if (target === 0) {
      setVal(0);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [end, duration]);

  const display =
    decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-IN");
  return (
    <>
      {prefix}
      {display}
      {suffix}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton block                                                      */
/* ------------------------------------------------------------------ */
function Skel({ w = "100%", h = 14, r = 6, style }) {
  return <div className="skel" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

function DashboardSkeleton() {
  return (
    <>
      <div className="studio-kpi-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="kpi-card kpi-card--skeleton">
            <div className="kpi-top"><Skel w="40%" h={10} /><Skel w={28} h={28} r={10} /></div>
            <Skel w="60%" h={26} style={{ marginBottom: 8 }} />
            <Skel w="45%" h={10} />
          </div>
        ))}
      </div>
      <div className="studio-dashboard-grid">
        <div className="studio-grid-left">
          <div className="studio-widget-card">
            <Skel w="30%" h={18} style={{ marginBottom: 18 }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="tl-item tl-item--skeleton">
                <Skel w={64} h={44} r={10} />
                <div style={{ flex: 1 }}>
                  <Skel w="55%" h={14} style={{ marginBottom: 8 }} />
                  <Skel w="80%" h={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="studio-grid-right">
          <div className="studio-widget-card">
            <Skel w="40%" h={18} style={{ marginBottom: 20 }} />
            <Skel w="100%" h={160} r={12} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* KPI Card — reusable with count-up + trend                           */
/* ------------------------------------------------------------------ */
function KpiCard({
  label, icon, value, formatted, trend, trendType = "positive",
  onClick, isRating = false, isRatingDisplay = false, decimals = 0,
  reviewsCount, delay = 0,
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      className={`kpi-card ${onClick ? "kpi-card--clickable" : ""}`}
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className={`kpi-icon ${isRating ? "kpi-icon--gold" : ""}`}>{icon}</span>
      </div>

      <div className="kpi-value">
        {isRatingDisplay ? (
          <>
            <CountUp end={value} decimals={1} />
            <span className="kpi-star">★</span>
          </>
        ) : formatted ? (
          formatted
        ) : (
          <CountUp end={value} decimals={decimals} />
        )}
      </div>

      <div className={`kpi-trend kpi-trend--${trendType}`}>
        {isRating ? <span>💬</span> : trendType === "warning" ? <span>↘</span> : <span>↗</span>}
        <span>{isRating ? `${reviewsCount || 0} reviews` : trend}</span>
      </div>

      <span className="kpi-ripple" aria-hidden="true" />
    </Wrapper>
  );
}

/* ------------------------------------------------------------------ */
/* Schedule Timeline Item                                              */
/* ------------------------------------------------------------------ */
function ScheduleItem({ item, onAction }) {
  const status = item.status_type || "confirmed";
  const isInProgress =
    item.status === "In Progress" || item.raw_status === "IN_PROGRESS";

  return (
    <div className="tl-item">
      <div className="tl-time">
        <span className="tl-time-value">{item.time || item.booking_time || "10:00"}</span>
        <span className="tl-time-period">{item.period || "AM"}</span>
      </div>

      <div className="tl-dot-col">
        <span className={`tl-dot tl-dot--${status} ${isInProgress ? "tl-dot--pulse" : ""}`} />
      </div>

      <div className="tl-card">
        <div className="tl-row">
          <div className="tl-row-left">
            <span className="tl-name">{item.client_name}</span>
            <span className="tl-station">{item.station}</span>
          </div>
          <span className={`tl-status tl-status--${status}`}>
            {isInProgress && <span className="tl-status-dot" />}
            {item.status || item.status_display}
          </span>
        </div>

        <div className="tl-meta">
          {item.booking_date ? `${item.booking_date} • ` : ""}
          {item.stylist || item.worker_name || "Specialist"} •{" "}
          {item.service || item.service_name} • {item.duration || "45 mins"}
        </div>

        <div className="tl-actions">
          <button
            type="button"
            className={`tl-btn tl-btn--${item.action_type || "primary"}`}
            onClick={() => onAction(item.id, item.action_label || "Seat Client")}
          >
            {item.action_label || "Update"}
            <span className="tl-btn-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff Card                                                          */
/* ------------------------------------------------------------------ */
function StaffCard({ staff }) {
  const initial = staff.name?.charAt(0).toUpperCase() || "S";
  return (
    <div className="staff-card">
      <div className="staff-avatar-wrapper">
        {staff.avatar ? (
          <img src={staff.avatar} alt={staff.name} className="staff-avatar-img" />
        ) : (
          <div className="staff-avatar-img staff-avatar-initial">{initial}</div>
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
          {staff.reviews_count !== undefined && (
            <span className="staff-metric-muted">({staff.reviews_count} reviews)</span>
          )}
          <span className="staff-metric-dot">•</span>
          <span>{staff.booked_count} booked today</span>
        </div>
      </div>
      <span className="staff-hover-badge">Available</span>
    </div>
  );
}

/* ================================================================== */
/* Main Component — all logic preserved                                */
/* ================================================================== */
export default function OwnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, updateUser } = useAuth();

  const [scheduleView, setScheduleView] = useState("today");
  const searchInputRef = useRef(null);

  const [workersList, setWorkersList] = useState([]);
  const [workerSearch, setWorkerSearch] = useState("");
  const [workerFilterRole, setWorkerFilterRole] = useState("all");
  const [workerFilterStatus, setWorkerFilterStatus] = useState("all");
  const [loadingWorkers, setLoadingWorkers] = useState(false);
  const [isAddWorkerOpen, setIsAddWorkerOpen] = useState(false);
  const [workerError, setWorkerError] = useState("");
  const [submittingWorker, setSubmittingWorker] = useState(false);
  const [workerSuccessModal, setWorkerSuccessModal] = useState(null);
  const [allBookings, setAllBookings] = useState([]);
  const [servicesList, setServicesList] = useState([]);

  const [workerForm, setWorkerForm] = useState({
    full_name: "", email: "", phone_number: "",
    specialization: "Senior Hair Stylist",
    experience: "1-2 Years (Junior Stylist)", profile_photo: "", password: "",
  });

  const filteredWorkers = useMemo(() => {
    const q = workerSearch.trim().toLowerCase();
    return workersList.filter((w) => {
      const matchesSearch = !q || [w.full_name, w.email, w.phone_number, w.specialization]
        .some((v) => String(v || "").toLowerCase().includes(q));
      const role = String(w.specialization || "").toLowerCase();
      const matchesRole =
        workerFilterRole === "all" ||
        (workerFilterRole === "hair" && role.includes("hair")) ||
        (workerFilterRole === "color" && role.includes("color")) ||
        (workerFilterRole === "spa" && (role.includes("spa") || role.includes("massage"))) ||
        (workerFilterRole === "skin" && (role.includes("skin") || role.includes("facial"))) ||
        (workerFilterRole === "nail" && role.includes("nail")) ||
        (workerFilterRole === "barber" && role.includes("barber"));
      const matchesStatus =
        workerFilterStatus === "all" ||
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
      setWorkersList(Array.isArray(data) ? data : data.results || data.workers || []);
    } catch (err) {
      setWorkerError(err.response?.data?.detail || "Could not load workers.");
    } finally {
      setLoadingWorkers(false);
    }
  };

  const fetchServices = async () => {
    try {
      const res = await api.get("/services/owner/services/");
      const svcs = res.data?.services || (Array.isArray(res.data) ? res.data : []);
      setServicesList(svcs);
    } catch (err) {
      console.log("Could not load salon services for walk-in:", err);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setWorkerForm((prev) => ({ ...prev, profile_photo: String(reader.result || "") }));
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
        full_name: "", email: "", phone_number: "",
        specialization: "Senior Hair Stylist",
        experience: "1-2 Years (Junior Stylist)", profile_photo: "", password: "",
      });
      setIsAddWorkerOpen(false);
    } catch (err) {
      const data = err.response?.data;
      setWorkerError(
        typeof data === "string" ? data
          : data?.detail || Object.values(data || {}).flat().join(" ") || "Failed to create worker."
      );
    } finally {
      setSubmittingWorker(false);
    }
  };

  const handleToggleWorkerStatus = async (workerId, isActive) => {
    try {
      const res = await api.patch(`/salons/owner/workers/${workerId}/`, { is_active: !isActive });
      const updated = res.data;
      setWorkersList((prev) =>
        prev.map((w) => (w.id === workerId ? { ...w, ...updated, is_active: updated.is_active ?? !isActive } : w))
      );
    } catch (err) {
      setWorkerError(err.response?.data?.detail || "Could not update worker status.");
    }
  };

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);

  useEffect(() => {
    if (user?.must_change_password === true) setShowTempPasswordModal(true);
  }, [user?.must_change_password]);

  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (location.state?.targetTab) setActiveTab(location.state.targetTab);
  }, [location.state]);

  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleOpenResetPassword = () => {
    resetPasswordFields();
    setIsResetPasswordOpen(true);
  };

  const handleCloseResetPassword = () => {
    resetPasswordFields();
    setIsResetPasswordOpen(false);
  };

  const handleResetPasswordSubmit = async (e) => {
    if (e) e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) return setPasswordError("Please enter your current password.");
    if (!newPassword) return setPasswordError("Please enter your new password.");
    if (newPassword.length < 8) return setPasswordError("New password must be at least 8 characters.");
    if (currentPassword === newPassword) return setPasswordError("New password cannot match current.");
    if (newPassword !== confirmPassword) return setPasswordError("Passwords do not match.");

    try {
      setPasswordLoading(true);
      const res = await api.post("/accounts/owner/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setPasswordSuccess(res.data?.message || "Password updated successfully.");
      setToastMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      if (user?.must_change_password) updateUser({ ...user, must_change_password: false });
      setTimeout(() => {
        setIsResetPasswordOpen(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.error || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [isBlockChairOpen, setIsBlockChairOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const [walkInForm, setWalkInForm] = useState({
    client_name: "", phone: "", service: "Haircut & Styling",
    stylist: "", station: "Station 01", duration: "45 mins",
  });

  const [blockChairForm, setBlockChairForm] = useState({
    station: "Station 01",
    reason: "Sanitization & Deep Cleaning",
    duration: "45 mins",
  });

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 17) return "Good Afternoon 👋";
    return "Good Evening 👋";
  }, []);

  const formattedToday = useMemo(() => {
    const d = new Date();
    const month = d.toLocaleString("default", { month: "short" });
    return `Today, ${d.getDate()} ${month}`;
  }, []);

  const [dashboardData, setDashboardData] = useState({
    salon_info: { id: null, name: "", city: "", category: "", outlet_code: "", is_open: true, approval_status: "" },
    kpi_stats: {
      bookings: { value: 0, trend: "0 today", trend_type: "positive" },
      revenue: { value: 0, formatted: "₹0", trend: "Accrued Revenue", trend_type: "positive" },
      completed: { value: 0, trend: "0 completed", trend_type: "positive" },
      cancelled: { value: 0, trend: "0 cancelled", trend_type: "positive" },
      upcoming: { value: 0, trend: "0 active slots", trend_type: "positive" },
    },
    today_schedule: [], all_bookings: [], staff_on_duty: [], reviews: [], worker_reviews: [],
    rating: 5.0, reviews_count: 0, rating_breakdown: null,
    revenue_progression: { peak_window: "--", daily_accrued: "₹0", target: "₹0", hours: [] },
    popular_services: [],
  });

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const fetchOwnerData = async () => {
    try {
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const res = await api.get("/salons/owner/dashboard/", config);
      if (res.data) {
        setDashboardData((prev) => ({
          ...prev,
          salon_info: { ...prev.salon_info, ...(res.data.salon_info || {}) },
          kpi_stats: res.data.kpi_stats || prev.kpi_stats,
          staff_on_duty: res.data.staff_on_duty || [],
          popular_services: res.data.popular_services || [],
          revenue_progression: res.data.revenue_progression || prev.revenue_progression,
          today_schedule: Array.isArray(res.data.today_schedule) ? res.data.today_schedule : [],
          all_bookings: Array.isArray(res.data.all_bookings) ? res.data.all_bookings : [],
          reviews: Array.isArray(res.data.reviews) ? res.data.reviews : [],
          worker_reviews: Array.isArray(res.data.worker_reviews) ? res.data.worker_reviews : [],
          rating: typeof res.data.rating === "number" ? res.data.rating : parseFloat(res.data.rating) || 5.0,
          reviews_count: typeof res.data.reviews_count === "number" ? res.data.reviews_count : parseInt(res.data.reviews_count, 10) || 0,
          rating_breakdown: res.data.rating_breakdown || null,
        }));
        if (Array.isArray(res.data.all_bookings)) setAllBookings(res.data.all_bookings);
      }
    } catch (err) {
      console.log("Failed to fetch owner dashboard data:", err);
    }
  };

  useEffect(() => {
    fetchOwnerData();
    fetchWorkers();
    fetchServices();
  }, []);

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

  const handleUpdateBookingStatus = async (bookingId, newStatus) => {
    try {
      await api.patch(`/salons/owner/bookings/${bookingId}/status/`, { status: newStatus });
      setToastMessage(`Booking status updated to ${newStatus}!`);
      await fetchOwnerData();
    } catch (err) {
      console.error("Failed to update booking status:", err);
      setToastMessage(err.response?.data?.error || "Failed to update appointment status");
    }
  };

  const handleAppointmentAction = async (appointmentId, currentAction) => {
    let targetStatus = null;
    if (currentAction === "Seat Client") targetStatus = "IN_PROGRESS";
    else if (currentAction === "Check In" || currentAction === "Complete") targetStatus = "COMPLETED";
    else if (currentAction === "Cancel") targetStatus = "CANCELLED";
    else if (currentAction === "Send Reminder") {
      setToastMessage("Appointment reminder sent via SMS & WhatsApp!");
      return;
    }
    if (targetStatus) await handleUpdateBookingStatus(appointmentId, targetStatus);
  };

  const handleQuickWalkInSubmit = async (e) => {
    e.preventDefault();
    if (!walkInForm.client_name.trim()) return;
    try {
      await api.post("/salons/owner/quick-walkin/", {
        client_name: walkInForm.client_name.trim(),
        phone: walkInForm.phone,
        service: walkInForm.service,
        stylist: walkInForm.stylist || (workersList[0]?.full_name || "Specialist"),
        station: walkInForm.station,
        duration: walkInForm.duration,
      });
      setToastMessage(`Walk-in for ${walkInForm.client_name} registered at ${walkInForm.station}!`);
      await fetchOwnerData();
    } catch (err) {
      setToastMessage(err.response?.data?.error || "Failed to register walk-in.");
    }
    setWalkInForm({
      client_name: "", phone: "", service: "Haircut & Styling",
      stylist: "", station: "Station 01", duration: "45 mins",
    });
    setIsWalkInOpen(false);
  };

  const handleBlockChairSubmit = (e) => {
    e.preventDefault();
    setToastMessage(`${blockChairForm.station} blocked for ${blockChairForm.duration} (${blockChairForm.reason}).`);
    setIsBlockChairOpen(false);
  };

  const activeScheduleList = useMemo(() => {
    const today = formatLocalDate(new Date());
    const all = dashboardData.all_bookings?.length ? dashboardData.all_bookings : allBookings;
    if (scheduleView === "today") {
      if (dashboardData.today_schedule?.length > 0) return dashboardData.today_schedule;
      return (all || []).filter((b) => b.booking_date === today);
    }
    if (scheduleView === "upcoming") {
      return (all || []).filter((b) => {
        const isFutureOrToday = !b.booking_date || b.booking_date >= today;
        const s = String(b.raw_status || b.status || "").toUpperCase();
        return isFutureOrToday && s !== "CANCELLED" && s !== "COMPLETED";
      });
    }
    return all || [];
  }, [dashboardData.today_schedule, dashboardData.all_bookings, allBookings, scheduleView]);

  const filteredSchedule = useMemo(() => {
    if (!searchQuery.trim()) return activeScheduleList;
    const q = searchQuery.toLowerCase();
    return activeScheduleList.filter(
      (item) =>
        (item.client_name || "").toLowerCase().includes(q) ||
        (item.service || item.service_name || "").toLowerCase().includes(q) ||
        (item.stylist || item.worker_name || "").toLowerCase().includes(q) ||
        (item.station || "").toLowerCase().includes(q)
    );
  }, [activeScheduleList, searchQuery]);

  const isLoadingDashboard = !dashboardData.salon_info.name && !dashboardData.salon_info.id;

  return (
    <div className="owner-studio-container">
      {toastMessage && (
        <div className="studio-toast">
          <span className="studio-toast-icon">✓</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <OwnerNavbarHeader
        salonInfo={dashboardData.salon_info}
        onQuickWalkIn={() => setIsWalkInOpen(true)}
        onExportReport={() => setIsExportOpen(true)}
        onNotificationsClick={() => setToastMessage("All notifications up to date.")}
        onSettingsClick={() => setActiveTab("Settings")}
      />

      <OwnerNavbar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === "Workers") fetchWorkers();
          else if (tab !== "Dashboard") setToastMessage(`Switched view to ${tab}`);
        }}
        workersCount={workersList.length}
      />

      <main className="studio-main-body">
        {activeTab === "Settings" ? (
          <div className="studio-settings-container">
            <div className="studio-settings-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <h1 className="studio-settings-title">Settings &amp; Account Security</h1>
                  <p className="studio-settings-sub">
                    Manage your Salon Owner security credentials and reset your password.
                  </p>
                </div>
                <button type="button" className="btn-modal-cancel" onClick={() => setActiveTab("Dashboard")}>
                  ← Back to Dashboard
                </button>
              </div>
            </div>

            <div className="studio-settings-grid">
              <div className="studio-settings-card">
                <div className="studio-settings-card-header">
                  <h3 className="studio-settings-card-title"><span>👤</span> Salon Manager Profile</h3>
                  <span className="role-badge">OWNER</span>
                </div>
                <div className="studio-settings-card-body">
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Manager Name</span>
                    <span className="settings-meta-value">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Salon Owner"}
                    </span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Email</span>
                    <span className="settings-meta-value">{user?.email || "owner@bookmysalon.com"}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Salon</span>
                    <span className="settings-meta-value">{dashboardData.salon_info.name}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Outlet</span>
                    <span className="settings-meta-value">{dashboardData.salon_info.city}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Role</span>
                    <span className="settings-meta-value" style={{ color: "var(--studio-positive)" }}>
                      Master Administrator
                    </span>
                  </div>
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--studio-border-subtle)" }}>
                    <p style={{ fontSize: 12, color: "var(--studio-text-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
                      Resetting password requires your current password. Use the new password for future sign-ins.
                    </p>
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      style={{ width: "100%", justifyContent: "center", display: "flex", gap: 6 }}
                      onClick={() => navigate("/owner/salon-profile")}
                    >
                      <span>⚙️</span> Manage Salon Profile
                    </button>
                  </div>
                </div>
              </div>

              <div className="studio-settings-card">
                <div className="studio-settings-card-header">
                  <h3 className="studio-settings-card-title"><span>🔑</span> Reset Password</h3>
                  <span style={{ fontSize: 11, color: "var(--studio-text-subtle)", fontWeight: 600 }}>
                    Requires Current Password
                  </span>
                </div>
                <div className="studio-settings-card-body">
                  <form onSubmit={handleResetPasswordSubmit}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {passwordError && <div className="password-alert-error"><span>⚠️</span><span>{passwordError}</span></div>}
                      {passwordSuccess && <div className="password-alert-success"><span>✓</span><span>{passwordSuccess}</span></div>}

                      <div className="modal-input-group">
                        <label htmlFor="settings_current_password">Current Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_current_password"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Enter your current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required autoComplete="current-password"
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowCurrentPassword((p) => !p)}>
                            {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      <div className="modal-input-group">
                        <label htmlFor="settings_new_password">New Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_new_password"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter new password (min. 8 characters)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required autoComplete="new-password"
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowNewPassword((p) => !p)}>
                            {showNewPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      <div className="modal-input-group">
                        <label htmlFor="settings_confirm_password">Confirm New Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter your new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required autoComplete="new-password"
                          />
                          <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword((p) => !p)}>
                            {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      <div className="password-requirements-box">
                        <div className="password-requirements-title">Security Checklist</div>
                        <div className={`password-requirement-item ${newPassword.length >= 8 ? "valid" : "pending"}`}>
                          <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                          <span>At least 8 characters long</span>
                        </div>
                        <div className={`password-requirement-item ${newPassword && currentPassword && newPassword !== currentPassword ? "valid" : "pending"}`}>
                          <span>{newPassword && currentPassword && newPassword !== currentPassword ? "✓" : "○"}</span>
                          <span>Must differ from current password</span>
                        </div>
                        <div className={`password-requirement-item ${confirmPassword && newPassword === confirmPassword ? "valid" : "pending"}`}>
                          <span>{confirmPassword && newPassword === confirmPassword ? "✓" : "○"}</span>
                          <span>New passwords match</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
                        <button type="button" className="btn-modal-cancel" onClick={resetPasswordFields} disabled={passwordLoading}>
                          Clear
                        </button>
                        <button type="submit" className="btn-modal-submit" disabled={passwordLoading}>
                          {passwordLoading ? "Updating…" : "✓ Update Password"}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === "Bookings" ? (
          <OwnerBookingsTab
            bookings={allBookings.length > 0 ? allBookings : dashboardData.all_bookings || []}
            workers={workersList}
            onUpdateStatus={handleUpdateBookingStatus}
            onRefresh={fetchOwnerData}
          />
        ) : activeTab === "Reviews" ? (
          <OwnerReviewsTab
            reviews={dashboardData.reviews || []}
            workerReviews={dashboardData.worker_reviews || []}
            rating={dashboardData.rating || 5.0}
            reviewsCount={dashboardData.reviews_count || 0}
            ratingBreakdown={dashboardData.rating_breakdown}
            workers={workersList}
            onRefresh={fetchOwnerData}
            onBackToDashboard={() => setActiveTab("Dashboard")}
          />
        ) : activeTab === "Revenue" ? (
          <OwnerRevenueTab
            salonId={dashboardData.salon_info?.id}
            onBackToDashboard={() => setActiveTab("Dashboard")}
          />
        ) : (
          <>
            <OwnerBanner
              salonInfo={dashboardData.salon_info}
              greeting={greeting}
              formattedToday={formattedToday}
              onResetPassword={handleOpenResetPassword}
            />

            {isLoadingDashboard ? (
              <DashboardSkeleton />
            ) : (
              <>
                {/* KPI Grid — 6 animated cards */}
                <section className="studio-kpi-grid">
                  <KpiCard
                    label="BOOKINGS"
                    icon="📅"
                    value={dashboardData.kpi_stats.bookings.value}
                    trend={dashboardData.kpi_stats.bookings.trend}
                    onClick={() => setActiveTab("Bookings")}
                    delay={0}
                  />
                  <KpiCard
                    label="REVENUE"
                    icon="🪙"
                    formatted={dashboardData.kpi_stats.revenue.formatted}
                    trend={dashboardData.kpi_stats.revenue.trend}
                    onClick={() => setActiveTab("Revenue")}
                    delay={60}
                  />
                  <KpiCard
                    label="COMPLETED"
                    icon="✓"
                    value={dashboardData.kpi_stats.completed.value}
                    trend={dashboardData.kpi_stats.completed.trend}
                    delay={120}
                  />
                  <KpiCard
                    label="CANCELLED"
                    icon="✕"
                    value={dashboardData.kpi_stats.cancelled.value}
                    trend={dashboardData.kpi_stats.cancelled.trend}
                    trendType="warning"
                    delay={180}
                  />
                  <KpiCard
                    label="UPCOMING"
                    icon="⏱"
                    value={dashboardData.kpi_stats.upcoming.value}
                    trend={dashboardData.kpi_stats.upcoming.trend}
                    onClick={() => setScheduleView("upcoming")}
                    delay={240}
                  />
                  <KpiCard
                    label="SALON RATING"
                    icon="★"
                    value={dashboardData.rating || 5.0}
                    isRating
                    isRatingDisplay
                    reviewsCount={dashboardData.reviews_count}
                    onClick={() => setActiveTab("Reviews")}
                    delay={300}
                  />
                </section>

                <div className="studio-dashboard-grid">
                  <div className="studio-grid-left">
                    {/* Schedule */}
                    <section className="studio-widget-card">
                      <div className="studio-widget-header" style={{ flexWrap: "wrap", gap: 10 }}>
                        <div className="studio-widget-title-group">
                          <span style={{ fontSize: 18 }}>📅</span>
                          <h2 className="studio-widget-title">
                            {scheduleView === "today" ? "Today's Schedule"
                              : scheduleView === "upcoming" ? "Upcoming Bookings"
                              : "All Salon Bookings"}
                          </h2>
                        </div>
                        <div className="segmented-control">
                          {[
                            { id: "today", label: "Today", count: dashboardData.today_schedule?.length || 0 },
                            { id: "upcoming", label: "Upcoming", count: dashboardData.kpi_stats?.upcoming?.value || 0 },
                            { id: "all", label: "All", count: dashboardData.all_bookings?.length || allBookings.length || 0 },
                          ].map((v) => (
                            <button
                              key={v.id}
                              type="button"
                              className={`seg-btn ${scheduleView === v.id ? "seg-btn--active" : ""}`}
                              onClick={() => setScheduleView(v.id)}
                            >
                              {v.label}
                              <span className="seg-count">{v.count}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="schedule-list">
                        {filteredSchedule.length === 0 ? (
                          <div className="empty-schedule">
                            <div className="empty-schedule-icon">📅</div>
                            <h4>{scheduleView === "today" ? "No appointments today" : "No appointments found"}</h4>
                            <p>
                              {scheduleView === "today" && (dashboardData.all_bookings?.length > 0 || allBookings.length > 0)
                                ? `You have ${dashboardData.all_bookings?.length || allBookings.length} bookings in the system.`
                                : "Customer bookings will appear here in real time."}
                            </p>
                            <div className="empty-schedule-actions">
                              {scheduleView !== "all" && (dashboardData.all_bookings?.length > 0 || allBookings.length > 0) && (
                                <button type="button" className="empty-btn empty-btn--primary" onClick={() => setScheduleView("all")}>
                                  View All Bookings
                                </button>
                              )}
                              <button type="button" className="empty-btn" onClick={() => setActiveTab("Bookings")}>
                                Open Bookings Manager →
                              </button>
                            </div>
                          </div>
                        ) : (
                          filteredSchedule.map((item) => (
                            <ScheduleItem key={item.id} item={item} onAction={handleAppointmentAction} />
                          ))
                        )}
                      </div>
                    </section>

                    {/* Staff On Duty */}
                    <section className="studio-widget-card">
                      <div className="studio-widget-header">
                        <div className="studio-widget-title-group">
                          <span style={{ fontSize: 18 }}>👥</span>
                          <h2 className="studio-widget-title">Staff On Duty Today</h2>
                          <span className="studio-widget-badge pill">
                            {dashboardData.staff_on_duty.length} Stylists
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-view-all-staff"
                          onClick={() => navigate("/owner/workers")}
                        >
                          View All →
                        </button>
                      </div>

                      <div className="staff-duty-grid">
                        {dashboardData.staff_on_duty?.length > 0 ? (
                          dashboardData.staff_on_duty.map((staff) => (
                            <StaffCard key={staff.id} staff={staff} />
                          ))
                        ) : (
                          <div className="empty-staff">
                            <span className="empty-staff-icon">👤</span>
                            <span>No staff members added yet</span>
                            <button type="button" className="empty-btn empty-btn--primary" onClick={() => navigate("/owner/workers")}>
                              + Add Staff
                            </button>
                          </div>
                        )}
                      </div>
                    </section>
                  </div>

                  <div className="studio-grid-right">
                    {/* Revenue Chart */}
                    <section className="studio-widget-card">
                      <div className="studio-widget-header">
                        <div className="studio-widget-title-group">
                          <span style={{ fontSize: 18 }}>📊</span>
                          <h2 className="studio-widget-title">Revenue Progression</h2>
                        </div>
                        <span className="studio-widget-badge pill">
                          Peak: {dashboardData.revenue_progression.peak_window}
                        </span>
                      </div>

                      <p className="revenue-widget-subtitle">
                        Daily trend • {dashboardData.revenue_progression.daily_accrued} accrued
                      </p>

                      <div className="revenue-chart-container">
                        {dashboardData.revenue_progression.hours.map((col, idx) => (
                          <div
                            key={idx}
                            className="revenue-chart-bar-group"
                            title={`${col.time}: ${col.amount}`}
                            style={{ animationDelay: `${idx * 40}ms` }}
                          >
                            {col.is_peak && <span className="peak-tag-badge">Peak</span>}
                            <div
                              className="revenue-bar-pillar"
                              style={{ height: col.height, backgroundColor: col.color }}
                            />
                            <span className="revenue-bar-label">{col.time}</span>
                            <span className="revenue-bar-tooltip">{col.amount}</span>
                          </div>
                        ))}
                      </div>

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

                    {/* Popular Services */}
                    <section className="studio-widget-card">
                      <div className="studio-widget-header">
                        <div className="studio-widget-title-group">
                          <span style={{ fontSize: 18 }}>✨</span>
                          <h2 className="studio-widget-title">Popular Services</h2>
                        </div>
                        <span className="studio-widget-badge">Top categories today</span>
                      </div>

                      <div className="popular-services-list">
                        {dashboardData.popular_services.map((service, idx) => (
                          <div
                            key={service.id}
                            className="popular-service-item"
                            style={{ animationDelay: `${idx * 80}ms` }}
                          >
                            <div className="service-item-top">
                              <div className="service-title-with-icon">
                                <span className="service-icon">{service.icon}</span>
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

                      <button type="button" className="btn-manage-catalog" onClick={() => navigate("/owner/services")}>
                        <span>Manage Service Catalog</span>
                        <span>→</span>
                      </button>
                    </section>

                    {/* Recent Reviews */}
                    <section className="studio-widget-card">
                      <div className="studio-widget-header">
                        <div className="studio-widget-title-group">
                          <span style={{ fontSize: 18 }}>💬</span>
                          <h2 className="studio-widget-title">Customer Feedback</h2>
                        </div>
                        <span className="rating-pill-small">
                          {dashboardData.rating || 5.0}★ ({dashboardData.reviews_count || 0})
                        </span>
                      </div>

                      {!dashboardData.reviews || dashboardData.reviews.length === 0 ? (
                        <div className="empty-reviews">
                          <div className="empty-reviews-icon">💬</div>
                          <h4>No client reviews yet</h4>
                          <p>Verified reviews from completed appointments will appear here.</p>
                        </div>
                      ) : (
                        <div className="reviews-mini-list">
                          {dashboardData.reviews.slice(0, 3).map((r) => {
                            const initial = (r.customer_name || r.author || "C")[0].toUpperCase();
                            return (
                              <div key={r.id} className="review-mini-card">
                                <div className="review-mini-top">
                                  <div className="review-mini-user">
                                    <div className="review-mini-avatar">{initial}</div>
                                    <span className="review-mini-name">{r.customer_name || r.author}</span>
                                  </div>
                                  <span className="review-mini-stars">{"★".repeat(r.rating)}</span>
                                </div>
                                {r.comment && (
                                  <p className="review-mini-comment">
                                    "{r.comment.length > 90 ? `${r.comment.slice(0, 90)}…` : r.comment}"
                                  </p>
                                )}
                                <div className="review-mini-meta">
                                  <span>{r.treatment || "Salon Service"}</span>
                                  <span>{r.date}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn-manage-catalog"
                        style={{ marginTop: 12 }}
                        onClick={() => setActiveTab("Reviews")}
                      >
                        <span>View All Reviews ({dashboardData.reviews_count || 0})</span>
                        <span>→</span>
                      </button>
                    </section>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* ─── Sticky Salon Information Footer Label ─── */}
      <OwnerStickyFooter
        salonInfo={dashboardData.salon_info}
        rating={dashboardData.rating}
        reviewsCount={dashboardData.reviews_count}
      />

      {/* ─── Modals (unchanged logic, improved styling via CSS) ─── */}
      {isWalkInOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsWalkInOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Register Quick Walk-In</h3>
              <button type="button" className="studio-modal-close-btn" onClick={() => setIsWalkInOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickWalkInSubmit}>
              <div className="studio-modal-body">
                <div className="modal-input-group">
                  <label>Client Full Name *</label>
                  <input
                    type="text" required placeholder="e.g. Arjun Kapoor"
                    value={walkInForm.client_name}
                    onChange={(e) => setWalkInForm({ ...walkInForm, client_name: e.target.value })}
                    autoFocus
                  />
                </div>
                <div className="modal-input-group">
                  <label>Contact Phone</label>
                  <input
                    type="tel" placeholder="+91 98765 43210"
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                  />
                </div>
                <div className="modal-row-split">
                  <div className="modal-input-group">
                    <label>Service</label>
                    <select value={walkInForm.service} onChange={(e) => setWalkInForm({ ...walkInForm, service: e.target.value })}>
                      {servicesList.length > 0 ? servicesList.map((s) => {
                        const sName = s.custom_name || s.service_name || s.name;
                        return <option key={s.id} value={sName}>{sName} {s.duration ? `(${s.duration} mins)` : ""}</option>;
                      }) : (
                        <>
                          <option value="Haircut & Styling">Haircut & Styling</option>
                          <option value="Hydra Facial">Hydra Facial</option>
                          <option value="Royal Beard Sculpt">Royal Beard Sculpt</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="modal-input-group">
                    <label>Stylist</label>
                    <select value={walkInForm.stylist} onChange={(e) => setWalkInForm({ ...walkInForm, stylist: e.target.value })}>
                      {workersList.length > 0 ? workersList.map((w) => {
                        const name = w.full_name || (w.user ? `${w.user.first_name} ${w.user.last_name || ""}`.trim() : "Stylist");
                        return <option key={w.id} value={name}>{name} ({w.station || "Station 01"})</option>;
                      }) : <option value="Any Available">Any Available Stylist</option>}
                    </select>
                  </div>
                </div>
                <div className="modal-row-split">
                  <div className="modal-input-group">
                    <label>Station</label>
                    <select value={walkInForm.station} onChange={(e) => setWalkInForm({ ...walkInForm, station: e.target.value })}>
                      <option>Station 01</option><option>Station 02</option>
                      <option>Station 03</option><option>Station 04</option>
                    </select>
                  </div>
                  <div className="modal-input-group">
                    <label>Duration</label>
                    <select value={walkInForm.duration} onChange={(e) => setWalkInForm({ ...walkInForm, duration: e.target.value })}>
                      <option>30 mins</option><option>45 mins</option><option>60 mins</option><option>90 mins</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="studio-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsWalkInOpen(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Confirm & Assign</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBlockChairOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsBlockChairOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Block Station / Chair</h3>
              <button type="button" className="studio-modal-close-btn" onClick={() => setIsBlockChairOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleBlockChairSubmit}>
              <div className="studio-modal-body">
                <div className="modal-input-group">
                  <label>Select Station</label>
                  <select value={blockChairForm.station} onChange={(e) => setBlockChairForm({ ...blockChairForm, station: e.target.value })}>
                    <option>Station 01 (Hair Styling Bar)</option>
                    <option>Station 02 (Facial & Spa Pod)</option>
                    <option>Station 03 (Men Grooming Chair)</option>
                    <option>Station 04 (Pedicure Lounge)</option>
                  </select>
                </div>
                <div className="modal-input-group">
                  <label>Reason</label>
                  <select value={blockChairForm.reason} onChange={(e) => setBlockChairForm({ ...blockChairForm, reason: e.target.value })}>
                    <option>Sanitization & Deep Cleaning</option>
                    <option>Stylist Break / Lunch Shift</option>
                    <option>Equipment Maintenance</option>
                    <option>Reserved for VIP Booking</option>
                  </select>
                </div>
                <div className="modal-input-group">
                  <label>Duration</label>
                  <select value={blockChairForm.duration} onChange={(e) => setBlockChairForm({ ...blockChairForm, duration: e.target.value })}>
                    <option>30 mins</option><option>45 mins</option>
                    <option>1 hour</option><option>2 hours</option>
                    <option>Rest of the day</option>
                  </select>
                </div>
              </div>
              <div className="studio-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={() => setIsBlockChairOpen(false)}>Cancel</button>
                <button type="submit" className="btn-modal-submit">Block Chair</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isExportOpen && (
        <div className="studio-modal-backdrop" onClick={() => setIsExportOpen(false)}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="studio-modal-header">
              <h3 className="studio-modal-title">Export Daily Studio Report</h3>
              <button type="button" className="studio-modal-close-btn" onClick={() => setIsExportOpen(false)}>✕</button>
            </div>
            <div className="studio-modal-body">
              <div style={{ background: "var(--studio-primary-light)", padding: 14, borderRadius: 8, textAlign: "center" }}>
                <h3 style={{ margin: 0, color: "var(--studio-primary)" }}>Coming Soon</h3>
                <p style={{ fontSize: 12, color: "var(--studio-text-muted)", margin: "6px 0 0" }}>
                  Ready to download as formatted PDF or CSV for accounting & salon audit.
                </p>
              </div>
            </div>
            <div className="studio-modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setIsExportOpen(false)}>Close</button>
              <button
                type="button" className="btn-modal-submit"
                onClick={() => { window.print(); setIsExportOpen(false); }}
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {isResetPasswordOpen && (
        <div className="studio-modal-backdrop" onClick={handleCloseResetPassword}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="studio-modal-header">
              <div>
                <h3 className="studio-modal-title">Reset Owner Password</h3>
                <span style={{ fontSize: 11, color: "var(--studio-text-subtle)", fontWeight: 500 }}>
                  Enter your current password to update master credentials
                </span>
              </div>
              <button type="button" className="studio-modal-close-btn" onClick={handleCloseResetPassword}>✕</button>
            </div>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="studio-modal-body">
                {passwordError && <div className="password-alert-error"><span>⚠️</span><span>{passwordError}</span></div>}
                {passwordSuccess && <div className="password-alert-success"><span>✓</span><span>{passwordSuccess}</span></div>}

                <div className="modal-input-group">
                  <label>Current Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required autoFocus autoComplete="current-password"
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowCurrentPassword((p) => !p)}>
                      {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <div className="modal-input-group">
                  <label>New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required autoComplete="new-password"
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowNewPassword((p) => !p)}>
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <div className="modal-input-group">
                  <label>Confirm New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required autoComplete="new-password"
                    />
                    <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPassword((p) => !p)}>
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                <div className="password-requirements-box">
                  <div className="password-requirements-title">Security Checklist</div>
                  <div className={`password-requirement-item ${newPassword.length >= 8 ? "valid" : "pending"}`}>
                    <span>{newPassword.length >= 8 ? "✓" : "○"}</span><span>At least 8 characters long</span>
                  </div>
                  <div className={`password-requirement-item ${newPassword && currentPassword && newPassword !== currentPassword ? "valid" : "pending"}`}>
                    <span>{newPassword && currentPassword && newPassword !== currentPassword ? "✓" : "○"}</span>
                    <span>Must differ from current password</span>
                  </div>
                  <div className={`password-requirement-item ${confirmPassword && newPassword === confirmPassword ? "valid" : "pending"}`}>
                    <span>{confirmPassword && newPassword === confirmPassword ? "✓" : "○"}</span>
                    <span>New passwords match</span>
                  </div>
                </div>
              </div>

              <div className="studio-modal-footer">
                <button type="button" className="btn-modal-cancel" onClick={handleCloseResetPassword} disabled={passwordLoading}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-submit" disabled={passwordLoading}>
                  {passwordLoading ? "Updating…" : "✓ Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTempPasswordModal && (
        <div className="studio-modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="studio-modal-card" style={{ maxWidth: 440 }}>
            <div className="studio-modal-header" style={{ borderBottom: "2px solid var(--studio-accent-gold)" }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️ Security Reminder</span>
            </div>
            <div className="studio-modal-body">
              <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#92400e" }}>
                You are using a temporary password.
              </p>
              <p style={{ margin: 0, color: "var(--studio-text-muted)", fontSize: "0.93rem", lineHeight: 1.5 }}>
                For your account security, please change your password as soon as possible.
              </p>
            </div>
            <div className="studio-modal-footer">
              <button type="button" className="btn-modal-cancel" onClick={() => setShowTempPasswordModal(false)}>
                I'll do it later
              </button>
              <button
                type="button" className="btn-modal-submit"
                onClick={() => { setShowTempPasswordModal(false); handleOpenResetPassword(); }}
              >
                Change Password Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
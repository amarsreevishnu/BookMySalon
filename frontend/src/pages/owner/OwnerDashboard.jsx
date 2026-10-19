import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerBanner from "../../components/owner/OwnerBanner";
import OwnerBookingsTab from "../../components/owner/OwnerBookingsTab";
import OwnerReviewsTab from "../../components/owner/OwnerReviewsTab";
import "../../styles/ownerDashboard.css";

const formatLocalDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, updateUser } = useAuth();

  const [scheduleView, setScheduleView] = useState("today"); // "today" | "upcoming" | "all"
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


  
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Temp-password reminder modal
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);

  useEffect(() => {
    if (user?.must_change_password === true) {
      setShowTempPasswordModal(true);
    }
  }, [user?.must_change_password]);

  
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  
  useEffect(() => {
    if (location.state?.targetTab) {
      setActiveTab(location.state.targetTab);
    }
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

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setPasswordError("Please enter your new password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (currentPassword === newPassword) {
      setPasswordError("New password cannot be the same as your current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await api.post("/accounts/owner/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const successMsg =
        res.data?.message || "Password updated successfully using current password.";
      setPasswordSuccess(successMsg);
      setToastMessage("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Clear the must_change_password flag in Redux + localStorage so modal never reappears
      if (user?.must_change_password) {
        updateUser({ ...user, must_change_password: false });
      }

      setTimeout(() => {
        setIsResetPasswordOpen(false);
        setPasswordSuccess("");
      }, 2000);
    } catch (err) {
      console.error("Owner password reset error:", err);
      setPasswordError(
        err.response?.data?.error ||
          "Failed to update password. Please check your current password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  
  const [isWalkInOpen, setIsWalkInOpen] = useState(false);
  const [isBlockChairOpen, setIsBlockChairOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  
  const [walkInForm, setWalkInForm] = useState({
    client_name: "",
    phone: "",
    service: "Haircut & Styling",
    stylist: "",
    station: "Station 01",
    duration: "45 mins",
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
    const day = d.getDate();
    const month = d.toLocaleString("default", { month: "short" });
    return `Today, ${day} ${month}`;
  }, []);

  
  const [dashboardData, setDashboardData] = useState({
    salon_info: {
      id: null,
      name: "",
      city: "",
      category: "",
      outlet_code: "",
      is_open: true,
      approval_status: "",
    },
    kpi_stats: {
      bookings: { value: 0, trend: "0 today", trend_type: "positive" },
      revenue: { value: 0, formatted: "₹0", trend: "Accrued Revenue", trend_type: "positive" },
      completed: { value: 0, trend: "0 completed", trend_type: "positive" },
      cancelled: { value: 0, trend: "0 cancelled", trend_type: "positive" },
      upcoming: { value: 0, trend: "0 active slots", trend_type: "positive" },
    },
    today_schedule: [],
    all_bookings: [],
    staff_on_duty: [],
    reviews: [],
    worker_reviews: [],
    rating: 5.0,
    reviews_count: 0,
    rating_breakdown: null,
    revenue_progression: {
      peak_window: "--",
      daily_accrued: "₹0",
      target: "₹0",
      hours: [],
    },
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
          rating: typeof res.data.rating === "number" ? res.data.rating : (parseFloat(res.data.rating) || 5.0),
          reviews_count: typeof res.data.reviews_count === "number" ? res.data.reviews_count : (parseInt(res.data.reviews_count, 10) || 0),
          rating_breakdown: res.data.rating_breakdown || null,
        }));
        if (Array.isArray(res.data.all_bookings)) {
          setAllBookings(res.data.all_bookings);
        }
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
    if (currentAction === "Seat Client") {
      targetStatus = "IN_PROGRESS";
    } else if (currentAction === "Check In" || currentAction === "Complete") {
      targetStatus = "COMPLETED";
    } else if (currentAction === "Cancel") {
      targetStatus = "CANCELLED";
    } else if (currentAction === "Send Reminder") {
      setToastMessage("Appointment reminder sent to client via SMS & WhatsApp!");
      return;
    }

    if (targetStatus) {
      await handleUpdateBookingStatus(appointmentId, targetStatus);
    }
  };

  // Submit Quick Walk-In
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
      setToastMessage(`Walk-in for ${walkInForm.client_name} registered successfully at ${walkInForm.station}!`);
      await fetchOwnerData();
    } catch (err) {
      console.error("Failed to register walk-in:", err);
      setToastMessage(err.response?.data?.error || "Failed to register walk-in.");
    }

    setWalkInForm({
      client_name: "",
      phone: "",
      service: "Haircut & Styling",
      stylist: "",
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

  const activeScheduleList = useMemo(() => {
    const today = formatLocalDate(new Date());
    const all = dashboardData.all_bookings?.length ? dashboardData.all_bookings : allBookings;

    if (scheduleView === "today") {
      if (dashboardData.today_schedule && dashboardData.today_schedule.length > 0) {
        return dashboardData.today_schedule;
      }
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

  // Filtered schedule based on search
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

  const navTabs = [
    "Dashboard",
    "Salon",
    "Bookings",
    "Services",
    "Workers",
    "Salon Schedule",
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

      <OwnerNavbarHeader
        onQuickWalkIn={() => setIsWalkInOpen(true)}
        onExportReport={() => setIsExportOpen(true)}
        onNotificationsClick={() => setToastMessage("All notifications up to date.")}
        onSettingsClick={() => setActiveTab("Settings")}
      />
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
        workersCount={workersList.length}
      />

      <main className="studio-main-body">
        {activeTab === "Settings" ? (
          <div className="studio-settings-container">
            <div className="studio-settings-header">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h1 className="studio-settings-title">Settings &amp; Account Security</h1>
                  <p className="studio-settings-sub">
                    Manage your Salon Owner security credentials and reset your password using your current password.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setActiveTab("Dashboard")}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px" }}
                >
                  <span>←</span>
                  <span>Back to Dashboard</span>
                </button>
              </div>
            </div>

            <div className="studio-settings-grid">
              {/* Account Overview Card */}
              <div className="studio-settings-card">
                <div className="studio-settings-card-header">
                  <h3 className="studio-settings-card-title">
                    <span>👤</span> Salon Manager Profile
                  </h3>
                  <span
                    style={{
                      background: "#eaf7ef",
                      color: "#1e824c",
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                    }}
                  >
                    OWNER
                  </span>
                </div>
                <div className="studio-settings-card-body">
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Manager Name</span>
                    <span className="settings-meta-value">
                      {user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Salon Owner"}
                    </span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Email Address</span>
                    <span className="settings-meta-value">{user?.email || "owner@bookmysalon.com"}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Affiliated Salon</span>
                    <span className="settings-meta-value">{dashboardData.salon_info.name}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Location Outlet</span>
                    <span className="settings-meta-value">{dashboardData.salon_info.city}</span>
                  </div>
                  <div className="settings-meta-item">
                    <span className="settings-meta-label">Role Privilege</span>
                    <span className="settings-meta-value" style={{ color: "#16a34a" }}>Master Administrator</span>
                  </div>

                  <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid var(--studio-border-subtle)" }}>
                    <p style={{ fontSize: "12px", color: "var(--studio-text-muted)", margin: "0 0 12px", lineHeight: "1.5" }}>
                      Security Notice: Resetting your password requires verifying your current password. Once updated, use the new password for future studio sign-ins.
                    </p>
                    <button
                      type="button"
                      className="btn-modal-cancel"
                      style={{ width: "100%", justifyContent: "center", display: "flex", gap: "6px" }}
                      onClick={() => navigate("/owner/salon-profile")}
                    >
                      <span>⚙️</span> Manage Salon Profile &amp; Amenities
                    </button>
                  </div>
                </div>
              </div>

              {/* Reset Password Card */}
              <div className="studio-settings-card">
                <div className="studio-settings-card-header">
                  <h3 className="studio-settings-card-title">
                    <span>🔑</span> Reset Password
                  </h3>
                  <span style={{ fontSize: "11px", color: "var(--studio-text-subtle)", fontWeight: 600 }}>
                    Requires Current Password
                  </span>
                </div>
                <div className="studio-settings-card-body">
                  <form onSubmit={handleResetPasswordSubmit}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      {passwordError && (
                        <div className="password-alert-error">
                          <span>⚠️</span>
                          <span>{passwordError}</span>
                        </div>
                      )}
                      {passwordSuccess && (
                        <div className="password-alert-success">
                          <span>✓</span>
                          <span>{passwordSuccess}</span>
                        </div>
                      )}

                      {/* Current Password */}
                      <div className="modal-input-group">
                        <label htmlFor="settings_current_password">Current Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_current_password"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Enter your current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowCurrentPassword((prev) => !prev)}
                            title={showCurrentPassword ? "Hide password" : "Show password"}
                          >
                            {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      {/* New Password */}
                      <div className="modal-input-group">
                        <label htmlFor="settings_new_password">New Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_new_password"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Enter new password (min. 8 characters)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowNewPassword((prev) => !prev)}
                            title={showNewPassword ? "Hide password" : "Show password"}
                          >
                            {showNewPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      {/* Confirm New Password */}
                      <div className="modal-input-group">
                        <label htmlFor="settings_confirm_password">Confirm New Password *</label>
                        <div className="password-input-wrapper">
                          <input
                            id="settings_confirm_password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Re-enter your new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowConfirmPassword((prev) => !prev)}
                            title={showConfirmPassword ? "Hide password" : "Show password"}
                          >
                            {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      {/* Password Requirements Checklist */}
                      <div className="password-requirements-box">
                        <div className="password-requirements-title">Security Checklist</div>
                        <div className={`password-requirement-item ${newPassword.length >= 8 ? "valid" : "pending"}`}>
                          <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                          <span>At least 8 characters long</span>
                        </div>
                        <div
                          className={`password-requirement-item ${
                            newPassword && currentPassword && newPassword !== currentPassword ? "valid" : "pending"
                          }`}
                        >
                          <span>{newPassword && currentPassword && newPassword !== currentPassword ? "✓" : "○"}</span>
                          <span>Must differ from current password</span>
                        </div>
                        <div
                          className={`password-requirement-item ${
                            confirmPassword && newPassword === confirmPassword ? "valid" : "pending"
                          }`}
                        >
                          <span>{confirmPassword && newPassword === confirmPassword ? "✓" : "○"}</span>
                          <span>New passwords match</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                        <button
                          type="button"
                          className="btn-modal-cancel"
                          onClick={resetPasswordFields}
                          disabled={passwordLoading}
                        >
                          Clear
                        </button>
                        <button
                          type="submit"
                          className="btn-modal-submit"
                          disabled={passwordLoading}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px",
                            opacity: passwordLoading ? 0.7 : 1,
                          }}
                        >
                          {passwordLoading ? (
                            <>
                              <span>⏳</span>
                              <span>Updating...</span>
                            </>
                          ) : (
                            <>
                              <span>✓</span>
                              <span>Update Password</span>
                            </>
                          )}
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
            bookings={allBookings.length > 0 ? allBookings : (dashboardData.all_bookings || [])}
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
        ) : (
          <>
            {/* Operations Banner: Salon Name, Live Status & Quick Actions */}
            <OwnerBanner
              salonInfo={dashboardData.salon_info}
              greeting={greeting}
              formattedToday={formattedToday}
              onResetPassword={handleOpenResetPassword}
            />

        <section className="studio-kpi-grid">
          {/* 1. BOOKINGS */}
          <div
            className="studio-kpi-card"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveTab("Bookings")}
            title="Click to view all bookings in Bookings Manager"
          >
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
          <div
            className="studio-kpi-card"
            style={{ cursor: "pointer" }}
            onClick={() => setScheduleView("upcoming")}
            title="Click to show upcoming appointments in schedule"
          >
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

          {/* 6. SALON RATING */}
          <div
            className="studio-kpi-card"
            style={{ cursor: "pointer" }}
            onClick={() => setActiveTab("Reviews")}
            title="Click to view Customer Reviews & Quality Ratings"
          >
            <div className="studio-kpi-header">
              <span className="studio-kpi-label">SALON RATING</span>
              <span className="studio-kpi-icon" style={{ color: "#f59e0b" }}>★</span>
            </div>
            <div className="studio-kpi-value" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span>{dashboardData.rating || 5.0}</span>
              <span style={{ fontSize: "18px", color: "#f59e0b" }}>★</span>
            </div>
            <div className="studio-kpi-trend positive">
              <span>💬</span>
              <span>{dashboardData.reviews_count || 0} reviews</span>
            </div>
          </div>
        </section>

        
        <div className="studio-dashboard-grid">
          
          <div className="studio-grid-left">
            {/* Widget 1: Schedule */}
            <section className="studio-widget-card">
              <div className="studio-widget-header" style={{ flexWrap: "wrap", gap: "10px" }}>
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>📅</span>
                  <h2 className="studio-widget-title">
                    {scheduleView === "today"
                      ? "Today's Schedule"
                      : scheduleView === "upcoming"
                      ? "Upcoming Bookings"
                      : "All Salon Bookings"}
                  </h2>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <div style={{ display: "inline-flex", background: "#f3f4f6", borderRadius: "8px", padding: "3px" }}>
                    <button
                      type="button"
                      onClick={() => setScheduleView("today")}
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: scheduleView === "today" ? 700 : 500,
                        background: scheduleView === "today" ? "#ffffff" : "transparent",
                        color: scheduleView === "today" ? "#111827" : "#6b7280",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        boxShadow: scheduleView === "today" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      Today ({dashboardData.today_schedule?.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleView("upcoming")}
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: scheduleView === "upcoming" ? 700 : 500,
                        background: scheduleView === "upcoming" ? "#ffffff" : "transparent",
                        color: scheduleView === "upcoming" ? "#111827" : "#6b7280",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        boxShadow: scheduleView === "upcoming" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      Upcoming ({dashboardData.kpi_stats?.upcoming?.value || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduleView("all")}
                      style={{
                        padding: "5px 12px",
                        fontSize: "12px",
                        fontWeight: scheduleView === "all" ? 700 : 500,
                        background: scheduleView === "all" ? "#ffffff" : "transparent",
                        color: scheduleView === "all" ? "#111827" : "#6b7280",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        boxShadow: scheduleView === "all" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                      }}
                    >
                      All Bookings ({dashboardData.all_bookings?.length || allBookings.length || 0})
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab("Bookings")}
                    style={{
                      padding: "5px 12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: "transparent",
                      color: "#4f46e5",
                      border: "1px solid #e0e7ff",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Full Bookings Tab →
                  </button>
                </div>
              </div>

              <div className="schedule-list">
                {filteredSchedule.length === 0 ? (
                  <div style={{ padding: "36px 16px", textAlign: "center", color: "var(--studio-text-muted)" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📅</div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--studio-text-main)" }}>
                      {scheduleView === "today"
                        ? "No appointments scheduled for today yet"
                        : "No appointments found for this filter"}
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--studio-text-muted)" }}>
                      {scheduleView === "today" && (dashboardData.all_bookings?.length > 0 || allBookings.length > 0)
                        ? `You have ${dashboardData.all_bookings?.length || allBookings.length} total salon bookings in the system.`
                        : "Customer bookings will appear here in real time."}
                    </p>
                    {(dashboardData.all_bookings?.length > 0 || allBookings.length > 0) && (
                      <div style={{ marginTop: "14px", display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                        {scheduleView !== "all" && (
                          <button
                            type="button"
                            onClick={() => setScheduleView("all")}
                            style={{
                              padding: "7px 14px",
                              fontSize: "12px",
                              fontWeight: 600,
                              background: "#111827",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                            }}
                          >
                            View All Salon Bookings ({dashboardData.all_bookings?.length || allBookings.length})
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setActiveTab("Bookings")}
                          style={{
                            padding: "7px 14px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: "#f3f4f6",
                            color: "#374151",
                            border: "1px solid #d1d5db",
                            borderRadius: "6px",
                            cursor: "pointer",
                          }}
                        >
                          Open Bookings Manager →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  filteredSchedule.map((item) => (
                    <div key={item.id} className="schedule-item-card">
                      {/* Time block */}
                      <div className="schedule-time-box">
                        <span className="schedule-time-value">{item.time || item.booking_time || "10:00"}</span>
                        <span className="schedule-time-period">{item.period || "AM"}</span>
                      </div>

                      {/* Customer & Service Info */}
                      <div className="schedule-client-info">
                        <div className="schedule-client-name-row">
                          <span className="schedule-client-name">{item.client_name}</span>
                          <span className="schedule-station-tag">{item.station}</span>
                        </div>
                        <div className="schedule-service-desc">
                          {item.booking_date ? `${item.booking_date} • ` : ""}
                          {item.stylist || item.worker_name || "Specialist"} • {item.service || item.service_name} • {item.duration || "45 mins"}
                        </div>
                      </div>

                      {/* Status & Action */}
                      <div className="schedule-actions-group">
                        <span className={`schedule-status-pill ${item.status_type || "confirmed"}`}>
                          {(item.status === "In Progress" || item.raw_status === "IN_PROGRESS") && "● "}
                          {item.status || item.status_display}
                        </span>

                        <button
                          type="button"
                          className={`btn-schedule-action ${item.action_type || "primary"}`}
                          onClick={() => handleAppointmentAction(item.id, item.action_label || "Seat Client")}
                        >
                          {item.action_label || "Update"}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Widget 2: Staff On Duty Today */}
            <section className="studio-widget-card">
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>👥</span>
                  <h2 className="studio-widget-title">Staff On Duty Today</h2><span className="studio-widget-badge pill">
                    {dashboardData.staff_on_duty.length} Stylists
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <button
                    type="button"
                    className="btn-add-worker-small"
                    
                    onClick={() => navigate("/owner/workers")}
                  >
                   <span className="studio-widget-badge pill" > View All </span>
                  </button>
                  
                  
                </div>
              </div>

              <div className="staff-duty-grid">
                {dashboardData.staff_on_duty?.length > 0 ? (
                  dashboardData.staff_on_duty.map((staff) => (
                    <div key={staff.id} className="staff-card">
                      <div className="staff-avatar-wrapper">
                        {staff.avatar ? (
                          <img
                            src={staff.avatar}
                            alt={staff.name}
                            className="staff-avatar-img"
                          />
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
                          <span className="staff-rating-star">
                            ★ {staff.rating} {staff.reviews_count !== undefined ? `(${staff.reviews_count} reviews)` : ""}
                          </span>
                          <span>•</span>
                          <span>{staff.booked_count} booked today</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-staff-message">
                    <span>No staff members added yet</span>
                  </div>
                )}
              </div>
            </section>

          </div>

          
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
                  navigate("/owner/services");
                }}
              >
                <span>Manage Service Catalog & Tariffs</span>
                <span>→</span>
              </button>
            </section>

            {/* Widget 5: Recent Customer Feedback & Reviews */}
            <section className="studio-widget-card" style={{ marginTop: "16px" }}>
              <div className="studio-widget-header">
                <div className="studio-widget-title-group">
                  <span style={{ fontSize: "18px" }}>💬</span>
                  <h2 className="studio-widget-title">Customer Feedback</h2>
                </div>
                <span
                  style={{
                    background: "#eaf7ef",
                    color: "#1e824c",
                    fontSize: "12px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "99px",
                  }}
                >
                  {dashboardData.rating || 5.0}★ ({dashboardData.reviews_count || 0})
                </span>
              </div>

              {(!dashboardData.reviews || dashboardData.reviews.length === 0) ? (
                <div style={{ textAlign: "center", padding: "24px 16px", color: "#627267", fontSize: "13px" }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 600 }}>No client reviews yet</p>
                  <span style={{ fontSize: "12px", color: "#8a9990" }}>
                    Verified reviews from completed customer appointments will appear here.
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                  {dashboardData.reviews.slice(0, 3).map((r) => {
                    const initial = (r.customer_name || r.author || "C")[0].toUpperCase();
                    return (
                      <div
                        key={r.id}
                        style={{
                          background: "#f8faf9",
                          padding: "12px 14px",
                          borderRadius: "10px",
                          border: "1px solid #e8edea",
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                width: "26px",
                                height: "26px",
                                borderRadius: "50%",
                                background: "#1e392a",
                                color: "#ffffff",
                                fontSize: "11px",
                                fontWeight: 700,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {initial}
                            </div>
                            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1e392a" }}>
                              {r.customer_name || r.author}
                            </span>
                          </div>
                          <span style={{ color: "#f59e0b", fontSize: "13px" }}>{"★".repeat(r.rating)}</span>
                        </div>
                        {r.comment && (
                          <p style={{ margin: 0, fontSize: "12px", color: "#4a5568", fontStyle: "italic", lineHeight: 1.4 }}>
                            “{r.comment.length > 90 ? `${r.comment.slice(0, 90)}...` : r.comment}”
                          </p>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#8a9990" }}>
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
                style={{ marginTop: "12px" }}
                onClick={() => setActiveTab("Reviews")}
              >
                <span>View All Reviews &amp; Ratings ({dashboardData.reviews_count || 0})</span>
                <span>→</span>
              </button>
            </section>
          </div>
        </div>
          </>
        )}
      </main>


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
                      {servicesList.length > 0 ? (
                        servicesList.map((s) => {
                          const sName = s.custom_name || s.service_name || s.name;
                          return (
                            <option key={s.id} value={sName}>
                              {sName} {s.duration ? `(${s.duration} mins)` : ""}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="Haircut & Styling">Haircut & Styling</option>
                          <option value="Hydra Facial">Hydra Facial</option>
                          <option value="Royal Beard Sculpt">Royal Beard Sculpt</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="modal-input-group">
                    <label htmlFor="walkin_stylist">Stylist</label>
                    <select
                      id="walkin_stylist"
                      value={walkInForm.stylist}
                      onChange={(e) => setWalkInForm({ ...walkInForm, stylist: e.target.value })}
                    >
                      {workersList.length > 0 ? (
                        workersList.map((w) => {
                          const name = w.full_name || (w.user ? `${w.user.first_name} ${w.user.last_name || ""}`.trim() : "Stylist");
                          return (
                            <option key={w.id} value={name}>
                              {name} ({w.station || "Station 01"})
                            </option>
                          );
                        })
                      ) : (
                        <option value="Any Available">Any Available Stylist</option>
                      )}
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

      {/*MODAL: EXPORT DAILY REPORT*/}
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
                
                <h3>Coming Soon</h3>
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

      
      {isResetPasswordOpen && (
        <div className="studio-modal-backdrop" onClick={handleCloseResetPassword}>
          <div className="studio-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "460px" }}>
            <div className="studio-modal-header">
              <div>
                <h3 className="studio-modal-title">Reset Owner Password</h3>
                <span style={{ fontSize: "11px", color: "var(--studio-text-subtle)", fontWeight: 500 }}>
                  Enter your current password to update master credentials
                </span>
              </div>
              <button
                type="button"
                className="studio-modal-close-btn"
                onClick={handleCloseResetPassword}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit}>
              <div className="studio-modal-body">
                {passwordError && (
                  <div className="password-alert-error">
                    <span>⚠️</span>
                    <span>{passwordError}</span>
                  </div>
                )}
                {passwordSuccess && (
                  <div className="password-alert-success">
                    <span>✓</span>
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {/* Current Password */}
                <div className="modal-input-group">
                  <label htmlFor="modal_current_password">Current Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      id="modal_current_password"
                      type={showCurrentPassword ? "text" : "password"}
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoFocus
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowCurrentPassword((prev) => !prev)}
                      title={showCurrentPassword ? "Hide password" : "Show password"}
                    >
                      {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="modal-input-group">
                  <label htmlFor="modal_new_password">New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      id="modal_new_password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      title={showNewPassword ? "Hide password" : "Show password"}
                    >
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="modal-input-group">
                  <label htmlFor="modal_confirm_password">Confirm New Password *</label>
                  <div className="password-input-wrapper">
                    <input
                      id="modal_confirm_password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle-btn"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      title={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Password Requirements Checklist */}
                <div className="password-requirements-box">
                  <div className="password-requirements-title">Security Checklist</div>
                  <div className={`password-requirement-item ${newPassword.length >= 8 ? "valid" : "pending"}`}>
                    <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                    <span>At least 8 characters long</span>
                  </div>
                  <div
                    className={`password-requirement-item ${
                      newPassword && currentPassword && newPassword !== currentPassword ? "valid" : "pending"
                    }`}
                  >
                    <span>{newPassword && currentPassword && newPassword !== currentPassword ? "✓" : "○"}</span>
                    <span>Must differ from current password</span>
                  </div>
                  <div
                    className={`password-requirement-item ${
                      confirmPassword && newPassword === confirmPassword ? "valid" : "pending"
                    }`}
                  >
                    <span>{confirmPassword && newPassword === confirmPassword ? "✓" : "○"}</span>
                    <span>New passwords match</span>
                  </div>
                </div>
              </div>

              <div className="studio-modal-footer">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={handleCloseResetPassword}
                  disabled={passwordLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal-submit"
                  disabled={passwordLoading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    opacity: passwordLoading ? 0.7 : 1,
                  }}
                >
                  {passwordLoading ? (
                    <>
                      <span>⏳</span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>✓</span>
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Temporary Password Reminder Modal ── */}
      {showTempPasswordModal && (
        <div className="studio-modal-backdrop" style={{ zIndex: 2000 }}>
          <div className="studio-modal-card" style={{ maxWidth: "440px" }}>
            <div className="studio-modal-header" style={{ borderBottom: "2px solid #f59e0b" }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️ Security Reminder</span>
            </div>
            <div className="studio-modal-body" style={{ paddingTop: "16px" }}>
              <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#92400e" }}>
                You are using a temporary password.
              </p>
              <p style={{ margin: 0, color: "#555", fontSize: "0.93rem", lineHeight: 1.5 }}>
                For your account security, please change your password as soon as possible.
                You can do this later, but we recommend doing it now.
              </p>
            </div>
            <div className="studio-modal-footer">
              <button
                className="btn-modal-cancel"
                onClick={() => setShowTempPasswordModal(false)}
              >
                I&apos;ll do it later
              </button>
              <button
                className="btn-modal-submit"
                onClick={() => {
                  setShowTempPasswordModal(false);
                  handleOpenResetPassword();
                }}
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

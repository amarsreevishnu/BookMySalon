import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import AdminSidebar from "../../components/admin/AdminSidebar";
import NotificationBell from "../../components/common/NotificationBell";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/adminDashboard.css";
import "../../styles/adminProfile.css";

export default function AdminProfile() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const fileInputRef = useRef(null);

  // Active tab state: "general", "security", "permissions"
  const [activeTab, setActiveTab] = useState("general");

  // Loading & Saving states
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Platform counters for sidebar
  const [platformCounts, setPlatformCounts] = useState({
    usersCount: 0,
    salonsCount: 0,
    pendingCount: 0,
  });

  // Profile Form Data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("Headquarters, Bengaluru");
  const [gender, setGender] = useState("Unspecified");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [memberSince, setMemberSince] = useState("");
  const [dateJoinedRaw, setDateJoinedRaw] = useState("");

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const showToast = (msg, duration = 3500) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? "" : prev));
    }, duration);
  };

  // Fetch live Super Admin Profile and Platform Counts
  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("access_token");
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};

      const [profileRes, statsRes, salonsRes] = await Promise.allSettled([
        api.get("/accounts/customer/profile/", config),
        api.get("/salons/admin/stats/", config),
        api.get("/salons/admin/salons/?status=all", config),
      ]);

      if (profileRes.status === "fulfilled" && profileRes.value?.data) {
        const data = profileRes.value.data;
        setFirstName(data.first_name || user?.first_name || "");
        setLastName(data.last_name || user?.last_name || "");
        setEmail(data.email || user?.email || "admin@bookmysalon.com");
        setPhone(data.phone_number || "");
        setLocation(data.primary_location || "Headquarters, Bengaluru");
        setGender(data.gender || "Unspecified");
        setAvatarUrl(data.avatar || user?.avatar || "");
        setMemberSince(data.member_since || "September 2026");
      } else {
        // Fallback to auth user state
        setFirstName(user?.first_name || "");
        setLastName(user?.last_name || "");
        setEmail(user?.email || "admin@bookmysalon.com");
        setAvatarUrl(user?.avatar || "");
      }

      // Populate sidebar counts
      if (statsRes.status === "fulfilled" && statsRes.value?.data) {
        setPlatformCounts((prev) => ({
          ...prev,
          usersCount: statsRes.value.data.registered_users || 0,
          salonsCount: statsRes.value.data.total_salons || 0,
          pendingCount: statsRes.value.data.pending_salons || 0,
        }));
      }

      if (salonsRes.status === "fulfilled" && Array.isArray(salonsRes.value?.data)) {
        const salonsList = salonsRes.value.data;
        const pending = salonsList.filter((s) => s.approval_status === "PENDING").length;
        setPlatformCounts((prev) => ({
          ...prev,
          salonsCount: salonsList.length,
          pendingCount: pending,
        }));
      }
    } catch (err) {
      console.error("Failed to load admin profile:", err);
      showToast("Could not load latest profile details from server.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, []);

  // Handle Avatar Image Upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("File size exceeds 5MB limit. Please choose a smaller photo.");
      return;
    }

    try {
      setUploadingAvatar(true);
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await api.post("/accounts/customer/avatar/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const newAvatar = res.data.avatar || res.data.user?.avatar || "";
      setAvatarUrl(newAvatar);

      // Synchronize auth state and localStorage
      const updatedUser = {
        ...user,
        ...(res.data.user || {}),
        avatar: newAvatar,
      };
      updateUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      showToast("✓ Profile avatar updated successfully!");
    } catch (err) {
      console.error("Avatar upload failed:", err);
      showToast("Failed to upload avatar. Please try again.");
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle Remove Avatar
  const handleAvatarRemove = async () => {
    try {
      setUploadingAvatar(true);
      await api.delete("/accounts/customer/avatar/");
      setAvatarUrl("");

      const updatedUser = {
        ...user,
        avatar: "",
      };
      updateUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      showToast("Profile avatar removed.");
    } catch (err) {
      console.error("Failed to remove avatar:", err);
      showToast("Failed to remove avatar.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Handle Save Profile Details
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) {
      showToast("First name cannot be empty.");
      return;
    }

    try {
      setSavingProfile(true);
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        primary_location: location.trim(),
        gender: gender,
      };

      const res = await api.put("/accounts/customer/profile/", payload);

      // Sync updated user to Redux & localStorage
      const updatedUser = {
        ...user,
        ...(res.data.user || {}),
        first_name: res.data.first_name || firstName.trim(),
        last_name: res.data.last_name || lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone_number: phone.trim(),
      };

      updateUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      showToast("✓ Super Admin profile details updated successfully!");
    } catch (err) {
      console.error("Profile update error:", err);
      showToast("Failed to update profile. " + (err.response?.data?.error || err.message));
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      const payload = {
        current_password: currentPassword,
        new_password: newPassword,
      };

      const res = await api.post("/accounts/customer/change-password/", payload);

      showToast(res.data?.message || "✓ Super Admin password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Password change error:", err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        "Failed to change password. Please verify current password.";
      setPasswordError(errorMsg);
      showToast(errorMsg);
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const displayFullName = `${firstName} ${lastName}`.trim() || user?.full_name || "Super Admin";

  return (
    <div className="admin-layout">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            background: "#1e3a29",
            color: "#ffffff",
            padding: "14px 20px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage("")}
            style={{
              background: "none",
              border: "none",
              color: "#ffffff",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Sidebar Navigation */}
      <AdminSidebar
        pendingCount={platformCounts.pendingCount}
        salonsCount={platformCounts.salonsCount}
        usersCount={platformCounts.usersCount}
        onLogout={handleLogout}
      />

      {/* Main Page Area */}
      <main className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="admin-search-wrap">
            <span className="admin-search-icon">🔍</span>
            <input
              type="text"
              readOnly
              placeholder="Super Admin Authority • Profile & Governance"
              className="admin-search-input"
              style={{ cursor: "default" }}
            />
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-live-pill">
              <span className="admin-system-dot" />
              <span>System Operational</span>
            </div>
            <span className="admin-region-text">Super Admin Console</span>

            <NotificationBell />

            <Link
              to="/"
              style={{
                fontSize: "12px",
                color: "#285438",
                fontWeight: "600",
                textDecoration: "none",
                background: "#edf5ef",
                padding: "6px 12px",
                borderRadius: "6px",
              }}
            >
              View Client Site ↗
            </Link>
          </div>
        </header>

        {/* Content Container */}
        <div className="admin-content-container admin-profile-page">
          {/* Breadcrumb */}
          <div className="admin-breadcrumb">
            Platform Operations &gt; Super Admin Authority &gt; Operator Profile
          </div>

          {/* Profile Hero Card */}
          <div className="admin-profile-hero">
            <div className="admin-profile-hero-left">
              <div className="admin-profile-avatar-wrap">
                {avatarUrl ? (
                  <img
                    src={resolveImageUrl(avatarUrl)}
                    alt={displayFullName}
                    className="admin-profile-avatar-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="admin-profile-avatar-fallback">
                    {firstName?.[0] || email?.[0] || "A"}
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: "none" }}
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                />

                <button
                  type="button"
                  className="admin-profile-avatar-badge"
                  title="Upload New Profile Photo"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? "⏳" : "📷"}
                </button>
              </div>

              <div className="admin-profile-hero-details">
                <h1>{displayFullName}</h1>
                <div className="admin-profile-hero-meta">
                  <span>✉️ {email}</span>
                  <span className="admin-profile-badge-super">
                    🛡️ Root Operator
                  </span>
                  <span className="admin-profile-badge-clearance">
                    ● Master Clearance
                  </span>
                </div>
                <p className="admin-profile-hero-sub">
                  BookMySalon Core Platform Governance • System Administrator Since {memberSince}
                </p>
              </div>
            </div>

            <div className="admin-profile-hero-actions">
              <button
                type="button"
                className="admin-hero-btn-white"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                <span>📷</span>
                <span>{avatarUrl ? "Update Photo" : "Upload Photo"}</span>
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  className="admin-hero-btn-ghost"
                  onClick={handleAvatarRemove}
                  disabled={uploadingAvatar}
                >
                  <span>🗑️</span>
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Clearance Stats Row */}
          <div className="admin-profile-stats-grid">
            <div className="admin-profile-stat-box">
              <div className="admin-stat-icon-wrap gold">
                <span>👑</span>
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Security Clearance</span>
                <span className="admin-stat-val">Tier 0 (Root)</span>
                <span className="admin-stat-sub">Highest Platform Authority</span>
              </div>
            </div>

            <div className="admin-profile-stat-box">
              <div className="admin-stat-icon-wrap">
                <span>🏪</span>
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Venues Supervised</span>
                <span className="admin-stat-val">
                  {platformCounts.salonsCount} Salons
                </span>
                <span className="admin-stat-sub">
                  {platformCounts.pendingCount} Pending Audits
                </span>
              </div>
            </div>

            <div className="admin-profile-stat-box">
              <div className="admin-stat-icon-wrap blue">
                <span>👥</span>
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Registered Clients</span>
                <span className="admin-stat-val">
                  {platformCounts.usersCount} Customers
                </span>
                <span className="admin-stat-sub">Across All Regional Hubs</span>
              </div>
            </div>

            <div className="admin-profile-stat-box">
              <div className="admin-stat-icon-wrap purple">
                <span>🔑</span>
              </div>
              <div className="admin-stat-info">
                <span className="admin-stat-label">Session Protocol</span>
                <span className="admin-stat-val">JWT Active</span>
                <span className="admin-stat-sub">Encrypted Bearer Session</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="admin-profile-tabs-wrap">
            <button
              type="button"
              className={`admin-profile-tab-btn ${activeTab === "general" ? "active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              <span>👤</span>
              <span>Personal & Account Details</span>
            </button>

            <button
              type="button"
              className={`admin-profile-tab-btn ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              <span>🔒</span>
              <span>Security & Password Management</span>
            </button>

            <button
              type="button"
              className={`admin-profile-tab-btn ${activeTab === "permissions" ? "active" : ""}`}
              onClick={() => setActiveTab("permissions")}
            >
              <span>🛡️</span>
              <span>Master Platform Privileges</span>
            </button>
          </div>

          {/* Tab 1: Personal & Account Details */}
          {activeTab === "general" && (
            <div className="admin-profile-panel">
              <div className="admin-profile-card-section">
                <div className="admin-card-section-header">
                  <div>
                    <h2>👤 Operator Profile Information</h2>
                    <p>
                      Update your administrator identity and operational contact details.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile}>
                  <div className="admin-form-grid-2">
                    <div className="admin-form-field">
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="e.g. Vishnu"
                        required
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="e.g. Prasad"
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>Email Address (Protected Identifier)</label>
                      <input
                        type="email"
                        value={email}
                        disabled
                        title="Primary admin email cannot be altered without server re-authentication"
                      />
                      <span className="admin-field-helper">
                        🔒 Verified system administrator email address.
                      </span>
                    </div>

                    <div className="admin-form-field">
                      <label>Phone / Emergency Hotline</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                      <span className="admin-field-helper">
                        Used for urgent platform escalations and critical alerts.
                      </span>
                    </div>

                    <div className="admin-form-field">
                      <label>Administrative Office / Base Location</label>
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="e.g. Headquarters, Indiranagar, Bengaluru"
                      />
                    </div>

                    <div className="admin-form-field">
                      <label>System Role & Permissions Level</label>
                      <input
                        type="text"
                        value="ADMIN • Super Administrator (Unrestricted)"
                        disabled
                      />
                      <span className="admin-field-helper">
                        Full root execution rights over salons, payments, and users.
                      </span>
                    </div>
                  </div>

                  <div className="admin-form-actions-bar">
                    <button
                      type="button"
                      className="admin-btn-outline"
                      onClick={() => fetchProfileData()}
                      disabled={savingProfile}
                    >
                      Reset Changes
                    </button>
                    <button
                      type="submit"
                      className="admin-btn-save"
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving Details..." : "✓ Save Profile Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Tab 2: Security & Password Management */}
          {activeTab === "security" && (
            <div className="admin-profile-panel">
              <div className="admin-profile-card-section">
                <div className="admin-card-section-header">
                  <div>
                    <h2>🔒 Master Account Password & Authentication</h2>
                    <p>
                      Maintain strong credentials to protect sensitive platform operations and financial data.
                    </p>
                  </div>
                </div>

                <div className="admin-security-grid">
                  {/* Password Form */}
                  <form onSubmit={handleChangePassword}>
                    {passwordError && (
                      <div
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          marginBottom: "18px",
                          fontWeight: "600",
                        }}
                      >
                        ✕ {passwordError}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div className="admin-form-field">
                        <label>Current Master Password *</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showCurrentPass ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowCurrentPass(!showCurrentPass)}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "14px",
                              color: "#6b7280",
                            }}
                          >
                            {showCurrentPass ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      <div className="admin-form-field">
                        <label>New Master Password *</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showNewPass ? "text" : "password"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPass(!showNewPass)}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "14px",
                              color: "#6b7280",
                            }}
                          >
                            {showNewPass ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>

                      <div className="admin-form-field">
                        <label>Confirm New Password *</label>
                        <div style={{ position: "relative" }}>
                          <input
                            type={showConfirmPass ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-type new password"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPass(!showConfirmPass)}
                            style={{
                              position: "absolute",
                              right: 12,
                              top: "50%",
                              transform: "translateY(-50%)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "14px",
                              color: "#6b7280",
                            }}
                          >
                            {showConfirmPass ? "👁️" : "👁️‍🗨️"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="admin-form-actions-bar">
                      <button
                        type="submit"
                        className="admin-btn-save"
                        disabled={savingPassword}
                      >
                        {savingPassword ? "Updating Password..." : "🔒 Update Master Password"}
                      </button>
                    </div>
                  </form>

                  {/* Password Checklist & Security Overview */}
                  <div className="admin-password-checklist">
                    <span className="admin-checklist-title">Password Security Policy</span>
                    <div className={`admin-check-item ${newPassword.length >= 8 ? "valid" : ""}`}>
                      <span className="admin-check-icon">{newPassword.length >= 8 ? "✓" : "○"}</span>
                      <span>Minimum 8 characters length</span>
                    </div>

                    <div
                      className={`admin-check-item ${
                        newPassword && confirmPassword && newPassword === confirmPassword ? "valid" : ""
                      }`}
                    >
                      <span className="admin-check-icon">
                        {newPassword && confirmPassword && newPassword === confirmPassword ? "✓" : "○"}
                      </span>
                      <span>New password and confirmation match</span>
                    </div>

                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e3ebe5" }}>
                      <span className="admin-checklist-title">Session Security</span>
                      <p style={{ margin: "4px 0 0 0", fontSize: "11px", color: "#61796b", lineHeight: 1.5 }}>
                        Super Admin JWT tokens auto-refresh securely. Immediate session invalidation takes place on manual logout.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Master Platform Privileges */}
          {activeTab === "permissions" && (
            <div className="admin-profile-panel">
              <div className="admin-profile-card-section">
                <div className="admin-card-section-header">
                  <div>
                    <h2>🛡️ Delegated Platform Governance Privileges</h2>
                    <p>
                      Super Admin root clearance enables full operational command across all BookMySalon services.
                    </p>
                  </div>
                </div>

                <div className="admin-perm-list">
                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">🏪</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>Salon Venue Verification & Onboarding</span>
                        <span className="admin-perm-tag">Root Clearance</span>
                      </div>
                      <p className="admin-perm-desc">
                        Full inspection authority over submitted partner applications, legal trade licenses, location coordinates, and automated credentials dispatch to salon owners.
                      </p>
                    </div>
                  </div>

                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">👥</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>User & Account Governance</span>
                        <span className="admin-perm-tag">Unrestricted</span>
                      </div>
                      <p className="admin-perm-desc">
                        Inspect customer directory, audit account creation dates, manage active staff roles, and execute immediate account suspensions when terms of service are breached.
                      </p>
                    </div>
                  </div>

                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">✂️</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>Service Master Catalog Architecture</span>
                        <span className="admin-perm-tag">Global Master</span>
                      </div>
                      <p className="admin-perm-desc">
                        Create and curate standardized beauty, hair, skin, and wellness categories, assign global pricing limits, and govern offerings available across all salons.
                      </p>
                    </div>
                  </div>

                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">⭐</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>Customer Review Governance & Moderation</span>
                        <span className="admin-perm-tag">Moderator Chief</span>
                      </div>
                      <p className="admin-perm-desc">
                        Audit customer ratings across all salons, hide inappropriate or defamatory feedback without data loss, and maintain platform ratings integrity.
                      </p>
                    </div>
                  </div>

                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">🎫</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>Support Helpdesk & Dispute Resolution</span>
                        <span className="admin-perm-tag">High Priority</span>
                      </div>
                      <p className="admin-perm-desc">
                        Supervise customer and salon owner inquiries, update priority tiers, assign internal staff, and dispatch official resolution replies.
                      </p>
                    </div>
                  </div>

                  <div className="admin-perm-item">
                    <div className="admin-perm-icon">💎</div>
                    <div className="admin-perm-info">
                      <div className="admin-perm-title">
                        <span>Financial Settlements & Wallet Protocol</span>
                        <span className="admin-perm-tag">Auditor</span>
                      </div>
                      <p className="admin-perm-desc">
                        Real-time audit access to Razorpay checkout webhooks, customer wallet credits/debits, salon commission liquidation, and worker commission integrity.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


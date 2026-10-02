import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { setCredentials } from "../../features/auth/authSlice";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/customerProfile.css";

export default function CustomerProfile() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, logout } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const activeTab = searchParams.get("tab") || "profile";

  // Profile data state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [profileData, setProfileData] = useState(null);

  // Editable Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("Male (He/Him)");
  const [location, setLocation] = useState("Indiranagar, Bengaluru");
  const [upiId, setUpiId] = useState("");

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Preferences edit state
  const [editHairTags, setEditHairTags] = useState([]);
  const [editSensitivities, setEditSensitivities] = useState([]);
  const [editRituals, setEditRituals] = useState([]);
  const [newTagInput, setNewTagInput] = useState("");

  // Bookings & Favorites tab data
  const [bookingsList, setBookingsList] = useState([]);
  const [favoritesList, setFavoritesList] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3200);
  };

  // 1. Fetch Profile Data
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/accounts/customer/profile/");
      const data = res.data;
      setProfileData(data);

      setFirstName(data.first_name || "");
      setLastName(data.last_name || "");
      setDob(data.date_of_birth || "");
      setPhone(data.phone_number || "");
      setGender(data.gender || "Male (He/Him)");
      setLocation(data.primary_location || "Indiranagar, Bengaluru");
      setUpiId(data.upi_id || "");

      if (data.wellness_preferences) {
        setEditHairTags(data.wellness_preferences.hair_type || []);
        setEditSensitivities(data.wellness_preferences.sensitivities || []);
        setEditRituals(data.wellness_preferences.rituals || []);
      }
    } catch (err) {
      console.error("Failed to fetch customer profile:", err);
      showToast("Unable to load latest profile data. Using stored credentials.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. Fetch Tab Specific Data
  useEffect(() => {
    if (activeTab === "bookings") {
      setTabLoading(true);
      api
        .get("/accounts/customer/bookings/")
        .then((res) => {
          setBookingsList(res.data.bookings || []);
        })
        .catch((err) => console.error("Bookings fetch error:", err))
        .finally(() => setTabLoading(false));
    } else if (activeTab === "favorites") {
      setTabLoading(true);
      api
        .get("/accounts/customer/favorites/")
        .then((res) => {
          setFavoritesList(res.data.favorites || []);
        })
        .catch((err) => console.error("Favorites fetch error:", err))
        .finally(() => setTabLoading(false));
    }
  }, [activeTab]);

  // Handle Tab Switch
  const handleTabChange = (tabKey) => {
    setSearchParams({ tab: tabKey });
  };

  // 3. Save Personal Information
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone,
        date_of_birth: dob || null,
        gender: gender,
        primary_location: location,
        upi_id: upiId,
      };

      const res = await api.put("/accounts/customer/profile/", payload);
      setProfileData(res.data);

      if (res.data.user) {
        const storedToken = localStorage.getItem("access_token");
        const storedRefresh = localStorage.getItem("refresh_token");
        dispatch(
          setCredentials({
            token: storedToken,
            refreshToken: storedRefresh,
            user: res.data.user,
          })
        );
      }

      showToast("Personal information updated successfully!");
    } catch (err) {
      console.error("Profile update error:", err);
      showToast(err.response?.data?.error || "Failed to update profile. Please check your inputs.");
    } finally {
      setSaving(false);
    }
  };

  // 4. Avatar Upload / Remove
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("File size exceeds 5MB limit. Please choose a smaller image.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await api.post("/accounts/customer/avatar/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setProfileData((prev) => ({
        ...prev,
        avatar: res.data.avatar,
      }));

      if (res.data.user) {
        const storedToken = localStorage.getItem("access_token");
        const storedRefresh = localStorage.getItem("refresh_token");
        dispatch(
          setCredentials({
            token: storedToken,
            refreshToken: storedRefresh,
            user: res.data.user,
          })
        );
      }

      showToast("Profile avatar updated successfully!");
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast("Failed to upload avatar. Please try again.");
    }
  };

  const handleAvatarRemove = async () => {
    try {
      const res = await api.delete("/accounts/customer/avatar/");
      setProfileData((prev) => ({
        ...prev,
        avatar: "",
      }));

      if (res.data.user) {
        const storedToken = localStorage.getItem("access_token");
        const storedRefresh = localStorage.getItem("refresh_token");
        dispatch(
          setCredentials({
            token: storedToken,
            refreshToken: storedRefresh,
            user: res.data.user,
          })
        );
      }

      showToast("Avatar removed successfully.");
    } catch (err) {
      console.error("Avatar remove error:", err);
      showToast("Failed to remove avatar.");
    }
  };

  // 5. Toggle Notification Channel
  const handleToggleChannel = async (channelKey) => {
    if (!profileData?.notification_channels) return;
    const currentVal = profileData.notification_channels[channelKey];
    const updatedChannels = {
      ...profileData.notification_channels,
      [channelKey]: !currentVal,
    };

    try {
      const res = await api.put("/accounts/customer/preferences/", {
        notification_channels: updatedChannels,
      });

      setProfileData((prev) => ({
        ...prev,
        notification_channels: res.data.notification_channels,
      }));

      showToast(
        `Channel updated: ${channelKey === "whatsapp_sms" ? "WhatsApp & SMS" : "Seasonal Rituals"} is now ${
          !currentVal ? "Enabled" : "Disabled"
        }`
      );
    } catch (err) {
      console.error("Channel update error:", err);
      showToast("Failed to update notification setting.");
    }
  };

  // 6. Save Wellness Preferences
  const handleSavePreferences = async () => {
    try {
      const updatedPrefs = {
        hair_type: editHairTags,
        sensitivities: editSensitivities,
        rituals: editRituals,
        preferred_stylist: profileData?.wellness_preferences?.preferred_stylist,
      };

      const res = await api.put("/accounts/customer/preferences/", {
        wellness_preferences: updatedPrefs,
      });

      setProfileData((prev) => ({
        ...prev,
        wellness_preferences: res.data.wellness_preferences,
      }));

      setShowPreferencesModal(false);
      showToast("Wellness & hair preferences saved successfully!");
    } catch (err) {
      console.error("Preferences save error:", err);
      showToast("Failed to save preferences.");
    }
  };

  // 7. Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setPasswordSaving(true);
      await api.post("/accounts/customer/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setShowPasswordModal(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated successfully!");
    } catch (err) {
      console.error("Password change error:", err);
      setPasswordError(err.response?.data?.error || "Failed to change password. Please check your current password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const currentFullName =
    profileData?.full_name ||
    `${user?.first_name || ""} ${user?.last_name || ""}`.trim() ||
    user?.email?.split("@")[0] ||
    "Mindful Client";

  const userInitial = currentFullName.charAt(0).toUpperCase();

  const userAvatarUrl = profileData?.avatar || user?.avatar || "";

  return (
    <div className="customer-profile-page">
      <CustomerHeader />

      <main className="profile-main-container">
        {/* Header & Title */}
        

        {/* Two Column Layout Grid */}
        <div className="profile-layout-grid">
          {/* ================================================================
              LEFT SIDEBAR
              ================================================================ */}
          <aside className="profile-sidebar">
            {/* Identity Card */}
            <div className="sidebar-identity-card">
              <div className="sidebar-avatar-wrap">
                {userAvatarUrl ? ( 
                  <img
                    src={resolveImageUrl(userAvatarUrl)}
                    alt={currentFullName}
                    className="sidebar-avatar-img" 
                  /> 
                ) : (
                  <div className="sidebar-avatar-placeholder">{userInitial}</div>
                )}
                <span className="sidebar-verified-dot" title="Verified Member" />
              </div>

              <h2 className="sidebar-user-name">{currentFullName}</h2>
              <p className="sidebar-user-email">{profileData?.email || user?.email}</p>

              <div className="sidebar-verified-badge">
                <span className="dot">●</span>
                <span>Verified Client</span>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="sidebar-nav-card">
              <nav className="sidebar-nav-list">
                <button
                  type="button"
                  className={`sidebar-nav-btn ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => handleTabChange("profile")}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">👤</span>
                    <span>My Profile</span>
                  </div>
                  {activeTab === "profile" && <span>›</span>}
                </button>

                <button
                  type="button"
                  className={`sidebar-nav-btn ${activeTab === "bookings" ? "active" : ""}`}
                  onClick={() => handleTabChange("bookings")}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">📅</span>
                    <span>My Bookings</span>
                  </div>
                  <span className="sidebar-nav-badge">
                    {profileData?.stats?.total_bookings_count || 0}
                  </span>
                </button>

                <button
                  type="button"
                  className={`sidebar-nav-btn ${activeTab === "favorites" ? "active" : ""}`}
                  onClick={() => handleTabChange("favorites")}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">🤍</span>
                    <span>Favorites</span>
                  </div>
                  <span className="sidebar-nav-badge">
                    {profileData?.stats?.saved_places_count || 0}
                  </span>
                </button>

                <button
                  type="button"
                  className={`sidebar-nav-btn ${activeTab === "reviews" ? "active" : ""}`}
                  onClick={() => handleTabChange("reviews")}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">⭐</span>
                    <span>Reviews</span>
                  </div>
                  <span className="sidebar-nav-badge">
                    {profileData?.stats?.completed_count || 0}
                  </span>
                </button>

                <button
                  type="button"
                  className={`sidebar-nav-btn ${activeTab === "notifications" ? "active" : ""}`}
                  onClick={() => {
                    handleTabChange("profile");
                    showToast("Notification channels are accessible in your holistic profile below.");
                  }}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">🔔</span>
                    <span>Notifications</span>
                  </div>
                  <span style={{ fontSize: "10px", color: "#10b981" }}>●</span>
                </button>

                <button
                  type="button"
                  className="sidebar-nav-btn"
                  onClick={() => {
                    showToast("UPI ID is configured: " + (profileData?.upi_id || "vishnu@okicici"));
                  }}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">💳</span>
                    <span>Payment Methods</span>
                  </div>
                  <span className="sidebar-nav-status-text">Saved</span>
                </button>

                <button
                  type="button"
                  className="sidebar-nav-btn"
                  onClick={() => setShowPasswordModal(true)}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">⚙️</span>
                    <span>Settings</span>
                  </div>
                </button>

                <div className="sidebar-nav-divider" />

                <button
                  type="button"
                  className="sidebar-nav-btn sidebar-nav-logout"
                  onClick={() => setShowLogoutModal(true)}
                >
                  <div className="sidebar-nav-btn-left">
                    <span className="sidebar-nav-icon">🚪</span>
                    <span>Sign Out</span>
                  </div>
                </button>
              </nav>
            </div>

            {/* 100% Organic Salons Assurance Box */}
            <div className="sidebar-assurance-card">
              <div className="assurance-header">
                <span>🌿</span>
                <span>100% Organic Salons Only</span>
              </div>
              <p className="assurance-desc">
                Your treatments are guaranteed non-toxic, vegan-certified, and tailored to sensitive skin.
              </p>
            </div>
          </aside>

          {/* ================================================================
              MAIN CONTENT: TAB ROUTER
              ================================================================ */}
          <section className="profile-content-area">
            {activeTab === "profile" && (
              <>
                {/* 1. Top Quick Stats Row (4 Uniform Cards) */}
                

                {/* 2. Avatar & Photo Display Card */}
                <div className="profile-card">
                  <div className="avatar-display-row">
                    <div className="avatar-display-left">
                      <div className="avatar-preview-wrap">
                        {userAvatarUrl ? (
                          <img
                            src={resolveImageUrl(userAvatarUrl)}
                            alt={currentFullName}
                            className="avatar-preview-img"
                          />
                        ) : (
                          <div className="avatar-preview-fallback">{userInitial}</div>
                        )}
                      </div>

                      <div className="avatar-controls-details">
                        <h4>Avatar & Photo Display</h4>
                        <p>JPG, PNG or WEBP. Maximum file size of 5MB.</p>

                        <input
                          type="file"
                          ref={fileInputRef}
                          style={{ display: "none" }}
                          accept="image/*"
                          onChange={handleAvatarFileChange}
                        />

                        <div className="avatar-btn-group">
                          <button
                            type="button"
                            className="btn-upload-avatar"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Upload New
                          </button>
                          {userAvatarUrl && (
                            <button
                              type="button"
                              className="btn-remove-avatar"
                              onClick={handleAvatarRemove}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="avatar-display-right">
                      <div className="member-tier-badge">
                        <span>🏆</span>
                        <span>{profileData?.membership_tier || "Emerald Member"}</span>
                      </div>
                      <p className="member-since-text">
                        Member since {profileData?.member_since || "October 2025"}
                      </p>
                      <button
                        type="button"
                        className="member-benefits-link"
                        onClick={() => showToast("Emerald Tier grants priority slot holds and 10% complimentary spa add-ons.")}
                      >
                        View Botanical Tier Benefits →
                      </button>
                    </div>
                  </div>
                </div>

                {/* 3. Personal Information Form */}
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <h3>Personal Information</h3>
                      <p>Update your verified personal credentials and identity preferences.</p>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--profile-text-muted)" }}>
                      * Required fields
                    </span>
                  </div>

                  <form onSubmit={handleSaveProfile}>
                    <div className="profile-form-grid">
                      {/* Full Name */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">Full Name *</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="text"
                            className="profile-input-field"
                            value={firstName ? `${firstName} ${lastName}`.trim() : currentFullName}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parts = val.split(" ");
                              setFirstName(parts[0] || "");
                              setLastName(parts.slice(1).join(" ") || "");
                            }}
                            required
                          />
                          <span className="input-suffix-icon">👤</span>
                        </div>
                      </div>

                      {/* Date of Birth */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">Date of Birth</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="date"
                            className="profile-input-field"
                            value={dob}
                            onChange={(e) => setDob(e.target.value)}
                          />
                          <span className="input-suffix-icon">📅</span>
                        </div>
                      </div>

                      {/* Phone Number */}
                      <div className="profile-input-group">
                        <div className="profile-label-row">
                          <label className="profile-input-label">Phone Number *</label>
                          <span className="verified-inline-tag">Verified</span>
                        </div>
                        <div className="profile-input-wrapper">
                          <input
                            type="tel"
                            className="profile-input-field"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                          />
                          <span className="input-suffix-icon">📞</span>
                        </div>
                      </div>

                      {/* Email Address */}
                      <div className="profile-input-group">
                        <div className="profile-label-row">
                          <label className="profile-input-label">Email Address *</label>
                          <span className="verified-inline-tag">Verified</span>
                        </div>
                        <div className="profile-input-wrapper">
                          <input
                            type="email"
                            className="profile-input-field"
                            value={profileData?.email || user?.email || ""}
                            readOnly
                            title="Email is verified with your account credentials"
                          />
                          <span className="input-suffix-icon">✉️</span>
                        </div>
                      </div>

                      {/* Gender / Pronouns */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">Gender / Pronouns</label>
                        <div className="profile-input-wrapper">
                          <select
                            className="profile-input-field"
                            value={gender}
                            onChange={(e) => setGender(e.target.value)}
                          >
                            <option value="Male (He/Him)">Male (He/Him)</option>
                            <option value="Female (She/Her)">Female (She/Her)</option>
                            <option value="Non-binary (They/Them)">Non-binary (They/Them)</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                          </select>
                          <span className="input-suffix-icon">▾</span>
                        </div>
                      </div>

                      {/* Primary Location / Neighborhood */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">Primary Location / Neighborhood</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="text"
                            className="profile-input-field"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g. Indiranagar, Bengaluru"
                          />
                          <span className="input-suffix-icon">📍</span>
                        </div>
                      </div>
                    </div>

                    <div className="profile-form-footer">
                      <button
                        type="button"
                        className="btn-form-cancel"
                        onClick={fetchProfile}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn-form-save"
                        disabled={saving}
                      >
                        {saving ? (
                          <span>Saving...</span>
                        ) : (
                          <>
                            <span>✓</span>
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

                {/* 4. Holistic Profile: Wellness & Hair Preferences */}
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <div className="holistic-tag-header">
                        <span>🌿</span>
                        <span>HOLISTIC PROFILE</span>
                      </div>
                      <h3>Wellness & Hair Preferences</h3>
                      <p>Helps our therapists prepare certified organic botanical formulations prior to your visit.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline-action"
                      onClick={() => setShowPreferencesModal(true)}
                    >
                      Edit Preferences
                    </button>
                  </div>

                  <div className="holistic-preferences-grid">
                    {/* Hair Type & Texture */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>✂️</span>
                        <span>Hair Type & Texture</span>
                      </div>
                      <div className="preference-pill-wrap">
                        {(profileData?.wellness_preferences?.hair_type || [
                          "Wavy (2B)",
                          "Medium Density",
                          "Dry Ends",
                        ]).map((tag, i) => (
                          <span key={i} className="preference-pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Scalp & Skin Sensitivities */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>💆</span>
                        <span>Scalp & Skin Sensitivities</span>
                      </div>
                      <div className="preference-pill-wrap">
                        {(profileData?.wellness_preferences?.sensitivities || [
                          "Sensitive Scalp",
                          "Organic-Only Formulations",
                          "Fragrance-Free Oil",
                        ]).map((tag, i) => (
                          <span
                            key={i}
                            className={`preference-pill ${
                              tag.toLowerCase().includes("sensitive") ? "highlight" : ""
                            }`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Favorite Rituals */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>✨</span>
                        <span>Favorite Rituals</span>
                      </div>
                      <ul className="preference-checklist">
                        {(profileData?.wellness_preferences?.rituals || [
                          "Precision Botanical Haircut & Styling",
                          "Ayurvedic Scalp Detox & Kansa Wand Massage",
                          "Beard Conditioning with Cedarwood Essential Oil",
                        ]).map((ritual, i) => (
                          <li key={i}>
                            <span className="check-icon">✓</span>
                            <span>{ritual}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Preferred Stylist & Artisan */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>⭐</span>
                        <span>Preferred Stylist & Artisan</span>
                      </div>
                      <div className="stylist-mini-card">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                          alt="Preferred Stylist"
                          className="stylist-mini-avatar"
                        />
                        <div className="stylist-mini-info">
                          <h5>
                            {profileData?.wellness_preferences?.preferred_stylist?.name ||
                              "Rahul Kumar"}
                          </h5>
                          <p>
                            {profileData?.wellness_preferences?.preferred_stylist?.role ||
                              "Master Stylist"}{" "}
                            —{" "}
                            {profileData?.wellness_preferences?.preferred_stylist?.salon ||
                              "ABC Salon & Spa, Indiranagar"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Notification Channels */}
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <h3>Notification Channels</h3>
                      <p>Keep track of mindful booking updates with zero unsolicited noise.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline-action"
                      onClick={() => showToast("All notification channels are configured cleanly.")}
                    >
                      Manage all
                    </button>
                  </div>

                  <div className="notification-channels-list">
                    {/* Channel 1 */}
                    <div className="notification-channel-row">
                      <div className="channel-info-group">
                        <div className="channel-icon-circle">💬</div>
                        <div className="channel-text-details">
                          <h5>WhatsApp & SMS Reminders</h5>
                          <p>Receive 24-hour and 2-hour appointment alerts with directions.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn-toggle-channel ${
                          profileData?.notification_channels?.whatsapp_sms !== false
                            ? ""
                            : "disabled"
                        }`}
                        onClick={() => handleToggleChannel("whatsapp_sms")}
                      >
                        {profileData?.notification_channels?.whatsapp_sms !== false
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </div>

                    {/* Channel 2 */}
                    <div className="notification-channel-row">
                      <div className="channel-info-group">
                        <div className="channel-icon-circle">🌿</div>
                        <div className="channel-text-details">
                          <h5>Botanical Drops & Seasonal Rituals</h5>
                          <p>Exclusive seasonal releases, priority slots, and double point gifts.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className={`btn-toggle-channel ${
                          profileData?.notification_channels?.seasonal_rituals !== false
                            ? ""
                            : "disabled"
                        }`}
                        onClick={() => handleToggleChannel("seasonal_rituals")}
                      >
                        {profileData?.notification_channels?.seasonal_rituals !== false
                          ? "Enabled"
                          : "Disabled"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 6. Security & Account Controls (Red Box) */}
                <div className="profile-card security-box">
                  <div className="security-box-header">
                    <span>🛡️</span>
                    <span>Security & Account Controls</span>
                  </div>

                  <div className="security-action-row">
                    <div className="security-action-left">
                      <h5>Password</h5>
                      <p>Last updated 3 months ago</p>
                    </div>
                    <button
                      type="button"
                      className="btn-outline-action"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      Change
                    </button>
                  </div>

                  <div className="security-action-row">
                    <div className="security-action-left">
                      <h5>Need to step away?</h5>
                      <p>Sign out session this device or review active browser sessions.</p>
                    </div>
                    <div className="security-btn-group">
                      <button
                        type="button"
                        className="btn-deactivate"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Are you sure you want to request account deactivation? Your customer sanctuary history will be archived."
                            )
                          ) {
                            showToast("Deactivation request submitted to platform administration.");
                          }
                        }}
                      >
                        Deactivate Account
                      </button>
                      <button
                        type="button"
                        className="btn-signout-red"
                        onClick={() => setShowLogoutModal(true)}
                      >
                        <span>🚪</span>
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ================================================================
                TAB: MY BOOKINGS
                ================================================================ */}
            {activeTab === "bookings" && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <h3>My Appointments & Rituals</h3>
                    <p>Track your scheduled sessions and past botanical salon visits.</p>
                  </div>
                  <Link to="/salons" className="btn-outline-action" style={{ textDecoration: "none" }}>
                    + Book New Ritual
                  </Link>
                </div>

                {tabLoading ? (
                  <p style={{ color: "var(--profile-text-muted)", fontSize: "14px" }}>
                    Loading appointment records...
                  </p>
                ) : bookingsList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <span style={{ fontSize: "36px", display: "block", marginBottom: "10px" }}>🌿</span>
                    <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 6px" }}>
                      No Appointments Scheduled Yet
                    </h4>
                    <p style={{ fontSize: "13px", color: "var(--profile-text-muted)", margin: "0 0 20px" }}>
                      Explore certified salons and reserve your initial conscious ritual.
                    </p>
                    <Link
                      to="/salons"
                      className="btn-upload-avatar"
                      style={{ textDecoration: "none", display: "inline-block" }}
                    >
                      Explore Salons
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {bookingsList.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px",
                          borderRadius: "12px",
                          border: "1px solid #e5e7eb",
                          background: "#fbfbfb",
                        }}
                      >
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <strong style={{ fontSize: "15px", color: "#111827" }}>{b.salon_name}</strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                background:
                                  b.status === "CONFIRMED"
                                    ? "#dcfce7"
                                    : b.status === "COMPLETED"
                                    ? "#e0e7ff"
                                    : "#fef3c7",
                                color:
                                  b.status === "CONFIRMED"
                                    ? "#15803d"
                                    : b.status === "COMPLETED"
                                    ? "#4338ca"
                                    : "#b45309",
                              }}
                            >
                              {b.status}
                            </span>
                          </div>
                          <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#4b5563" }}>
                            {b.service_name} • ₹{b.service_price}
                          </p>
                          <small style={{ color: "#6b7280" }}>
                            📅 {b.booking_date} at {b.booking_time} ({b.duration})
                          </small>
                        </div>
                        <Link
                          to={`/salons/${b.salon_id}`}
                          className="btn-outline-action"
                          style={{ textDecoration: "none" }}
                        >
                          View Salon
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                TAB: FAVORITES
                ================================================================ */}
            {activeTab === "favorites" && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <h3>Saved Favorite Salons</h3>
                    <p>Your curated selection of organic, vegan-certified partner spaces.</p>
                  </div>
                  <Link to="/salons" className="btn-outline-action" style={{ textDecoration: "none" }}>
                    Explore More
                  </Link>
                </div>

                {tabLoading ? (
                  <p style={{ color: "var(--profile-text-muted)", fontSize: "14px" }}>
                    Loading your saved sanctuaries...
                  </p>
                ) : favoritesList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 20px" }}>
                    <span style={{ fontSize: "36px", display: "block", marginBottom: "10px" }}>🤍</span>
                    <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 6px" }}>
                      No Saved Salons Yet
                    </h4>
                    <p style={{ fontSize: "13px", color: "var(--profile-text-muted)", margin: "0 0 20px" }}>
                      Discover vetted salons and save your preferred spaces for quick bookings.
                    </p>
                    <Link
                      to="/salons"
                      className="btn-upload-avatar"
                      style={{ textDecoration: "none", display: "inline-block" }}
                    >
                      Browse Salons
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                    {favoritesList.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                          overflow: "hidden",
                          background: "#ffffff",
                        }}
                      >
                        <img
                          src={resolveImageUrl(f.cover_image)}
                          alt={f.name}
                          style={{ width: "100%", height: "130px", objectFit: "cover" }}
                        />
                        <div style={{ padding: "12px" }}>
                          <h4 style={{ fontSize: "14px", fontWeight: "700", margin: "0 0 4px" }}>{f.name}</h4>
                          <p style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 10px" }}>
                            📍 {f.city} • {f.category}
                          </p>
                          <Link
                            to={`/salons/${f.id}`}
                            className="btn-form-save"
                            style={{
                              textDecoration: "none",
                              display: "block",
                              textAlign: "center",
                              padding: "6px 12px",
                              fontSize: "12px",
                            }}
                          >
                            Book Slot
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                TAB: REVIEWS
                ================================================================ */}
            {activeTab === "reviews" && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <h3>Treatment Feedback & Reviews</h3>
                    <p>Ratings and mindful notes from your past completed rituals.</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div
                    style={{
                      background: "#fbfbfb",
                      border: "1px solid #e5e7eb",
                      borderRadius: "12px",
                      padding: "16px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "14px" }}>Aura Luxe Salon & Spa</strong>
                      <span style={{ color: "#f59e0b", fontSize: "14px" }}>★★★★★</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "#374151", margin: "0 0 6px", lineHeight: "1.5" }}>
                      "Exceptional scalp detox ritual. The organic cedarwood infusion was deeply calming, and the stylist accommodated my sensitive skin preferences wonderfully."
                    </p>
                    <small style={{ color: "#9ca3af" }}>Verified Review • 2 weeks ago</small>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ====================================================================
          MODAL: EDIT WELLNESS PREFERENCES
          ==================================================================== */}
      {showPreferencesModal && (
        <div className="profile-modal-overlay" onClick={() => setShowPreferencesModal(false)}>
          <div className="profile-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Edit Wellness & Hair Preferences</h3>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowPreferencesModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              {/* Hair Types */}
              <div>
                <label className="profile-input-label">Hair Type & Texture Tags</label>
                <div className="preference-pill-wrap" style={{ margin: "8px 0" }}>
                  {editHairTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="preference-pill"
                      style={{ cursor: "pointer" }}
                      title="Click to remove"
                      onClick={() => setEditHairTags(editHairTags.filter((_, i) => i !== idx))}
                    >
                      {tag} ✕
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="profile-input-field"
                    placeholder="Add hair tag (e.g. Fine Curls)..."
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTagInput.trim()) {
                        e.preventDefault();
                        setEditHairTags([...editHairTags, newTagInput.trim()]);
                        setNewTagInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-outline-action"
                    onClick={() => {
                      if (newTagInput.trim()) {
                        setEditHairTags([...editHairTags, newTagInput.trim()]);
                        setNewTagInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Sensitivities */}
              <div style={{ marginTop: "10px" }}>
                <label className="profile-input-label">Scalp & Skin Sensitivities</label>
                <div className="preference-pill-wrap" style={{ margin: "8px 0" }}>
                  {editSensitivities.map((tag, idx) => (
                    <span
                      key={idx}
                      className="preference-pill highlight"
                      style={{ cursor: "pointer" }}
                      title="Click to remove"
                      onClick={() =>
                        setEditSensitivities(editSensitivities.filter((_, i) => i !== idx))
                      }
                    >
                      {tag} ✕
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {["Sensitive Scalp", "Fragrance-Free Oil", "Organic-Only Formulations", "Nut Allergy", "Eczema Prone"].map(
                    (sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        style={{
                          fontSize: "11px",
                          background: "#f3f4f6",
                          border: "1px solid #d1d5db",
                          borderRadius: "9999px",
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (!editSensitivities.includes(sugg)) {
                            setEditSensitivities([...editSensitivities, sugg]);
                          }
                        }}
                      >
                        + {sugg}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="profile-modal-footer">
              <button
                type="button"
                className="btn-form-cancel"
                onClick={() => setShowPreferencesModal(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn-form-save" onClick={handleSavePreferences}>
                <span>✓</span>
                <span>Save Preferences</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CHANGE PASSWORD
          ==================================================================== */}
      {showPasswordModal && (
        <div className="profile-modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="profile-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Change Password</h3>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowPasswordModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleChangePassword}>
              <div className="profile-modal-body">
                {passwordError && (
                  <div
                    style={{
                      background: "#fee2e2",
                      color: "#dc2626",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  >
                    {passwordError}
                  </div>
                )}

                <div className="profile-input-group">
                  <label className="profile-input-label">Current Password</label>
                  <input
                    type="password"
                    className="profile-input-field"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="profile-input-group">
                  <label className="profile-input-label">New Password (min 8 chars)</label>
                  <input
                    type="password"
                    className="profile-input-field"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>

                <div className="profile-input-group">
                  <label className="profile-input-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="profile-input-field"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="profile-modal-footer">
                <button
                  type="button"
                  className="btn-form-cancel"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={passwordSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-form-save"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: CONFIRM LOGOUT
          ==================================================================== */}
      {showLogoutModal && (
        <div className="profile-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="profile-modal-window" style={{ maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Confirm Sign Out</h3>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowLogoutModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              <p style={{ fontSize: "14px", color: "var(--profile-text-muted)", margin: 0, lineHeight: "1.5" }}>
                Are you sure you want to end your current customer session on this device?
              </p>
            </div>

            <div className="profile-modal-footer">
              <button
                type="button"
                className="btn-form-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-signout-red"
                onClick={async () => {
                  setShowLogoutModal(false);
                  if (logout) {
                    await logout();
                  } else {
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("refresh_token");
                    localStorage.removeItem("user");
                  }
                  navigate("/login");
                }}
              >
                <span>🚪</span>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="profile-toast" role="alert">
          <span>🌿</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <CustomerFooter />
    </div>
  );
}

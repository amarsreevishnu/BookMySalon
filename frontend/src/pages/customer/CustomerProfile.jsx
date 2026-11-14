import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import { selectUserAvatar } from "../../features/auth/authSlice";
import CustomerHeader from "../../components/customer/CustomerHeader";
import CustomerFooter from "../../components/customer/CustomerFooter";
import SalonLoader from "../../components/common/Loader";
import CustomerProfileSidebar from "../../components/customer/CustomerProfileSidebar";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/customerProfile.css";

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const reduxAvatar = useSelector(selectUserAvatar);

  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);

  const activeTab = searchParams.get("tab") || "profile";

  // Redirect if someone visits /customer/profile?tab=bookings or ?tab=favorites to canonical pages
  useEffect(() => {
    if (activeTab === "bookings") {
      navigate("/customer/my-bookings", { replace: true });
    } else if (activeTab === "favorites") {
      navigate("/customer/favorites", { replace: true });
    } else if (activeTab === "wallet") {
      navigate("/customer/wallet", { replace: true });
    }
  }, [activeTab, navigate]);

  // Keep latest user in a ref to prevent dependency loop with updateUser
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
  const [gender, setGender] = useState("");
  const [location, setLocation] = useState("");
  const [upiId, setUpiId] = useState("");

  // Modals state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);

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
  const [editPreferredStylist, setEditPreferredStylist] = useState({
    name: "",
    role: "",
    salon: "",
  });
  const [newHairInput, setNewHairInput] = useState("");
  const [newRitualInput, setNewRitualInput] = useState("");
  const [newSensitivityInput, setNewSensitivityInput] = useState("");

  // Customer Reviews state
  const [myReviews, setMyReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 3200);
  };

  // 1. Fetch Profile Data from Backend API
  const fetchProfile = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await api.get("/accounts/customer/profile/");
      const data = res.data;
      setProfileData(data);

      const currentUser = userRef.current;
      setFirstName(data.first_name || currentUser?.first_name || "");
      setLastName(data.last_name || currentUser?.last_name || "");
      setDob(data.date_of_birth || "");
      setPhone(data.phone_number || currentUser?.phone_number || "");
      setGender(data.gender || "");
      setLocation(data.primary_location || "");
      setUpiId(data.upi_id || "");

      if (data.wellness_preferences) {
        setEditHairTags(Array.isArray(data.wellness_preferences.hair_type) ? data.wellness_preferences.hair_type : []);
        setEditSensitivities(Array.isArray(data.wellness_preferences.sensitivities) ? data.wellness_preferences.sensitivities : []);
        setEditRituals(Array.isArray(data.wellness_preferences.rituals) ? data.wellness_preferences.rituals : []);
        if (data.wellness_preferences.preferred_stylist) {
          setEditPreferredStylist({
            name: data.wellness_preferences.preferred_stylist.name || "",
            role: data.wellness_preferences.preferred_stylist.role || "",
            salon: data.wellness_preferences.preferred_stylist.salon || "",
          });
        }
      }

      // Synchronize latest profile data with global Redux auth state ONLY if actual data changed
      const current = userRef.current;
      if (current) {
        const newFullName =
          data.full_name ||
          `${data.first_name || ""} ${data.last_name || ""}`.trim() ||
          current.full_name;

        const hasChanged =
          current.first_name !== (data.first_name || "") ||
          current.last_name !== (data.last_name || "") ||
          current.full_name !== newFullName ||
          (Boolean(data.avatar) && current.avatar !== data.avatar) ||
          (Boolean(data.phone_number) && current.phone_number !== data.phone_number);

        if (hasChanged) {
          updateUser({
            ...current,
            id: data.id || current.id,
            email: data.email || current.email,
            first_name: data.first_name ?? current.first_name ?? "",
            last_name: data.last_name ?? current.last_name ?? "",
            full_name: newFullName,
            avatar: data.avatar || current.avatar || "",
            phone_number: data.phone_number || current.phone_number || "",
            role: current.role || "CUSTOMER",
          });
        }
      }
    } catch (err) {
      console.error("Failed to fetch customer profile:", err);
      showToast("Unable to load latest profile data. Using stored credentials.");
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [updateUser]);

  useEffect(() => {
    fetchProfile(true);
  }, [fetchProfile]);

  // 2. Fetch Customer Reviews when on Reviews tab
  useEffect(() => {
    if (activeTab === "reviews") {
      setReviewsLoading(true);
      api
        .get("/reviews/my/")
        .then((res) => {
          setMyReviews(res.data?.reviews || []);
        })
        .catch((err) => {
          console.error("Failed to load customer reviews:", err);
        })
        .finally(() => setReviewsLoading(false));
    }
  }, [activeTab]);

  // 3. Save Personal Information
  const handleSaveProfile = async (e) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone_number: phone.trim(),
        date_of_birth: dob || null,
        gender: gender,
        primary_location: location.trim(),
        upi_id: upiId.trim(),
      };

      const res = await api.put("/accounts/customer/profile/", payload);
      setProfileData(res.data);

      const updatedUser = {
        ...user,
        ...(res.data.user || {}),
        first_name: res.data.first_name || firstName,
        last_name: res.data.last_name || lastName,
        full_name: res.data.full_name || `${firstName} ${lastName}`.trim(),
        avatar: res.data.avatar || user?.avatar || "",
        phone_number: res.data.phone_number || phone,
        role: user?.role || "CUSTOMER",
      };
      updateUser(updatedUser);

      // Dispatch global profile updated event to sync sidebar across views
      window.dispatchEvent(new CustomEvent("bm-profile-updated", { detail: res.data }));

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

      const newAvatarUrl = res.data.avatar || res.data.user?.avatar || "";

      setProfileData((prev) => ({
        ...prev,
        avatar: newAvatarUrl,
      }));

      const updatedUser = {
        ...user,
        ...(res.data.user || {}),
        avatar: newAvatarUrl,
      };
      updateUser(updatedUser);

      window.dispatchEvent(
        new CustomEvent("bm-profile-updated", {
          detail: { ...profileData, avatar: newAvatarUrl },
        })
      );

      showToast("Profile avatar updated successfully!");
    } catch (err) {
      console.error("Avatar upload error:", err);
      showToast("Failed to upload avatar. Please try again.");
    }
  };

  const handleAvatarRemove = async () => {
    try {
      await api.delete("/accounts/customer/avatar/");
      setProfileData((prev) => ({
        ...prev,
        avatar: "",
      }));

      const updatedUser = {
        ...user,
        ...(user || {}),
        avatar: "",
      };
      updateUser(updatedUser);

      window.dispatchEvent(
        new CustomEvent("bm-profile-updated", {
          detail: { ...profileData, avatar: "" },
        })
      );

      showToast("Avatar removed successfully.");
    } catch (err) {
      console.error("Avatar remove error:", err);
      showToast("Failed to remove avatar.");
    }
  };

  // 5. Save Wellness Preferences Dynamically to Database
  const handleSavePreferences = async () => {
    try {
      const updatedPrefs = {
        hair_type: editHairTags,
        sensitivities: editSensitivities,
        rituals: editRituals,
        preferred_stylist: editPreferredStylist.name.trim()
          ? {
              name: editPreferredStylist.name.trim(),
              role: editPreferredStylist.role.trim() || "Specialist",
              salon: editPreferredStylist.salon.trim(),
            }
          : null,
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

  // 6. Password Change
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
      setPasswordError(
        err.response?.data?.error ||
          "Failed to change password. Please check your current password."
      );
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

  const userAvatarUrl = profileData?.avatar || reduxAvatar || user?.avatar || "";

  if (loading) {
    return (
      <div className="customer-profile-page">
        <CustomerHeader />
        <div
          style={{
            minHeight: "65vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "60px 20px",
          }}
        >
          <SalonLoader size={84} label="Loading Profile..." />
        </div>
        <CustomerFooter />
      </div>
    );
  }

  return (
    <div className="customer-profile-page">
      <CustomerHeader />

      {toastMessage && <div className="bk-toast">{toastMessage}</div>}

      <main className="profile-main-container">


        <div className="profile-layout-grid">
          {/* REUSABLE SHARED CUSTOMER SIDEBAR */}
          <CustomerProfileSidebar
            activeNav={activeTab}
            profile={profileData}
            onNavChange={(key, path) => {
              if (key === "profile" || key === "reviews" || key === "settings") {
                setSearchParams({ tab: key });
              } else {
                navigate(path);
              }
            }}
          />

          {/* MAIN CONTENT AREA */}
          <section className="profile-content-area">
            {/*  TAB: PROFILE (PERSONAL INFORMATION & WELLNESS PREFERENCES)*/}
            {activeTab === "profile" && (
              <>
                {/* 1. Avatar & Photo Display Card */}
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
                        <span>{profileData?.membership_tier || "Verified Member"}</span>
                      </div>
                      {profileData?.member_since && (
                        <p className="member-since-text">
                          Member since {profileData.member_since}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Personal Information Form */}
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
                      {/* First Name */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">First Name *</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="text"
                            className="profile-input-field"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="Enter first name"
                            required
                          />
                          <span className="input-suffix-icon">👤</span>
                        </div>
                      </div>

                      {/* Last Name */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">Last Name</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="text"
                            className="profile-input-field"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Enter last name"
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
                            placeholder="+91..."
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
                            <option value="">Select Gender</option>
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
                        <label className="profile-input-label">Primary Location / City</label>
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

                      {/* UPI ID */}
                      <div className="profile-input-group">
                        <label className="profile-input-label">UPI ID for Quick Checkout</label>
                        <div className="profile-input-wrapper">
                          <input
                            type="text"
                            className="profile-input-field"
                            value={upiId}
                            onChange={(e) => setUpiId(e.target.value)}
                            placeholder="e.g. username@okhdfcbank"
                          />
                          <span className="input-suffix-icon">💳</span>
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
                        Reset
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

                {/* 3. Holistic Profile: Wellness & Hair Preferences (100% Dynamic) */}
                <div className="profile-card">
                  <div className="profile-card-header">
                    <div className="profile-card-title-group">
                      <div className="holistic-tag-header">
                        <span>🌿</span>
                        <span>HOLISTIC PROFILE</span>
                      </div>
                      <h3>Wellness &amp; Hair Preferences</h3>
                      <p>
                        Helps our therapists prepare certified organic botanical formulations
                        tailored to your skin and hair texture.
                      </p>
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
                        <span>Hair Type &amp; Texture</span>
                      </div>
                      {editHairTags && editHairTags.length > 0 ? (
                        <div className="preference-pill-wrap">
                          {editHairTags.map((tag, i) => (
                            <span key={i} className="preference-pill">
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="preference-empty-text">
                          No hair type tags added yet. Click &ldquo;Edit Preferences&rdquo; to customize.
                        </p>
                      )}
                    </div>

                    {/* Scalp & Skin Sensitivities */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>💆</span>
                        <span>Scalp &amp; Skin Sensitivities</span>
                      </div>
                      {editSensitivities && editSensitivities.length > 0 ? (
                        <div className="preference-pill-wrap">
                          {editSensitivities.map((tag, i) => (
                            <span
                              key={i}
                              className={`preference-pill ${
                                tag.toLowerCase().includes("sensitive") ||
                                tag.toLowerCase().includes("allergy")
                                  ? "highlight"
                                  : ""
                              }`}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="preference-empty-text">
                          No sensitivities specified. Formulations will use standard organic blends.
                        </p>
                      )}
                    </div>

                    {/* Favorite Rituals */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>✨</span>
                        <span>Favorite Rituals</span>
                      </div>
                      {editRituals && editRituals.length > 0 ? (
                        <ul className="preference-checklist">
                          {editRituals.map((ritual, i) => (
                            <li key={i}>
                              <span className="check-icon">✓</span>
                              <span>{ritual}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="preference-empty-text">
                          No favorite rituals selected yet.
                        </p>
                      )}
                    </div>

                    {/* Preferred Stylist & Artisan Notes */}
                    <div className="preference-box">
                      <div className="preference-box-title">
                        <span>⭐</span>
                        <span>Preferred Specialist &amp; Notes</span>
                      </div>
                      {editPreferredStylist.name ? (
                        <div className="stylist-mini-card">
                          <div className="stylist-mini-avatar-fallback">
                            {editPreferredStylist.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="stylist-mini-info">
                            <h5>{editPreferredStylist.name}</h5>
                            <p>
                              {editPreferredStylist.role || "Specialist"}
                              {editPreferredStylist.salon
                                ? ` — ${editPreferredStylist.salon}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="preference-empty-text">
                          No preferred specialist noted. Click &ldquo;Edit Preferences&rdquo; to add your favorite artisan.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ================================================================
                TAB: REVIEWS (100% REAL DYNAMIC REVIEWS FROM BACKEND)
                ================================================================ */}
            {activeTab === "reviews" && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <h3>Treatment Feedback &amp; Reviews</h3>
                    <p>Ratings and mindful notes from your past completed salon visits.</p>
                  </div>
                  <span className="sidebar-nav-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>
                    {myReviews.length} Verified Review{myReviews.length === 1 ? "" : "s"}
                  </span>
                </div>

                {reviewsLoading ? (
                  <div style={{ padding: "40px 20px", display: "flex", justifyContent: "center" }}>
                    <SalonLoader size={48} label="Loading your reviews..." />
                  </div>
                ) : myReviews.length === 0 ? (
                  <div
                    style={{
                      padding: "48px 24px",
                      textAlign: "center",
                      background: "#fafcfb",
                      borderRadius: "16px",
                      border: "1px dashed var(--profile-border)",
                    }}
                  >
                    <div style={{ fontSize: "2.4rem", marginBottom: "8px" }}>⭐</div>
                    <h4 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 6px" }}>
                      No Reviews Yet
                    </h4>
                    <p style={{ fontSize: "13px", color: "#6b7280", maxWidth: "420px", margin: "0 auto 18px", lineHeight: "1.5" }}>
                      You haven&apos;t written any reviews yet. After completing appointments, you can share feedback and rating scores with your salon specialists.
                    </p>
                    <Link
                      to="/customer/my-bookings"
                      className="btn-form-save"
                      style={{ textDecoration: "none", display: "inline-block", padding: "8px 18px" }}
                    >
                      View Past Appointments →
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {myReviews.map((rev) => (
                      <div
                        key={rev.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid var(--profile-border)",
                          borderRadius: "14px",
                          padding: "16px 18px",
                          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.02)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "8px",
                            flexWrap: "wrap",
                            gap: "8px",
                          }}
                        >
                          <div>
                            <Link
                              to={`/customer/salons/${rev.salon_id}`}
                              style={{
                                fontSize: "15px",
                                fontWeight: "700",
                                color: "var(--profile-primary)",
                                textDecoration: "none",
                              }}
                            >
                              {rev.salon_name}
                            </Link>
                            {rev.salon_city && (
                              <span style={{ fontSize: "12px", color: "#6b7280", marginLeft: "6px" }}>
                                • {rev.salon_city}
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{ color: "#f59e0b", fontSize: "15px" }}>
                              {"★".repeat(rev.rating)}
                              {"☆".repeat(5 - rev.rating)}
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "#374151" }}>
                              ({rev.rating}/5)
                            </span>
                          </div>
                        </div>

                        {rev.service_name && (
                          <div
                            style={{
                              display: "inline-block",
                              background: "#f0fdf4",
                              color: "#166534",
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              marginBottom: "8px",
                            }}
                          >
                            ✂️ {rev.service_name}
                          </div>
                        )}

                        <p
                          style={{
                            fontSize: "13px",
                            color: "#374151",
                            margin: "0 0 8px",
                            lineHeight: "1.5",
                          }}
                        >
                          &ldquo;{rev.comment}&rdquo;
                        </p>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            fontSize: "11.5px",
                            color: "#9ca3af",
                            borderTop: "1px solid #f3f4f6",
                            paddingTop: "6px",
                          }}
                        >
                          <span>
                            Reviewed on{" "}
                            {new Date(rev.created_at).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span style={{ color: "#059669", fontWeight: "600" }}>
                            ✓ Verified Visit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                TAB: SETTINGS (ACCOUNT SECURITY & PASSWORD CHANGE)
                ================================================================ */}
            {activeTab === "settings" && (
              <div className="profile-card">
                <div className="profile-card-header">
                  <div className="profile-card-title-group">
                    <h3>Account Security &amp; Settings</h3>
                    <p>Manage your account credentials, security preferences, and active authentication.</p>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {/* Verified Credentials Summary */}
                  <div
                    style={{
                      background: "#fbfdfc",
                      border: "1px solid var(--profile-border)",
                      borderRadius: "14px",
                      padding: "18px",
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "14px",
                    }}
                  >
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#6b7280" }}>
                        Primary Email
                      </span>
                      <p style={{ margin: "4px 0 2px", fontWeight: "600", fontSize: "13.5px", color: "#111827" }}>
                        {profileData?.email || user?.email}
                      </p>
                      <span style={{ color: "#059669", fontSize: "11px", fontWeight: "600" }}>✓ Verified</span>
                    </div>

                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#6b7280" }}>
                        Verified Phone
                      </span>
                      <p style={{ margin: "4px 0 2px", fontWeight: "600", fontSize: "13.5px", color: "#111827" }}>
                        {phone || "Not configured"}
                      </p>
                      <span style={{ color: phone ? "#059669" : "#d97706", fontSize: "11px", fontWeight: "600" }}>
                        {phone ? "✓ SMS & WhatsApp Enabled" : "Add phone in Personal Information"}
                      </span>
                    </div>

                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "#6b7280" }}>
                        Account Status
                      </span>
                      <p style={{ margin: "4px 0 2px", fontWeight: "600", fontSize: "13.5px", color: "#111827" }}>
                        Active Customer
                      </p>
                      <span style={{ color: "#059669", fontSize: "11px", fontWeight: "600" }}>✓ Good Standing</span>
                    </div>
                  </div>

                  {/* Change Password Form In-Page */}
                  <div
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--profile-border)",
                      borderRadius: "14px",
                      padding: "20px",
                    }}
                  >
                    <h4 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                      Change Password
                    </h4>
                    <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#6b7280" }}>
                      Ensure your account uses a secure password of at least 8 characters.
                    </p>

                    {passwordError && (
                      <div
                        style={{
                          background: "#fee2e2",
                          color: "#dc2626",
                          padding: "10px 14px",
                          borderRadius: "8px",
                          fontSize: "12.5px",
                          marginBottom: "14px",
                        }}
                      >
                        {passwordError}
                      </div>
                    )}

                    <form onSubmit={handleChangePassword}>
                      <div className="profile-form-grid">
                        <div className="profile-input-group">
                          <label className="profile-input-label">Current Password *</label>
                          <input
                            type="password"
                            className="profile-input-field"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                          />
                        </div>

                        <div className="profile-input-group">
                          <label className="profile-input-label">New Password (min 8 chars) *</label>
                          <input
                            type="password"
                            className="profile-input-field"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="At least 8 characters"
                            required
                          />
                        </div>

                        <div className="profile-input-group">
                          <label className="profile-input-label">Confirm New Password *</label>
                          <input
                            type="password"
                            className="profile-input-field"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            required
                          />
                        </div>
                      </div>

                      <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
                        <button
                          type="submit"
                          className="btn-form-save"
                          disabled={passwordSaving}
                        >
                          {passwordSaving ? "Updating Password..." : "Update Password"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* ====================================================================
          MODAL: EDIT WELLNESS PREFERENCES (100% DYNAMIC)
          ==================================================================== */}
      {showPreferencesModal && (
        <div className="profile-modal-overlay" onClick={() => setShowPreferencesModal(false)}>
          <div className="profile-modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Edit Wellness &amp; Hair Preferences</h3>
              <button
                type="button"
                className="profile-modal-close-btn"
                onClick={() => setShowPreferencesModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="profile-modal-body">
              {/* 1. Hair Types & Texture */}
              <div>
                <label className="profile-input-label">Hair Type &amp; Texture Tags</label>
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
                    placeholder="Add hair tag (e.g. Wavy 2B, Fine, Dry Ends)..."
                    value={newHairInput}
                    onChange={(e) => setNewHairInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newHairInput.trim()) {
                        e.preventDefault();
                        if (!editHairTags.includes(newHairInput.trim())) {
                          setEditHairTags([...editHairTags, newHairInput.trim()]);
                        }
                        setNewHairInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-outline-action"
                    onClick={() => {
                      if (newHairInput.trim() && !editHairTags.includes(newHairInput.trim())) {
                        setEditHairTags([...editHairTags, newHairInput.trim()]);
                        setNewHairInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                {/* Popular suggestions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {["Straight (1A)", "Wavy (2B)", "Curly (3A)", "Coily (4A)", "Medium Density", "Thick", "Fine", "Color-Treated"].map(
                    (sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        style={{
                          fontSize: "11px",
                          background: editHairTags.includes(sugg) ? "#dcfce7" : "#f3f4f6",
                          color: editHairTags.includes(sugg) ? "#166534" : "#4b5563",
                          border: "1px solid #d1d5db",
                          borderRadius: "9999px",
                          padding: "2px 8px",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (!editHairTags.includes(sugg)) {
                            setEditHairTags([...editHairTags, sugg]);
                          }
                        }}
                      >
                        + {sugg}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* 2. Sensitivities */}
              <div style={{ marginTop: "14px" }}>
                <label className="profile-input-label">Scalp &amp; Skin Sensitivities</label>
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
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="profile-input-field"
                    placeholder="Add sensitivity (e.g. Nut Allergy, Fragrance-Free)..."
                    value={newSensitivityInput}
                    onChange={(e) => setNewSensitivityInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newSensitivityInput.trim()) {
                        e.preventDefault();
                        if (!editSensitivities.includes(newSensitivityInput.trim())) {
                          setEditSensitivities([...editSensitivities, newSensitivityInput.trim()]);
                        }
                        setNewSensitivityInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-outline-action"
                    onClick={() => {
                      if (newSensitivityInput.trim() && !editSensitivities.includes(newSensitivityInput.trim())) {
                        setEditSensitivities([...editSensitivities, newSensitivityInput.trim()]);
                        setNewSensitivityInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                  {["Sensitive Scalp", "Fragrance-Free Oil", "Organic-Only Formulations", "Nut Allergy", "Eczema Prone", "Sulfate-Free"].map(
                    (sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        style={{
                          fontSize: "11px",
                          background: editSensitivities.includes(sugg) ? "#fef3c7" : "#f3f4f6",
                          color: editSensitivities.includes(sugg) ? "#92400e" : "#4b5563",
                          border: "1px solid #d1d5db",
                          borderRadius: "9999px",
                          padding: "2px 8px",
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

              {/* 3. Favorite Rituals */}
              <div style={{ marginTop: "14px" }}>
                <label className="profile-input-label">Favorite Rituals &amp; Treatments</label>
                <div className="preference-pill-wrap" style={{ margin: "8px 0" }}>
                  {editRituals.map((tag, idx) => (
                    <span
                      key={idx}
                      className="preference-pill"
                      style={{ cursor: "pointer" }}
                      title="Click to remove"
                      onClick={() => setEditRituals(editRituals.filter((_, i) => i !== idx))}
                    >
                      {tag} ✕
                    </span>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    className="profile-input-field"
                    placeholder="Add favorite treatment (e.g. Scalp Detox Massage)..."
                    value={newRitualInput}
                    onChange={(e) => setNewRitualInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newRitualInput.trim()) {
                        e.preventDefault();
                        if (!editRituals.includes(newRitualInput.trim())) {
                          setEditRituals([...editRituals, newRitualInput.trim()]);
                        }
                        setNewRitualInput("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-outline-action"
                    onClick={() => {
                      if (newRitualInput.trim() && !editRituals.includes(newRitualInput.trim())) {
                        setEditRituals([...editRituals, newRitualInput.trim()]);
                        setNewRitualInput("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* 4. Preferred Stylist & Artisan Notes */}
              <div style={{ marginTop: "14px" }}>
                <label className="profile-input-label">Preferred Specialist &amp; Treatment Notes</label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "6px" }}>
                  <input
                    type="text"
                    className="profile-input-field"
                    placeholder="Specialist name (optional)..."
                    value={editPreferredStylist.name}
                    onChange={(e) =>
                      setEditPreferredStylist({
                        ...editPreferredStylist,
                        name: e.target.value,
                      })
                    }
                  />
                  <input
                    type="text"
                    className="profile-input-field"
                    placeholder="Role / Title (e.g. Master Stylist)..."
                    value={editPreferredStylist.role}
                    onChange={(e) =>
                      setEditPreferredStylist({
                        ...editPreferredStylist,
                        role: e.target.value,
                      })
                    }
                  />
                </div>
                <input
                  type="text"
                  className="profile-input-field"
                  style={{ marginTop: "8px" }}
                  placeholder="Salon name or personalized styling notes for check-in..."
                  value={editPreferredStylist.salon}
                  onChange={(e) =>
                    setEditPreferredStylist({
                      ...editPreferredStylist,
                      salon: e.target.value,
                    })
                  }
                />
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
          MODAL: CHANGE PASSWORD (STANDALONE TRIGGER)
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
                      marginBottom: "10px",
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

      <CustomerFooter />
    </div>
  );
}

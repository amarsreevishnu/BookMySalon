import { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import WorkerHeader from "../../components/worker/WorkerHeader";
import WorkerSalonBanner from "../../components/worker/WorkerSalonBanner";
import "../../styles/workerProfile.css";
import "../../styles/workerDashboard.css";

export default function WorkerProfile() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [profileSuccessMsg, setProfileSuccessMsg] = useState("");
  const [profileErrorMsg, setProfileErrorMsg] = useState("");
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState("");
  const [passwordErrorMsg, setPasswordErrorMsg] = useState("");

  const [salonInfo, setSalonInfo] = useState({
    name: "Affiliated Salon Outlet",
    city: "",
    address: "",
    category: "",
    phone: "",
  });

  const [stylistMeta, setStylistMeta] = useState({
    chair: "Chair #01",
    shift: "09:30 AM - 06:30 PM",
    roleBadge: "Senior Salon Specialist",
    assignedBookingsCount: 0,
    employmentStatus: "Full-Time Specialist",
    rating: "4.92 ★",
  });

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    specialization: "",
    experience: "",
    bio: "",
    profile_photo: "",
  });

  
  const [formErrors, setFormErrors] = useState({});

  
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  
  const [passwordErrors, setPasswordErrors] = useState({});

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  
  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    try {
     
      const dashRes = await api.get("/salons/worker/dashboard/").catch(() => null);
      if (dashRes?.data) {
        const { salon, worker, kpi_stats } = dashRes.data;
        if (salon) {
          setSalonInfo({
            name: salon.name || "Affiliated Salon Outlet",
            city: salon.city || "",
            address: salon.address || "",
            category: salon.category || salon.category_name || "Luxury Salon",
            phone: salon.phone || "",
          });
        }
        if (worker) {
          setStylistMeta((prev) => ({
            ...prev,
            chair: worker.station || (worker.chair ? `Chair #${worker.chair}` : "Chair #01"),
            shift: worker.shift || "09:30 AM - 06:30 PM",
            roleBadge: worker.specialization || worker.role_badge || "Senior Salon Specialist",
            employmentStatus: worker.employment_status || "Full-Time Specialist",
            assignedBookingsCount: kpi_stats?.total_bookings || 0,
          }));
        }
      }

      
      const profRes = await api.get("/salons/worker/profile/").catch(() => null);
      if (profRes?.data) {
        const p = profRes.data;
        setFormData({
          first_name: p.first_name || user?.first_name || "",
          last_name: p.last_name || user?.last_name || "",
          email: p.email || user?.email || "",
          phone_number: p.phone_number || user?.phone_number || "",
          specialization: p.specialization || "",
          experience: p.experience || "",
          bio: p.bio || "",
          profile_photo:
            p.profile_photo ||
            user?.avatar ||
            "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=240&q=80",
        });
        if (p.salon_details) {
          setSalonInfo((prev) => ({
            ...prev,
            ...p.salon_details,
          }));
        }
      } else if (dashRes?.data?.worker) {
        
        const w = dashRes.data.worker;
        const nameParts = (w.full_name || user?.full_name || "").split(" ");
        setFormData({
          first_name: nameParts[0] || user?.first_name || "",
          last_name: nameParts.slice(1).join(" ") || user?.last_name || "",
          email: user?.email || "",
          phone_number: w.phone_number || user?.phone_number || "",
          specialization: w.specialization || "",
          experience: w.experience || "",
          bio: w.bio || "",
          profile_photo:
            w.profile_photo ||
            w.avatar ||
            user?.avatar ||
            "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=240&q=80",
        });
      } else {
        
        setFormData({
          first_name: user?.first_name || "",
          last_name: user?.last_name || "",
          email: user?.email || "",
          phone_number: user?.phone_number || "",
          specialization: "Senior Hair Stylist & Botanical Therapist",
          experience: "5+ Years",
          bio: "Specializing in organic haircare, precision cuts, and customized botanical treatments.",
          profile_photo:
            user?.avatar ||
            "https://images.unsplash.com/photo-1595152772835-219674b2a8a6?auto=format&fit=crop&w=240&q=80",
        });
      }
    } catch (err) {
      console.error("Error loading worker profile:", err);
      showToast("Unable to load profile details.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const validateProfileField = (name, value) => {
    let error = "";
    const trimmed = String(value || "").trim();

    switch (name) {
      case "first_name":
        if (!trimmed) {
          error = "First name is required.";
        } else if (trimmed.length < 2) {
          error = "First name must be at least 2 characters.";
        } else if (!/^[A-Za-z\s]+$/.test(trimmed)) {
          error = "First name should only contain letters and spaces.";
        }
        break;

      case "last_name":
        if (trimmed && !/^[A-Za-z\s]+$/.test(trimmed)) {
          error = "Last name should only contain letters and spaces.";
        }
        break;

      case "phone_number": {
        const clean = trimmed.replace(/[\s\-\+]/g, "");
        const localPhone = clean.startsWith("91") && clean.length === 12 ? clean.slice(2) : clean;
        if (!localPhone) {
          error = "Phone number is required.";
        } else if (!/^[6-9]\d{9}$/.test(localPhone)) {
          error = "Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.";
        }
        break;
      }

      case "specialization":
        if (!trimmed) {
          error = "Specialization cannot be empty.";
        } else if (trimmed.length > 150) {
          error = "Specialization cannot exceed 150 characters.";
        }
        break;

      case "experience":
        if (trimmed.length > 100) {
          error = "Experience cannot exceed 100 characters.";
        }
        break;

      case "bio":
        if (trimmed.length > 500) {
          error = "Bio cannot exceed 500 characters.";
        }
        break;

      default:
        break;
    }

    return error;
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const err = validateProfileField(name, value);
    setFormErrors((prev) => ({ ...prev, [name]: err }));
    setProfileSuccessMsg("");
    setProfileErrorMsg("");
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormErrors((prev) => ({ ...prev, profile_photo: "Please select an image file (PNG, JPG, WEBP)." }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormErrors((prev) => ({ ...prev, profile_photo: "Image size must be less than 5MB." }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, profile_photo: reader.result }));
      setFormErrors((prev) => ({ ...prev, profile_photo: "" }));
    };
    reader.readAsDataURL(file);
  };

  // Submit Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    // Validate all fields
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateProfileField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (Object.keys(newErrors).length > 0) {
      setFormErrors(newErrors);
      setProfileErrorMsg("Please correct the errors in the profile form.");
      return;
    }

    setSavingProfile(true);
    setProfileErrorMsg("");
    setProfileSuccessMsg("");

    try {
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        phone_number: formData.phone_number.trim(),
        specialization: formData.specialization.trim(),
        experience: formData.experience.trim(),
        bio: formData.bio.trim(),
        profile_photo: formData.profile_photo,
      };

      const res = await api.patch("/salons/worker/profile/", payload);
      setProfileSuccessMsg("Specialist profile updated successfully!");
      showToast("Profile saved successfully ✨");
      if (res.data?.profile) {
        const p = res.data.profile;
        setFormData((prev) => ({
          ...prev,
          first_name: p.first_name || prev.first_name,
          last_name: p.last_name || prev.last_name,
          phone_number: p.phone_number || prev.phone_number,
          specialization: p.specialization || prev.specialization,
          experience: p.experience || prev.experience,
          bio: p.bio || prev.bio,
          profile_photo: p.profile_photo || prev.profile_photo,
        }));
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      const resData = err.response?.data;
      if (resData?.errors) {
        setFormErrors(resData.errors);
        setProfileErrorMsg(resData.error || "Validation failed on server.");
      } else if (resData?.error) {
        setProfileErrorMsg(resData.error);
      } else {
        setProfileErrorMsg("Could not save profile. Please try again.");
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const passwordRules = useMemo(() => {
    const pw = passwordData.new_password || "";
    return {
      length: pw.length >= 8,
      upper: /[A-Z]/.test(pw),
      lower: /[a-z]/.test(pw),
      number: /\d/.test(pw),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pw),
      match: pw.length > 0 && pw === passwordData.confirm_password,
      different:
        passwordData.current_password.length > 0 &&
        pw.length > 0 &&
        pw !== passwordData.current_password,
    };
  }, [passwordData]);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({ ...prev, [name]: value }));
    setPasswordSuccessMsg("");
    setPasswordErrorMsg("");

    if (name === "current_password") {
      setPasswordErrors((prev) => ({
        ...prev,
        current_password: value ? "" : "Current password is required.",
      }));
    }
    if (name === "new_password") {
      let err = "";
      if (!value) {
        err = "New password is required.";
      } else if (value.length < 8) {
        err = "Password must be at least 8 characters.";
      } else if (passwordData.current_password && value === passwordData.current_password) {
        err = "New password cannot be the same as your current password.";
      }
      setPasswordErrors((prev) => ({ ...prev, new_password: err }));
    }
    if (name === "confirm_password") {
      setPasswordErrors((prev) => ({
        ...prev,
        confirm_password:
          value === passwordData.new_password ? "" : "Confirmation password does not match.",
      }));
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    const errors = {};
    if (!passwordData.current_password) {
      errors.current_password = "Current password is required.";
    }
    if (!passwordData.new_password) {
      errors.new_password = "New password is required.";
    } else if (passwordData.new_password.length < 8) {
      errors.new_password = "New password must be at least 8 characters long.";
    } else if (passwordData.new_password === passwordData.current_password) {
      errors.new_password = "New password cannot be the same as your current password.";
    } else if (!passwordRules.upper || !passwordRules.lower || !passwordRules.number || !passwordRules.special) {
      errors.new_password = "Password does not meet the complexity requirements.";
    }

    if (!passwordData.confirm_password) {
      errors.confirm_password = "Confirm password is required.";
    } else if (passwordData.new_password !== passwordData.confirm_password) {
      errors.confirm_password = "New password and confirmation do not match.";
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      setPasswordErrorMsg("Please resolve all password validation errors.");
      return;
    }

    setResettingPassword(true);
    setPasswordErrorMsg("");
    setPasswordSuccessMsg("");

    try {
      const payload = {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password,
      };

      await api.post("/salons/worker/change-password/", payload);

      setPasswordSuccessMsg("Password reset successfully using your current password!");
      showToast("Password updated securely 🔒");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setPasswordErrors({});
    } catch (err) {
      console.error("Password reset error:", err);
      const resData = err.response?.data;
      if (resData?.error) {
        setPasswordErrorMsg(resData.error);
      } else if (resData?.current_password) {
        setPasswordErrorMsg(
          Array.isArray(resData.current_password)
            ? resData.current_password[0]
            : resData.current_password
        );
      } else {
        setPasswordErrorMsg("Failed to reset password. Please verify your current password.");
      }
    } finally {
      setResettingPassword(false);
    }
  };

  const stylistProfileForHeader = {
    name: `${formData.first_name} ${formData.last_name}`.trim() || user?.full_name || "Specialist",
    avatar: formData.profile_photo,
    chair: stylistMeta.chair,
    shift: stylistMeta.shift,
    roleBadge: formData.specialization || stylistMeta.roleBadge,
  };

  return (
    <div className="wp-page-wrapper">
      
      <WorkerHeader
        activeTab="profile"
        salonInfo={salonInfo}
        stylistProfile={stylistProfileForHeader}
      />

      <main className="wp-main-content">
        <WorkerSalonBanner salonInfo={salonInfo} />

       
        <div className="wp-breadcrumb">
          <Link to="/worker/dashboard" className="wp-breadcrumb-link">
            Specialist Dashboard
          </Link>
          <span>/</span>
          <span className="wp-breadcrumb-current">My Profile &amp; Settings</span>
        </div>

        
        <div className="wp-header-row">
          <h1 className="wp-header-title">Specialist Profile &amp; Security</h1>
          <p className="wp-header-subtitle">
            Manage your public stylist credentials, contact info, and reset your account password.
          </p>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <div style={{ fontSize: "2rem", marginBottom: "12px" }}>⏳</div>
            <div>Loading specialist profile details...</div>
          </div>
        ) : (
          <div className="wp-layout-grid">
            <aside>
              <div className="wp-card wp-hero-card">
                <div className="wp-avatar-wrapper">
                  <img
                    src={formData.profile_photo}
                    alt={stylistProfileForHeader.name}
                    className="wp-avatar-img"
                  />
                  <label htmlFor="avatar-file-input" className="wp-avatar-upload-btn" title="Upload new photo">
                    📷
                    <input
                      id="avatar-file-input"
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>

                <h2 className="wp-hero-name">
                  {formData.first_name} {formData.last_name}
                </h2>
                <div className="wp-hero-role">{formData.specialization || stylistMeta.roleBadge}</div>

                <div className="wp-hero-meta-list">
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>🪑</span> Station
                    </span>
                    <span className="wp-hero-meta-val">{stylistMeta.chair}</span>
                  </div>
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>⏰</span> Active Shift
                    </span>
                    <span className="wp-hero-meta-val">{stylistMeta.shift}</span>
                  </div>
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>🏛️</span> Outlet
                    </span>
                    <span className="wp-hero-meta-val">{salonInfo.name}</span>
                  </div>
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>💼</span> Status
                    </span>
                    <span className="wp-hero-meta-val">{stylistMeta.employmentStatus}</span>
                  </div>
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>⭐</span> Client Rating
                    </span>
                    <span className="wp-hero-meta-val">{stylistMeta.rating}</span>
                  </div>
                  <div className="wp-hero-meta-item">
                    <span className="wp-hero-meta-label">
                      <span>📅</span> Total Bookings
                    </span>
                    <span className="wp-hero-meta-val">{stylistMeta.assignedBookingsCount} Completed</span>
                  </div>
                </div>
              </div>
            </aside>

            
            <div>
              <div className="wp-card">
                <div className="wp-card-header">
                  <h2 className="wp-card-title">
                    <span>👤</span> Personal &amp; Professional Details
                  </h2>
                  <span className="wp-card-badge">Profile</span>
                </div>

                {profileSuccessMsg && (
                  <div className="wp-alert-success">
                    <span>✓</span>
                    <span>{profileSuccessMsg}</span>
                  </div>
                )}

                {profileErrorMsg && (
                  <div className="wp-alert-error">
                    <span>⚠️</span>
                    <span>{profileErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleProfileSubmit}>
                  <div className="wp-form-grid">
                    <div className="wp-form-group">
                      <label htmlFor="first_name_input" className="wp-label">
                        <span>First Name *</span>
                      </label>
                      <input
                        id="first_name_input"
                        name="first_name"
                        type="text"
                        className={`wp-input ${formErrors.first_name ? "error" : ""}`}
                        value={formData.first_name}
                        onChange={handleProfileChange}
                        placeholder="e.g. Arun"
                        required
                      />
                      {formErrors.first_name && (
                        <div className="wp-field-error">⚠️ {formErrors.first_name}</div>
                      )}
                    </div>

                    <div className="wp-form-group">
                      <label htmlFor="last_name_input" className="wp-label">
                        <span>Last Name</span>
                      </label>
                      <input
                        id="last_name_input"
                        name="last_name"
                        type="text"
                        className={`wp-input ${formErrors.last_name ? "error" : ""}`}
                        value={formData.last_name}
                        onChange={handleProfileChange}
                        placeholder="e.g. Kumar"
                      />
                      {formErrors.last_name && (
                        <div className="wp-field-error">⚠️ {formErrors.last_name}</div>
                      )}
                    </div>

                    <div className="wp-form-group">
                      <label htmlFor="email_input" className="wp-label">
                        <span>Email Address</span>
                        <span style={{ fontSize: "0.72rem", color: "#166534" }}>✓ Verified</span>
                      </label>
                      <input
                        id="email_input"
                        name="email"
                        type="email"
                        className="wp-input"
                        value={formData.email}
                        disabled
                        title="Registered email address cannot be changed."
                      />
                      <span className="wp-field-hint">Used for official account notifications.</span>
                    </div>

                    
                    <div className="wp-form-group">
                      <label htmlFor="phone_input" className="wp-label">
                        <span>Mobile Number *</span>
                      </label>
                      <input
                        id="phone_input"
                        name="phone_number"
                        type="tel"
                        className={`wp-input ${formErrors.phone_number ? "error" : ""}`}
                        value={formData.phone_number}
                        onChange={handleProfileChange}
                        placeholder="e.g. 9845012345"
                        required
                      />
                      {formErrors.phone_number ? (
                        <div className="wp-field-error">⚠️ {formErrors.phone_number}</div>
                      ) : (
                        <span className="wp-field-hint">10-digit Indian mobile number.</span>
                      )}
                    </div>

                    
                    <div className="wp-form-group">
                      <label htmlFor="specialization_input" className="wp-label">
                        <span>Specialization *</span>
                      </label>
                      <input
                        id="specialization_input"
                        name="specialization"
                        type="text"
                        className={`wp-input ${formErrors.specialization ? "error" : ""}`}
                        value={formData.specialization}
                        onChange={handleProfileChange}
                        placeholder="e.g. Senior Hair Stylist &amp; Colorist"
                        required
                      />
                      {formErrors.specialization && (
                        <div className="wp-field-error">⚠️ {formErrors.specialization}</div>
                      )}
                    </div>

                    
                    <div className="wp-form-group">
                      <label htmlFor="experience_input" className="wp-label">
                        <span>Experience</span>
                      </label>
                      <input
                        id="experience_input"
                        name="experience"
                        type="text"
                        className={`wp-input ${formErrors.experience ? "error" : ""}`}
                        value={formData.experience}
                        onChange={handleProfileChange}
                        placeholder="e.g. 5+ Years"
                      />
                      {formErrors.experience && (
                        <div className="wp-field-error">⚠️ {formErrors.experience}</div>
                      )}
                    </div>

                    
                    <div className="wp-form-group full-width">
                      <label htmlFor="bio_input" className="wp-label">
                        <span>Professional Bio / Notes</span>
                        <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          {formData.bio.length} / 500
                        </span>
                      </label>
                      <textarea
                        id="bio_input"
                        name="bio"
                        rows={3}
                        className={`wp-textarea ${formErrors.bio ? "error" : ""}`}
                        value={formData.bio}
                        onChange={handleProfileChange}
                        placeholder="Brief summary of your expertise, styling philosophy, and certifications..."
                      />
                      {formErrors.bio && (
                        <div className="wp-field-error">⚠️ {formErrors.bio}</div>
                      )}
                    </div>
                  </div>

                  <div className="wp-actions-row">
                    <button
                      type="submit"
                      className="btn-wp-save"
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Saving Profile..." : "Save Profile Details"}
                    </button>
                  </div>
                </form>
              </div>

              
              <div className="wp-card">
                <div className="wp-card-header">
                  <h2 className="wp-card-title">
                    <span>🔒</span> Security &amp; Password Reset
                  </h2>
                  <span className="wp-card-badge">Password</span>
                </div>

                {passwordSuccessMsg && (
                  <div className="wp-alert-success">
                    <span>✓</span>
                    <span>{passwordSuccessMsg}</span>
                  </div>
                )}

                {passwordErrorMsg && (
                  <div className="wp-alert-error">
                    <span>⚠️</span>
                    <span>{passwordErrorMsg}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit}>
                  <div className="wp-form-grid">
                    
                    <div className="wp-form-group full-width">
                      <label htmlFor="current_password_input" className="wp-label">
                        <span>Current Password *</span>
                      </label>
                      <div className="wp-password-wrap">
                        <input
                          id="current_password_input"
                          name="current_password"
                          type={showCurrentPassword ? "text" : "password"}
                          className={`wp-input ${passwordErrors.current_password ? "error" : ""}`}
                          value={passwordData.current_password}
                          onChange={handlePasswordChange}
                          placeholder="Enter your current password"
                          required
                        />
                        <button
                          type="button"
                          className="wp-eye-btn"
                          onClick={() => setShowCurrentPassword((prev) => !prev)}
                          title={showCurrentPassword ? "Hide password" : "Show password"}
                        >
                          {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                      {passwordErrors.current_password && (
                        <div className="wp-field-error">⚠️ {passwordErrors.current_password}</div>
                      )}
                    </div>

                    
                    <div className="wp-form-group">
                      <label htmlFor="new_password_input" className="wp-label">
                        <span>New Password *</span>
                      </label>
                      <div className="wp-password-wrap">
                        <input
                          id="new_password_input"
                          name="new_password"
                          type={showNewPassword ? "text" : "password"}
                          className={`wp-input ${passwordErrors.new_password ? "error" : ""}`}
                          value={passwordData.new_password}
                          onChange={handlePasswordChange}
                          placeholder="Enter new strong password"
                          required
                        />
                        <button
                          type="button"
                          className="wp-eye-btn"
                          onClick={() => setShowNewPassword((prev) => !prev)}
                          title={showNewPassword ? "Hide password" : "Show password"}
                        >
                          {showNewPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                      {passwordErrors.new_password && (
                        <div className="wp-field-error">⚠️ {passwordErrors.new_password}</div>
                      )}
                    </div>

                    
                    <div className="wp-form-group">
                      <label htmlFor="confirm_password_input" className="wp-label">
                        <span>Confirm New Password *</span>
                      </label>
                      <div className="wp-password-wrap">
                        <input
                          id="confirm_password_input"
                          name="confirm_password"
                          type={showConfirmPassword ? "text" : "password"}
                          className={`wp-input ${passwordErrors.confirm_password ? "error" : ""}`}
                          value={passwordData.confirm_password}
                          onChange={handlePasswordChange}
                          placeholder="Re-enter new password"
                          required
                        />
                        <button
                          type="button"
                          className="wp-eye-btn"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          title={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                        </button>
                      </div>
                      {passwordErrors.confirm_password && (
                        <div className="wp-field-error">⚠️ {passwordErrors.confirm_password}</div>
                      )}
                    </div>
                  </div>

                  
                  <div className="wp-password-rules-box">
                    <div className="wp-password-rules-title">Password Requirements</div>
                    <div className="wp-password-rules-grid">
                      <div className={`wp-rule-item ${passwordRules.length ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.length ? "✓" : "○"}</span>
                        <span>At least 8 characters</span>
                      </div>
                      <div className={`wp-rule-item ${passwordRules.upper && passwordRules.lower ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.upper && passwordRules.lower ? "✓" : "○"}</span>
                        <span>Uppercase &amp; lowercase letters</span>
                      </div>
                      <div className={`wp-rule-item ${passwordRules.number ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.number ? "✓" : "○"}</span>
                        <span>At least one number (0-9)</span>
                      </div>
                      <div className={`wp-rule-item ${passwordRules.special ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.special ? "✓" : "○"}</span>
                        <span>At least one symbol (!@#$%^&amp;*)</span>
                      </div>
                      <div className={`wp-rule-item ${passwordRules.different ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.different ? "✓" : "○"}</span>
                        <span>Different from current password</span>
                      </div>
                      <div className={`wp-rule-item ${passwordRules.match ? "valid" : ""}`}>
                        <span className="wp-rule-icon">{passwordRules.match ? "✓" : "○"}</span>
                        <span>New passwords match</span>
                      </div>
                    </div>
                  </div>

                  <div className="wp-actions-row">
                    <button
                      type="submit"
                      className="btn-wp-reset-pw"
                      disabled={resettingPassword}
                    >
                      {resettingPassword ? "Updating Password..." : "Reset Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      
      {toastMessage && (
        <div className="wp-toast">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

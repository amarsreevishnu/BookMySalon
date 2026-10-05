import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "../../styles/ownerBanner.css";

/**
 * Reusable Owner Salon Dashboard Banner Component
 * Displays live salon operations badge, greeting, date, highlighted salon name, and quick actions.
 * Works seamlessly across OwnerDashboard, OwnerServices, OwnerWorkerLeaves, etc.
 */
export default function OwnerBanner({
  salonInfo,
  greeting,
  formattedToday,
  title,
  onResetPassword,
  onManageProfile,
  extraActions,
  showActions = true,
  showManageProfile = true,
  showResetPassword = true,
}) {
  const navigate = useNavigate();

  // Dynamic Salon Info Fallback Fetching
  const [fetchedSalon, setFetchedSalon] = useState(null);

  useEffect(() => {
    if (!salonInfo || !salonInfo.name) {
      let isMounted = true;
      api
        .get("/salons/owner/dashboard/")
        .then((res) => {
          if (isMounted && res.data?.salon_info) {
            setFetchedSalon(res.data.salon_info);
          }
        })
        .catch(() => {
          // Graceful fallback to default
        });
      return () => {
        isMounted = false;
      };
    }
  }, [salonInfo]);

  const activeSalon = useMemo(() => {
    if (salonInfo?.name) return salonInfo;
    if (fetchedSalon?.name) return fetchedSalon;
    return {
      name: "Salon",
      city: "",
      address: "",
      category: "",
    };
  }, [salonInfo, fetchedSalon]);

  // Dynamic Greeting based on current time
  const currentGreeting = useMemo(() => {
    if (greeting) return greeting;
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning 👋";
    if (hour < 17) return "Good Afternoon 👋";
    return "Good Evening 👋";
  }, [greeting]);

  // Formatted date (e.g. "Today, 5 Oct")
  const currentFormattedDate = useMemo(() => {
    if (formattedToday) return formattedToday;
    const d = new Date();
    const day = d.getDate();
    const month = d.toLocaleString("default", { month: "short" });
    return `Today, ${day} ${month}`;
  }, [formattedToday]);

  // Built-in Reset Password Modal State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const resetModalFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleOpenResetModal = () => {
    if (onResetPassword) {
      onResetPassword();
    } else {
      resetModalFields();
      setIsResetModalOpen(true);
    }
  };

  const handleCloseResetModal = () => {
    resetModalFields();
    setIsResetModalOpen(false);
  };

  const handleManageProfileClick = () => {
    if (onManageProfile) {
      onManageProfile();
    } else {
      navigate("/owner/salon-profile");
    }
  };

  const handlePasswordSubmit = async (e) => {
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

      setPasswordSuccess(
        res.data?.message || "Password updated successfully using current password."
      );
      setTimeout(() => {
        handleCloseResetModal();
      }, 1800);
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

  return (
    <>
      <div className="owner-banner-card">
        <div className="owner-banner-left">
          {/* Top Meta: Live Status Badge + Date & Greeting */}
          <div className="owner-banner-meta-bar">
            <div className="owner-banner-live-badge">
              <span className="owner-banner-pulse-dot" />
              <span>Salon Open • Live Operations</span>
            </div>

            <div className="owner-banner-time-info">
              <span>{currentGreeting}</span>
              <span className="owner-banner-dot-separator">•</span>
              <span>{currentFormattedDate}</span>
            </div>
          </div>

          {/* Main Title with Styled Salon Name */}
          <h1 className="owner-banner-title">
            {title ? (
              title
            ) : (
              <>
                <span>Welcome to</span>
                <span className="owner-banner-salon-highlight">{activeSalon.name}</span>
                <span>Dashboard</span>
              </>
            )}
          </h1>

          {/* Salon Location / Category details if available */}
          {(activeSalon.city || activeSalon.address || activeSalon.category) && (
            <div className="owner-banner-details-row">
              {activeSalon.address && (
                <span className="owner-banner-detail-item">
                  📍 {activeSalon.address}
                  {activeSalon.city ? `, ${activeSalon.city}` : ""}
                </span>
              )}
              {!activeSalon.address && activeSalon.city && (
                <span className="owner-banner-detail-item">
                  📍 {activeSalon.city}
                </span>
              )}
              {activeSalon.category && (
                <>
                  <span className="owner-banner-dot-separator">•</span>
                  <span className="owner-banner-detail-item">
                    🏷️ {activeSalon.category}
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right Actions */}
        {showActions && (
          <div className="owner-banner-actions">
            {extraActions}

            {showManageProfile && (
              <button
                type="button"
                className="btn-owner-banner-action profile"
                onClick={handleManageProfileClick}
                title="Edit salon profile, media gallery, hours, amenities"
              >
                <span>⚙️</span>
                <span>Manage Salon Profile</span>
              </button>
            )}

            {showResetPassword && (
              <button
                type="button"
                className="btn-owner-banner-action password"
                onClick={handleOpenResetModal}
                title="Reset your password using current password"
              >
                <span>🔑</span>
                <span>Reset Password</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Built-in Reset Password Modal */}
      {isResetModalOpen && (
        <div
          className="ob-modal-overlay"
          onClick={() => !passwordLoading && handleCloseResetModal()}
        >
          <div className="ob-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="ob-modal-header">
              <h3 className="ob-modal-title">
                <span>🔑</span>
                <span>Reset Password</span>
              </h3>
              <button
                type="button"
                className="ob-modal-close"
                onClick={() => !passwordLoading && handleCloseResetModal()}
                disabled={passwordLoading}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="ob-modal-body">
                {passwordError && (
                  <div className="ob-alert-error">
                    ⚠️ {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className="ob-alert-success">
                    ✓ {passwordSuccess}
                  </div>
                )}

                {/* Current Password */}
                <div className="ob-form-group">
                  <label className="ob-form-label">Current Password *</label>
                  <div className="ob-password-input-wrap">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      className="ob-form-input"
                      placeholder="Enter your current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      className="ob-toggle-eye"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* New Password */}
                <div className="ob-form-group">
                  <label className="ob-form-label">New Password *</label>
                  <div className="ob-password-input-wrap">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      className="ob-form-input"
                      placeholder="Enter new password (min. 8 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="ob-toggle-eye"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Confirm New Password */}
                <div className="ob-form-group">
                  <label className="ob-form-label">Confirm New Password *</label>
                  <div className="ob-password-input-wrap">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      className="ob-form-input"
                      placeholder="Re-enter your new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="ob-toggle-eye"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                </div>

                {/* Requirements Checklist */}
                <div className="ob-checklist">
                  <div className="ob-checklist-title">Security Checklist</div>
                  <div className={`ob-checklist-item ${newPassword.length >= 8 ? "valid" : ""}`}>
                    <span>{newPassword.length >= 8 ? "✓" : "○"}</span>
                    <span>At least 8 characters long</span>
                  </div>
                  <div
                    className={`ob-checklist-item ${
                      newPassword && currentPassword && newPassword !== currentPassword ? "valid" : ""
                    }`}
                  >
                    <span>
                      {newPassword && currentPassword && newPassword !== currentPassword ? "✓" : "○"}
                    </span>
                    <span>Must differ from current password</span>
                  </div>
                  <div
                    className={`ob-checklist-item ${
                      confirmPassword && newPassword === confirmPassword ? "valid" : ""
                    }`}
                  >
                    <span>{confirmPassword && newPassword === confirmPassword ? "✓" : "○"}</span>
                    <span>New passwords match</span>
                  </div>
                </div>
              </div>

              <div className="ob-modal-footer">
                <button
                  type="button"
                  className="btn-ob-cancel"
                  onClick={handleCloseResetModal}
                  disabled={passwordLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-ob-submit"
                  disabled={passwordLoading}
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
    </>
  );
}

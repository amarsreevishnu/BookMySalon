import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { useAuth } from "../../hooks/useAuth";
import OwnerNavbar from "../../components/owner/OwnerNavbar";
import OwnerNavbarHeader from "../../components/owner/OwnerNavbarHeader";
import OwnerStickyFooter from "../../components/owner/OwnerStickyFooter";
import { resolveImageUrl } from "../../utils/imageUtils";
import "../../styles/ownerDashboard.css";

export default function OwnerSettings() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();

  const [salonInfo, setSalonInfo] = useState({
    id: null,
    name: "Salon Studio",
    city: "",
    owner_profile_photo: "",
  });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchSalonData = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
        const res = await api.get("/salons/owner/dashboard/", config);
        if (res.data?.salon_info && isMounted) {
          setSalonInfo(res.data.salon_info);
        }
      } catch (err) {
        console.error("Failed to load salon info in settings:", err);
      }
    };
    fetchSalonData();
    return () => {
      isMounted = false;
    };
  }, []);

  const resetPasswordFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
    setPasswordSuccess("");
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("New password must differ from current password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      const res = await api.post("/accounts/owner/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      const successMsg = res.data?.message || "Password updated successfully.";
      setPasswordSuccess(successMsg);
      showToast("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (user?.must_change_password) {
        updateUser({ ...user, must_change_password: false });
      }

      setTimeout(() => {
        setPasswordSuccess("");
      }, 3500);
    } catch (err) {
      console.error("Change password error:", err);
      setPasswordError(err.response?.data?.error || err.response?.data?.detail || "Failed to update password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const ownerImg =
    salonInfo?.owner_profile_photo ||
    user?.profile_photo ||
    user?.profile_image ||
    user?.avatar;
  const initial = (user?.first_name || user?.email || "O").charAt(0).toUpperCase();
  const managerName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : "Salon Owner";

  return (
    <div className="studio-app-shell">
      <OwnerNavbarHeader salonInfo={salonInfo} />
      <OwnerNavbar activeTab="Settings" />

      <main className="studio-main-body">
        <div className="studio-settings-container">
          <div className="studio-settings-header">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h1 className="studio-settings-title">Settings &amp; Account Security</h1>
                <p className="studio-settings-sub">
                  Manage your Salon Owner security credentials, manager profile and reset your password.
                </p>
              </div>
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => navigate("/owner/dashboard")}
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          <div className="studio-settings-grid">
            {/* Salon Manager Profile Card */}
            <div className="studio-settings-card">
              <div className="studio-settings-card-header">
                <h3 className="studio-settings-card-title">
                  <span>👤</span> Salon Manager Profile
                </h3>
                <span className="role-badge">OWNER</span>
              </div>
              <div className="studio-settings-card-body">
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    marginBottom: 18,
                    paddingBottom: 16,
                    borderBottom: "1px solid var(--studio-border-subtle, #e2ece5)",
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#edf6f2",
                      border: "2.5px solid #2d6a4f",
                      boxShadow: "0 2px 8px rgba(15, 57, 43, 0.12)",
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {ownerImg ? (
                      <img
                        src={resolveImageUrl(ownerImg)}
                        alt={managerName}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <span style={{ fontSize: 24, fontWeight: 800, color: "#166534" }}>
                        {initial}
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 700,
                        color: "var(--studio-text-dark, #172a1e)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {managerName}
                    </h4>
                    <p
                      style={{
                        margin: "2px 0 6px",
                        fontSize: 12,
                        color: "var(--studio-text-muted, #64756c)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {salonInfo?.name || "Salon Enterprise"}
                    </p>
                    <span
                      style={{
                        display: "inline-block",
                        background: "rgba(45, 106, 79, 0.1)",
                        color: "#2d6a4f",
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 12,
                        letterSpacing: 0.3,
                      }}
                    >
                      ★ Verified Owner
                    </span>
                  </div>
                </div>

                <div className="settings-meta-item">
                  <span className="settings-meta-label">Manager Name</span>
                  <span className="settings-meta-value">{managerName}</span>
                </div>
                <div className="settings-meta-item">
                  <span className="settings-meta-label">Email</span>
                  <span className="settings-meta-value">{user?.email || "owner@bookmysalon.com"}</span>
                </div>
                <div className="settings-meta-item">
                  <span className="settings-meta-label">Salon</span>
                  <span className="settings-meta-value">{salonInfo?.name || "Salon Studio"}</span>
                </div>
                <div className="settings-meta-item">
                  <span className="settings-meta-label">Outlet</span>
                  <span className="settings-meta-value">{salonInfo?.city || "Registered City"}</span>
                </div>
                <div className="settings-meta-item">
                  <span className="settings-meta-label">Role</span>
                  <span className="settings-meta-value" style={{ color: "var(--studio-positive, #166534)" }}>
                    Master Administrator
                  </span>
                </div>

                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--studio-border-subtle, #e2ece5)" }}>
                  <p style={{ fontSize: 12, color: "var(--studio-text-muted, #64756c)", margin: "0 0 12px", lineHeight: 1.5 }}>
                    Salon Registration, license documents and gallery updates are managed in Salon Profile Management.
                  </p>
                  <Link
                    to="/owner/salon-profile"
                    className="btn-modal-cancel"
                    style={{ width: "100%", justifyContent: "center", display: "flex", gap: 6, textDecoration: "none", boxSizing: "border-box" }}
                  >
                    <span>⚙️</span> Manage Salon Profile &amp; Documents
                  </Link>
                </div>
              </div>
            </div>

            {/* Reset Password Card */}
            <div className="studio-settings-card">
              <div className="studio-settings-card-header">
                <h3 className="studio-settings-card-title">
                  <span>🔑</span> Reset Password
                </h3>
                <span style={{ fontSize: 11, color: "var(--studio-text-subtle, #829489)", fontWeight: 600 }}>
                  Requires Current Password
                </span>
              </div>
              <div className="studio-settings-card-body">
                <form onSubmit={handleResetPasswordSubmit}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                          onClick={() => setShowCurrentPassword((p) => !p)}
                        >
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
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewPassword((p) => !p)}
                        >
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
                          required
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword((p) => !p)}
                        >
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
                      >
                        {passwordLoading ? "Updating…" : "✓ Update Password"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      {toastMessage && (
        <div
          className="studio-toast"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#1e392a",
            color: "#ffffff",
            padding: "12px 20px",
            borderRadius: 10,
            boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            zIndex: 9999,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          {toastMessage}
        </div>
      )}

      <OwnerStickyFooter salonInfo={salonInfo} />
    </div>
  );
}

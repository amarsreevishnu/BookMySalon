import { useEffect } from "react";

export default function UserViewModal({ user, onClose, onToggleBlock, isProcessing }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!user) return null;

  const initial =
    user.first_name?.[0]?.toUpperCase() ||
    user.email?.[0]?.toUpperCase() ||
    "C";

  const joinedFormatted = user.date_joined
    ? new Date(user.date_joined).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const lastLoginFormatted = user.last_login
    ? new Date(user.last_login).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never logged in";

  return (
    <div
      className="asl-modal-backdrop user-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Customer Profile Details"
    >
      <div
        className="asl-modal-panel user-modal-panel"
        style={{ maxWidth: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="asl-modal-header">
          <div className="asl-modal-header-left">
            <span style={{ fontSize: "22px" }}>👤</span>
            <div>
              <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#162a1d" }}>
                Customer Profile Details
              </h3>
              <span style={{ fontSize: "11px", color: "#6e8476" }}>
                Platform Identifier: #CUST-{user.id}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="asl-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="asl-modal-body">
          {/* User Hero Preview Card */}
          <div className="asl-modal-user-hero">
            <div className="asl-user-thumb-wrap" style={{ width: 64, height: 64 }}>
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.full_name || user.email}
                  className="asl-user-thumb"
                  style={{ width: 64, height: 64, fontSize: 24 }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="asl-user-thumb"
                style={{
                  width: 64,
                  height: 64,
                  fontSize: 24,
                  display: user.avatar ? "none" : "flex",
                }}
              >
                {initial}
              </div>
              <span
                className={user.is_active ? "asl-user-thumb-online" : "asl-user-thumb-blocked"}
                style={{ width: 14, height: 14, borderWidth: 3 }}
                title={user.is_active ? "Account Active" : "Account Blocked"}
              />
            </div>

            <div className="asl-modal-user-titles" style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "18px", color: "#172a1d" }}>
                {user.full_name || "Unnamed Customer"}
              </h3>
              <p
                style={{
                  margin: "0 0 10px 0",
                  fontSize: "13px",
                  color: "#546e5e",
                  wordBreak: "break-all",
                }}
              >
                {user.email}
              </p>
              <div className="asl-modal-badges-row">
                <span className="asl-badge-pill customer">Role: Customer</span>
                {user.is_active ? (
                  <span className="asl-badge-pill active">● Active</span>
                ) : (
                  <span className="asl-badge-pill blocked">● Blocked</span>
                )}
                <span
                  className="asl-badge-pill"
                  style={{ background: "#f0f5f1", color: "#2d543c" }}
                >
                  ✓ Verified Account
                </span>
              </div>
            </div>
          </div>

          {/* User Information Tiles */}
          <div className="asl-info-grid-2">
            <div className="asl-info-box">
              <div className="asl-info-box-label">Customer ID</div>
              <div className="asl-info-box-val">#CUST-{user.id}</div>
              <div className="asl-info-box-sub">Platform unique identifier</div>
            </div>

            <div className="asl-info-box">
              <div className="asl-info-box-label">Account Status</div>
              <div
                className="asl-info-box-val"
                style={{ color: user.is_active ? "#059669" : "#dc2626" }}
              >
                {user.is_active ? "Active & Authorized" : "Access Blocked / Suspended"}
              </div>
              <div className="asl-info-box-sub">
                {user.is_active ? "Can log in & book" : "Login access disabled"}
              </div>
            </div>

            <div className="asl-info-box">
              <div className="asl-info-box-label">First Name</div>
              <div className="asl-info-box-val">{user.first_name || "—"}</div>
              <div className="asl-info-box-sub">Given name</div>
            </div>

            <div className="asl-info-box">
              <div className="asl-info-box-label">Last Name</div>
              <div className="asl-info-box-val">{user.last_name || "—"}</div>
              <div className="asl-info-box-sub">Family name</div>
            </div>

            <div className="asl-info-box">
              <div className="asl-info-box-label">Registered On</div>
              <div className="asl-info-box-val">{joinedFormatted}</div>
              <div className="asl-info-box-sub">Account creation date</div>
            </div>

            <div className="asl-info-box">
              <div className="asl-info-box-label">Last Activity / Login</div>
              <div className="asl-info-box-val">{lastLoginFormatted}</div>
              <div className="asl-info-box-sub">Session authentication</div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="asl-modal-footer">
          <div className="asl-modal-footer-left">
            <span>Actions for {user.email}</span>
          </div>

          <div className="asl-modal-footer-actions">
            <button
              type="button"
              className="asl-btn-outline"
              onClick={onClose}
              disabled={isProcessing}
            >
              Close
            </button>

            {user.is_active ? (
              <button
                type="button"
                className="asl-btn-danger"
                disabled={isProcessing}
                onClick={() => onToggleBlock(user)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 8,
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>🚫</span>
                <span>{isProcessing ? "Blocking..." : "Block Customer"}</span>
              </button>
            ) : (
              <button
                type="button"
                className="asl-btn-primary"
                disabled={isProcessing}
                onClick={() => onToggleBlock(user)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "9px 16px",
                  borderRadius: 8,
                  background: "#059669",
                  color: "#ffffff",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                <span>🔓</span>
                <span>{isProcessing ? "Unblocking..." : "Unblock Customer"}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


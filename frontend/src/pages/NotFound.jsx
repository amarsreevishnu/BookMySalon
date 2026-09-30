import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getRoleDashboardPath } from "../utils/roleUtils";
import "../styles/notFound.css";

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();

  const dashboardPath = getRoleDashboardPath(user);

  const getRoleLabel = () => {
    if (!user?.role) return "Dashboard";
    switch (user.role) {
      case "OWNER":
        return "Owner Studio";
      case "WORKER":
        return "Worker Portal";
      case "ADMIN":
        return "Admin Console";
      default:
        return "Customer Dashboard";
    }
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isAuthenticated ? dashboardPath : "/");
    }
  };

  return (
    <div className="nf-wrapper">
      {/* --------------------------------------------------------------------
          TOP HEADER BRAND
          -------------------------------------------------------------------- */}
      <header className="nf-header">
        <Link to={isAuthenticated ? dashboardPath : "/"} className="nf-brand">
          <div className="nf-logo-crest">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <path d="M7 16V14" />
              <path d="M12 16V10" />
              <path d="M17 16V6" />
            </svg>
          </div>
          <div>
            <div className="nf-brand-name">BookMySalon</div>
            <div className="nf-brand-tag">LUXURY SALON NETWORK</div>
          </div>
        </Link>

        <div className="nf-header-links">
          {isAuthenticated ? (
            <Link to={dashboardPath} className="nf-header-link">
              Go to {getRoleLabel()} →
            </Link>
          ) : (
            <>
              <Link to="/login" className="nf-header-link">
                Sign In
              </Link>
              <Link to="/register" className="nf-header-link">
                Register
              </Link>
            </>
          )}
        </div>
      </header>

      {/* --------------------------------------------------------------------
          MAIN 404 CARD
          -------------------------------------------------------------------- */}
      <main className="nf-container">
        <div className="nf-card">
          {/* Badge */}
          <div className="nf-badge-pill">
            <span className="nf-badge-dot" />
            <span>ERROR 404 • PAGE NOT FOUND</span>
          </div>

          {/* Graphic 404 with salon icon */}
          <div className="nf-graphic-wrap">
            <h1 className="nf-digits">404</h1>
            <div className="nf-icon-overlay" title="Lost appointment or link">
              ✂️
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="nf-title">Looks Like You&apos;re Lost in Style</h2>
          <p className="nf-description">
            The page you are looking for{" "}
            <code
              style={{
                background: "#eef4f0",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "12.5px",
                color: "#1e392a",
                fontWeight: 600,
              }}
            >
              {location.pathname}
            </code>{" "}
            doesn&apos;t exist, has been relocated, or is temporarily
            unavailable.
          </p>

          {/* Action Buttons */}
          <div className="nf-actions">
            {isAuthenticated ? (
              <Link to={dashboardPath} className="nf-btn-primary">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>Back to {getRoleLabel()}</span>
              </Link>
            ) : (
              <Link to="/" className="nf-btn-primary">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span>Back to Home</span>
              </Link>
            )}

            <button
              type="button"
              className="nf-btn-secondary"
              onClick={handleGoBack}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span>Go Back</span>
            </button>
          </div>

          {/* Quick Helpful Shortcuts */}
          <div className="nf-shortcuts">
            <span className="nf-shortcuts-label">Helpful Navigation Shortcuts</span>
            <div className="nf-shortcuts-list">
              <Link to="/salons" className="nf-shortcut-chip">
                <span>📍</span>
                <span>Explore Salons</span>
              </Link>

              <Link to="/salon-application" className="nf-shortcut-chip">
                <span>💼</span>
                <span>Partner With Us</span>
              </Link>

              {!isAuthenticated && (
                <Link to="/login" className="nf-shortcut-chip">
                  <span>🔐</span>
                  <span>Sign In / Access Account</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --------------------------------------------------------------------
          FOOTER
          -------------------------------------------------------------------- */}
      <footer className="nf-footer">
        © {new Date().getFullYear()} BookMySalon Technologies. All rights reserved.
      </footer>
    </div>
  );
}

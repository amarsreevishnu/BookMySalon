import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { getRoleDashboardPath } from "../utils/roleUtils";
import "../styles/notFound.css";
import logo from "../assets/logo.png";

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
      {/* ===== Scoped animation styles ===== */}
      <style>{`
        /* ---------- STAGE ---------- */
        .nf-stage {
          position: relative;
          width: 100%;
          max-width: 520px;
          height: 300px;
          margin: 1.5rem auto 0.5rem;
          overflow: hidden;
          border-radius: 20px;
          background:
            radial-gradient(circle at 70% 20%, #f4fbf4 0%, transparent 55%),
            linear-gradient(160deg, #eef7ee 0%, #dcecdc 100%);
          box-shadow: inset 0 0 40px #b1d8b155;
          isolation: isolate;
        }

        /* faint "page grid" being searched */
        .nf-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(#c8e0c8 1px, transparent 1px),
            linear-gradient(90deg, #c8e0c8 1px, transparent 1px);
          background-size: 34px 34px;
          opacity: 0.45;
          animation: nf-grid-drift 18s linear infinite;
        }
        @keyframes nf-grid-drift {
          from { background-position: 0 0, 0 0; }
          to   { background-position: 34px 34px, 34px 34px; }
        }

        /* fake page skeleton blocks being scanned */
        .nf-skeleton {
          position: absolute;
          border-radius: 8px;
          background: linear-gradient(90deg, #cfe4cf, #e6f3e6, #cfe4cf);
          background-size: 200% 100%;
          opacity: 0.7;
          animation: nf-skel-shimmer 2.4s linear infinite;
        }
        .nf-skeleton.s1 { top: 34px; left: 32px; width: 120px; height: 14px; }
        .nf-skeleton.s2 { top: 60px; left: 32px; width: 200px; height: 10px; animation-delay: .2s; }
        .nf-skeleton.s3 { top: 84px; left: 32px; width: 160px; height: 10px; animation-delay: .4s; }
        .nf-skeleton.s4 { top: 130px; left: 32px; width: 90px; height: 90px; border-radius: 14px; animation-delay: .3s; }
        .nf-skeleton.s5 { top: 130px; left: 136px; width: 140px; height: 12px; animation-delay: .5s; }
        .nf-skeleton.s6 { top: 154px; left: 136px; width: 110px; height: 10px; animation-delay: .7s; }
        .nf-skeleton.s7 { top: 178px; left: 136px; width: 130px; height: 10px; animation-delay: .9s; }
        @keyframes nf-skel-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ---------- MAGNIFYING GLASS ---------- */
        .nf-search {
          position: absolute;
          z-index: 5;
          width: 96px;
          height: 96px;
          left: 0;
          top: 0;
          pointer-events: none;
          animation: nf-scan 6s ease-in-out infinite;
          filter: drop-shadow(0 10px 18px #2b5e2b44);
        }

        /* the glass lens */
        .nf-lens {
          position: absolute;
          inset: 0 14px 14px 0;
          width: 74px;
          height: 74px;
          border-radius: 50%;
          border: 6px solid #2f6e30;
          background:
            radial-gradient(circle at 30% 25%, #ffffffcc, #d9efd9aa 45%, #b1d8b1aa 100%);
          box-shadow:
            inset 0 0 14px #ffffffcc,
            inset 0 0 4px #7fb07f,
            0 4px 12px #2b5e2b55;
          overflow: hidden;
        }
        /* glass glare */
        .nf-lens::after {
          content: "";
          position: absolute;
          top: 8px;
          left: 12px;
          width: 22px;
          height: 12px;
          border-radius: 50%;
          background: #ffffffcc;
          transform: rotate(-28deg);
        }
        /* tiny magnified "missing" indicator inside lens */
        .nf-lens::before {
          content: "?";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -54%);
          font-size: 1.7rem;
          font-weight: 800;
          color: #3e7a3e;
          opacity: 0.55;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        /* handle */
        .nf-handle {
          position: absolute;
          right: 6px;
          bottom: 4px;
          width: 30px;
          height: 12px;
          border-radius: 8px;
          background: linear-gradient(135deg, #7fb07f, #2f6e30);
          transform: rotate(45deg);
          box-shadow: inset 0 2px 3px #cfe4cf, 0 3px 8px #2b5e2b66;
        }

        /* the glass "scans" the page: wander, then shake "nothing found" */
        @keyframes nf-scan {
          0%   { left: 4%;   top: 8%;   transform: rotate(-8deg) scale(1); }
          15%  { left: 55%;  top: 6%;   transform: rotate(6deg) scale(1); }
          30%  { left: 62%;  top: 52%;  transform: rotate(-6deg) scale(1.02); }
          45%  { left: 12%;  top: 58%;  transform: rotate(8deg) scale(1); }
          55%  { left: 42%;  top: 34%;  transform: rotate(0deg) scale(1.06); }
          /* shake: "nothing found" */
          58%  { left: 40%;  top: 34%;  transform: rotate(-9deg) scale(1.06); }
          61%  { left: 44%;  top: 34%;  transform: rotate(9deg)  scale(1.06); }
          64%  { left: 40%;  top: 34%;  transform: rotate(-9deg) scale(1.06); }
          67%  { left: 44%;  top: 34%;  transform: rotate(9deg)  scale(1.06); }
          70%  { left: 42%;  top: 34%;  transform: rotate(0deg) scale(1.06); }
          /* settle down, out of frame */
          85%  { left: 42%;  top: 90%;  transform: rotate(14deg) scale(0.9); opacity: 1; }
          95%  { left: 42%;  top: 110%; transform: rotate(20deg) scale(0.8); opacity: 0; }
          96%  { left: 4%;   top: 8%;   transform: rotate(-8deg) scale(1); opacity: 0; }
          100% { left: 4%;   top: 8%;   transform: rotate(-8deg) scale(1); opacity: 1; }
        }

        /* ---------- REVEAL: "404 NOT FOUND" ---------- */
        .nf-reveal {
          position: absolute;
          inset: 0;
          z-index: 4;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          opacity: 0;
          animation: nf-reveal 6s ease-in-out infinite;
          text-align: center;
          padding: 1rem;
        }

        .nf-reveal-digits {
          font-size: clamp(3.4rem, 12vw, 5.4rem);
          font-weight: 900;
          letter-spacing: 4px;
          margin: 0;
          line-height: 1;
          background: linear-gradient(135deg, #2b6b2b, #7fb07f 55%, #459a45);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          text-shadow: 0 4px 20px #b1d8b166;
        }

        /* "NOT FOUND" stamp */
        .nf-stamp {
          display: inline-block;
          padding: 6px 16px;
          border: 2px dashed #3e7a3e;
          border-radius: 10px;
          color: #2f6e30;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 4px;
          text-transform: uppercase;
          background: #ffffffb3;
          transform: rotate(-4deg);
          animation: nf-stamp-press 6s ease-in-out infinite;
        }

        .nf-reveal-line {
          width: 0;
          height: 3px;
          border-radius: 3px;
          background: linear-gradient(90deg, transparent, #7fb07f, transparent);
          animation: nf-line 6s ease-in-out infinite;
        }

        @keyframes nf-reveal {
          0%, 62%   { opacity: 0; transform: scale(0.92); }
          70%, 88%  { opacity: 1; transform: scale(1); }
          93%, 100% { opacity: 0; transform: scale(1.02); }
        }
        @keyframes nf-stamp-press {
          0%, 64%   { transform: rotate(-4deg) scale(1.5); opacity: 0; }
          70%       { transform: rotate(-4deg) scale(0.94); opacity: 1; }
          74%       { transform: rotate(-4deg) scale(1.02); }
          78%, 90%  { transform: rotate(-4deg) scale(1); opacity: 1; }
          95%, 100% { opacity: 0; }
        }
        @keyframes nf-line {
          0%, 68%   { width: 0; opacity: 0; }
          74%, 88%  { width: 180px; opacity: 1; }
          93%, 100% { width: 0; opacity: 0; }
        }

        /* ---------- TITLE / DESC (below stage) ---------- */
        .nf-title { animation: nf-fade-up 0.7s 0.15s both; }
        .nf-description { animation: nf-fade-up 0.7s 0.3s both; }
        .nf-actions { animation: nf-fade-up 0.7s 0.45s both; }
        .nf-shortcuts { animation: nf-fade-up 0.7s 0.6s both; }
        @keyframes nf-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* badge dot pulse */
        .nf-badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #3e7a3e;
          display: inline-block;
          animation: nf-blink 1.4s infinite ease-in-out;
        }
        @keyframes nf-blink {
          0%, 80%, 100% { opacity: 0.35; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.25); }
        }

        @media (max-width: 420px) {
          .nf-stage { height: 240px; }
          .nf-search { width: 74px; height: 74px; }
          .nf-lens { width: 56px; height: 56px; border-width: 5px; }
          .nf-handle { width: 24px; height: 10px; }
          .nf-skeleton.s4 { height: 70px; width: 70px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .nf-grid, .nf-skeleton, .nf-search, .nf-lens::before,
          .nf-reveal, .nf-stamp, .nf-reveal-line, .nf-badge-dot,
          .nf-title, .nf-description, .nf-actions, .nf-shortcuts {
            animation: none !important;
          }
          .nf-reveal { opacity: 1; }
          .nf-search { display: none; }
        }
      `}</style>

      <header className="nf-header">
        <Link to={isAuthenticated ? dashboardPath : "/"} className="nf-brand">
          <div className="nf-logo-crest">
            <img src={logo} alt="BookMySalon Logo" />
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

      <main className="nf-container">
        <div className="nf-card">
          {/* Badge */}
          <div className="nf-badge-pill">
            <span className="nf-badge-dot" />
            <span>ERROR 404 • PAGE NOT FOUND</span>
          </div>

          {/* ===== ANIMATED SEARCH STAGE ===== */}
          <div className="nf-stage" role="img" aria-label="Searching for the page... Page not found">
            {/* searchable page backdrop */}
            <div className="nf-grid" />
            <div className="nf-skeleton s1" />
            <div className="nf-skeleton s2" />
            <div className="nf-skeleton s3" />
            <div className="nf-skeleton s4" />
            <div className="nf-skeleton s5" />
            <div className="nf-skeleton s6" />
            <div className="nf-skeleton s7" />

            {/* the reveal: 404 NOT FOUND */}
            <div className="nf-reveal">
              <h1 className="nf-reveal-digits">404</h1>
              <div className="nf-reveal-line" />
              <span className="nf-stamp">Not Found</span>
            </div>

            {/* the searching magnifying glass */}
            <div className="nf-search" aria-hidden="true">
              <div className="nf-lens" />
              <div className="nf-handle" />
            </div>
          </div>

          {/* Title & Description */}
          <h2 className="nf-title">Looks Like You&apos;re Lost in Style</h2>
          <p className="nf-description">
            We searched high and low, but{" "}
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
              <Link to="/customer/salons" className="nf-shortcut-chip">
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

      <footer className="nf-footer">
        © {new Date().getFullYear()} BookMySalon Technologies. All rights reserved.
      </footer>
    </div>
  );
}
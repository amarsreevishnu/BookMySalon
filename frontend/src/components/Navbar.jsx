import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleDashboardPath } from "../utils/roleUtils";

function Navbar() {
  const { token, user } = useAuth();
  const dashboardPath = getRoleDashboardPath(user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="navbar-wrapper">
      <div className="navbar">
        <Link to="/" className="brand">
            <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

        <nav className={`nav-links ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a>
          <a href="#salons" onClick={() => setMobileMenuOpen(false)}>Salons</a>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How It Works</a>
          <Link to="/salons" className="nav-explore-link" onClick={() => setMobileMenuOpen(false)}>
            Explore Salons
          </Link>
        </nav>

        <div className="nav-actions">
          {token ? (
            <Link to={dashboardPath} className="nav-button">
              {user?.role === "ADMIN" || user?.is_superuser
                ? "Admin Dashboard →"
                : user?.role === "OWNER"
                ? "Owner Dashboard →"
                : "My Dashboard →"}
            </Link>
          ) : (
            <>
              <Link to="/login" className="login-link">
                Log in
              </Link>

              <Link to="/register" className="nav-button">
                Sign up
              </Link>
            </>
          )}

          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
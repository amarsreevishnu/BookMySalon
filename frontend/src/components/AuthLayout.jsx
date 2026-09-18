import { Link } from "react-router-dom";
import "../styles/auth.css";

function AuthLayout({
  title,
  description,
  children,
  footerText,
  footerLinkText,
  footerLink,
}) {
  return (
    <div className="auth-page">
      <section className="auth-form-panel">
        <div className="auth-form-container">
          <Link to="/" className="auth-logo">
             <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

          <div className="auth-heading">
            <h1>{title}</h1>
            <p>{description}</p>
          </div>

          {children}

          <p className="auth-footer-text">
            {footerText}{" "}
            <Link to={footerLink}>{footerLinkText}</Link>
          </p>
        </div>
      </section>

      <section className="auth-image-panel">
        <div className="auth-image-overlay">
          <div className="auth-image-content">
            <div className="auth-image-pill-row">
              <span className="auth-image-pill">
                <span className="pill-star">★</span> 4.9 Rating • 2,500+ Verified Bookings
              </span>
            </div>

            <h2>
              Refined Wellness.
              <br />
              Effortless Beauty.
            </h2>

            <p>
              Discover curated botanical salons, certified clean rituals, and elite master stylists. Seamlessly reserve instant slots with guaranteed zero waiting time.
            </p>

            <div className="auth-image-features">
              <div className="auth-feature-item">
                <span className="feature-icon">🌿</span>
                <span className="feature-text">100% Non-Toxic & Botanical Products</span>
              </div>
              <div className="auth-feature-item">
                <span className="feature-icon">⚡</span>
                <span className="feature-text">Live Real-Time Instant Slot Booking</span>
              </div>
              <div className="auth-feature-item">
                <span className="feature-icon">👑</span>
                <span className="feature-text">Hand-Vetted & Certified Top Salons</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
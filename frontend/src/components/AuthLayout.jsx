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
      <div className="auth-card-container">
        {/* --------------------------------------------------------------------
            LEFT FORM PANEL (Matching Reference Model)
            -------------------------------------------------------------------- */}
        <section className="auth-form-panel">
          <div className="auth-top-bar">
            <Link to="/" className="auth-logo">
              <div className="explore-brand-icon">✂</div>
              <span className="explore-brand-name">BookMySalon</span>
            </Link>

            {/* Locale / Language selector matching reference image (english (uk) ▾) */}
            <div className="auth-locale-indicator" title="Language selection">
              <span>English (UK)</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <div className="auth-form-container">
            <div className="auth-heading">
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>

            {children}

            {footerText && (
              <p className="auth-footer-text">
                {footerText}{" "}
                <Link to={footerLink}>{footerLinkText}</Link>
              </p>
            )}
          </div>

          <div className="auth-bottom-spacer" />
        </section>

        {/* --------------------------------------------------------------------
            RIGHT SHOWCASE PANEL (Salon Image & Luxury Aesthetics)
            -------------------------------------------------------------------- */}
        <section className="auth-image-panel">
          <div className="auth-showcase-content">
            {/* Top Brand Emblem */}
            <div className="auth-showcase-brand">
              <div className="auth-showcase-emblem">
                <div className="emblem-core">✦</div>
              </div>
              <span className="auth-showcase-brand-tag">BOOKMYSALON EXPERIENCE</span>
            </div>

            {/* Headline matching reference style ("Getting Started With Salon Care") */}
            <h2 className="auth-showcase-headline">
              Getting Started With
              <span className="headline-highlight">Salon Care</span>
            </h2>
            <p className="auth-showcase-subhead">
              Discover verified master stylists, luxury sanctuaries, and organic wellness treatments tailored for you.
            </p>

            {/* Showcase Salon Photo Container with modern curved lens & floating badges */}
            <div className="auth-salon-showcase-frame">
              <div className="salon-image-wrapper">
                <img
                  src="https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1200&q=85"
                  alt="Luxury Salon Experience"
                  className="salon-showcase-img"
                />
                <div className="salon-image-gradient-overlay" />

                {/* Floating Rating Badge */}
                <div className="salon-floating-badge badge-top">
                  <span className="badge-star">★</span>
                  <div className="badge-text-group">
                    <span className="badge-title">4.9 / 5.0 Rating</span>
                    <span className="badge-subtitle">Verified Client Reviews</span>
                  </div>
                </div>

                {/* Floating Organic Wellness Badge */}
                <div className="salon-floating-badge badge-bottom">
                  <span className="badge-leaf">🌿</span>
                  <div className="badge-text-group">
                    <span className="badge-title">100% Organic Care</span>
                    <span className="badge-subtitle">Certified Master Stylists</span>
                  </div>
                </div>
              </div>

              {/* Decorative ambient glow */}
              <div className="showcase-ambient-glow" />
            </div>

            {/* Bottom trust statement */}
            <div className="auth-showcase-footer-trust">
              <div className="trust-avatars-row">
                <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=80&q=80" alt="Client" />
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=80&q=80" alt="Client" />
                <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=80&q=80" alt="Client" />
              </div>
              <span className="trust-stats-text">
                Joined by <strong>15,000+</strong> beauty and wellness enthusiasts
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AuthLayout;
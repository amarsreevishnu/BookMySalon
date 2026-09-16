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
            <span className="auth-logo-icon">✂</span>
            <span>BookMySalon</span>
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
            <span className="auth-image-label">
              BOOKMYSALON EXPERIENCE
            </span>

            <h2>
              Book Better.
              <br />
              Succeed Together.
            </h2>

            <p>
              Discover curated sanctuary treatments and elite stylists.
              Seamlessly manage appointments, elevate your self-care
              routine, and join a community dedicated to refined wellness.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthLayout;
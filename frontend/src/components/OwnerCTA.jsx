import { Link } from "react-router-dom";

function OwnerCTA() {
  return (
    <section className="section-container">
      <div className="owner-cta interactive-owner-cta">
        <div className="owner-cta-left">
          <span className="eyebrow owner-pill">👑 PARTNER WITH BOOKMYSALON</span>

          <h2>Grow & Automate Your Salon Business</h2>

          <p>
            Join the premier botanical salon network. Fill empty afternoon slots with instant bookings, accept seamless payments, and delight repeat clients.
          </p>

          <div className="owner-perks-list">
            <div className="owner-perk">
              <span className="owner-perk-check">✓</span>
              <span>0% Platform Commission for First 30 Days</span>
            </div>
            <div className="owner-perk">
              <span className="owner-perk-check">✓</span>
              <span>Automated WhatsApp & SMS Appointment Reminders</span>
            </div>
            <div className="owner-perk">
              <span className="owner-perk-check">✓</span>
              <span>Live Walk-In & Stylist Station Manager</span>
            </div>
          </div>
        </div>

        <div className="owner-cta-right">
          <div className="owner-card-preview">
            <div className="preview-stat-pill">
              <span className="stat-num">+42%</span>
              <span className="stat-desc">Average Client Retention</span>
            </div>
            <Link to="/salon-application" className="owner-cta-btn">
              <span>Create Your Salon</span>
              <span>→</span>
            </Link>
            <span className="owner-guarantee-note">⚡ Fast onboarding in under 5 minutes</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default OwnerCTA;
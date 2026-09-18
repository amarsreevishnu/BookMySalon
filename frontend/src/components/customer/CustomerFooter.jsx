import { Link } from "react-router-dom";

function CustomerFooter() {
  return (
    <footer className="customer-footer">
      <div className="customer-footer-brand">
        <Link to="/customer-home" className="explore-brand-group">
            <div className="explore-brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="explore-brand-name">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>

        <p>
          Your trusted destination for effortless beauty, wellness,
          and salon experiences.
        </p>
      </div>

      <div className="footer-links-column">
        <h4>Explore</h4>
        <Link to="/salons">Find Salons</Link>
        <Link to="/services">Explore Treatments</Link>
        <Link to="/offers">Today's Offers</Link>
      </div>

      <div className="footer-links-column">
        <h4>Account</h4>
        <Link to="/bookings">My Appointments</Link>
        <Link to="/saved-salons">Saved Salons</Link>
        <Link to="/profile">Preferences</Link>
      </div>

      <div className="footer-links-column">
        <h4>Privacy</h4>
        <Link to="/privacy">Privacy Policy</Link>
        <Link to="/terms">Terms of Service</Link>
        <Link to="/contact">Contact Us</Link>
      </div>

      <div className="customer-footer-bottom">
        <span>© 2026 BookMySalon. All rights reserved.</span>
        <span>Made for better beauty experiences.</span>
      </div>
    </footer>
  );
}

export default CustomerFooter;
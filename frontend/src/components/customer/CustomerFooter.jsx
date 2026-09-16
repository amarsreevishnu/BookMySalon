import { Link } from "react-router-dom";

function CustomerFooter() {
  return (
    <footer className="customer-footer">
      <div className="customer-footer-brand">
        <Link to="/customer-home" className="customer-brand">
          <span className="customer-brand-icon">✂</span>

          <div>
            <strong>BookMySalon</strong>
            <small>BEAUTY & WELLNESS</small>
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
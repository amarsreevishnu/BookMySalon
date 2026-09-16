import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          <Link to="/" className="brand footer-logo">
            <span className="brand-icon">✂</span>
            <span>BookMySalon</span>
          </Link>

          <p>
            Discover beauty, find trusted salons, and book your next
            appointment with confidence.
          </p>
        </div>

        <div className="footer-column">
          <h4>Quick links</h4>
          <a href="#services">Services</a>
          <a href="#salons">Salons</a>
          <a href="#how-it-works">How it works</a>
        </div>

        <div className="footer-column">
          <h4>Support</h4>
          <a href="#contact">Contact us</a>
          <a href="#help">Help center</a>
          <a href="#privacy">Privacy policy</a>
        </div>

        <div className="footer-column">
          <h4>For business</h4>
          <Link to="/register">List your salon</Link>
          <Link to="/login">Owner login</Link>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 BookMySalon. All rights reserved.</p>
        <p>Made for better salon experiences.</p>
      </div>
    </footer>
  );
}

export default Footer;
import { useState } from "react";
import { Link } from "react-router-dom";

function Footer() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (email.trim()) {
      setSubscribed(true);
      setEmail("");
      setTimeout(() => setSubscribed(false), 4000);
    }
  };

  return (
    <footer className="footer">
      <div className="footer-top">
        <div className="footer-brand">
          
          <Link to="/" className="brand footer-logo">
            <div  className="brand-icon">✂</div>
            <div className="explore-brand-titles">
              <span className="brand-text">BookMySalon</span>
              <span className="explore-brand-sub">ORGANIC WELLNESS</span>
            </div>
          </Link>
          <p>
            Discover certified organic salons, book instant slots with zero wait time, and elevate your wellness routine with confidence.
          </p>

          {/* Interactive Newsletter Form */}
          <form className="footer-newsletter-form" onSubmit={handleSubscribe}>
            <span className="newsletter-title">Subscribe for exclusive wellness offers</span>
            <div className="newsletter-input-group">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
              <button type="submit" className="newsletter-btn">
                Subscribe
              </button>
            </div>
            {subscribed && (
              <span className="newsletter-success">
                ✓ Welcome! You will receive our exclusive subscriber perks.
              </span>
            )}
          </form>
        </div>

        <div className="footer-column">
          <h4>Explore</h4>
          <a href="#services">Services</a>
          <a href="#salons">Top Salons</a>
          <a href="#how-it-works">How It Works</a>
          <Link to="/salons">Browse All Salons</Link>
        </div>

        <div className="footer-column">
          <h4>Experience</h4>
          <Link to="/salons?category=Hair">Hair & Styling</Link>
          <Link to="/salons?category=Spa">Ayurvedic Spa</Link>
          <Link to="/salons?category=Facial">Botanical Facial</Link>
          <Link to="/salons?category=Nails">Nail Studio</Link>
        </div>

        <div className="footer-column">
          <h4>For Business</h4>
          <Link to="/salon-application">List Your Salon</Link>
          <Link to="/login">Partner Login</Link>
          <Link to="/register">Create Account</Link>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© 2026 BookMySalon Inc. All rights reserved. • Clean Luxury & Botanical Wellness</p>
        <p>Made with care for refined salon experiences.</p>
      </div>
    </footer>
  );
}

export default Footer;
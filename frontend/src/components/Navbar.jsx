import { Link } from "react-router-dom";

function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="brand">
        <span className="brand-icon">✂</span>
        <span>BookMySalon</span>
      </Link>

      <nav className="nav-links">
        <a href="#services">Services</a>
        <a href="#salons">Salons</a>
        <a href="#how-it-works">How it works</a>
      </nav>

      <div className="nav-actions">
        <Link to="/login/" className="login-link">
          Login
        </Link>

        <Link to="/register" className="primary-button small-button">
          Sign up
        </Link>
      </div>
    </header>
  );
}

export default Navbar;
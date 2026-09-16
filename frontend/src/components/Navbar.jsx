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
        <a href="#how-it-works">How It Works</a>
      </nav>

      <div className="nav-actions">
        <Link to="/login" className="login-link">
          Log in
        </Link>

        <Link to="/register" className="nav-button">
          Sign up
        </Link>
      </div>
    </header>
  );
}

export default Navbar;
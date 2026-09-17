import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleDashboardPath } from "../utils/roleUtils";

function Navbar() {
  const { token, user } = useAuth();
  const dashboardPath = getRoleDashboardPath(user);

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
        {token ? (
          <Link to={dashboardPath} className="nav-button">
            {user?.role === "ADMIN" || user?.is_superuser
              ? "Admin Dashboard →"
              : user?.role === "OWNER"
              ? "Owner Dashboard →"
              : "My Dashboard →"}
          </Link>
        ) : (
          <>
            <Link to="/login" className="login-link">
              Log in
            </Link>

            <Link to="/register" className="nav-button">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
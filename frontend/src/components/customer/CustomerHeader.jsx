import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
function CustomerHeader() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const handleLogout = () => {
    logout();

    navigate("/login");
  };

  return (
    <header className="customer-header">
      <Link to="/customer-home" className="customer-brand">
        <span className="customer-brand-icon">✂</span>

        <div>
          <strong>BookMySalon</strong>
          <small>BEAUTY & WELLNESS</small>
        </div>
      </Link>

      <nav className="customer-nav">
        <Link to="/customer-home">Home</Link>
        <Link to="/salons">Find Salons</Link>
        <Link to="/bookings">Bookings</Link>
        <Link to="/favorites">Favorites</Link>
      </nav>

      <div className="customer-header-actions">
        <button
          className="notification-button"
          onClick={() => navigate("/notifications")}
          aria-label="Notifications"
        >
          ♧
        </button>

        <button
          className="profile-button"
          onClick={() => navigate("/profile")}
        >
          <span>V</span>
          <small>Vishnu</small>
        </button>

        <button className="logout-button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}

export default CustomerHeader;
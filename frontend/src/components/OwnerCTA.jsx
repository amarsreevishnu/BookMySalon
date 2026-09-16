import { Link } from "react-router-dom";

function OwnerCTA() {
  return (
    <section className="owner-cta">
      <div>
        <p className="eyebrow light-eyebrow">FOR SALON OWNERS</p>

        <h2>Elevate your salon business</h2>

        <p>
          Join BookMySalon, reach more customers, and manage your salon
          bookings in one place.
        </p>
      </div>

      <Link to="/register" className="light-button">
        List your salon →
      </Link>
    </section>
  );
}

export default OwnerCTA;
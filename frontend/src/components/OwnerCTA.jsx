import { Link } from "react-router-dom";

function OwnerCTA() {
  return (
    <section className="section-container">
      <div className="owner-cta">
        <div>
          <span className="eyebrow">GROW WITH BOOKMYSALON</span>

          <h2>Elevate Your Salon Business</h2>

          <p>
            Bring your salon online, manage appointments, connect with
            customers, and grow your business with BookMySalon.
          </p>
        </div>

        <Link to="/salon-application" className="light-button">
          List your salon
        </Link>
      </div>
    </section>
  );
}

export default OwnerCTA;
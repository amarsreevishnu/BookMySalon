import { Link } from "react-router-dom";

function SalonCard({ salon }) {
  return (
    <article className="salon-card">
      <div className="salon-image-wrapper">
        <img src={salon.image} alt={salon.name} />

        <span className="rating-badge">★ {salon.rating}</span>
      </div>

      <div className="salon-card-content">
        <p className="salon-location">{salon.location}</p>

        <h3>{salon.name}</h3>

        <p className="salon-description">{salon.description}</p>

        <div className="salon-card-footer">
          <span>
            From <strong>₹{salon.price}</strong>
          </span>

          <Link to="/register" className="outline-button">
            View salon
          </Link>
        </div>
      </div>
    </article>
  );
}

export default SalonCard;
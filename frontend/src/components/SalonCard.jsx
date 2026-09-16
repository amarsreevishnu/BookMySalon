import { Link } from "react-router-dom";

function SalonCard({ salon }) {
  return (
    <article className="salon-card">
      <div className="salon-image-wrapper">
        <img src={salon.image} alt={salon.name} />
        <span className="salon-rating">★ {salon.rating}</span>
      </div>

      <div className="salon-card-content">
        <span className="salon-location">{salon.location}</span>

        <h3>{salon.name}</h3>

        <p>{salon.description}</p>

        <div className="salon-card-bottom">
          <strong>{salon.price}</strong>

          <Link to="/login" className="small-button">
            View Salon
          </Link>
        </div>
      </div>
    </article>
  );
}

export default SalonCard;
import { useNavigate } from "react-router-dom";

function SalonCard({ salon }) {
  const navigate = useNavigate();

  return (
    <article className="customer-salon-card">
      <div className="salon-card-image-wrapper">
        <img src={salon.image} alt={salon.name} />

        <span className="salon-card-rating">
          ★ {salon.rating}
        </span>

        <span className="salon-open-status">
          ● Open until {salon.openUntil}
        </span>
      </div>

      <div className="customer-salon-content">
        <div className="salon-card-title-row">
          <div>
            <h3 title={salon.name}>{salon.name}</h3>
            <p title={salon.location}>📍 {salon.location}</p>
          </div>

          <span className="salon-price">
            {salon.price}
          </span>
        </div>

        <p className="salon-description" title={salon.description}>
          {salon.description}
        </p>

        <div className="salon-tags">
          {(salon.tags || []).slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <button
          className="view-salon-button"
          onClick={() => navigate(`/salons/${salon.id}`)}
        >
          View Salon <span>→</span>
        </button>
      </div>
    </article>
  );
}

export default SalonCard;
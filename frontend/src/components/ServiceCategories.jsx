import { useNavigate } from "react-router-dom";

const services = [
  {
    name: "Hair",
    icon: "✂️",
    price: "From ₹299",
    tag: "Popular",
    description: "Haircut, styling & organic color",
    image:
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Spa",
    icon: "🧖‍♀️",
    price: "From ₹899",
    tag: "Relaxing",
    description: "Ayurvedic rituals & aromatherapy",
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Nails",
    icon: "💅",
    price: "From ₹349",
    tag: "Artistry",
    description: "Gel manicure & non-toxic nail art",
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Facial",
    icon: "✨",
    price: "From ₹499",
    tag: "Clean Purity",
    description: "Botanical glow & deep herbal detox",
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=600&q=80",
  },
  {
    name: "Makeup",
    icon: "💄",
    price: "From ₹749",
    tag: "Glamour",
    description: "Occasion, bridal & camera ready",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=600&q=80",
  },
];

function ServiceCategories() {
  const navigate = useNavigate();

  const handleCategoryClick = (catName) => {
    navigate(`/salons?category=${encodeURIComponent(catName)}`);
  };

  return (
    <section className="section-container" id="services">
      <div className="section-heading">
        <div>
          <span className="eyebrow">CURATED EXPERIENCES</span>
          <h2>Popular Categories</h2>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={() => navigate("/salons")}
        >
          View all categories →
        </button>
      </div>

      <div className="service-grid">
        {services.map((service) => (
          <article
            className="service-card interactive-service-card"
            key={service.name}
            onClick={() => handleCategoryClick(service.name)}
            title={`Browse ${service.name} salons`}
          >
            <div className="service-card-media">
              <img src={service.image} alt={service.name} />
              <span className="service-tag-badge">{service.tag}</span>
              <span className="service-icon-badge">{service.icon}</span>
            </div>
            <div className="service-card-info">
              <div className="service-card-header">
                <h3>{service.name}</h3>
                <span className="service-price-pill">{service.price}</span>
              </div>
              <p>{service.description}</p>
              <span className="service-explore-link">Explore salons →</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServiceCategories;
const services = [
  {
    name: "Haircut",
    description: "Fresh new look",
    icon: "✂",
  },
  {
    name: "Spa",
    description: "Relax and refresh",
    icon: "🧖",
  },
  {
    name: "Facial",
    description: "Glow naturally",
    icon: "✨",
  },
  {
    name: "Beard",
    description: "Sharp and stylish",
    icon: "🧔",
  },
  {
    name: "Nails",
    description: "Perfect finishing",
    icon: "💅",
  },
];

function PopularServices() {
  return (
    <section className="section" id="services">
      <div className="section-heading">
        <div>
          <p className="eyebrow">EXPLORE SERVICES</p>
          <h2>Popular services</h2>
        </div>

        <span className="section-link">View all services →</span>
      </div>

      <div className="services-grid">
        {services.map((service) => (
          <div className="service-card" key={service.name}>
            <div className="service-icon">{service.icon}</div>

            <h3>{service.name}</h3>
            <p>{service.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default PopularServices;
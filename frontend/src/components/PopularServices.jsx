const services = [
  { name: "Haircut", icon: "✂️", description: "Fresh styles" },
  { name: "Hair Spa", icon: "🧖", description: "Relax & refresh" },
  { name: "Facial", icon: "✨", description: "Healthy glow" },
  { name: "Manicure", icon: "💅", description: "Nail care" },
  { name: "Massage", icon: "🌿", description: "Relaxation" },
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
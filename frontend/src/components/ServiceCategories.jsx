const services = [
  {
    name: "Hair",
    description: "Hair styling",
    image:
      "https://images.unsplash.com/photo-1562322140-8baeececf3df?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Spa",
    description: "Relax and refresh",
    image:
      "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Nails",
    description: "Nail care",
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Facial",
    description: "Skin care",
    image:
      "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=400&q=80",
  },
  {
    name: "Makeup",
    description: "Beauty makeup",
    image:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80",
  },
];

function ServiceCategories() {
  return (
    <section className="section-container" id="services">
      <div className="section-heading">
        <div>
          <span className="eyebrow">EXPLORE OUR SERVICES</span>
          <h2>Popular Services</h2>
        </div>

        <span className="section-note">Discover something new</span>
      </div>

      <div className="service-grid">
        {services.map((service) => (
          <article className="service-card" key={service.name}>
            <img src={service.image} alt={service.name} />
            <h3>{service.name}</h3>
            <p>{service.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default ServiceCategories;
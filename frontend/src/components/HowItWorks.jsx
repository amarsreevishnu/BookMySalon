const steps = [
  {
    number: "01",
    title: "Search & Discover",
    description:
      "Find salons near you and explore their services, prices, and reviews.",
  },
  {
    number: "02",
    title: "Book Your Appointment",
    description:
      "Choose your preferred service, date, time, and available stylist.",
  },
  {
    number: "03",
    title: "Relax & Glow",
    description:
      "Visit the salon and enjoy a smooth, personalized beauty experience.",
  },
];

function HowItWorks() {
  return (
    <section className="section-container how-section" id="how-it-works">
      <div className="center-heading">
        <span className="eyebrow">SIMPLE, SEAMLESS, BEAUTIFUL</span>
        <h2>How BookMySalon Works</h2>
      </div>

      <div className="steps-grid">
        {steps.map((step) => (
          <article className="step-card" key={step.number}>
            <span className="step-number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;
const steps = [
  {
    number: "01",
    title: "Search a salon",
    description:
      "Find salons near you and explore their services, ratings, and prices.",
  },
  {
    number: "02",
    title: "Book a service",
    description:
      "Choose your preferred service, worker, date, and available time slot.",
  },
  {
    number: "03",
    title: "Relax and enjoy",
    description:
      "Visit the salon at your selected time and enjoy your beauty experience.",
  },
];

function HowItWorks() {
  return (
    <section className="section" id="how-it-works">
      <div className="center-heading">
        <p className="eyebrow">SIMPLE AND CONVENIENT</p>
        <h2>How BookMySalon works</h2>
      </div>

      <div className="steps-grid">
        {steps.map((step) => (
          <div className="step-card" key={step.number}>
            <span className="step-number">{step.number}</span>

            <h3>{step.title}</h3>

            <p>{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;
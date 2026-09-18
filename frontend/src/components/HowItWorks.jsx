import { useState } from "react";

const steps = [
  {
    number: "01",
    icon: "🔍",
    badge: "Step 1",
    title: "Search & Discover",
    description:
      "Explore curated botanical salons near your location. Filter by real-time instant slots, organic purity, guest ratings, and verified tariffs.",
  },
  {
    number: "02",
    icon: "📅",
    badge: "Step 2",
    title: "Choose Slot & Stylist",
    description:
      "Select your exact treatment, choose your favorite master stylist, and pick an instant slot for today or book in advance with zero booking fees.",
  },
  {
    number: "03",
    icon: "✨",
    badge: "Step 3",
    title: "Relax & Glow",
    description:
      "Walk straight in with zero queue waiting. Experience pure botanical wellness treatments and walk out rejuvenated with verified booking points.",
  },
];

function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section className="section-container how-section" id="how-it-works">
      <div className="center-heading">
        <span className="eyebrow">SIMPLE, SEAMLESS, BEAUTIFUL</span>
        <h2>How BookMySalon Works</h2>
        <p className="center-heading-desc">
          Booking a luxury salon experience has never been smoother
        </p>
      </div>

      <div className="steps-grid">
        {steps.map((step, idx) => (
          <article
            className={`step-card interactive-step-card ${activeStep === idx ? "active-step" : ""}`}
            key={step.number}
            onMouseEnter={() => setActiveStep(idx)}
            onClick={() => setActiveStep(idx)}
          >
            <div className="step-card-top">
              <span className="step-icon-badge">{step.icon}</span>
              <span className="step-number">{step.number}</span>
            </div>

            <span className="step-badge">{step.badge}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HowItWorks;
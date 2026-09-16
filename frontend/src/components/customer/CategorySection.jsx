const categories = [
  {
    name: "Hair",
    icon: "✂",
    price: "Starting ₹250",
    description: "Haircuts & styling",
  },
  {
    name: "Spa",
    icon: "♨",
    price: "Starting ₹900",
    description: "Relax & refresh",
  },
  {
    name: "Facial",
    icon: "◉",
    price: "Starting ₹450",
    description: "Skin care",
  },
  {
    name: "Nails",
    icon: "◌",
    price: "Starting ₹350",
    description: "Nail care",
  },
  {
    name: "Makeup",
    icon: "◍",
    price: "Starting ₹750",
    description: "Beauty makeup",
  },
  {
    name: "Therapy",
    icon: "♧",
    price: "Starting ₹600",
    description: "Wellness care",
  },
];

function CategorySection({
  selectedCategory,
  onCategorySelect,
}) {
  return (
    <section className="customer-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">CURATED CATEGORIES</span>
          <h2>Popular Services</h2>
        </div>

        <span className="section-side-text">
          Quick booking in 1 click
        </span>
      </div>

      <div className="category-grid">
        {categories.map((category) => (
          <button
            key={category.name}
            className={`category-card ${
              selectedCategory === category.name ? "selected" : ""
            }`}
            onClick={() => onCategorySelect(category.name)}
          >
            <span className="category-icon">{category.icon}</span>

            <strong>{category.name}</strong>

            <small>{category.price}</small>

            <span>{category.description}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export default CategorySection;
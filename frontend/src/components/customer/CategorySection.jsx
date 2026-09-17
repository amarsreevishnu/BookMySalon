const categories = [
  {
    name: "Hair",
    icon: "✂️",
    price: "From ₹250",
    description: "Haircuts, styling & color",
    tag: "Popular",
    colorBg: "#eef7f2",
    iconColor: "#2d6a4f",
  },
  {
    name: "Spa",
    icon: "🧖‍♀️",
    price: "From ₹900",
    description: "Detox & aromatherapy rituals",
    tag: "Relaxing",
    colorBg: "#fef3c7",
    iconColor: "#92400e",
  },
  {
    name: "Facial",
    icon: "✨",
    price: "From ₹450",
    description: "Botanical glow & skin therapy",
    tag: "Clean Purity",
    colorBg: "#e0f2fe",
    iconColor: "#0369a1",
  },
  {
    name: "Nails",
    icon: "💅",
    price: "From ₹350",
    description: "Gel manicure & nail artistry",
    tag: "Artistry",
    colorBg: "#fce7f3",
    iconColor: "#be185d",
  },
  {
    name: "Makeup",
    icon: "💄",
    price: "From ₹750",
    description: "Occasion & bridal touch",
    tag: "Glamour",
    colorBg: "#fae8ff",
    iconColor: "#86198f",
  },
  {
    name: "Therapy",
    icon: "🌿",
    price: "From ₹600",
    description: "Ayurvedic wellness & massage",
    tag: "Holistic",
    colorBg: "#dcfce7",
    iconColor: "#15803d",
  },
];

function CategorySection({
  selectedCategory,
  onCategorySelect,
}) {
  return (
    <section className="customer-section category-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">🌿 CURATED TREATMENTS</span>
          <h2>Popular Services</h2>
          <p className="section-subtitle">
            Explore certified botanical services and top-rated stylist rituals
          </p>
        </div>

        <div className="section-heading-actions">
          {selectedCategory && selectedCategory !== "All" && (
            <button
              type="button"
              className="reset-category-btn"
              onClick={() => onCategorySelect("All")}
            >
              Reset filter (<strong>{selectedCategory}</strong>) ✕
            </button>
          )}
          <span className="section-side-badge">⚡ Instant 1-Click Booking</span>
        </div>
      </div>

      <div className="category-grid">
        {categories.map((category) => {
          const isSelected = selectedCategory === category.name;
          return (
            <button
              key={category.name}
              type="button"
              className={`category-card ${isSelected ? "selected" : ""}`}
              onClick={() => onCategorySelect(category.name)}
              aria-pressed={isSelected}
            >
              <div className="category-card-top">
                <div
                  className="category-icon"
                  style={{ backgroundColor: category.colorBg, color: category.iconColor }}
                >
                  <span>{category.icon}</span>
                </div>
                <span className="category-tag-pill">{category.tag}</span>
              </div>

              <div className="category-card-info">
                <h3 className="category-name">{category.name}</h3>
                <p className="category-desc">{category.description}</p>
              </div>

              <div className="category-card-footer">
                <span className="category-price-chip">{category.price}</span>
                <span className="category-arrow">→</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default CategorySection;
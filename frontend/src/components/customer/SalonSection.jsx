import SalonCard from "./SalonCard";

const salons = [
  {
    id: 1,
    name: "Aura Luxe Salon & Spa",
    location: "Kowdiar, Thiruvananthapuram",
    rating: "4.9",
    openUntil: "9:00 PM",
    price: "₹499+",
    description: "Premium beauty treatments and expert stylists.",
    tags: ["Hair", "Facial", "Spa"],
    category: "Hair",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 2,
    name: "Urban Glow Hair Studio",
    location: "Pattom, Thiruvananthapuram",
    rating: "4.8",
    openUntil: "8:30 PM",
    price: "₹399+",
    description: "Modern hair styling and personalized care.",
    tags: ["Hair Styling", "Organic Products"],
    category: "Hair",
    image:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 3,
    name: "Verdant Nail & Skin",
    location: "Vazhuthacaud, Thiruvananthapuram",
    rating: "4.7",
    openUntil: "7:30 PM",
    price: "₹450+",
    description: "Relaxing skin treatments and professional nail care.",
    tags: ["Nail Art", "Ayurvedic Facial"],
    category: "Nails",
    image:
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
  },
  {
    id: 4,
    name: "The Grooming Club",
    location: "Kesavadasapuram, Thiruvananthapuram",
    rating: "4.8",
    openUntil: "8:00 PM",
    price: "₹250+",
    description: "Classic grooming services for every occasion.",
    tags: ["Men's Grooming", "Beard Trim"],
    category: "Hair",
    image:
      "https://images.unsplash.com/photo-1512690459411-b9245aed614b?auto=format&fit=crop&w=900&q=85",
  },
];

function SalonSection({
  selectedCategory,
  selectedFilter,
}) {
  let filteredSalons = [...salons];

  if (selectedCategory !== "All") {
    filteredSalons = filteredSalons.filter(
      (salon) =>
        salon.category === selectedCategory ||
        salon.tags.some((tag) =>
          tag.toLowerCase().includes(
            selectedCategory.toLowerCase()
          )
        )
    );
  }

  if (selectedFilter === "Top Rated") {
    filteredSalons = filteredSalons.filter(
      (salon) => Number(salon.rating) >= 4.8
    );
  }

  return (
    <section className="customer-section">
      <div className="customer-section-heading">
        <div>
          <span className="section-label">● OPEN NOW · REAL-TIME SLOTS</span>
          <h2>Available Near You</h2>
        </div>

        <div className="section-heading-actions">
          <span>Showing verified salons</span>
          <button>View all 14 salons →</button>
        </div>
      </div>

      {filteredSalons.length > 0 ? (
        <div className="customer-salon-grid">
          {filteredSalons.map((salon) => (
            <SalonCard key={salon.id} salon={salon} />
          ))}
        </div>
      ) : (
        <div className="empty-salon-message">
          No salons found for this category.
        </div>
      )}
    </section>
  );
}

export default SalonSection;
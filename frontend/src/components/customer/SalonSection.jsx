import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SalonCard from "./SalonCard";
import api from "../../api/axios";

const DEFAULT_SALONS = [
  {
    id: 5,
    name: "Apple Salon Sreekariyam",
    location: "Sreekariyam Gandhipuarm, sreekariyam",
    rating: "4.9",
    openUntil: "8:30 PM",
    price: "₹349+",
    description: "Certified partner salon with premium hair styling & grooming.",
    tags: ["Hair & Styling", "AC", "Certified"],
    category: "Hair",
    image:
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80",
  },
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
  const [salons, setSalons] = useState(DEFAULT_SALONS);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/salons/")
      .then((res) => {
        if (isMounted && res.data && res.data.length > 0) {
          const mapped = res.data.map((s) => ({
            id: s.id,
            name: s.name,
            location: s.city
              ? `${s.city}, ${s.state || ""}`.trim().replace(/,$/, "")
              : s.address,
            rating: "4.9",
            openUntil: "9:00 PM",
            price: "₹399+",
            description:
              s.description ||
              "Premium salon treatments and expert stylists.",
            category: s.category?.toLowerCase().includes("hair")
              ? "Hair"
              : s.category?.toLowerCase().includes("nail")
              ? "Nails"
              : s.category?.toLowerCase().includes("skin")
              ? "Skin"
              : s.category?.toLowerCase().includes("spa")
              ? "Spa"
              : s.category || "Hair",
            tags:
              s.amenities && s.amenities.length > 0
                ? s.amenities.slice(0, 3)
                : [s.category || "Hair"],
            image:
              s.cover_image ||
              (s.images && s.images[0]) ||
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=85",
          }));
          setSalons(mapped);
        }
      })
      .catch(() => {
        // Fallback to default list
      });

    return () => {
      isMounted = false;
    };
  }, []);

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
          <span className="section-label">● LIVE AVAILABILITY</span>
          <h2>Available Salons Near You</h2>
          <p className="section-subtitle">
            Certified organic & verified venues open with slots available today
          </p>
        </div>

        <div className="section-heading-actions">
          <span className="section-side-text">Showing verified salons</span>
          <Link to="/salons" className="text-button">
            View all salons →
          </Link>
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
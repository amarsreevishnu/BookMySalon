import { useState, useEffect } from "react";
import SalonCard from "./SalonCard";
import api from "../api/axios";

const DEFAULT_SALONS = [
  {
    name: "Maison Beauty Lounge",
    location: "Kowdiar, Trivandrum",
    description: "Luxury hair and beauty services",
    price: "From ₹499",
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "The Glow Studio",
    location: "Pattom, Trivandrum",
    description: "Modern salon and spa experience",
    price: "From ₹599",
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=800&q=85",
  },
  {
    name: "Urban Style Salon",
    location: "Vazhuthacaud, Trivandrum",
    description: "Expert stylists and premium care",
    price: "From ₹399",
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1633681926022-84c23e8cb2d6?auto=format&fit=crop&w=800&q=85",
  },
];

function PopularSalons() {
  const [salons, setSalons] = useState(DEFAULT_SALONS);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/salons/")
      .then((res) => {
        if (isMounted && res.data && res.data.length > 0) {
          const mapped = res.data.map((s) => ({
            name: s.name,
            location: s.city
              ? `${s.city}, ${s.state || ""}`.trim().replace(/,$/, "")
              : s.address,
            description: s.description || "Luxury hair and beauty services",
            price: "From ₹399",
            rating: "4.9",
            image:
              s.cover_image ||
              (s.images && s.images[0]) ||
              "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=800&q=85",
          }));
          setSalons(mapped);
        }
      })
      .catch(() => {
        // Fallback to default curated list
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="section-container" id="salons">
      <div className="section-heading">
        <div>
          <span className="eyebrow">DISCOVER YOUR NEXT EXPERIENCE</span>
          <h2>Nearby & Popular Salons</h2>
        </div>

        <button className="text-button">View all salons →</button>
      </div>

      <div className="salon-grid">
        {salons.map((salon) => (
          <SalonCard salon={salon} key={salon.name} />
        ))}
      </div>
    </section>
  );
}

export default PopularSalons;
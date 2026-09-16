import SalonCard from "./SalonCard";

const salons = [
  {
    id: 1,
    name: "Maison Beauty Studio",
    location: "Kowdiar, Thiruvananthapuram",
    description: "Modern beauty and styling experience.",
    price: 499,
    rating: "4.8",
    image:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 2,
    name: "The Groom Room",
    location: "Vazhuthacaud, Thiruvananthapuram",
    description: "Premium grooming for every occasion.",
    price: 399,
    rating: "4.7",
    image:
      "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 3,
    name: "Aura Beauty Lounge",
    location: "Pattom, Thiruvananthapuram",
    description: "Relaxing spa and beauty treatments.",
    price: 599,
    rating: "4.9",
    image:
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=80",
  },
];

function SalonList() {
  return (
    <section className="section" id="salons">
      <div className="section-heading">
        <div>
          <p className="eyebrow">DISCOVER YOUR NEXT LOOK</p>
          <h2>Nearby & popular salons</h2>
        </div>

        <span className="section-link">View all salons →</span>
      </div>

      <div className="salon-grid">
        {salons.map((salon) => (
          <SalonCard key={salon.id} salon={salon} />
        ))}
      </div>
    </section>
  );
}

export default SalonList;
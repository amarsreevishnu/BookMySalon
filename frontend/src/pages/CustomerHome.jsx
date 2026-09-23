import { useState } from "react";
import { useNavigate } from "react-router-dom";

import CustomerHeader from "../components/customer/CustomerHeader";
import CustomerHero from "../components/customer/CustomerHero";
import CategorySection from "../components/customer/CategorySection";
import SalonSection from "../components/customer/SalonSection";
import OfferSection from "../components/customer/OfferSection";
import CustomerFooter from "../components/customer/CustomerFooter";

import "../styles/customer-home.css";

function CustomerHome() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedFilter, setSelectedFilter] = useState("All");

  const handleSearch = () => {
    const query = search.trim();

    if (query) {
      navigate(`/salons?search=${encodeURIComponent(query)}`);
    } else {
      navigate("/salons");
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);

    if (category === "All") {
      navigate("/salons");
    } else {
      navigate(
        `/salons?category=${encodeURIComponent(category)}`
      );
    }
  };

  return (
    <div className="customer-home">
      <CustomerHeader />

      <main className="customer-main-content">
        <CustomerHero
          search={search}
          setSearch={setSearch}
          selectedFilter={selectedFilter}
          setSelectedFilter={setSelectedFilter}
          onSearch={handleSearch}
        />

        <CategorySection
          selectedCategory={selectedCategory}
          onCategorySelect={handleCategorySelect}
        />

        <SalonSection
          selectedCategory={selectedCategory}
          selectedFilter={selectedFilter}
        />

        <OfferSection />

        <section className="map-promo-section">
          <div className="map-promo-icon">📍</div>

          <div>
            <h3>Looking for salons within walking distance?</h3>
            <p>
              Switch to the interactive map to discover salons near your
              current location with live directions.
            </p>
          </div>

          <button
            type="button"
            className="outline-button"
            onClick={() => navigate("/salons/map")}
          >
            Open Map View →
          </button>
        </section>
      </main>

      <CustomerFooter />
    </div>
  );
}

export default CustomerHome; 
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import ServiceCategories from "../components/ServiceCategories";
import PopularSalons from "../components/PopularSalons";
import OfferBanner from "../components/OfferBanner";
import HowItWorks from "../components/HowItWorks";
import OwnerCTA from "../components/OwnerCTA";
import Footer from "../components/Footer";

import "../styles/LandingPage.css";

function LandingPage() {
  return (
    <div className="landing-page">
      <Navbar />
      <main>
        <Hero />
        <ServiceCategories />
        <PopularSalons />
        <OfferBanner />
        <HowItWorks />
        <OwnerCTA />
      </main>
      <Footer />
    </div>
  );
}

export default LandingPage;
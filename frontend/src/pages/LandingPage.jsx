import Navbar from "../components/Navbar";
import HeroSection from "../components/HeroSection";
import PopularServices from "../components/PopularServices";
import SalonList from "../components/SalonList";
import OfferBanner from "../components/OfferBanner";
import HowItWorks from "../components/HowItWorks";
import OwnerCTA from "../components/OwnerCTA";
import Footer from "../components/Footer";

function LandingPage() {
  return (
    <>
      <Navbar />

      <main>
        <HeroSection />
        <PopularServices />
        <SalonList />
        <OfferBanner />
        <HowItWorks />
        <OwnerCTA />
      </main>

      <Footer />
    </>
  );
}

export default LandingPage;
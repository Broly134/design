import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { ProblemSection } from "./components/ProblemSection";
import { AdvantagesSection } from "./components/AdvantagesSection";
import { ProductSection } from "./components/ProductSection";
import { ComparisonSection } from "./components/ComparisonSection";
import { WhyChooseSection } from "./components/WhyChooseSection";
import { RoomCalculator } from "./components/RoomCalculator";
import { TrustSection } from "./components/TrustSection";
import { TestimonialsSection } from "./components/TestimonialsSection";
import { OfferSection } from "./components/OfferSection";
import { FaqSection } from "./components/FaqSection";
import { FinalCtaSection } from "./components/FinalCtaSection";
import { Footer } from "./components/Footer";

function App() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ProblemSection />
        <AdvantagesSection />
        <ProductSection />
        <ComparisonSection />
        <WhyChooseSection />
        <RoomCalculator />
        <TrustSection />
        <TestimonialsSection />
        <OfferSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <Footer />
    </>
  );
}

export default App;

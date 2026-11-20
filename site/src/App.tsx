import { SmoothScroll } from "./fx-ext/SmoothScroll";
import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { Logos } from "./sections/Logos";
import { HowItWorks } from "./sections/HowItWorks";
import { Decisions } from "./sections/Decisions";
import { Verification } from "./sections/Verification";
import { Partners } from "./sections/Partners";
import { Comparison } from "./sections/Comparison";
import { Pricing } from "./sections/Pricing";
// Compare (the vendor table) is not on the landing page; the docs render its data.
import { Trust } from "./sections/Trust";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

/**
 * Landing page order, business outcomes first and chain detail last: the promise (Hero), who it is
 * for (Logos line), how it works (HowItWorks), payment protection (Trust, id "protection"), margin
 * control (Decisions), seller types (Partners), what anyone can check (Verification), the no-fee
 * pilot (Pricing), under the hood with a status per part (Comparison, id "under-the-hood"), FAQ.
 */
export default function App() {
  return (
    <SmoothScroll>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <HowItWorks />
        <Trust />
        <Decisions />
        <Partners />
        <Verification />
        <Pricing />
        <Comparison />
        <Faq />
      </main>
      <Footer />
    </SmoothScroll>
  );
}

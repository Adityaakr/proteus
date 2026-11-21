import { SmoothScroll } from "./fx-ext/SmoothScroll";
import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { Logos } from "./sections/Logos";
import { HowItWorks } from "./sections/HowItWorks";
import { BeforeAfter } from "./sections/BeforeAfter";
import { Decisions } from "./sections/Decisions";
import { Verification } from "./sections/Verification";
import { Partners } from "./sections/Partners";
import { Erc8183 } from "./sections/Erc8183";
import { Comparison } from "./sections/Comparison";
import { Pricing } from "./sections/Pricing";
import { Trust } from "./sections/Trust";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

/**
 * Landing page order, business outcomes first, light and dark sections alternating: the promise
 * (Hero), who it is for (Logos line), how it works (HowItWorks), one order without and with Proteus
 * (BeforeAfter), payment protection (dark Trust, id "protection"), margin control (Decisions),
 * seller types (Partners), why Arc with a status per part (dark Comparison, id "why-arc"), agent to
 * agent (Verification, id "agents"), the ERC-8183 standard (dark Erc8183), pricing, FAQ.
 */
export default function App() {
  return (
    <SmoothScroll>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <HowItWorks />
        <BeforeAfter />
        <Trust />
        <Decisions />
        <Partners />
        <Comparison />
        <Verification />
        <Erc8183 />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </SmoothScroll>
  );
}

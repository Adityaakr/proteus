import { SmoothScroll } from "./fx-ext/SmoothScroll";
import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { Logos } from "./sections/Logos";
import { HowItWorks } from "./sections/HowItWorks";
import { Decisions } from "./sections/Decisions";
import { Verification } from "./sections/Verification";
import { Partners } from "./sections/Partners";
import { Comparison } from "./sections/Comparison";
// import { Pricing } from "./sections/Pricing"; // unrendered, see content/proteus.ts
// Compare (the vendor table) is not on the landing page; the docs render its data.
import { Trust } from "./sections/Trust";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

/**
 * Landing page order: the promise (Hero), who it is for (Logos line), the four-step flow (Trust,
 * id "how-it-works"), the seller's deal agent (HowItWorks, id "agent"), seller control (Decisions),
 * what buyers can check (Verification), the seller types (Partners), buyers and their agents with
 * a status per channel (Comparison, id "agents"), then the FAQ.
 */
export default function App() {
  return (
    <SmoothScroll>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <Trust />
        <HowItWorks />
        <Decisions />
        <Verification />
        <Partners />
        <Comparison />
        {/* <Pricing /> : no pricing copy in the current doc; re-add when there is */}
        <Faq />
      </main>
      <Footer />
    </SmoothScroll>
  );
}

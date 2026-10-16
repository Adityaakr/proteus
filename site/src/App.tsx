import { SmoothScroll } from "./fx-ext/SmoothScroll";
import { Nav } from "./sections/Nav";
import { Hero } from "./sections/Hero";
import { Logos } from "./sections/Logos";
import { HowItWorks } from "./sections/HowItWorks";
import { Decisions } from "./sections/Decisions";
import { Verification } from "./sections/Verification";
import { Partners } from "./sections/Partners";
import { Comparison } from "./sections/Comparison";
import { Compare } from "./sections/Compare";
// import { Pricing } from "./sections/Pricing"; // unrendered, see content/proteus.ts
import { Trust } from "./sections/Trust";
import { Record } from "./sections/Record";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

export default function App() {
  return (
    <SmoothScroll>
      <Nav />
      <main>
        <Hero />
        <Logos />
        <HowItWorks />
        <Decisions />
        <Compare />
        <Verification />
        <Partners />
        <Comparison />
        {/* <Pricing /> : no pricing copy in the current doc; re-add when there is */}
        <Trust />
        <Record />
        <Faq />
      </main>
      <Footer />
    </SmoothScroll>
  );
}

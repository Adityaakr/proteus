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
import { erc8183, landingCompare } from "./content/proteus";
import { Pricing } from "./sections/Pricing";
import { Trust } from "./sections/Trust";
import { Faq } from "./sections/Faq";
import { Footer } from "./sections/Footer";

/**
 * Landing page order, business outcomes first: the promise (Hero), who it is for (Logos line), how
 * it works (HowItWorks), payment protection (Trust, id "protection"), margin control (Decisions),
 * agent to agent (Verification, id "agents"), seller types (Partners), how it differs (Compare with
 * the landing data), the ERC-8183 lifecycle (Partners with its data, id "erc-8183"), why Arc with a
 * status per part (Comparison, id "why-arc"), pricing, FAQ.
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
        <Verification />
        <Partners />
        <Compare data={landingCompare} />
        <Partners data={erc8183} id="erc-8183" />
        <Comparison />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </SmoothScroll>
  );
}

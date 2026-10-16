import { logos } from "../content/proteus";
import LogoGrid from "../fx/LogoGrid";
import { useBreakpoint } from "../ui/useBreakpoint";
import s from "./Logos.module.css";

/** $control__logoPairs of instance r5gAyaGS2, mapped through asset-map.json. */
const LOGO_PAIRS = [
  "/assets/logos/northwind.png",
  "/assets/logos/lumen.png",
  "/assets/logos/harbor.png",
  "/assets/logos/kaidata.png",
  "/assets/logos/meridian.png",
  "/assets/logos/vantage.png",
  "/assets/logos/orbit.png",
  "/assets/logos/tidewater.png",
].map((src) => ({ image: { src } }));

/**
 * section-logos.json: Body 2 line + the LogoGrid code component. Instance props:
 * rows 1, columns 4 (phone 2x2), interval 2000, stagger 150, spring 230/19, blur 6,
 * desaturate 100, transparent surface/card/border, radius 16, gaps 0, logoHeight 16 (40 on
 * tablet/phone), logoScale 45 (50), alignment Center, height 63 (40 / 105).
 */
export function Logos() {
  const bp = useBreakpoint();
  const desktop = bp === "desktop";
  const phone = bp === "phone";
  return (
    <section className={s.section}>
      <div className={s.content}>
        <div className={s.inner}>
          <div className={s.headingTag}>
            <div className={s.headingDesc}>
              <p className={`body2 ${s.line}`}>{logos.line}</p>
            </div>
          </div>
          <div className={s.grid}>
            <LogoGrid
              logos={LOGO_PAIRS}
              autoplay
              rows={phone ? 2 : 1}
              columns={phone ? 2 : 4}
              direction="Up"
              interval={2000}
              stagger={150}
              springStiffness={230}
              springDamping={19}
              transitionBlur={6}
              desaturate={100}
              surface="rgba(247, 247, 246, 0)"
              cardBackground="rgba(255, 255, 255, 0)"
              borderColor="rgba(17, 17, 17, 0)"
              radius="16px"
              gap={0}
              padding={0}
              cellPadding={0}
              logoSize={desktop ? 16 : 40}
              logoScale={desktop ? 45 : 50}
              alignment="center"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

import { logos } from "../content/proteus";
import s from "./Logos.module.css";

/**
 * section-logos.json: the Body 2 audience line under the hero. The LogoGrid that sat below it showed
 * placeholder companies, so it is not rendered: no customer logos until there are real ones to show.
 */
export function Logos() {
  return (
    <section className={s.section}>
      <div className={s.content}>
        <div className={s.inner}>
          <div className={s.headingTag}>
            <div className={s.headingDesc}>
              <p className={`body2 ${s.line}`}>{logos.line}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

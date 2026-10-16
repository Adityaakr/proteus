import { footer } from "../content/proteus";
import { Button } from "../ui/Button";
import s from "./Footer.module.css";

const MARK = "/assets/7QuYVNK6yeb3hmBB6mc2yJ1DBUg.png";

/** Framer "Footer" (component-Footer__HSAs7QY3s.json); breakpoint deltas live in Footer.module.css. */
export function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.container}>
        <div className={s.message}>
          <h2 className={`h2 ${s.h2}`}>{footer.heading}</h2>
          <p className={`body1 ${s.line}`}>{footer.line}</p>
          <Button label={footer.cta.label} href={footer.cta.href} variant="primary" icon />
        </div>

        <div className={s.brandRow}>
          <div className={s.brand}>
            <img className={s.mark} src={MARK} alt="" width={40} height={40} />
            <div className={s.brandText}>
              <h3 className={`h3 ${s.white}`}>{footer.brand}</h3>
              <p className={`body2 ${s.tagline}`}>{footer.tagline}</p>
            </div>
          </div>
          <div className={s.column}>
            <h5 className={`h5 ${s.white}`}>{footer.columnTitle}</h5>
            {footer.columns.map((c) => (
              <a key={c.href} className={`body2 ${s.link}`} href={c.href}>
                {c.label}
              </a>
            ))}
          </div>
        </div>

        <div className={s.rail}>
          <p className={`body2 ${s.white}`}>{footer.copyright}</p>
          <div className={s.legal}>
            <a className={`body2 ${s.muted}`} href={footer.right.href} target="_blank" rel="noreferrer">
              {footer.right.label}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { Link } from "react-router-dom";
import { ArrowRight, Code2 } from "lucide-react";
import { Card } from "../../seller/kit";
import { DEVELOPERS_PATH, MOVED_TO_DEVELOPERS } from "./reference";
import d from "./developers.module.css";

/** Pointer left on Seller settings where the technical cards used to be. */
export function MovedToDevelopers() {
  return (
    <Card variant="muted" padding="compact" aria-labelledby="moved-to-developers">
      <div className={d.moved}>
        <span className={d.movedIcon} aria-hidden>
          <Code2 size={18} strokeWidth={1.9} />
        </span>
        <div className={d.movedText}>
          <h2 id="moved-to-developers" className="h6">Moved to Developers</h2>
          <p className="body3">
            {MOVED_TO_DEVELOPERS.map((m, i) => (
              <span key={m.label}>
                {i > 0 && (i === MOVED_TO_DEVELOPERS.length - 1 ? " and " : ", ")}
                <Link to={`${DEVELOPERS_PATH}#${m.anchor}`} className={d.inlineLink}>{m.label.charAt(0).toLowerCase() + m.label.slice(1)}</Link>
              </span>
            ))}{" "}
            now live on the Developers page, next to your API keys.
          </p>
        </div>
        <Link to={DEVELOPERS_PATH} className={d.movedCta}>
          Open Developers <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </Card>
  );
}

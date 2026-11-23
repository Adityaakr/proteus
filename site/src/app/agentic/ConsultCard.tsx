import { ArrowRight } from "lucide-react";
import type { ConsultPayload } from "../lib/types";
import c from "./consult.module.css";

/**
 * A recommendation from the seller's agent while the conversation is on all products: an opening line, two to four
 * of the seller's products (each with why it fits and its "from" price, all from the seller's catalogue) and the
 * follow-up questions. Each product is a button: tapping it moves the conversation to that product for a quote.
 * Only the latest recommendation is tappable.
 */
export function ConsultCard({ consult, onPick, disabled, priceOf }: { consult: ConsultPayload; onPick?: (slug: string) => void; disabled?: boolean; /** The "from" price in the buyer's currency, when the page has the product. */ priceOf?: (slug: string) => string | null }) {
  return (
    <div className={c.card}>
      <p className={c.intro}>{consult.intro}</p>
      <ul className={c.picks} aria-label="Recommended products">
        {consult.picks.map((p) => (
          <li key={p.slug}>
            <button type="button" className={c.pick} onClick={() => onPick?.(p.slug)} disabled={disabled || !onPick} aria-label={`Get a quote for ${p.name}`}>
              <span className={c.pickTop}>
                <strong>{p.name}</strong>
                {(priceOf?.(p.slug) ?? p.fromPrice) && <span className={c.price}>from {priceOf?.(p.slug) ?? p.fromPrice} a {p.unitLabel}</span>}
              </span>
              {p.reason && <span className={c.reason}>{p.reason}</span>}
              {onPick && !disabled && <ArrowRight size={14} className={c.go} aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      {consult.questions.length > 0 ? (
        <p className={c.questions}>{consult.questions.join(" ")}</p>
      ) : (
        <p className={c.questions}>Tap one and I will put together exact offers.</p>
      )}
    </div>
  );
}

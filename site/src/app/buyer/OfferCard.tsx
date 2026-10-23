import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toMicro, pluralUnit } from "@proteus/domain";
import { T_DEFAULT } from "../../lib/motion";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { Money } from "../ui/Money";
import type { Offer } from "../lib/api";
import { fmtUnits } from "./common";
import n from "./negotiate.module.css";

const ORIGIN_LABEL: Record<Offer["origin"], string> = {
  tier: "Published tier",
  budget_fit: "Fits your budget",
  requested_units: "Your requested volume",
  counter: "Counteroffer",
};

export interface OfferCardProps {
  offer: Offer;
  unitLabel?: string;
  termDays?: number;
  /** Draw as the recommended offer (primary accept button). */
  top?: boolean;
  busy?: boolean;
  onAccept: (offer: Offer) => void;
  onCounter?: (offer: Offer, ask: { targetTotal?: string; targetUnits?: string }) => void;
  counterBusy?: boolean;
}

export function OfferCard({ offer, unitLabel = "unit", termDays, top, busy, onAccept, onCounter, counterBusy }: OfferCardProps) {
  const [counterOpen, setCounterOpen] = useState(false);
  const [mode, setMode] = useState<"total" | "units">("total");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const formId = useId();
  const needsApproval = offer.status === "approval_required";
  const origins = Array.from(new Set([offer.origin, ...offer.origins]));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const v = value.replace(/[$,\s]/g, "");
    if (mode === "total") {
      if (!/^\d+(\.\d{1,6})?$/.test(v) || Number(v) <= 0) return setErr("Enter a total in USDC, for example 1500 or 1500.50.");
      onCounter?.(offer, { targetTotal: toMicro(v).toString() });
    } else {
      if (!/^\d+$/.test(v) || v === "0") return setErr("Enter a whole number of units, for example 1800.");
      onCounter?.(offer, { targetUnits: v });
    }
  };

  const digits = offer.unitPriceUsd.split(".")[1]?.replace(/0+$/, "").length && offer.unitPriceUsd.split(".")[1]!.replace(/0+$/, "").length > 2 ? 4 : 2;
  const reasons = offer.publicReasons.filter((r) => !/integrations are not available/.test(r));
  return (
    <motion.article layout transition={T_DEFAULT} className={n.offer} aria-label={`${offer.tierName} offer, ${fmtUnits(offer.units)} ${pluralUnit(unitLabel)}`}>
      <div className={n.offerHead}>
        <span className={n.offerName}>
          {offer.tierName}
          {top && offer.status === "eligible" ? <span className={n.offerTag}>Recommended</span> : offer.status === "approval_required" ? <span className={n.offerTagMuted}>Needs seller approval</span> : offer.status === "rejected" ? <span className={n.offerTagMuted}>Not available</span> : null}
        </span>
        <span className={n.offerTotal}><Money usd={offer.prepaidTotalUsd} /></span>
      </div>
      <p className={n.offerFacts}>
        <b>{fmtUnits(offer.units)}</b> {pluralUnit(unitLabel)} at <b><Money usd={offer.unitPriceUsd} digits={digits} /></b> each, prepaid{termDays ? ` for ${termDays} days` : ""}.
        {offer.overagePriceUsd ? <> Overage <b><Money usd={offer.overagePriceUsd} /></b>.</> : " Unused balance refunds after the term."}
        {" "}<span className={n.offerTagMuted}>{origins.map((o) => ORIGIN_LABEL[o]).join(", ")}</span>
      </p>
      {offer.includes.length > 0 && <p className={n.offerIncl}>Includes {offer.includes.join(", ")}.</p>}
      {reasons.map((r) => <p key={r} className={n.offerReason}>{r}</p>)}
      <div className={n.offerActions}>
        <ActionButton size="sm" variant={top ? "primary" : "secondary"} onClick={() => onAccept(offer)} loading={busy} disabled={offer.status === "rejected"} loadingLabel="Preparing the quote">
          {needsApproval ? "Request seller approval" : "Accept this offer"}
        </ActionButton>
        {onCounter && (
          <button type="button" className={n.textBtn} onClick={() => setCounterOpen((o) => !o)} aria-expanded={counterOpen} aria-controls={formId}>
            {counterOpen ? "Close counteroffer" : "Make a counteroffer"}
          </button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {counterOpen && onCounter && (
          <motion.form id={formId} key="counter" onSubmit={submit} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={T_DEFAULT} style={{ overflow: "hidden" }} noValidate>
            <div className={n.counter}>
              <fieldset className={n.segmented}>
                <legend className="sr-only">Counter with</legend>
                <label><input type="radio" name={`${formId}-mode`} checked={mode === "total"} onChange={() => setMode("total")} /> Target total</label>
                <label><input type="radio" name={`${formId}-mode`} checked={mode === "units"} onChange={() => setMode("units")} /> Target units</label>
              </fieldset>
              <Field
                label={mode === "total" ? `Total for ${fmtUnits(offer.units)} ${pluralUnit(unitLabel)} (USDC)` : `${pluralUnit(unitLabel)[0]!.toUpperCase()}${pluralUnit(unitLabel).slice(1)} for ${offer.prepaidTotalUsd} USDC`}
                inputMode={mode === "total" ? "decimal" : "numeric"}
                placeholder={mode === "total" ? "1500" : "1800"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={err}
                hint="The seller's rules decide instantly. Nothing is binding until you sign."
              />
              <div>
                <ActionButton type="submit" size="sm" variant="secondary" loading={counterBusy} loadingLabel="Checking with the seller">Send counteroffer</ActionButton>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

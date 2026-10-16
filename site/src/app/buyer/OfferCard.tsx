import { useId, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toMicro } from "@proteus/domain";
import { T_DEFAULT } from "../../lib/motion";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Notice } from "../ui/misc";
import type { Offer } from "../lib/api";
import { fmtUnits, prettyIntegration } from "./common";
import s from "./buyer.module.css";

const ORIGIN_LABEL: Record<Offer["origin"], string> = {
  tier: "Published tier",
  budget_fit: "Fits your budget",
  requested_units: "Your requested volume",
  counter: "Counteroffer",
};

export interface OfferCardProps {
  offer: Offer;
  unitLabel?: string;
  /** Draw as the recommended offer (primary accept button). */
  top?: boolean;
  busy?: boolean;
  onAccept: (offer: Offer) => void;
  onCounter?: (offer: Offer, ask: { targetTotal?: string; targetUnits?: string }) => void;
  counterBusy?: boolean;
}

export function OfferCard({ offer, unitLabel = "resolution", top, busy, onAccept, onCounter, counterBusy }: OfferCardProps) {
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

  return (
    <motion.article layout transition={T_DEFAULT} className={`${s.offer} ${top ? s.offerTop : ""}`} aria-label={`${offer.tierName} offer, ${fmtUnits(offer.units)} ${unitLabel}s`}>
      <div className={s.offerHead}>
        <div className={s.stackTight}>
          <div className={s.row}>
            <span className="h6">{offer.tierName}</span>
            <StatusTag state={offer.status} />
          </div>
          <div className={s.chips}>
            {origins.map((o) => (
              <span key={o} className={s.chip}>{ORIGIN_LABEL[o]}</span>
            ))}
          </div>
        </div>
        <div className={s.stackTight} style={{ alignItems: "flex-end" }}>
          <span className={s.offerTotal}>
            <Money usd={offer.prepaidTotalUsd} />
          </span>
          <span className="body3">prepaid for the term</span>
        </div>
      </div>
      <div className={s.offerFacts}>
        <span><strong>{fmtUnits(offer.units)}</strong> {unitLabel}s</span>
        <span><strong><Money usd={offer.unitPriceUsd} digits={offer.unitPriceUsd.split(".")[1]?.length && offer.unitPriceUsd.split(".")[1]!.length > 2 ? 4 : 2} /></strong> per {unitLabel}</span>
        {offer.overagePriceUsd && <span>Overage <strong><Money usd={offer.overagePriceUsd} /></strong></span>}
        {offer.includes.length > 0 && <span>Includes {offer.includes.join(", ")}</span>}
      </div>
      {offer.unsupportedIntegrations.length > 0 && (
        <Notice tone="warn">
          {offer.unsupportedIntegrations.map(prettyIntegration).join(", ")} {offer.unsupportedIntegrations.length > 1 ? "are" : "is"} not supported and is excluded from these terms.
        </Notice>
      )}
      {offer.publicReasons.filter((r) => !/integrations are not available/.test(r)).map((r) => (
        <p key={r} className="body3">{r}</p>
      ))}
      <div className={s.offerActions}>
        <ActionButton variant={top ? "primary" : "secondary"} onClick={() => onAccept(offer)} loading={busy} disabled={offer.status === "rejected"} loadingLabel="Preparing the quote">
          {needsApproval ? "Request seller approval" : "Accept this offer"}
        </ActionButton>
        {onCounter && (
          <ActionButton variant="ghost" onClick={() => setCounterOpen((o) => !o)} aria-expanded={counterOpen} aria-controls={formId}>
            Make a counteroffer
          </ActionButton>
        )}
      </div>
      <AnimatePresence initial={false}>
        {counterOpen && onCounter && (
          <motion.form
            id={formId}
            key="counter"
            onSubmit={submit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={T_DEFAULT}
            style={{ overflow: "hidden" }}
            noValidate
          >
            <div className={s.counter}>
              <fieldset className={s.segmented}>
                <legend className="sr-only">Counter with</legend>
                <label>
                  <input type="radio" name={`${formId}-mode`} checked={mode === "total"} onChange={() => setMode("total")} />
                  Target total
                </label>
                <label>
                  <input type="radio" name={`${formId}-mode`} checked={mode === "units"} onChange={() => setMode("units")} />
                  Target units
                </label>
              </fieldset>
              <Field
                label={mode === "total" ? `Total for ${fmtUnits(offer.units)} ${unitLabel}s (USDC)` : `${unitLabel[0]!.toUpperCase()}${unitLabel.slice(1)}s for ${offer.prepaidTotalUsd} USDC`}
                inputMode={mode === "total" ? "decimal" : "numeric"}
                placeholder={mode === "total" ? "1500" : "1800"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                error={err}
                hint="The seller's rules decide instantly. Nothing is binding until you sign."
              />
              <div className={s.row}>
                <ActionButton type="submit" variant="secondary" loading={counterBusy} loadingLabel="Checking with the seller">
                  Send counteroffer
                </ActionButton>
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

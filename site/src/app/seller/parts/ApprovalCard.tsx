import { useState } from "react";
import { Link } from "react-router-dom";
import { ActionButton, Field, Money, MonoValue, Notice, ToolApproval, type ToolApprovalStatus } from "../kit";
import { useDecideApproval } from "../api";
import { MarginVsFloor, RuleChips } from "./Rules";
import { SellerOnlyTag } from "./SellerOnly";
import { dateTime, relTime, units } from "../format";
import { errorMessage } from "../transport";
import type { Approval } from "../types";
import s from "../seller.module.css";

const STATUS: Record<Approval["status"], ToolApprovalStatus> = { pending: "pending", approved: "approved", declined: "denied", expired: "denied" };

/** ToolApproval-style card for one owner approval, with a reason field and Approve / Decline. */
export function ApprovalCard({ a, showNegotiationLink = true, floorBps }: { a: Approval; showNegotiationLink?: boolean; floorBps?: string }) {
  const m = useDecideApproval();
  const [reason, setReason] = useState("");
  const pending = a.status === "pending";
  const floor = a.floorBps ?? floorBps;
  return (
    <ToolApproval
      tool="seller.approve_quote"
      moneyMovement
      status={m.isPending ? "approving" : STATUS[a.status]}
      title={`${a.buyer}: ${a.tierName}, ${units(a.units)} units`}
      description={
        <>
          {a.productName ? `${a.productName} · ` : ""}quote <span className={s.mono}>{a.quoteId}</span>
          {showNegotiationLink && a.negotiationId && (
            <>
              {" · "}
              <Link className={s.link} to={`/app/sell/negotiations/${encodeURIComponent(a.negotiationId)}`}>
                Open negotiation
              </Link>
            </>
          )}
        </>
      }
      parameters={[
        { label: "Buyer", value: a.buyerAddress ? <MonoValue value={a.buyerAddress} short copy label="buyer address" /> : a.buyer },
        { label: "Package", value: `${a.tierName}, ${units(a.units)} units` },
        { label: "Prepaid total", value: <Money micro={a.prepaidTotal} /> },
        { label: <span className={s.row} style={{ gap: 6 }}>Margin <SellerOnlyTag /></span>, value: a.marginBps ? <MarginVsFloor bps={a.marginBps} floor={floor} /> : "Not reported" },
        { label: "Rule ids", value: <RuleChips rules={a.ruleIds} /> },
        pending
          ? { label: "Expires", value: a.expiresAt ? `${dateTime(a.expiresAt)} (${relTime(a.expiresAt)})` : "With the quote" }
          : { label: "Decided", value: a.decidedAt ? dateTime(a.decidedAt) : "Yes" },
      ]}
    >
      {pending ? (
        <div className={s.decide}>
          <Field label="Reason (optional)" hint="Kept in the decisions log. The buyer only sees approved or declined." value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
          <div className={s.formActions}>
            <ActionButton onClick={() => m.mutate({ id: a.id, decision: "approve", reason })} loading={m.isPending && m.variables?.decision === "approve"} loadingLabel="Approving" disabled={m.isPending}>
              Approve
            </ActionButton>
            <ActionButton variant="danger" onClick={() => m.mutate({ id: a.id, decision: "decline", reason })} loading={m.isPending && m.variables?.decision === "decline"} loadingLabel="Declining" disabled={m.isPending}>
              Decline
            </ActionButton>
          </div>
        </div>
      ) : a.reason ? (
        <p className="body3">Reason: {a.reason}</p>
      ) : undefined}
    </ToolApproval>
  );
}

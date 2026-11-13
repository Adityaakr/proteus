import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { ARC_NETWORK_NAMES, defaultNetwork, explorerTx } from "@proteus/domain";
import { ActionButton, Card, DataTable, ExplorerLink, KeyValue, Money, MonoValue, Notice, StatusTag } from "../kit";
import { useCloseTerm, useDeal, useRecordDelivery } from "../api";
import { Field } from "../../ui/Field";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api as appApi, downloadFile } from "../../lib/api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { SellerOnly } from "../parts/SellerOnly";
import { JournalTable } from "../parts/JournalTable";
import { big, dateTime, pct, unixToDate, units } from "../format";
import { errorMessage } from "../transport";
import type { BuyerOrderDetails, DealDetail as Deal } from "../types";
import s from "../seller.module.css";

const shortId = (v: string) => (v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);

export default function DealDetail() {
  const { id = "" } = useParams();
  const q = useDeal(id);
  return (
    <div className={s.page}>
      <PageHeader
        title={q.data ? q.data.productName ?? `Deal ${q.data.publicId}` : "Deal"}
        back={{ to: "/app/sell/deals", label: "Deals" }}
        status={
          q.data && (
            <>
              <StatusTag state={q.data.status} />
              {q.data.network === "illustrative" && <StatusTag network="illustrative" label="Illustrative, no chain transaction" />}
            </>
          )
        }
        description={q.data ? `Onchain deal #${shortId(q.data.dealIdOnchain)} · ${q.data.publicId}` : undefined}
        sellerLabel={q.data?.labels.seller ?? "sandbox"}
        actions={
          q.data && (
            <ActionButton variant="secondary" to={`/records/${encodeURIComponent(q.data.publicId)}`} iconLeft={<ExternalLink size={16} />}>
              Public record
            </ActionButton>
          )
        }
      />
      <QueryView q={q} label="deal">
        {(d) => <Body d={d} />}
      </QueryView>
    </div>
  );
}

function Body({ d }: { d: Deal }) {
  const b = d.balances;
  const dep = big(b.deposit) || 1n;
  const w = (v: string) => `${Number((big(v) * 10000n) / dep) / 100}%`;
  const t = d.terms;
  const unitNum = big(t.unitNum);
  const unitDen = big(t.unitDen) || 1n;
  return (
    <>
      <OrderDetails dealId={d.id} items={d.orderDetails ?? []} />

      <Card
        title="Balances"
        subtitle={b.source === "chain" ? "Read from the escrow contract." : "Pending: waiting for the funding transaction to confirm."}
        actions={<StatusTag tone={b.source === "chain" ? "success" : "warn"} label={b.source === "chain" ? "Source: chain" : "Source: pending"} />}
      >
        <div className={s.balances}>
          {[
            ["Deposit", b.deposit],
            ["Settled to you", b.settled],
            ["Refunded to buyer", b.refunded],
            ["Remaining in escrow", b.remaining],
          ].map(([k, v]) => (
            <div key={k} className={s.bal}>
              <span className="body3">{k}</span>
              <span className={s.balValue}><Money micro={v} /></span>
            </div>
          ))}
        </div>
        <div className={s.meter} role="img" aria-label={`Settled ${w(b.settled)}, refunded ${w(b.refunded)}, remaining ${w(b.remaining)} of the deposit`}>
          <span className={s.meterSettled} style={{ width: w(b.settled) }} />
          <span className={s.meterRefunded} style={{ width: w(b.refunded) }} />
        </div>
        <div className={s.legend}>
          <span><span className={s.legendDot} style={{ background: "var(--c-primary)" }} />Settled</span>
          <span><span className={s.legendDot} style={{ background: "var(--c-dark-40)" }} />Refunded</span>
          <span><span className={s.legendDot} style={{ background: "var(--c-dark-5)", boxShadow: "inset 0 0 0 1px var(--c-dark-20)" }} />Remaining</span>
        </div>
      </Card>

      <div className={s.grid2}>
        <Card title="Signed terms" subtitle="The exact EIP-712 message both parties signed.">
          <KeyValue
            items={[
              { k: "Unit price", v: <Money micro={(unitNum / unitDen).toString()} digits={4} /> },
              { k: "Max units", v: <span className={s.mono}>{units(t.maxUnits)}</span> },
              { k: "Prepaid", v: <Money micro={t.prepaid} /> },
              { k: "Term", v: `${unixToDate(t.start)} to ${unixToDate(t.end)}` },
              { k: "Refundable from", v: dateTime(d.refundableAt) },
              { k: "Billable unit", v: d.publicTerms.billableUnit },
              { k: "Includes", v: d.publicTerms.includes.join(", ") },
              { k: "Terms hash", v: <MonoValue value={t.publicTermsHash ?? ""} short copy label="public terms hash" /> },
            ]}
          />
        </Card>
        <Card title="Parties and funding">
          <KeyValue
            items={[
              { k: "Buyer", v: <MonoValue value={d.buyerAddress} short copy label="buyer address" /> },
              { k: "Buyer signature", v: <MonoValue value={d.signatures.buyer} short copy label="buyer signature" /> },
              { k: "Seller", v: <MonoValue value={t.seller ?? ""} short copy label="seller address" /> },
              { k: "Seller signature", v: <MonoValue value={d.signatures.seller} short copy label="seller signature" /> },
              { k: "Payee", v: <MonoValue value={d.sellerPayee} short copy label="payee address" /> },
              { k: "Escrow", v: d.explorer.escrow ? <ExplorerLink href={d.explorer.escrow} hash={d.escrowAddress} /> : <MonoValue value={d.escrowAddress} short copy label="escrow address" /> },
              {
                k: "Funding tx",
                v: d.funding.txHash ? (
                  <ExplorerLink href={d.funding.explorerUrl ?? explorerTx(d.funding.txHash)} hash={d.funding.txHash} />
                ) : d.status === "awaiting_funding" ? (
                  <StatusTag state="awaiting_funding" />
                ) : (
                  <span className={s.muted}>No transaction hash recorded</span>
                ),
              },
              { k: "Confirmed", v: d.funding.confirmedAt ? dateTime(d.funding.confirmedAt) : "Not yet" },
            ]}
          />
        </Card>
      </div>

      <div className={s.grid2}>
        <Card title="Usage" subtitle="Billable units are charged only after the buyer acknowledges them.">
          <KeyValue
            items={[
              { k: "Units delivered", v: <span className={s.mono}>{units(d.usage.units)} of {units(t.maxUnits)}</span> },
              { k: "Charged (cumulative)", v: <Money micro={d.usage.charged} /> },
              { k: "Settled onchain", v: <Money micro={d.usage.settled} /> },
              { k: "Awaiting settlement", v: <Money micro={(big(d.usage.charged) - big(d.usage.settled)).toString()} /> },
            ]}
          />
        </Card>
        {d.economics && (
          <SellerOnly title="Deal economics" description="Expected at signing, from the cost model version in force then." as="div">
            <KeyValue
              items={[
                { k: "Revenue", v: <Money micro={d.economics.expectedRevenue} /> },
                { k: "Variable cost", v: <Money micro={d.economics.expectedVariableCost} /> },
                { k: "Tx cost", v: <Money micro={d.economics.expectedTxCost} /> },
                { k: "Direct cost", v: <Money micro={d.economics.allocatedDirectCost} /> },
                { k: "Contribution", v: <Money micro={d.economics.expectedContribution} /> },
                { k: "Margin", v: <span className={s.mono}>{pct(d.economics.expectedContributionMarginBps)}</span> },
              ]}
            />
          </SellerOnly>
        )}
      </div>

      <Card title="Settlements and chain transactions">
        <DataTable
          columns={[
            { key: "kind", header: "Type", render: (x) => <span className={s.strong}>{x.kind}</span> },
            { key: "at", header: "Date", render: (x) => dateTime(x.at) },
            { key: "amt", header: "Amount", numeric: true, render: (x) => (x.amount ? <Money micro={x.amount} /> : "") },
            { key: "st", header: "Status", render: (x) => (x.status ? <StatusTag state={x.status} /> : "") },
            { key: "tx", header: "Transaction", render: (x) => <ExplorerLink href={x.explorerUrl ?? explorerTx(x.txHash)} hash={x.txHash} /> },
          ]}
          rows={d.chainTxs}
          rowKey={(x) => x.txHash + x.kind}
          empty={<p className="body3">No chain transactions recorded for this deal yet. Funding, settlements and refunds appear here with explorer links once they confirm.</p>}
        />
      </Card>

      <Card title="Journal" subtitle="Double-entry lines for this deal.">
        <JournalTable rows={d.journal} />
      </Card>

      <SellerDispute dealId={d.id} />

      {(d.status === "funded" || d.status === "active") && <OrderUpdates dealId={d.id} />}
      {(d.status === "funded" || d.status === "active") && <RecordDelivery d={d} />}

      <CloseTerm d={d} />
    </>
  );
}

/**
 * Seller-confirmed delivery for physical goods and offline work. Each batch becomes a signed receipt; the buyer is
 * paid out of escrow only after countersigning the cumulative total, exactly like metered API usage.
 */
/** A dispute on this deal, as the buyer opened it on the escrow; the arbiter can only split the unspent balance. */
function SellerDispute({ dealId }: { dealId: string }) {
  const q = useQuery({ queryKey: ["deal-dispute", dealId], queryFn: () => appApi.dealDispute(dealId), retry: false });
  const x = q.data?.dispute;
  if (!x) return null;
  return (
    <Card title={x.status === "open" ? "Dispute open" : "Dispute resolved"} subtitle={`Opened by the ${x.openedBy}. Decided by the escrow arbiter, who can only split the unspent balance.`}>
      <div className={s.fields}>
        <p className="body2">“{x.reason}”</p>
        <KeyValue
          items={[
            { k: "Opened", v: <ExplorerLink href={explorerTx(x.openTx)} hash={x.openTx} /> },
            ...(x.status === "resolved"
              ? [
                  { k: "To you", v: <Money micro={x.toSeller ?? "0"} /> },
                  { k: "To the buyer", v: <Money micro={x.toBuyer ?? "0"} /> },
                  ...(x.resolveTx ? [{ k: "Resolved", v: <ExplorerLink href={explorerTx(x.resolveTx)} hash={x.resolveTx} /> }] : []),
                ]
              : []),
          ]}
        />
        {x.status === "open" && <Notice tone="warn">The deal is frozen: no settlement or refund until the arbiter decides. Share any evidence with the arbiter.</Notice>}
      </div>
    </Card>
  );
}

/** Order status the buyer sees on its "Your order" page, like a shop's order tracking. */
const UPDATE_BUTTONS: { status: "accepted" | "in_production" | "shipped" | "out_for_delivery" | "delayed" | "note"; label: string }[] = [
  { status: "accepted", label: "Order accepted" },
  { status: "in_production", label: "In production" },
  { status: "shipped", label: "Shipped" },
  { status: "out_for_delivery", label: "Out for delivery" },
  { status: "delayed", label: "Delayed" },
  { status: "note", label: "Message" },
];

function OrderUpdates({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const tl = useQuery({ queryKey: ["seller-deal-timeline", dealId], queryFn: () => appApi.app.dealTimeline(dealId) });
  const [status, setStatus] = useState<(typeof UPDATE_BUTTONS)[number]["status"]>("accepted");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const m = useMutation({
    mutationFn: () => appApi.app.postOrderUpdate(dealId, { status, note: note.trim() || undefined, trackingUrl: tracking.trim() || undefined }),
    onSuccess: () => {
      setNote("");
      setTracking("");
      qc.invalidateQueries({ queryKey: ["seller-deal-timeline", dealId] });
    },
  });
  const needsNote = status === "note" || status === "delayed";
  const valid = (!needsNote || note.trim().length >= 2) && (!tracking || /^https:\/\//.test(tracking));
  const events = tl.data?.events ?? [];
  return (
    <Card title="Update the buyer" subtitle="The buyer sees each update on its order page, in order, like tracking a parcel. Notes and tracking links are encrypted and visible only to you and the buyer.">
      <div className={s.fields}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="radiogroup" aria-label="Order status">
          {UPDATE_BUTTONS.map((b) => (
            <button key={b.status} type="button" role="radio" aria-checked={status === b.status} onClick={() => setStatus(b.status)} className="body3" style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--c-dark-20, #d5d8de)", background: status === b.status ? "var(--c-dark-100, #111)" : "transparent", color: status === b.status ? "#fff" : "inherit", cursor: "pointer" }}>
              {b.label}
            </button>
          ))}
        </div>
        {(status === "shipped" || status === "out_for_delivery") && <Field label="Tracking link (optional)" value={tracking} onChange={(e) => setTracking(e.target.value.trim())} placeholder="https://www.courier.example/track/AB123" />}
        <Field label={needsNote ? (status === "delayed" ? "Why, and the new expected date" : "Message for the buyer") : "Note for the buyer (optional)"} value={note} onChange={(e) => setNote(e.target.value)} placeholder={status === "delayed" ? "Print run slipped a day; ships Thursday" : "Proof approved, printing starts tomorrow"} maxLength={1000} />
        {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
        {m.isSuccess && <Notice tone="success">Sent. The buyer sees "{m.data.label}" on its order page.</Notice>}
        <div className={s.formActions}>
          <ActionButton onClick={() => m.mutate()} disabled={!valid} loading={m.isPending} loadingLabel="Sending">Send update</ActionButton>
        </div>
        {events.length > 0 && (
          <ul className="body3" style={{ listStyle: "none", padding: 0, margin: "8px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
                <span style={{ opacity: 0.65 }}>{dateTime(e.at)}</span>
                <span>{e.label}{e.note ? `: “${e.note}”` : ""}{e.url ? <> · <a href={e.url} target="_blank" rel="noreferrer">link</a></> : null}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function RecordDelivery({ d }: { d: Deal }) {
  const m = useRecordDelivery(d.id);
  const left = big(d.terms.maxUnits) - big(d.usage.units);
  const [unitsText, setUnits] = useState("1");
  const [note, setNote] = useState("");
  const [proof, setProof] = useState("");
  const [batchKey, setBatchKey] = useState(() => `delivery-${Date.now().toString(36)}`);
  const n = Number(unitsText);
  const valid = Number.isInteger(n) && n >= 1 && BigInt(n) <= left && note.trim().length >= 3 && (!proof || /^https:\/\//.test(proof));
  const submit = () =>
    m.mutate(
      { units: n, note: note.trim(), proofUrl: proof.trim() || undefined, requestId: batchKey },
      { onSuccess: () => { setNote(""); setProof(""); setUnits("1"); setBatchKey(`delivery-${Date.now().toString(36)}`); } },
    );
  return (
    <Card title="Record a delivery" subtitle="For physical goods and work delivered outside an API. Each batch becomes a receipt signed by your signer; you are paid from escrow once the buyer countersigns.">
      {left <= 0n ? (
        <Notice>All {units(d.terms.maxUnits)} units in this agreement are recorded.</Notice>
      ) : (
        <div className={s.fields}>
          <Field label={`Units delivered (up to ${units(left.toString())} left)`} value={unitsText} onChange={(e) => setUnits(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" />
          <Field label="What was delivered" value={note} onChange={(e) => setNote(e.target.value)} placeholder="200 custom hoodies, printed and shipped in 4 boxes" maxLength={2000} />
          <Field label="Proof link (optional)" value={proof} onChange={(e) => setProof(e.target.value.trim())} placeholder="https://tracking.example.com/AB123 or a photo link" />
          {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
          {m.isSuccess && <Notice tone="success" title="Delivery recorded">{m.data.units} unit{m.data.units === 1 ? "" : "s"} added as a signed receipt. The buyer now sees it under usage to sign.</Notice>}
          <div className={s.formActions}>
            <ActionButton onClick={submit} disabled={!valid} loading={m.isPending} loadingLabel="Recording">Record delivery</ActionButton>
          </div>
          <p className="body3" style={{ opacity: 0.7 }}>Delivery is confirmed by you, not verified by Proteus AI. The buyer pays only for units they countersign and can open a dispute instead.</p>
        </div>
      )}
    </Card>
  );
}

function CloseTerm({ d }: { d: Deal }) {
  const m = useCloseTerm(d.id);
  const [confirming, setConfirming] = useState(false);
  const closed = d.status === "closed";
  return (
    <Card title="Close term early" subtitle="Ends the term now. Accepted usage settles to you and the unused balance becomes refundable to the buyer after the grace period.">
      {m.isSuccess ? (
        <Notice tone="success" title="Close submitted">
          Transaction <ExplorerLink href={explorerTx(m.data.txHash)} hash={m.data.txHash} />
        </Notice>
      ) : closed ? (
        <Notice>This term is already closed.</Notice>
      ) : confirming ? (
        <div className={s.confirm} role="group" aria-label="Confirm closing the term">
          <p className="body3">
            Close deal #{shortId(d.dealIdOnchain)} now? <Money micro={d.balances.remaining} /> remains in escrow. This sends a transaction on {ARC_NETWORK_NAMES[defaultNetwork()]} and cannot be undone.
          </p>
          {m.isError && <Notice tone="danger">{errorMessage(m.error)}</Notice>}
          <div className={s.formActions}>
            <ActionButton variant="danger" onClick={() => m.mutate()} loading={m.isPending} loadingLabel="Submitting">
              Yes, close the term
            </ActionButton>
            <ActionButton variant="ghost" onClick={() => setConfirming(false)} disabled={m.isPending}>
              Keep it open
            </ActionButton>
          </div>
        </div>
      ) : (
        <div>
          <ActionButton variant="danger" onClick={() => setConfirming(true)}>
            Close term early
          </ActionButton>
        </div>
      )}
    </Card>
  );
}

/** Everything the buyer typed or attached on this order, newest first, so the seller can fulfil it from one place. */
function OrderDetails({ dealId, items }: { dealId: string; items: BuyerOrderDetails[] }) {
  const [err, setErr] = useState<string | null>(null);
  const download = (reqId: string, key: string, name: string) => {
    setErr(null);
    downloadFile(`/app/deals/${dealId}/requests/${reqId}/files/${encodeURIComponent(key)}`, name).catch((e) => setErr(errorMessage(e)));
  };
  return (
    <Card
      title="Order details from the buyer"
      subtitle={items.length ? "What the buyer sent for this order, newest first. Use it to produce and ship, then record the delivery below." : "Nothing yet. When the buyer sends quantity, address, artwork or notes from their order page, it appears here and you get an alert."}
      actions={items.length ? <StatusTag tone="success" label={`${items.length} ${items.length === 1 ? "submission" : "submissions"}`} /> : undefined}
    >
      {items.map((it, i) => (
        <div key={it.id} className={s.orderDetails}>
          <span className="body3">{i === 0 ? "Latest, " : ""}sent {dateTime(it.at)}</span>
          <dl>
            {it.fields.map((f) => (
              <div key={f.key}>
                <dt>{f.label}</dt>
                <dd>
                  {f.file ? (
                    <button type="button" className={s.fileLink} onClick={() => download(it.id, f.key, f.file!.name)}>
                      {f.file.name} <span className={s.muted}>({Math.max(1, Math.round(f.file.size / 1024))} KB, download)</span>
                    </button>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      {err && <Notice tone="danger">{err}</Notice>}
    </Card>
  );
}

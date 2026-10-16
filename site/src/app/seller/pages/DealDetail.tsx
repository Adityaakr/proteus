import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import { ActionButton, Card, DataTable, ExplorerLink, KeyValue, Money, MonoValue, Notice, StatusTag } from "../kit";
import { useCloseTerm, useDeal } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { SellerOnly } from "../parts/SellerOnly";
import { JournalTable } from "../parts/JournalTable";
import { big, dateTime, pct, unixToDate, units } from "../format";
import { errorMessage } from "../transport";
import type { DealDetail as Deal } from "../types";
import s from "../seller.module.css";

const shortId = (v: string) => (v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v);

export default function DealDetail() {
  const { id = "" } = useParams();
  const q = useDeal(id);
  return (
    <div className={s.page}>
      <PageHeader
        title={q.data ? q.data.productName ?? `Deal ${q.data.publicId}` : "Deal"}
        back={{ to: "/app/deals", label: "Deals" }}
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

      <CloseTerm d={d} />
    </>
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
            Close deal #{shortId(d.dealIdOnchain)} now? <Money micro={d.balances.remaining} /> remains in escrow. This sends a transaction on Arc testnet and cannot be undone.
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

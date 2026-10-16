import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleDollarSign, FileText, Handshake, PenLine, RotateCcw, Server, type LucideIcon } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import { ReviewShell } from "../layouts/ReviewShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatCard } from "../ui/StatCard";
import { StatusTag } from "../ui/StatusTag";
import { ExplorerLink, KeyValue, MonoValue } from "../ui/misc";
import { api, qk, type ReviewEventKind } from "../lib/api";
import { ErrorState, PageHeader, fmtDateTime, prettyIntegration } from "../buyer/common";
import b from "../buyer/buyer.module.css";
import r from "./review.module.css";

const KIND: Record<ReviewEventKind, { label: string; icon: LucideIcon }> = {
  quote: { label: "Quote issued", icon: FileText },
  accept: { label: "Terms signed", icon: Handshake },
  fund: { label: "Escrow funded", icon: CircleDollarSign },
  service: { label: "Service provisioned", icon: Server },
  usage_accept: { label: "Usage acknowledged", icon: PenLine },
  settle: { label: "Settled to seller", icon: BadgeCheck },
  refund: { label: "Refunded to buyer", icon: RotateCcw },
};

export default function ReviewRecord() {
  const { publicId = "" } = useParams();
  const q = useQuery({ queryKey: qk.record(publicId), queryFn: () => api.reviewRecord(publicId) });
  return (
    <ReviewShell>
      {q.isLoading ? (
        <LoadingCard label="Loading record" lines={6} />
      ) : q.error || !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <PageHeader
            eyebrow={
              <>
                <StatusTag network={q.data.labels.network} />
                <StatusTag network={q.data.labels.seller === "sandbox" ? "sandbox" : "live"} label={q.data.labels.seller === "sandbox" ? "Demo seller" : "Live seller"} />
                <span className="body3">Record {publicId}</span>
              </>
            }
            title="Agreement record"
            lede="A redacted timeline of this agreement. Buyer identity, seller costs and conversation transcripts are never published."
            actions={<ActionButton variant="secondary" to="/review">All records</ActionButton>}
          />
          <div className={b.stats}>
            <StatCard label="Deposited" value={<Money micro={q.data.balances.deposit} />} />
            <StatCard label="Settled" value={<Money micro={q.data.balances.settled} />} />
            <StatCard label="Refunded" value={<Money micro={q.data.balances.refunded} />} />
            <StatCard label="Remaining" value={<Money micro={q.data.balances.remaining} />} hint={q.data.balances.source === "chain" ? "Read from chain" : "Pending chain confirmation"} />
          </div>
          <div className={b.grid2}>
            <Card title="Timeline" level={2}>
              <ol className={r.timeline}>
                {q.data.timeline.map((ev, i) => {
                  const k = KIND[ev.kind] ?? { label: ev.kind, icon: FileText };
                  const Icon = k.icon;
                  const href = ev.explorerUrl ?? (ev.txHash ? explorerTx(ev.txHash) : undefined);
                  return (
                    <li key={`${ev.at}-${i}`} className={r.event}>
                      <span className={r.dot} aria-hidden>
                        <Icon size={16} strokeWidth={2} />
                      </span>
                      <div className={r.eventBody}>
                        <div className={r.eventHead}>
                          <span className={r.kind}>{k.label}</span>
                          <time className={r.time} dateTime={ev.at}>{fmtDateTime(ev.at)}</time>
                        </div>
                        <p className="body3" style={{ color: "var(--c-dark-80)" }}>{ev.summary}</p>
                        {href ? (
                          <ExplorerLink href={href} hash={ev.txHash} />
                        ) : ["fund", "settle", "refund"].includes(ev.kind) ? (
                          <span className="body3">No transaction link {q.data.labels.network === "illustrative" ? "(illustrative record)" : "yet"}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
            <div className={b.stack}>
              <Card title="Public terms" level={2} padding="compact">
                <KeyValue
                  items={[
                    { k: "Billable unit", v: q.data.publicTerms.billableUnit },
                    { k: "Included", v: q.data.publicTerms.includes.join(", ") },
                    { k: "Integrations", v: q.data.publicTerms.integrations.map(prettyIntegration).join(", ") },
                    { k: "Term", v: `${q.data.publicTerms.termDays} days` },
                    ...(q.data.publicTerms.overage ? [{ k: "Overage", v: q.data.publicTerms.overage }] : []),
                    { k: "Refunds", v: q.data.publicTerms.refundPolicy },
                  ]}
                />
              </Card>
              <Card title="Commitment" level={2} padding="compact" subtitle="The EIP-712 terms hash both parties signed.">
                <MonoValue value={q.data.termsHash} short copy label="terms hash" />
              </Card>
            </div>
          </div>
        </>
      )}
    </ReviewShell>
  );
}

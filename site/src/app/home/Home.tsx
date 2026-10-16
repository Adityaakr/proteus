import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, Briefcase, MessagesSquare } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { TodoList, type TodoItem } from "../agentic/TodoList";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { Skeleton } from "../ui/Skeleton";
import { Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { api, errorMessage, isAuthError, qk, type DealSummary, type NegotiationSummary } from "../lib/api";
import { BalanceCard } from "../wallet/BalanceCard";
import { useBalances } from "../wallet/useBalances";
import { fmtDate, prettySlug } from "../buyer/common";
import h from "./home.module.css";

export default function Home() {
  const { me, meStatus, user } = useAuth();
  const bal = useBalances();
  const act = useQuery({ queryKey: qk.meActivity, queryFn: api.meActivity, retry: false });
  const negs = act.data?.negotiations ?? [];
  const deals = act.data?.deals ?? [];
  const activeNegs = negs.filter((n) => n.status === "open" || n.status === "quoted");
  const fundedDeals = deals.filter((d) => ["funded", "active", "funding_pending"].includes(d.status));
  const hasOrg = Boolean(me?.org);

  const funded = (bal.data?.usdc ?? 0n) > 0n;
  const negotiated = negs.length > 0 || deals.length > 0;
  const todos: TodoItem[] = [
    { id: "fund", label: <Link to="/app/wallet" className={h.todoLink}>Add testnet USDC</Link>, status: funded ? "completed" : "in-progress", detail: funded ? "Your wallet has a balance" : "Free from the Circle faucet" },
    { id: "neg", label: <Link to="/app/market" className={h.todoLink}>Negotiate your first deal</Link>, status: negotiated ? "completed" : funded ? "in-progress" : "pending", detail: negotiated ? undefined : "Pick a product in the market and talk to the seller's agent" },
    { id: "sell", label: <Link to="/app/sell" className={h.todoLink}>Start selling</Link>, status: hasOrg ? "completed" : "pending", detail: hasOrg ? `Selling as ${me!.org!.name}` : "Publish an AI service and let your agent negotiate" },
  ];
  const allDone = todos.every((t) => t.status === "completed");

  return (
    <AppShell title="Home">
      <div className={h.head}>
        <h1 className={h.title}>{user?.email ? `Welcome, ${user.email.split("@")[0]}` : "Welcome"}</h1>
        <p className="body1">Buy AI services on negotiated, escrowed terms, or sell your own. One account, one balance.</p>
      </div>

      {meStatus === "unauthorized" && (
        <Notice tone="info" title="Account sync pending">
          You are signed in, but the PROTEUS server has not linked this login yet. Your wallet works; lists of your negotiations and deals appear once it does.
        </Notice>
      )}

      <div className={h.grid}>
        <div className={h.stack}>
          <BalanceCard action={<ActionButton size="sm" to="/app/wallet" iconLeft={<ArrowDownToLine size={14} strokeWidth={2} />}>Deposit</ActionButton>} />

          <Card title="Active negotiations" actions={<Link to="/app/negotiations" className={h.more}>All <ArrowRight size={14} aria-hidden /></Link>} padding="compact">
            <ListState q={act} empty={<EmptyState icon={<MessagesSquare size={20} strokeWidth={1.75} />} title="No open negotiations" description="Start one from a product in the market." action={<ActionButton variant="secondary" to="/app/market">Browse the market</ActionButton>} />} count={activeNegs.length}>
              <ul className={h.list}>
                {activeNegs.slice(0, 4).map((n) => (
                  <NegRow key={n.id} n={n} />
                ))}
              </ul>
            </ListState>
          </Card>

          <Card title="Funded deals" subtitle="Prepaid balance still in escrow, refundable after the term." actions={<Link to="/app/deals" className={h.more}>All <ArrowRight size={14} aria-hidden /></Link>} padding="compact">
            <ListState q={act} empty={<p className="body3">No funded deals yet. A deal appears here once you fund it from your balance.</p>} count={fundedDeals.length}>
              <ul className={h.list}>
                {fundedDeals.slice(0, 4).map((d) => (
                  <DealRow key={d.id} d={d} />
                ))}
              </ul>
            </ListState>
          </Card>
        </div>

        <div className={h.stack}>
          {!allDone && (
            <Card title="Get started" padding="compact">
              <TodoList items={todos} title="Setup" />
            </Card>
          )}
          {hasOrg ? <SellWidget /> : (
            <Card title="Sell on PROTEUS" padding="compact" variant="muted">
              <p className="body2">List an AI service with published tiers. Your agent negotiates within your margin rules, and payouts land in this same wallet.</p>
              <div><ActionButton variant="secondary" to="/app/sell" iconLeft={<Briefcase size={16} strokeWidth={2} />}>Start selling</ActionButton></div>
            </Card>
          )}
          {act.data && act.data.payPerCall.calls > 0 && (
            <Card title="Pay per call" padding="compact">
              <p className="body2">{act.data.payPerCall.calls} paid calls, <Money micro={act.data.payPerCall.spent} unit /> spent.</p>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ListState({ q, empty, count, children }: { q: { isLoading: boolean; error: unknown }; empty: ReactNode; count: number; children: ReactNode }) {
  if (q.isLoading) return <Skeleton lines={3} />;
  if (q.error && !isAuthError(q.error)) return <Notice tone="warn">{errorMessage(q.error)}</Notice>;
  if (count === 0) return <>{empty}</>;
  return <>{children}</>;
}

function NegRow({ n }: { n: NegotiationSummary }) {
  return (
    <li>
      <Link to={`/app/negotiations/${n.id}`} className={h.row}>
        <span className={h.rowMain}>
          <span className={h.rowTitle}>{prettySlug(n.productSlug)}</span>
          <span className="body3">Started {fmtDate(n.createdAt)}{n.bestOfferUsd ? `, best offer $${n.bestOfferUsd}` : ""}</span>
        </span>
        <StatusTag state={n.status} />
      </Link>
    </li>
  );
}

function DealRow({ d }: { d: DealSummary }) {
  return (
    <li>
      <Link to={`/app/deals/${d.id}`} className={h.row}>
        <span className={h.rowMain}>
          <span className={h.rowTitle}>{prettySlug(d.productSlug ?? "Deal")}</span>
          <span className="body3"><Money micro={d.remaining} /> remaining of <Money micro={d.deposit} /></span>
        </span>
        <StatusTag state={d.status} />
      </Link>
    </li>
  );
}

function SellWidget() {
  const { me } = useAuth();
  const ov = useQuery({ queryKey: ["sell", "overview"], queryFn: api.app.overview, retry: false });
  return (
    <Card title={`Selling as ${me?.org?.name ?? "your business"}`} actions={<StatusTag network="sandbox" label="Sandbox seller" />} padding="compact">
      {ov.isLoading ? (
        <Skeleton lines={2} />
      ) : ov.data ? (
        <dl className={h.kv}>
          <dt>Approvals waiting</dt>
          <dd className="app-mono">{ov.data.approvalsPending}</dd>
          <dt>Deals funded</dt>
          <dd className="app-mono">{ov.data.dealsFunded}</dd>
          <dt>Earned and settled</dt>
          <dd><Money micro={ov.data.earnedSettled} /></dd>
        </dl>
      ) : (
        <p className="body3">Open the seller console for products, approvals and finance.</p>
      )}
      <div><ActionButton variant="secondary" to="/app/sell" icon>Open seller console</ActionButton></div>
    </Card>
  );
}


import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, ArrowRight, Briefcase, Check } from "lucide-react";
import { DepositDialog } from "../wallet/DepositDialog";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Money } from "../ui/Money";
import { NetworkBadge, statusLabel } from "../ui/StatusTag";
import { UsdcMark } from "../ui/Marks";
import { walletErrorMessage } from "../lib/wallet";
import { Skeleton } from "../ui/Skeleton";
import { Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import type { TodoItem } from "../agentic/TodoList";
import { api, errorMessage, isAuthError, qk, type DealSummary, type NegotiationSummary } from "../lib/api";
import { formatNative, useBalances } from "../wallet/useBalances";
import { fmtDate, prettySlug } from "../buyer/common";
import h from "./home.module.css";

export default function Home() {
  const { me, meStatus, user } = useAuth();
  const bal = useBalances();
  const [deposit, setDeposit] = useState(false);
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

  const name = user?.email ? user.email.split("@")[0] : null;
  const todoClass = (st: TodoItem["status"]) => (st === "completed" ? h.todoDone : st === "in-progress" ? h.todoNow : "");

  return (
    <AppShell title="Home">
      <div className={h.head}>
        <h1 className={h.title}>{name ? `Welcome, ${name}` : "Welcome"}</h1>
        <p className={h.lede}>Buy AI services on negotiated, escrowed terms, or sell your own. One account, one balance.</p>
      </div>

      {meStatus === "unauthorized" && (
        <Notice tone="info" title="Account sync pending">
          You are signed in, but the Proteus AI server has not linked this login yet. Your wallet works; lists of your negotiations and deals appear once it does.
        </Notice>
      )}

      <div className={h.grid}>
        <div className={h.doc}>
          <section className={h.section} aria-labelledby="h-bal">
            <div className={h.sectionHead}>
              <span id="h-bal" className={h.label}>Balance</span>
              <Link to="/app/wallet" className={h.more}>Wallet <ArrowRight size={14} aria-hidden /></Link>
            </div>
            <div className={h.balanceRow}>
              {bal.isLoading ? (
                <Skeleton width={180} height={40} />
              ) : bal.error ? (
                <Notice tone="warn" title="Could not read your balance">{walletErrorMessage(bal.error)}</Notice>
              ) : (
                <span className={h.balance}>
                  <Money micro={bal.data?.usdc ?? 0n} />
                  <span className={h.balanceUnit}><UsdcMark size={18} /> USDC</span>
                </span>
              )}
              <ActionButton size="sm" onClick={() => setDeposit(true)} iconLeft={<ArrowDownToLine size={14} strokeWidth={2} />}>Deposit</ActionButton>
            </div>
            <div className={h.fineRow}>
              <NetworkBadge network="testnet" />
              <p className={h.fine}>Gas on Arc is paid from this same balance{bal.data ? `, native ${formatNative(bal.data.native)}` : ""}.</p>
            </div>
            <DepositDialog open={deposit} onClose={() => setDeposit(false)} />
          </section>

          <section className={h.section} aria-labelledby="h-negs">
            <div className={h.sectionHead}>
              <span id="h-negs" className={h.label}>Active negotiations</span>
              <Link to="/app/negotiations" className={h.more}>All <ArrowRight size={14} aria-hidden /></Link>
            </div>
            <ListState q={act} empty={<p className={h.empty}>No open negotiations. Start one from a product in the <Link to="/app/market" className={h.emptyLink}>market</Link>.</p>} count={activeNegs.length}>
              <ul className={h.list}>
                {activeNegs.slice(0, 4).map((n) => (
                  <NegRow key={n.id} n={n} />
                ))}
              </ul>
            </ListState>
          </section>

          <section className={h.section} aria-labelledby="h-deals">
            <div className={h.sectionHead}>
              <span id="h-deals" className={h.label}>Funded deals</span>
              <Link to="/app/deals" className={h.more}>All <ArrowRight size={14} aria-hidden /></Link>
            </div>
            <ListState q={act} empty={<p className={h.empty}>No funded deals yet. A deal appears here once you fund it from your balance; the prepaid amount stays in escrow and is refundable after the term.</p>} count={fundedDeals.length}>
              <ul className={h.list}>
                {fundedDeals.slice(0, 4).map((d) => (
                  <DealRow key={d.id} d={d} />
                ))}
              </ul>
            </ListState>
          </section>
        </div>

        <aside className={h.rail}>
          {!allDone && (
            <section className={h.section} aria-labelledby="h-start">
              <span id="h-start" className={h.label}>Get started</span>
              <ol className={h.todos}>
                {todos.map((t) => (
                  <li key={t.id}>
                    <div className={`${h.todo} ${todoClass(t.status)}`}>
                      <span className={h.todoIcon} aria-hidden>{t.status === "completed" && <Check size={11} strokeWidth={3} />}</span>
                      <span className={h.todoBody}>
                        {t.label}
                        {t.detail && <span className={h.todoSub}>{t.detail}</span>}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {hasOrg ? (
            <SellWidget />
          ) : (
            <section className={h.section} aria-labelledby="h-sell">
              <span id="h-sell" className={h.label}>Sell on Proteus AI</span>
              <h2 className={h.railTitle}>Let your agent negotiate for you</h2>
              <p className={h.railText}>List an AI service with published tiers. Your agent negotiates within your margin rules, and payouts land in this same wallet.</p>
              <div><ActionButton variant="secondary" size="sm" to="/app/sell" iconLeft={<Briefcase size={14} strokeWidth={2} />}>Start selling</ActionButton></div>
            </section>
          )}
          {act.data && act.data.payPerCall.calls > 0 && (
            <section className={h.section} aria-labelledby="h-ppc">
              <span id="h-ppc" className={h.label}>Pay per call</span>
              <p className={h.railText}>{act.data.payPerCall.calls} paid {act.data.payPerCall.calls === 1 ? "call" : "calls"}, <Money micro={act.data.payPerCall.spent} unit /> spent.</p>
            </section>
          )}
        </aside>
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
          <span className={h.rowSub}>{n.sellerName ? `${n.sellerName}, ` : ""}started {fmtDate(n.createdAt)}{n.bestOfferUsd ? `, best offer $${n.bestOfferUsd}` : ""}</span>
        </span>
        <span className={h.state}>{statusLabel(n.status)}</span>
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
          <span className={h.rowSub}><Money micro={d.remaining} /> remaining of <Money micro={d.deposit} /></span>
        </span>
        <span className={h.state}>{statusLabel(d.status)}</span>
      </Link>
    </li>
  );
}

function SellWidget() {
  const { me } = useAuth();
  const ov = useQuery({ queryKey: ["sell", "overview"], queryFn: api.app.overview, retry: false });
  return (
    <section className={h.section} aria-labelledby="h-sellas">
      <div className={h.sectionHead}>
        <span id="h-sellas" className={h.label}>Selling as {me?.org?.name ?? "your business"}</span>
        <Link to="/app/sell" className={h.more}>Console <ArrowRight size={14} aria-hidden /></Link>
      </div>
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
        <p className={h.railText}>Your seller overview is not available right now.</p>
      )}
    </section>
  );
}


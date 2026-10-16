import { Banknote, CircleCheck, Receipt, RotateCcw, TriangleAlert, Wallet } from "lucide-react";
import { Card, EmptyState, Money, Notice, StatCard, StatusTag } from "../kit";
import { useFinance } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { JournalTable } from "../parts/JournalTable";
import { dateTime, relTime } from "../format";
import s from "../seller.module.css";

export default function Finance() {
  const q = useFinance();
  return (
    <div className={s.page}>
      <PageHeader description="Prepaid USDC moves from liability to earned only when the buyer accepts usage and it settles onchain." />
      <QueryView q={q} label="finance">
        {(f) => {
          const rec = f.reconciliation;
          const ran = Boolean(rec.lastRunAt);
          const ok = rec.discrepancies.length === 0;
          const testnet = <StatusTag network="testnet" label="Testnet" noDot />;
          return (
            <>
              <div className={s.stats}>
                <StatCard label="Funded" icon={<Wallet size={14} />} value={<span className={s.statMoney}><Money micro={f.funded} /></span>} hint="Deposited into escrow" tag={testnet} />
                <StatCard label="Earned (settled)" icon={<Banknote size={14} />} value={<span className={s.statMoney}><Money micro={f.earned} /></span>} hint="Settled to your payee" tag={testnet} />
                <StatCard label="Pending liability" icon={<Receipt size={14} />} value={<span className={s.statMoney}><Money micro={f.liability} /></span>} hint="Prepaid, not yet earned" tag={testnet} />
                <StatCard label="Refunded" icon={<RotateCcw size={14} />} value={<span className={s.statMoney}><Money micro={f.refunded} /></span>} hint="Returned to buyers" tag={testnet} />
              </div>
              <Card
                title="Reconciliation"
                subtitle={rec.lastRunAt ? `Ledger compared with escrow balances ${relTime(rec.lastRunAt)} (${dateTime(rec.lastRunAt)}).` : "Reconciliation has not run yet."}
                actions={!ran ? <StatusTag tone="neutral" label="Not run yet" /> : <StatusTag tone={ok ? "success" : "danger"} icon={ok ? <CircleCheck size={12} /> : <TriangleAlert size={12} />} label={ok ? "Matches chain" : `${rec.discrepancies.length} discrepanc${rec.discrepancies.length === 1 ? "y" : "ies"}`} />}
              >
                {!ran ? (
                  <p className="body3">No comparison against the escrow contract has run, so these balances are unverified. The check runs on a schedule inside the API once it is connected to Arc testnet.</p>
                ) : ok ? (
                  <p className="body3">Every journal balance matches the escrow contract. The check runs on a schedule inside the API.</p>
                ) : (
                  <div className={s.stack} style={{ gap: 8 }}>
                    {rec.discrepancies.map((d, i) => (
                      <Notice key={d.id ?? i} tone="danger">{d.summary}</Notice>
                    ))}
                  </div>
                )}
              </Card>
              <Card title="Journal" subtitle="All deals, newest first. Each funding, settlement and refund posts balanced debit and credit lines.">
                {f.journal.length ? (
                  <JournalTable rows={f.journal} showDeal={f.journal.some((j) => j.dealPublicId)} />
                ) : (
                  <EmptyState title="No journal entries yet" description="Entries post when a buyer funds a deal. Approve a quote or share your product page to get the first one." />
                )}
              </Card>
            </>
          );
        }}
      </QueryView>
    </div>
  );
}

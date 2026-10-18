import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import { Check, FlaskConical } from "lucide-react";
import { ActionButton, Card, LoadingCard, Notice, StatusTag } from "../kit";
import { isUnauthorized, useStartSandbox } from "../api";
import { errorMessage } from "../transport";
import s from "./parts.module.css";

/** Loading, no-session, and error handling for one query; renders children with data. */
export function QueryView<T>({ q, label, children }: { q: UseQueryResult<T>; label: string; children: (data: T) => ReactNode }) {
  if (q.isPending) return <LoadingCard label={`Loading ${label}`} />;
  if (q.isError) {
    if (isUnauthorized(q.error)) return <SandboxGate />;
    return (
      <Card title={`Could not load ${label}`}>
        <div className={s.errorBox}>
          <Notice tone="danger">{errorMessage(q.error)}</Notice>
          <ActionButton variant="secondary" onClick={() => q.refetch()} loading={q.isFetching}>
            Try again
          </ActionButton>
        </div>
      </Card>
    );
  }
  return <>{children(q.data as T)}</>;
}

/** Shown when there is no seller session: one action, creates the sandbox session, then reloads data. */
export function SandboxGate() {
  const start = useStartSandbox();
  return (
    <div className={s.gate}>
      <Card
        title="Try the demo seller"
        subtitle="No account needed. You get the labeled demo seller with one product, live negotiations and real deals on Arc."
        actions={<StatusTag network="sandbox" label="Sandbox seller" icon={<FlaskConical size={12} />} />}
      >
        <ul className={s.gateList}>
          {["See the private cost model and policy behind every quote", "Approve or decline quotes above your threshold", "Follow funded deals, settlements and the journal on Arc"].map((t) => (
            <li key={t} className="body3">
              <Check size={16} strokeWidth={2} color="var(--c-green)" aria-hidden style={{ flex: "none", marginTop: 2 }} />
              {t}
            </li>
          ))}
        </ul>
        {start.isError && <Notice tone="danger">{errorMessage(start.error)}</Notice>}
        <ActionButton onClick={() => start.mutate()} loading={start.isPending} loadingLabel="Opening demo seller" icon>
          Try the demo seller
        </ActionButton>
        <p className="body3" style={{ fontSize: 12 }}>
          Owners of a live seller sign in with Privy. Demo data never counts toward live totals.
        </p>
      </Card>
    </div>
  );
}

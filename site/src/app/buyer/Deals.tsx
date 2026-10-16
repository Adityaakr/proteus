import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { SandboxNote } from "../layouts/SandboxNote";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { Notice } from "../ui/misc";
import { StatusTag } from "../ui/StatusTag";
import { api, isAuthError, qk, type DealSummary } from "../lib/api";
import { ErrorState, PageHeader, fmtDate, prettySlug } from "./common";

export default function Deals() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: qk.meDeals, queryFn: api.meDeals, retry: false });
  const empty = <EmptyState icon={<Handshake size={20} strokeWidth={1.75} />} title="No deals yet" description="Accept an offer in a negotiation and fund it from your balance." action={<ActionButton variant="secondary" size="sm" to="/app/market">Browse the market</ActionButton>} />;
  return (
    <AppShell title="Deals">
      <PageHeader title="Deals" lede="Prepaid agreements held in escrow. The seller is paid only for usage you sign." />
      <SandboxNote />
      {q.isLoading ? (
        <LoadingCard lines={4} />
      ) : q.error && isAuthError(q.error) ? (
        <>
          <Notice tone="info" title="Account sync pending">The server has not linked your login yet, so your deals cannot be listed.</Notice>
          {empty}
        </>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Card padding="flush">
          <DataTable<DealSummary>
            caption="Your deals, newest first"
            rows={q.data ?? []}
            rowKey={(d) => d.id}
            onRowClick={(d) => navigate(`/app/deals/${d.id}`)}
            empty={empty}
            columns={[
              { key: "product", header: "Product", render: (d) => prettySlug(d.productSlug ?? "Deal") },
              { key: "status", header: "Status", render: (d) => <StatusTag state={d.status} /> },
              { key: "deposit", header: "Deposit", numeric: true, render: (d) => <Money micro={d.deposit} /> },
              { key: "remaining", header: "Remaining", numeric: true, render: (d) => <Money micro={d.remaining} /> },
              { key: "created", header: "Created", render: (d) => fmtDate(d.createdAt) },
            ]}
          />
        </Card>
      )}
    </AppShell>
  );
}

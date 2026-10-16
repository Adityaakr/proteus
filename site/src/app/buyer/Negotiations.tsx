import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MessagesSquare } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { Notice } from "../ui/misc";
import { StatusTag } from "../ui/StatusTag";
import { api, isAuthError, qk, type NegotiationSummary } from "../lib/api";
import { ErrorState, PageHeader, fmtDateTime, prettySlug } from "./common";

export default function Negotiations() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: qk.meNegotiations, queryFn: api.meNegotiations, retry: false });
  const empty = <EmptyState icon={<MessagesSquare size={20} strokeWidth={1.75} />} title="No negotiations yet" description="Open a product in the market and tell the seller's agent what you need." action={<ActionButton to="/app/market">Browse the market</ActionButton>} />;
  return (
    <AppShell title="Negotiations">
      <PageHeader title="Negotiations" lede="Every conversation you started with a seller's agent." />
      {q.isLoading ? (
        <LoadingCard lines={4} />
      ) : q.error && isAuthError(q.error) ? (
        <>
          <Notice tone="info" title="Account sync pending">The server has not linked your login yet, so your negotiations cannot be listed.</Notice>
          {empty}
        </>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Card padding="flush">
          <DataTable<NegotiationSummary>
            caption="Your negotiations, newest first"
            rows={q.data ?? []}
            rowKey={(n) => n.id}
            onRowClick={(n) => navigate(`/app/negotiations/${n.id}`)}
            empty={empty}
            columns={[
              { key: "product", header: "Product", render: (n) => prettySlug(n.productSlug) },
              { key: "status", header: "Status", render: (n) => <StatusTag state={n.status} /> },
              { key: "offer", header: "Best offer", numeric: true, render: (n) => (n.bestOfferUsd ? <Money usd={n.bestOfferUsd} /> : "None yet") },
              { key: "updated", header: "Updated", render: (n) => fmtDateTime(n.updatedAt ?? n.createdAt) },
            ]}
          />
        </Card>
      )}
    </AppShell>
  );
}

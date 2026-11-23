import { useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { filterBySearch } from "@proteus/domain";
import { NoMatches, SearchBar } from "../ui/SearchBar";
import { statusLabel } from "../ui/StatusTag";
import { useDebounced, useSearchParam } from "../lib/useSearchParam";
import { Handshake } from "lucide-react";
import { AppShell } from "../layouts/AppShell";
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
  const [query, setQuery] = useSearchParam("q");
  const server = useDebounced(query).trim();
  const typed = useDeferredValue(query);
  const q = useQuery({ queryKey: [...qk.meDeals, server], queryFn: () => api.meDeals(server), retry: false, placeholderData: keepPreviousData });
  // A superset of what the API's `?q=` reads, so no server match is hidden while the list filters as you type.
  const rows = filterBySearch(q.data ?? [], typed, (d) => [d.sellerName as string | undefined, d.sellerSlug as string | undefined, d.productName as string | undefined, d.productSlug, d.publicId, d.status, statusLabel(d.status)]);
  const empty = <EmptyState icon={<Handshake size={20} strokeWidth={1.75} />} title="No deals yet" description="Accept an offer in a negotiation and fund it from your balance." action={<ActionButton variant="secondary" size="sm" to="/app/market">Browse the market</ActionButton>} />;
  return (
    <AppShell title="Deals">
      <PageHeader title="Deals" lede="Prepaid agreements held in escrow. The seller is paid only for usage you sign." />
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
        <>
          {((q.data?.length ?? 0) > 0 || query) && <SearchBar value={query} onChange={setQuery} label="Search deals" placeholder="Search by seller, product, status or deal ID" shown={rows.length} noun={query ? "matches" : "deals"} />}
          <Card padding="flush">
            <DataTable<DealSummary>
              caption="Your deals, newest first"
              rows={rows}
              rowKey={(d) => d.id}
              onRowClick={(d) => navigate(`/app/deals/${d.id}`)}
              empty={query ? <NoMatches query={query} noun="deals" onClear={() => setQuery("")} /> : empty}
              columns={[
                { key: "product", header: "Product", render: (d) => (d.productName as string | undefined) ?? prettySlug(d.productSlug ?? "Deal") },
                { key: "status", header: "Status", render: (d) => <StatusTag state={d.status} /> },
                { key: "deposit", header: "Deposit", numeric: true, render: (d) => <Money micro={d.deposit} /> },
                { key: "remaining", header: "Remaining", numeric: true, render: (d) => <Money micro={d.remaining} /> },
                { key: "created", header: "Created", render: (d) => fmtDate(d.createdAt) },
              ]}
            />
          </Card>
        </>
      )}
    </AppShell>
  );
}

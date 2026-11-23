import { useDeferredValue } from "react";
import { useNavigate } from "react-router-dom";
import { filterBySearch } from "@proteus/domain";
import { MessagesSquare } from "lucide-react";
import { ActionButton, DataTable, EmptyState, Money, MonoValue, StatusTag, type DataColumn } from "../kit";
import { useMe } from "../../sell/hooks";
import { SELL } from "../paths";
import { useNegotiations, useProducts } from "../api";
import { QueryView } from "../parts/QueryView";
import { PageHeader } from "../parts/PageHeader";
import { relTime } from "../format";
import type { NegotiationSummary } from "../types";
import { NoMatches, SearchBar } from "../../ui/SearchBar";
import { statusLabel } from "../../ui/StatusTag";
import { useDebounced, useSearchParam } from "../../lib/useSearchParam";

/** What the search reads on a negotiation; a superset of what the API's `?q=` reads, so no server match is hidden. */
export const negotiationSearchFields = (n: NegotiationSummary) => [n.buyerLabel, n.buyerAddress, n.productName, n.publicId, n.status, statusLabel(n.status)];
import s from "../seller.module.css";

export default function Negotiations() {
  const [query, setQuery] = useSearchParam("q");
  const q = useNegotiations(useDebounced(query));
  const typed = useDeferredValue(query);
  const nav = useNavigate();
  const { me } = useMe();
  const products = useProducts();
  const first = products.data?.[0];
  const marketLink = me?.org && first ? `/app/market/${me.org.slug}/${first.slug}` : undefined;
  const cols: DataColumn<NegotiationSummary>[] = [
    {
      key: "buyer",
      header: "Buyer",
      render: (n) => (
        <a href={`/app/sell/negotiations/${encodeURIComponent(n.id)}`} onClick={(e) => { e.preventDefault(); nav(`/app/sell/negotiations/${encodeURIComponent(n.id)}`); }}>
          <span className={s.strong}>{n.buyerLabel}</span>
          <span className={s.sub}>{n.productName}</span>
        </a>
      ),
    },
    { key: "status", header: "Status", render: (n) => <span className={s.row} style={{ gap: 4 }}><StatusTag state={n.status} />{n.needsApproval && <StatusTag state="approval_required" />}</span> },
    { key: "turns", header: "Turns", numeric: true, render: (n) => n.turns },
    { key: "best", header: "Current offer", numeric: true, render: (n) => (n.bestOfferTotal ? <Money micro={n.bestOfferTotal} /> : <span className={s.muted}>None yet</span>) },
    { key: "upd", header: "Updated", render: (n) => <span className={s.muted}>{relTime(n.updatedAt)}</span> },
  ];
  return (
    <div className={s.page}>
      <PageHeader description="Every conversation your agent is having with buyers, newest first." />
      <QueryView q={q} label="negotiations">
        {(found) => {
          const rows = filterBySearch(found, typed, negotiationSearchFields).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
          if (found.length === 0 && !query)
            return (
              <EmptyState
                icon={<MessagesSquare size={20} />}
                title="No negotiations yet"
                description={
                  marketLink ? (
                    <>
                      Share your market link. When a buyer or their agent opens it and starts a conversation, it shows up here with the private economics behind every offer.
                      <span style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
                        <MonoValue value={typeof window !== "undefined" ? `${window.location.origin}${marketLink}` : marketLink} copy label="market link" />
                      </span>
                    </>
                  ) : (
                    "Publish a product, then share your market link. Conversations with buyers and their agents show up here."
                  )
                }
                action={marketLink ? <ActionButton variant="secondary" to={marketLink} icon>Open your market page</ActionButton> : <ActionButton to={`${SELL}/start`} icon>Start selling</ActionButton>}
              />
            );
          return (
            <div className={s.stack}>
              <SearchBar value={query} onChange={setQuery} label="Search negotiations" placeholder="Search by buyer, product, status or ID" shown={rows.length} noun={query ? "matches" : "negotiations"} />
              {rows.length === 0 ? <NoMatches query={query} noun="negotiations" onClear={() => setQuery("")} /> : <DataTable columns={cols} rows={rows} rowKey={(n) => n.id} onRowClick={(n) => nav(`/app/sell/negotiations/${encodeURIComponent(n.id)}`)} caption="Inbox" />}
            </div>
          );
        }}
      </QueryView>
    </div>
  );
}

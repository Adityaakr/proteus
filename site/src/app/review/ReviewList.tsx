import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReviewShell } from "../layouts/ReviewShell";
import { DataTable } from "../ui/DataTable";
import { EmptyState } from "../ui/EmptyState";
import { LoadingCard } from "../ui/Skeleton";
import { Money } from "../ui/Money";
import { StatusTag } from "../ui/StatusTag";
import { api, qk, type ReviewListItem } from "../lib/api";
import { ErrorState, PageHeader, fmtDate } from "../buyer/common";
import r from "./review.module.css";

export default function ReviewList() {
  const navigate = useNavigate();
  const q = useQuery({ queryKey: qk.review, queryFn: api.reviewList });
  return (
    <ReviewShell>
      <PageHeader
        title="Public records"
        lede="Every agreement leaves a redacted public record: what was agreed, funded, used, settled and refunded, with links to the chain where a transaction exists."
      />
      {q.isLoading ? (
        <LoadingCard label="Loading records" lines={5} />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <DataTable<ReviewListItem>
          caption="Agreements, newest first"
          rows={q.data ?? []}
          rowKey={(x) => x.publicId}
          onRowClick={(x) => navigate(`/records/${x.publicId}`)}
          empty={<EmptyState title="No records yet" description="Records appear here once a buyer accepts an offer." />}
          columns={[
            {
              key: "rec",
              header: "Record",
              render: (x) => (
                <Link to={`/records/${x.publicId}`} className={r.link} onClick={(e) => e.stopPropagation()}>
                  {x.productName}
                  <span className="sr-only">, record {x.publicId}</span>
                </Link>
              ),
            },
            { key: "seller", header: "Seller", render: (x) => <StatusTag network={x.sellerLabel === "sandbox" ? "sandbox" : "live"} /> },
            { key: "status", header: "Status", render: (x) => <StatusTag state={x.status} /> },
            { key: "funded", header: "Funded", numeric: true, render: (x) => <Money usd={x.fundedUsd} /> },
            { key: "settled", header: "Settled", numeric: true, render: (x) => <Money usd={x.settledUsd} /> },
            { key: "refunded", header: "Refunded", numeric: true, render: (x) => <Money usd={x.refundedUsd} /> },
            { key: "network", header: "Network", render: (x) => <StatusTag network={x.network} /> },
            { key: "date", header: "Created", render: (x) => fmtDate(x.createdAt) },
          ]}
        />
      )}
    </ReviewShell>
  );
}

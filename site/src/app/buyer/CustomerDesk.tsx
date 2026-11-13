import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { api, errorMessage, type InboxItem, type RequestMark } from "../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { CopyButton, Notice } from "../ui/misc";
import { fmtDateTime } from "./common";
import f from "./fund.module.css";
import d from "./deal.module.css";

const MARKS: { mark: RequestMark; label: string }[] = [
  { mark: "confirmed", label: "Confirmed" },
  { mark: "done", label: "Done" },
  { mark: "cancelled", label: "Cancelled" },
];

/**
 * The front desk for a scheduling service: a link (and website embed) where the business's own customers reach its
 * AI assistant, and an inbox of every request with the full note, which the business marks as it handles them.
 */
export function CustomerDesk({ productSlug, apiKey, dealId }: { productSlug: string; apiKey: string; dealId: string }) {
  const qc = useQueryClient();
  const linkKey = ["customer-link", dealId] as const;
  const inboxKey = ["service-inbox", dealId] as const;
  const link = useQuery({ queryKey: linkKey, queryFn: () => api.customerLink(productSlug, apiKey) });
  const box = useQuery({ queryKey: inboxKey, queryFn: () => api.serviceInbox(productSlug, apiKey), refetchInterval: 15_000 });
  const rotate = useMutation({ mutationFn: () => api.rotateCustomerLink(productSlug, apiKey), onSuccess: (r) => qc.setQueryData(linkKey, r) });
  const revoke = useMutation({ mutationFn: () => api.revokeCustomerLink(productSlug, apiKey), onSuccess: () => qc.setQueryData(linkKey, { link: null }) });
  const mark = useMutation({
    mutationFn: (v: { requestId: string; status: RequestMark }) => api.markRequest(dealId, v.requestId, { status: v.status }, apiKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: inboxKey }),
  });
  const l = link.data?.link;
  const items = box.data?.items ?? [];
  const open = items.filter((i) => i.mark === "new" && i.status !== "failed").length;

  return (
    <>
      <section className={f.section} aria-labelledby="h-link">
        <div className={f.sectionHead}>
          <h2 id="h-link" className={f.h2}>Your customer link</h2>
          <span className={f.h2Sub}>Share it, or put it on your website, so your customers reach your AI assistant directly. Each request they send is billed from this deal only when it is delivered, and lands in your inbox below.</span>
        </div>
        {l ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className={d.secret}>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{l.url}</span>
              <CopyButton value={l.url} label="Copy link" />
              <a href={l.url} target="_blank" rel="noreferrer" className={f.textBtn} aria-label="Open the customer page"><ExternalLink size={13} /></a>
            </div>
            <span className={f.label}>Website embed</span>
            <div className={d.secret}>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 12 }}>{l.embed}</span>
              <CopyButton value={l.embed} label="Copy embed code" />
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <button type="button" className={f.textBtn} onClick={() => rotate.mutate()} disabled={rotate.isPending}>Replace link (the old one stops working)</button>
              <button type="button" className={f.textBtn} onClick={() => revoke.mutate()} disabled={revoke.isPending}>Turn off</button>
            </div>
          </div>
        ) : (
          <div><ActionButton size="sm" loading={rotate.isPending} loadingLabel="Creating" onClick={() => rotate.mutate()} disabled={link.isLoading}>Create customer link</ActionButton></div>
        )}
        {(rotate.error || revoke.error || link.error) && <Notice tone="danger">{errorMessage(rotate.error ?? revoke.error ?? link.error)}</Notice>}
      </section>

      <section className={f.section} aria-labelledby="h-inbox">
        <div className={f.sectionHead}>
          <h2 id="h-inbox" className={f.h2}>Inbox{open ? ` (${open} new)` : ""}</h2>
          <span className={f.h2Sub}>Every booking and message, from your customers and from you. Mark each one as you handle it.</span>
        </div>
        {box.isError && <Notice tone="danger">{errorMessage(box.error)}</Notice>}
        {items.length === 0 ? (
          <p className={f.fine}>Nothing yet. Requests from your customer link and from this page appear here.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            {items.map((i: InboxItem) => (
              <li key={i.requestId} style={{ border: "1px solid var(--c-dark-10, #e6e8ee)", borderRadius: 12, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, opacity: i.mark === "done" || i.mark === "cancelled" ? 0.6 : 1 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <span className={f.fine} style={{ margin: 0 }}>{fmtDateTime(i.at)}</span>
                  <span className={f.badge}>{i.via === "customer" ? "From a customer" : "From you"}</span>
                  <span className={`${f.badge} ${i.mark === "confirmed" || i.mark === "done" ? f.badgeOk : ""}`}>{i.mark === "new" ? "New" : MARKS.find((m) => m.mark === i.mark)?.label}</span>
                  {i.status !== "delivered" && <span className={f.badge}>{i.status === "handoff" ? "Needs you" : "Not completed, not charged"}</span>}
                </div>
                <div className={d.answer} style={{ whiteSpace: "pre-wrap" }}>{i.answer}</div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  {MARKS.map((m) => (
                    <button key={m.mark} type="button" className={f.textBtn} disabled={mark.isPending || i.mark === m.mark} onClick={() => mark.mutate({ requestId: i.requestId, status: m.mark })}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {mark.error && <Notice tone="danger">{errorMessage(mark.error)}</Notice>}
      </section>
    </>
  );
}

/**
 * Seller console data layer: typed calls for `/api/app/*` plus react-query hooks.
 * Transport is the shared client (site/src/app/lib/api.ts); responses pass through ./normalize.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CostUpdateBody, PolicyUpdateBody } from "@proteus/domain";
import { api, isUnauthorized } from "./transport";
import * as N from "./normalize";

export { isUnauthorized };

export const sellerApi = {
  startSandbox: () => api.app.sandboxSession(),
  overview: async () => N.overview(await api.app.overview()),
  products: async () => (await api.app.products()).map(N.product),
  product: async (id: string) => N.product(await api.app.product(id)),
  updatePolicy: async (id: string, body: PolicyUpdateBody) => N.product(await api.app.updatePolicy(id, body)),
  updateCost: async (id: string, body: CostUpdateBody) => N.product(await api.app.updateCost(id, body)),
  preview: async (id: string, body: { desiredUnits?: string; budget?: string }) => {
    const r = await api.app.preview(id, body);
    return { candidates: (r.candidates ?? []).map(N.candidate) };
  },
  negotiations: async () => (await api.app.negotiations()).map(N.negotiationSummary),
  negotiation: async (id: string) => N.negotiation(await api.app.negotiation(id)),
  approvals: async () => (await api.app.approvals()).map(N.approval),
  decideApproval: async (id: string, body: { decision: "approve" | "decline"; reason?: string }) => N.approval(await api.app.decideApproval(id, body)),
  deals: async () => (await api.app.deals()).map(N.dealSummary),
  deal: async (id: string) => N.deal(await api.app.deal(id)),
  closeTerm: (id: string) => api.app.closeTerm(id),
  recordDelivery: (id: string, body: { units: number; note: string; proofUrl?: string; requestId: string }) => api.app.recordDelivery(id, body),
  finance: async () => N.finance(await api.app.finance()),
  setListing: async (id: string, active: boolean) => N.product(await api.app.setListing(id, active)),
  deleteProduct: (id: string) => api.app.deleteProduct(id),
  dashboard: () => api.app.dashboard(),
  customers: () => api.app.customers(),
  usage: () => api.app.usage(),
  insights: () => api.app.insights(),
};

const K = {
  all: ["seller"] as const,
  overview: ["seller", "overview"] as const,
  products: ["seller", "products"] as const,
  product: (id: string) => ["seller", "product", id] as const,
  negotiations: ["seller", "negotiations"] as const,
  negotiation: (id: string) => ["seller", "negotiation", id] as const,
  approvals: ["seller", "approvals"] as const,
  deals: ["seller", "deals"] as const,
  deal: (id: string) => ["seller", "deal", id] as const,
  finance: ["seller", "finance"] as const,
  dashboard: ["seller", "dashboard"] as const,
  customers: ["seller", "customers"] as const,
  usage: ["seller", "usage"] as const,
  insights: ["seller", "insights"] as const,
};

const retry = (n: number, e: Error) => !isUnauthorized(e) && n < 1;

export const useOverview = () => useQuery({ queryKey: K.overview, queryFn: sellerApi.overview, retry });
export const useProducts = () => useQuery({ queryKey: K.products, queryFn: sellerApi.products, retry });
export const useProduct = (id: string) => useQuery({ queryKey: K.product(id), queryFn: () => sellerApi.product(id), retry });
export const useNegotiations = () => useQuery({ queryKey: K.negotiations, queryFn: sellerApi.negotiations, retry });
export const useNegotiation = (id: string) => useQuery({ queryKey: K.negotiation(id), queryFn: () => sellerApi.negotiation(id), retry });
export const useApprovals = () => useQuery({ queryKey: K.approvals, queryFn: sellerApi.approvals, retry });
export const useDeals = () => useQuery({ queryKey: K.deals, queryFn: sellerApi.deals, retry });
export const useDeal = (id: string) => useQuery({ queryKey: K.deal(id), queryFn: () => sellerApi.deal(id), retry });
export const useFinance = () => useQuery({ queryKey: K.finance, queryFn: sellerApi.finance, retry });
export function useSetListing(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (active: boolean) => sellerApi.setListing(id, active), onSuccess: (p) => { qc.setQueryData(K.product(id), p); qc.invalidateQueries({ queryKey: K.products }); qc.invalidateQueries({ queryKey: ["market"] }); } });
}
export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => sellerApi.deleteProduct(id), onSuccess: () => { qc.invalidateQueries({ queryKey: K.products }); qc.invalidateQueries({ queryKey: ["market"] }); } });
}
export const useDashboard = () => useQuery({ queryKey: K.dashboard, queryFn: sellerApi.dashboard, retry });
export const useCustomers = () => useQuery({ queryKey: K.customers, queryFn: sellerApi.customers, retry });
export const useUsage = () => useQuery({ queryKey: K.usage, queryFn: sellerApi.usage, retry });
export const useInsights = () => useQuery({ queryKey: K.insights, queryFn: sellerApi.insights, retry });

export function useStartSandbox() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: sellerApi.startSandbox, onSuccess: () => qc.invalidateQueries({ queryKey: K.all }) });
}

export function useUpdatePolicy(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PolicyUpdateBody) => sellerApi.updatePolicy(id, body),
    onSuccess: (p) => {
      qc.setQueryData(K.product(id), p);
      qc.invalidateQueries({ queryKey: K.products });
    },
  });
}

export function useUpdateCost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CostUpdateBody) => sellerApi.updateCost(id, body),
    onSuccess: (p) => {
      qc.setQueryData(K.product(id), p);
      qc.invalidateQueries({ queryKey: K.products });
    },
  });
}

export function usePreview(id: string) {
  return useMutation({ mutationFn: (body: { desiredUnits?: string; budget?: string }) => sellerApi.preview(id, body) });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; decision: "approve" | "decline"; reason?: string }) => sellerApi.decideApproval(v.id, { decision: v.decision, reason: v.reason || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: K.all }),
  });
}

export function useCloseTerm(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => sellerApi.closeTerm(id), onSuccess: () => qc.invalidateQueries({ queryKey: K.all }) });
}

export function useRecordDelivery(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { units: number; note: string; proofUrl?: string; requestId: string }) => sellerApi.recordDelivery(id, body), onSuccess: () => qc.invalidateQueries({ queryKey: K.all }) });
}

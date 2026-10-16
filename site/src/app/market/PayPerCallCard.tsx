import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Zap } from "lucide-react";
import { explorerTx } from "@proteus/domain";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { Money } from "../ui/Money";
import { Skeleton } from "../ui/Skeleton";
import { StatusTag } from "../ui/StatusTag";
import { ExplorerLink, Notice } from "../ui/misc";
import { useAuth } from "../auth/useAuth";
import { ApiError, api, errorMessage, newRequestId, type PayExecuteResponse, type PayRequired, type ServiceKind } from "../lib/api";
import { signTransferAuthorization, walletErrorMessage } from "../lib/wallet";
import m from "./market.module.css";

type Probe = { available: true; req: PayRequired } | { available: false; reason: string };

function asRequired(e: unknown): PayRequired | null {
  if (e instanceof ApiError && e.status === 402 && e.body && typeof e.body === "object" && Array.isArray((e.body as PayRequired).accepts)) return e.body as PayRequired;
  return null;
}
/** 2 decimals unless the micro amount has sub-cent precision (then up to 4). */
function decimalsForMicro(micro?: string | bigint): number {
  if (micro === undefined) return 2;
  const v = BigInt(micro);
  return v % 10_000n === 0n ? 2 : 4;
}
const notAvailable = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 501);

/** x402 pay per call: one signed USDC authorization per request, settled through Circle's facilitator. */
export function PayPerCallCard({ sellerSlug, productSlug, service, unitLabel = "unit", bare }: { sellerSlug: string; productSlug: string; service?: ServiceKind; unitLabel?: string; /** Render without the Card frame (inside a rail). */ bare?: boolean | "inline" }) {
  const inline = bare === "inline";
  const sampleStore = service === "sample-store" || service === undefined;
  const { wallet, getWalletClient, mock } = useAuth();
  const payer = wallet?.address;
  const probe = useQuery<Probe>({
    queryKey: ["pay-probe", sellerSlug, productSlug, payer ?? ""],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => {
      try {
        await api.payExecute(sellerSlug, productSlug, { requestId: newRequestId("probe"), input: { question: "price check" }, payer });
        return { available: false, reason: "The seller did not ask for a payment." };
      } catch (e) {
        const req = asRequired(e);
        if (req) return { available: true, req };
        if (notAvailable(e)) return { available: false, reason: errorMessage(e) };
        throw e;
      }
    },
  });

  const [question, setQuestion] = useState(sampleStore ? "Where is my order?" : "");
  const [orderId, setOrderId] = useState(sampleStore ? "A1001" : "");
  const [phase, setPhase] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: async (): Promise<PayExecuteResponse> => {
      const requestId = newRequestId("ppc");
      const input = { question: question.trim(), orderId: orderId.trim() || undefined };
      let req: PayRequired | null = null;
      setPhase("Getting the price");
      try {
        return await api.payExecute(sellerSlug, productSlug, { requestId, input, payer });
      } catch (e) {
        req = asRequired(e);
        if (!req) throw e;
      }
      const accept = req.accepts[0];
      if (!accept || !req.nonce) throw new Error("The seller's payment requirements are incomplete.");
      setPhase("Signing the payment");
      const client = await getWalletClient();
      const payment = await signTransferAuthorization(client, accept, req.nonce);
      setPhase("Running and settling");
      return api.payExecute(sellerSlug, productSlug, { requestId, input, payer, payment });
    },
    onSettled: () => setPhase(null),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;
    run.mutate();
  };

  const price = probe.data?.available ? probe.data.req.accepts[0]?.amount : undefined;

  const body = (
    <>
      {probe.isLoading ? (
        <Skeleton lines={2} />
      ) : probe.error ? (
        <Notice tone="warn">{errorMessage(probe.error)}</Notice>
      ) : !probe.data?.available ? (
        <div className={m.purchase}>
          <div><StatusTag tone="neutral" label="Not available yet" /></div>
          <p className="body3">Pay per call is not available yet for this product.{mock ? " Mock mode does not run x402 payments." : ""}</p>
        </div>
      ) : (
        <form className={m.purchase} onSubmit={submit} noValidate>
          {!inline && (
            <span className={m.price}>
              <Money micro={price} digits={4} /> <span className="body3">per call</span>
            </span>
          )}
          <Field label={sampleStore ? "Question" : "Request"} placeholder={sampleStore ? "Where is my order?" : `Describe the ${unitLabel} you want`} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} />
          <Field label={sampleStore ? "Order id" : "Reference"} hint={sampleStore ? "Sample store orders A1001 to A1004" : "Optional. Your own id, echoed in the receipt."} value={orderId} onChange={(e) => setOrderId(e.target.value)} />
          <div>
            <ActionButton type="submit" variant={inline ? "primary" : "secondary"} fullWidth={inline} loading={run.isPending} loadingLabel={phase ?? "Working"} disabled={!wallet || (inline && !question.trim())}>
              {inline ? <>{"Pay "}<Money micro={price} digits={decimalsForMicro(price)} />{" and run"}</> : "Pay and run"}
            </ActionButton>
          </div>
          <p className="body3">{inline ? "One signed USDC authorization for exactly this price, valid two minutes, settles once. Failed answers are not charged." : "You sign one USDC authorization for exactly this price. It expires in two minutes and can settle only once. Failed answers are not charged."}</p>
          {run.isError && <Notice tone="danger">{run.error instanceof ApiError ? errorMessage(run.error) : walletErrorMessage(run.error)}</Notice>}
          {run.data && (
            <div className={m.purchase} aria-live="polite">
              <div className={m.answer}>{run.data.answer}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <StatusTag state={run.data.status} />
                <StatusTag tone={run.data.payment.status === "settled" ? "success" : "info"} label={run.data.payment.status === "settled" ? "Payment settled" : "Payment pending"} />
                {run.data.payment.settleTxHash && <ExplorerLink href={explorerTx(run.data.payment.settleTxHash)} hash={run.data.payment.settleTxHash} />}
              </div>
            </div>
          )}
        </form>
      )}
    </>
  );
  if (inline) return body;
  if (bare) {
    return (
      <div className={m.bareWrap}>
        <h2 className={m.bareTitle}>Pay per call</h2>
        <p className={m.bareText}>Try one {unitLabel} before committing, or use it at low volume. Each request is paid on its own from your balance.</p>
        {body}
      </div>
    );
  }
  return (
    <Card title="Pay per call" subtitle={`Try one ${unitLabel} before committing, or use it at low volume. Each request is paid on its own from your balance.`} actions={<Zap size={18} strokeWidth={2} color="var(--c-dark-60)" aria-hidden />}>
      {body}
    </Card>
  );
}
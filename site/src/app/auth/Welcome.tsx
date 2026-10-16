import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Briefcase, ShoppingBag } from "lucide-react";
import { useAuth } from "./useAuth";
import { api, errorMessage, qk, type AccountMode } from "../lib/api";
import { Notice } from "../ui/misc";
import s from "./welcome.module.css";

/** First screen after sign-in: what the person came to do. Sets the account mode and sends them to the right side. */
export default function Welcome() {
  const { user, refetchMe } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<AccountMode | null>(null);
  const choose = useMutation({
    mutationFn: (mode: AccountMode) => api.updateMe({ mode }),
    onMutate: (mode) => setPicked(mode),
    onSuccess: (me, mode) => {
      qc.setQueryData(qk.me, me);
      refetchMe();
      try {
        localStorage.setItem("proteus:mode", mode);
      } catch {
        /* ignore */
      }
      navigate(mode === "sell" ? "/app/sell" : "/app/market", { replace: true });
    },
    onError: () => setPicked(null),
  });
  const name = user?.email ? user.email.split("@")[0] : null;
  return (
    <main className={s.page} id="app-main">
      <div className={s.inner}>
        <span className={s.label}>Welcome{name ? `, ${name}` : ""}</span>
        <h1 className={s.title}>What brings you to PROTEUS?</h1>
        <p className={s.lede}>One account does both. Pick where to start; you can switch any time from the sidebar.</p>
        <div className={s.options}>
          <button type="button" className={s.option} onClick={() => choose.mutate("buy")} disabled={choose.isPending} aria-busy={picked === "buy"}>
            <span className={s.optIcon}><ShoppingBag size={20} strokeWidth={1.8} /></span>
            <span className={s.optBody}>
              <span className={s.optTitle}>Buy a service</span>
              <span className={s.optText}>Negotiate custom terms with a seller's agent, fund the deal into escrow, and pay only for delivered usage you countersign.</span>
            </span>
            <ArrowRight size={18} strokeWidth={2} aria-hidden className={s.optArrow} />
          </button>
          <button type="button" className={s.option} onClick={() => choose.mutate("sell")} disabled={choose.isPending} aria-busy={picked === "sell"}>
            <span className={s.optIcon}><Briefcase size={20} strokeWidth={1.8} /></span>
            <span className={s.optBody}>
              <span className={s.optTitle}>Sell a service</span>
              <span className={s.optText}>Publish what you sell with its tiers, costs and margin floor. Your agent negotiates within those rules and payouts settle to your wallet.</span>
            </span>
            <ArrowRight size={18} strokeWidth={2} aria-hidden className={s.optArrow} />
          </button>
        </div>
        {choose.isError && <Notice tone="danger">{errorMessage(choose.error)}</Notice>}
      </div>
    </main>
  );
}

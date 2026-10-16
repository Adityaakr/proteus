import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { T_DEFAULT } from "../../lib/motion";
import { Wordmark } from "../layouts/Wordmark";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { ArcMark } from "../ui/Marks";
import { ApiError, api } from "../lib/api";
import { useAuth } from "./useAuth";
import { loginHref, safeNext } from "./RequireAuth";
import "../app.css";
import s from "./auth.module.css";

/** PRX-XXXX-XXXX-XXXX as the person types: uppercase, grouped, prefix added once there is something to group. */
export function formatInvite(raw: string): string {
  let body = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (body.startsWith("PRX")) body = body.slice(3);
  body = body.slice(0, 12);
  if (!body) return "";
  return `PRX-${body.match(/.{1,4}/g)!.join("-")}`;
}

export default function InvitePage() {
  const { ready, authenticated, me, meStatus, refetchMe, mock } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already in: nothing to do here.
  useEffect(() => {
    if (mock || (authenticated && meStatus === "ready" && me?.access !== false)) navigate(next, { replace: true });
  }, [mock, authenticated, meStatus, me?.access, next, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.replace(/[^A-Z0-9]/gi, "").length < 15) return setError("Enter the full code.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.redeemInvite(code);
      if (r.bound) {
        refetchMe();
        navigate(next, { replace: true });
      } else {
        navigate(loginHref(next), { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-app className={s.page}>
      <a href="#invite-main" className="app-skip-link">Skip to content</a>
      <header className={s.top}>
        <Wordmark />
      </header>
      <main id="invite-main" tabIndex={-1} className={s.main}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={T_DEFAULT} className={s.cardWrap}>
          <Card>
            <div className={s.head}>
              <h1 className={s.title}>Enter your invite code</h1>
              <p className={s.lede}>Proteus AI is invite-only right now.</p>
            </div>
            <form className={s.form} onSubmit={submit} noValidate>
              <Field
                label="Invite code"
                hideLabel
                className={s.code}
                value={code}
                onChange={(e) => {
                  setCode(formatInvite(e.target.value));
                  setError(null);
                }}
                placeholder="PRX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                maxLength={18}
                autoFocus
                error={error}
              />
              <ActionButton type="submit" size="lg" fullWidth loading={busy || !ready} loadingLabel={ready ? "Checking" : "Loading"}>
                Continue
              </ActionButton>
            </form>
            <p className={s.builtOn}><span>Built on</span><ArcMark size={14} /><span>Arc</span></p>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

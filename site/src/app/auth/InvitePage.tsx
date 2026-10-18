import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { Wordmark } from "../layouts/Wordmark";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { ArcMark } from "../ui/Marks";
import { useQuery } from "@tanstack/react-query";
import { ApiError, api, qk } from "../lib/api";
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

const SPRING = { type: "spring", stiffness: 240, damping: 26, mass: 0.9 } as const;
const OPEN = { type: "spring", stiffness: 190, damping: 23, mass: 1 } as const;

export default function InvitePage() {
  const { ready, authenticated, me, meStatus, refetchMe, mock } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [shake, setShake] = useState(0);
  const leaveTo = useRef<string | null>(null);

  const health = useQuery({ queryKey: qk.health, queryFn: api.health, staleTime: 60_000, retry: false });
  const gateOff = health.data?.features?.inviteGate === false;

  // Already in, or no gate on this deployment: nothing to do here.
  useEffect(() => {
    if (mock || (authenticated && meStatus === "ready" && me?.access !== false)) {
      void navigate(next, { replace: true });
      return;
    }
    if (gateOff) void navigate(authenticated ? next : loginHref(next), { replace: true });
  }, [mock, authenticated, meStatus, me?.access, next, navigate, gateOff]);

  const fail = (msg: string) => {
    setError(msg);
    setShake((n) => n + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.replace(/[^A-Z0-9]/gi, "").length < 15) return fail("Enter the full code.");
    setBusy(true);
    setError(null);
    try {
      const r = await api.redeemInvite(code);
      if (r.bound) refetchMe();
      leaveTo.current = r.bound ? next : loginHref(next);
      setDone(true);
    } catch (err) {
      fail(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  // The card opens from the centre: scale and blur settle on a spring, then the rows follow in order.
  const card: Variants = reduce
    ? { hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        hidden: { opacity: 0, scale: 0.78, y: 16, filter: "blur(12px)" },
        show: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)", transition: { ...OPEN, staggerChildren: 0.08, delayChildren: 0.16 } },
        exit: { opacity: 0, scale: 1.04, filter: "blur(8px)", transition: { duration: 0.28, ease: [0.4, 0, 1, 1] } },
      };
  const row: Variants = reduce ? { hidden: { opacity: 0 }, show: { opacity: 1 } } : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: SPRING } };

  return (
    <div data-app className={s.page}>
      <a href="#invite-main" className="app-skip-link">Skip to content</a>
      <header className={s.top}>
        <Wordmark />
      </header>
      <main id="invite-main" tabIndex={-1} className={`${s.main} ${s.inviteMain}`}>
        <motion.div className={s.glow} aria-hidden initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: done ? 0 : 1, scale: 1 }} transition={{ duration: 1.1, ease: "easeOut" }} />
        <AnimatePresence
          onExitComplete={() => {
            // Hold the confirmation long enough to be seen, then move on.
            if (leaveTo.current) setTimeout(() => navigate(leaveTo.current!, { replace: true }), 900);
          }}
        >
          {!done && (
            <motion.section key="card" className={s.inviteCard} variants={card} initial="hidden" animate="show" exit="exit" style={{ transformOrigin: "50% 50%" }} aria-labelledby="invite-title">
              <motion.div variants={row} className={s.inviteHead}>
                <h1 id="invite-title" className={s.title}>Enter your invite code</h1>
                <p className={s.lede}>Proteus AI is invite-only right now.</p>
              </motion.div>
              <motion.form variants={row} className={s.form} onSubmit={submit} noValidate>
                <motion.div key={shake} animate={shake && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.4 }}>
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
                </motion.div>
                <ActionButton type="submit" size="lg" fullWidth loading={busy || !ready} loadingLabel={ready ? "Checking" : "Loading"} icon={<ArrowRight size={16} strokeWidth={2} />}>
                  Continue
                </ActionButton>
              </motion.form>
              <motion.p variants={row} className={s.builtOn}><span>Built on</span><ArcMark size={14} /><span>Arc</span></motion.p>
            </motion.section>
          )}
          {done && (
            <motion.div key="ok" className={s.okBadge} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} role="status" aria-live="polite">
              <motion.span className={s.okRing} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING, delay: 0.05 }}>
                <Check size={28} strokeWidth={2.5} />
              </motion.span>
              <span className={s.okText}>You're in</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

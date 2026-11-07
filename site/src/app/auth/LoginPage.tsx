import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { LogIn, Mail, Wallet } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { Wordmark } from "../layouts/Wordmark";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { ArcMark, CircleMark } from "../ui/Marks";
import { Notice } from "../ui/misc";
import { browserWallets, preferredWallet, type BrowserWallet } from "../lib/browserWallets";
import { useAuth } from "./useAuth";
import { api, qk } from "../lib/api";
import { safeNext } from "./RequireAuth";
import "../app.css";
import s from "./auth.module.css";

export default function LoginPage() {
  const auth = useAuth();
  const { ready, authenticated, login, mock, provider } = auth;
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const opened = useRef(false);

  // Once signed in, go to `next`. Mock mode keeps the page visible until the button is used.
  useEffect(() => {
    if (ready && authenticated && !mock) navigate(next, { replace: true });
  }, [ready, authenticated, mock, next, navigate]);

  // Privy: open its modal once on arrival so sign in is one step.
  useEffect(() => {
    if (provider !== "privy" || !ready || authenticated || mock || opened.current) return;
    opened.current = true;
    login();
  }, [provider, ready, authenticated, mock, login]);

  const go = () => {
    if (mock) {
      login();
      navigate(next, { replace: true });
      return;
    }
    login();
  };

  return (
    <div data-app className={s.page}>
      <a href="#login-main" className="app-skip-link">Skip to content</a>
      <header className={s.top}>
        <Wordmark />
      </header>
      <main id="login-main" tabIndex={-1} className={s.main}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={T_DEFAULT} className={s.cardWrap}>
          <Card>
            <div className={s.head}>
              <h1 className={`${s.title} ${s.titleLong}`}>The autonomous deal service desk for internet businesses</h1>
            </div>
            {provider === "circle" && !mock ? (
              <CircleSignIn onDone={() => navigate(next, { replace: true })} />
            ) : (
              <ActionButton size="lg" fullWidth onClick={go} loading={!ready} loadingLabel="Loading" iconLeft={<LogIn size={16} strokeWidth={2} />}>
                {mock ? "Continue as the demo user" : "Sign in"}
              </ActionButton>
            )}
            <p className={s.builtOn}><span>Built on</span><ArcMark size={14} /><span>Arc</span><span className={s.dot}>·</span><span>Wallets by</span><CircleMark size={14} /><span>Circle</span></p>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

/** Circle: email OTP (the code entry opens in Circle's window) or a browser wallet signing a nonce. */
function CircleSignIn({ onDone }: { onDone: () => void }) {
  const { emailLogin, loginWithWallet } = useAuth();
  const health = useQuery({ queryKey: qk.health, queryFn: api.health, staleTime: 60_000, retry: false });
  const emailAvailable = health.data?.auth?.circleEmail !== false;
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One button per installed wallet, so the person picks: window.ethereum belongs to whichever extension injected last.
  const ordered = () => { const all = browserWallets(); const first = preferredWallet()?.id; return [...all.filter((w) => w.id === first), ...all.filter((w) => w.id !== first)]; };
  const [wallets, setWallets] = useState<BrowserWallet[]>(ordered);
  useEffect(() => setWallets(ordered()), []);
  const hasWallet = wallets.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    setBusy("email");
    setError(null);
    try {
      await emailLogin!(email.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in did not complete.");
    } finally {
      setBusy(null);
    }
  };
  const wallet = async (id?: string) => {
    setBusy(id ?? "wallet");
    setError(null);
    try {
      await loginWithWallet!(id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Wallet sign-in did not complete.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={s.form}>
      {emailAvailable && (
        <form className={s.form} onSubmit={submit} noValidate>
          <Field label="Email" hideLabel type="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(null); }} placeholder="you@company.com" autoComplete="email" inputMode="email" autoFocus />
          <ActionButton type="submit" size="lg" fullWidth loading={busy === "email"} loadingLabel="Check your inbox" iconLeft={<Mail size={16} strokeWidth={2} />}>
            Continue with email
          </ActionButton>
        </form>
      )}
      {wallets.length > 1 ? (
        wallets.map((x, i) => (
          <ActionButton key={x.id} variant={emailAvailable || i > 0 ? "secondary" : "primary"} size="lg" fullWidth onClick={() => wallet(x.id)} loading={busy === x.id} loadingLabel={`Check ${x.name}`} disabled={busy != null && busy !== x.id} iconLeft={x.icon ? <img src={x.icon} alt="" width={18} height={18} style={{ borderRadius: 4 }} /> : <Wallet size={16} strokeWidth={2} />}>
            Continue with {x.name}
          </ActionButton>
        ))
      ) : (hasWallet || !emailAvailable) && (
        <ActionButton variant={emailAvailable ? "secondary" : "primary"} size="lg" fullWidth onClick={() => wallet(wallets[0]?.id)} loading={busy != null && busy !== "email"} loadingLabel="Check your wallet" iconLeft={<Wallet size={16} strokeWidth={2} />}>
          Continue with a wallet
        </ActionButton>
      )}
      {error && <Notice tone="danger">{error}</Notice>}
      <p className={s.lede} style={{ fontSize: 13 }}>
        {emailAvailable ? `Email creates a wallet for you, secured by Circle and a PIN only you know.${hasWallet ? " Or bring your own." : ""}` : "Sign in with MetaMask or another browser wallet on Arc. Email sign-in with a Circle wallet arrives on mainnet with Circle production access."}
      </p>
    </div>
  );
}

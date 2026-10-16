import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { LogIn, Mail, Wallet } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import { Wordmark } from "../layouts/Wordmark";
import { SandboxNote } from "../layouts/SandboxNote";
import { ActionButton } from "../ui/ActionButton";
import { Card } from "../ui/Card";
import { useAuth } from "./useAuth";
import { safeNext } from "./RequireAuth";
import "../app.css";
import s from "./auth.module.css";

export default function LoginPage() {
  const { ready, authenticated, login, mock } = useAuth();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const navigate = useNavigate();
  const opened = useRef(false);

  // Real mode: once signed in, go to `next`. Mock mode keeps the page visible until the button is used.
  useEffect(() => {
    if (ready && authenticated && !mock) navigate(next, { replace: true });
  }, [ready, authenticated, mock, next, navigate]);

  // Open the Privy modal once on arrival so sign in is one step.
  useEffect(() => {
    if (!ready || authenticated || mock || opened.current) return;
    opened.current = true;
    login();
  }, [ready, authenticated, mock, login]);

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
              <h1 className={s.title}>Sign in to PROTEUS</h1>
              <p className="body2">One account to buy and sell AI services. Signing in creates a wallet for you on Arc testnet, so you can fund deals and get paid from one balance.</p>
            </div>
            <ul className={s.methods}>
              <li><Mail size={16} strokeWidth={2} aria-hidden /> Email or Google</li>
              <li><Wallet size={16} strokeWidth={2} aria-hidden /> Or a wallet you already use</li>
            </ul>
            <ActionButton size="lg" fullWidth onClick={go} loading={!ready} loadingLabel="Loading" iconLeft={<LogIn size={16} strokeWidth={2} />}>
              {mock ? "Continue as the demo user" : "Sign in"}
            </ActionButton>
            <SandboxNote />
            <p className="body3">Embedded wallet. Your key is split between a hardware enclave and your login. You can export it from the account menu. PROTEUS never holds your key.</p>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}

import { Link } from "react-router-dom";
import s from "./shells.module.css";

export function Wordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className={s.brand} aria-label="Proteus AI home">
      <img src="/assets/proteus-ai-wordmark.png" alt="Proteus AI" className={s.wordmark} width={94} height={18} />
    </Link>
  );
}

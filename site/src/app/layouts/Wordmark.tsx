import { Link } from "react-router-dom";
import s from "./shells.module.css";

export function Wordmark({ to = "/" }: { to?: string }) {
  return (
    <Link to={to} className={s.brand} aria-label="PROTEUS home">
      <img src="/assets/proteus-wordmark.png" alt="PROTEUS" className={s.wordmark} width={92} height={18} />
    </Link>
  );
}

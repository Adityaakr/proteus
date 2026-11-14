/** The blog's frame: the same sticky top bar as the docs, with Blog selected. */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import "../app.css";
import { Wordmark } from "../layouts/Wordmark";
import s from "./blog.module.css";

const NAV = [
  { label: "Product", href: "/#features" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
];

export function BlogLayout({ children }: { children: ReactNode }) {
  return (
    <div data-app className={s.root}>
      <header className={s.top}>
        <Link to="/" className={s.brand} aria-label="Proteus AI home"><Wordmark /></Link>
        <nav className={s.pills} aria-label="Site">
          {NAV.map((n) => (
            n.href.startsWith("/#")
              ? <a key={n.label} href={n.href} className={s.pill}>{n.label}</a>
              : <Link key={n.label} to={n.href} className={`${s.pill} ${n.label === "Blog" ? s.pillOn : ""}`}>{n.label}</Link>
          ))}
        </nav>
        <a href="https://app.proteus.co.in/app" className={s.cta}>Open the app <ArrowUpRight size={14} aria-hidden /></a>
      </header>
      {children}
    </div>
  );
}

export function Foot() {
  return (
    <footer className={s.foot}>
      Written by Aditya, founder of Proteus AI. Facts match <a href="/docs" className={s.a}>the docs</a> and <a href="/docs/facts.json" className={s.a}>facts.json</a>. For agents: <a href="/llms.txt" className={s.a}>llms.txt</a> · <a href="/blog/rss.xml" className={s.a}>RSS</a>
    </footer>
  );
}

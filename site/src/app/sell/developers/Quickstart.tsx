/**
 * Quickstart & reference on the Developers page: one console for the seller API. Pick a quickstart step or an endpoint
 * on the left; the right shows what it does, the curl or TypeScript to copy, and a Send button. Send uses the public
 * sandbox key by default (already loaded, demo data, writes are dry runs), or a key the seller pastes for this visit.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";
import { Card, DataTable } from "../../seller/kit";
import { CodeTabs, CopyButton } from "../../docs/Code";
import { TryIt, TryItKeyProvider, type OwnTarget } from "../../docs/TryIt";
import { v1 } from "../v1";
import { ERRORS_REFERENCE, SELLER_API_DOCS, SELLER_API_REFERENCE, endpointExamples, quickstartSnippets, type ApiRoute } from "./reference";
import d from "./developers.module.css";

type Item = { id: string; group: "Quickstart" | "Endpoints"; label: string; route: ApiRoute; text: string; bash: string; ts: string; example: Record<string, unknown> | null };

const LANGS = ["cURL", "TypeScript"] as const;
const routeOf = (key: string) => SELLER_API_REFERENCE.find((r) => `${r.method} ${r.path}` === key)!;

/** `code` spans in plain reference text. */
function Inline({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/g).map((t, i) => (t.startsWith("`") && t.endsWith("`") ? <code key={i} className={d.inlineCode}>{t.slice(1, -1)}</code> : <span key={i}>{t}</span>))}</>;
}

export function Quickstart({ apiBase, env, ownKeys }: { apiBase: string; env: "test" | "live"; ownKeys: boolean }) {
  const examples = endpointExamples(apiBase);
  const items: Item[] = [
    ...quickstartSnippets(apiBase, env).map((st): Item => {
      const ex = examples.find((e) => `${e.method} ${e.path}` === st.route)!;
      return { id: `qs-${st.id}`, group: "Quickstart", label: st.title, route: routeOf(st.route), text: st.body, bash: st.bash, ts: st.ts, example: ex.example };
    }),
    ...examples.map((ex): Item => ({ id: `ep-${ex.method}-${ex.path}`, group: "Endpoints", label: ex.title, route: routeOf(`${ex.method} ${ex.path}`), text: ex.description, bash: ex.bash, ts: ex.ts, example: ex.example })),
  ];
  const [selected, setSelected] = useState(items[0]!.id);
  const [lang, setLang] = useState<string>(LANGS[0]);
  const item = items.find((x) => x.id === selected) ?? items[0]!;

  // The signed-in seller's own ids, to pre-fill :id when sending with their key.
  const products = useQuery({ queryKey: ["sell", "developers", "products"], queryFn: () => v1.app.products(), retry: false, enabled: ownKeys });
  const deals = useQuery({ queryKey: ["sell", "developers", "deals"], queryFn: () => v1.app.deals(), retry: false, enabled: ownKeys });
  const own: OwnTarget | undefined = ownKeys ? { base: apiBase, env, ids: { product: (products.data as { id: string }[] | undefined)?.[0]?.id, deal: deals.data?.[0]?.id } } : undefined;

  const columns = [
    { key: "s", header: "Status", render: (e: (typeof ERRORS_REFERENCE)[number]) => <span className={d.statusCode}>{e.status}</span> },
    { key: "m", header: "Meaning", render: (e: (typeof ERRORS_REFERENCE)[number]) => e.meaning },
  ];

  return (
    <Card aria-label="Seller API console">
      <div className={d.baseRow}>
        <span className={d.baseLabel}>Base URL</span>
        <code className={d.baseUrl}>{apiBase}</code>
        <CopyButton text={apiBase} className={d.baseCopy} />
        <span className={d.baseNote}>JSON in and out · money in micro-USDC strings · scoped to your seller</span>
        <Link to={SELLER_API_DOCS.reference} className={d.inlineLink}>Full reference <ArrowUpRight size={13} aria-hidden /></Link>
      </div>
      <TryItKeyProvider>
        <div className={d.console}>
          <nav className={d.consoleNav} aria-label="Seller API">
            <label className={d.consoleSelect}>
              <span className={d.navGroup}>Endpoint</span>
              <select value={item.id} onChange={(e) => setSelected(e.target.value)}>
                {(["Quickstart", "Endpoints"] as const).map((g) => (
                  <optgroup key={g} label={g}>
                    {items.filter((x) => x.group === g).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </label>
            {(["Quickstart", "Endpoints"] as const).map((g) => (
              <div key={g} className={d.navList}>
                <span className={d.navGroup}>{g}</span>
                {items.filter((x) => x.group === g).map((x) => (
                  <button key={x.id} type="button" className={`${d.navItem} ${x.id === item.id ? d.navOn : ""}`} aria-current={x.id === item.id ? "true" : undefined} onClick={() => setSelected(x.id)}>
                    {g === "Endpoints" && <span className={`${d.verb} ${d[`verb${x.route.method}`] ?? ""}`}>{x.route.method}</span>}
                    <span className={d.navLabel}>{x.label}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
          <div className={d.consoleMain}>
            <div className={d.consoleHead}>
              <h3 className={d.consoleTitle}>{item.label}</h3>
              <span className={d.consoleRoute}>
                <span className={`${d.verb} ${d[`verb${item.route.method}`] ?? ""}`}>{item.route.method}</span>
                <code>{item.route.path.replace("/v1/seller", "")}</code>
                <span className={`${d.scope} ${item.route.scope?.endsWith(":write") ? d.scopeWrite : ""}`}>{item.route.scope ?? "any key"}</span>
              </span>
              <p className={d.consoleText}><Inline text={item.text} /></p>
            </div>
            <CodeTabs tabs={[{ label: "cURL", lang: "bash", code: item.bash }, { label: "TypeScript", lang: "ts", code: item.ts }]} value={lang} onChange={setLang} />
            <TryIt key={item.id} route={item.route} example={item.example} own={own} compact />
          </div>
        </div>
      </TryItKeyProvider>
      <details className={d.errorsBox}>
        <summary>Errors</summary>
        <DataTable caption="Errors" columns={columns} rows={[...ERRORS_REFERENCE]} rowKey={(e) => e.status} />
      </details>
    </Card>
  );
}

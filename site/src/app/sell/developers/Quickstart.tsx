import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, DataTable, type DataColumn } from "../../seller/kit";
import { Code } from "../../docs/Code";
import { ERRORS_REFERENCE, SELLER_API_DOCS, SELLER_API_REFERENCE, quickstartSnippets, type ApiRoute } from "./reference";
import d from "./developers.module.css";

/** Seller API quickstart (curl or TypeScript) and the endpoint reference with the permission each one needs. */
export function Quickstart({ apiBase, env }: { apiBase: string; env: "test" | "live" }) {
  const [lang, setLang] = useState<"bash" | "ts">("bash");
  const steps = quickstartSnippets(apiBase, env);
  const columns: DataColumn<ApiRoute>[] = [
    { key: "method", header: "Method", render: (r) => <span className={d.method}>{r.method}</span> },
    { key: "path", header: "Path", render: (r) => <span className={d.refPath}>{r.path.replace("/v1/seller", "")}</span> },
    { key: "scope", header: "Permission", render: (r) => (r.scope ? <span className={`${d.scope} ${r.scope.endsWith(":write") ? d.scopeWrite : ""}`}>{r.scope}</span> : <span className={d.whenSub}>Any key</span>) },
    { key: "what", header: "What it does", render: (r) => r.summary },
  ];
  return (
    <>
      <Card
        title="Quickstart"
        subtitle={<>Base URL <code className={d.refPath}>{apiBase}</code>. JSON in and out; money is micro-USDC strings and every response is scoped to your own seller. <Link to={SELLER_API_DOCS.guide} className={d.inlineLink}>Full guide in the docs</Link></>}
        actions={
          <div className={d.langTabs} role="tablist" aria-label="Language">
            {([["bash", "curl"], ["ts", "TypeScript"]] as const).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={lang === id} className={`${d.envTab} ${lang === id ? d.envTabOn : ""}`} onClick={() => setLang(id)}>{label}</button>
            ))}
          </div>
        }
      >
        <ol className={d.steps}>
          {steps.map((st) => (
            <li key={st.id} className={d.step}>
              <div className={d.stepText}>
                <h3>{st.title}</h3>
                <p>{st.body}</p>
              </div>
              <Code lang={lang}>{lang === "bash" ? st.bash : st.ts}</Code>
            </li>
          ))}
        </ol>
      </Card>
      <Card title="Reference" subtitle={<>Every seller API endpoint and the key permission it needs. Paths are relative to the base URL. <Link to={SELLER_API_DOCS.reference} className={d.inlineLink}>Examples for each endpoint</Link></>}>
        <DataTable caption="Seller API endpoints" columns={columns} rows={SELLER_API_REFERENCE} rowKey={(r) => `${r.method} ${r.path}`} />
        <DataTable
          caption="Errors"
          columns={[
            { key: "s", header: "Status", render: (e: (typeof ERRORS_REFERENCE)[number]) => <span className={d.statusCode}>{e.status}</span> },
            { key: "m", header: "Meaning", render: (e: (typeof ERRORS_REFERENCE)[number]) => e.meaning },
          ]}
          rows={[...ERRORS_REFERENCE]}
          rowKey={(e) => e.status}
        />
      </Card>
    </>
  );
}

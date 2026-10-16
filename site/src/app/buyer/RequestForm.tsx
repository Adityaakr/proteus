import { useId, useState, type ChangeEvent } from "react";
import { Paperclip, X } from "lucide-react";
import { Field } from "../ui/Field";
import type { RequestField, RequestSpec } from "../lib/types";
import s from "./request.module.css";

/** Fallback when a product has no request spec: one free-text request plus an optional reference. */
export const DEFAULT_SPEC: RequestSpec = {
  fields: [
    { key: "question", label: "Request", type: "textarea", required: true, placeholder: "What the service should do" },
    { key: "orderId", label: "Reference", type: "text", placeholder: "Optional", hint: "Your own id, echoed in the receipt." },
  ],
};

/** First-party sample order store: question plus one of the sample order ids. */
export const SAMPLE_SPEC: RequestSpec = {
  fields: [
    { key: "question", label: "Question", type: "textarea", required: true, placeholder: "Where is my order?" },
    { key: "orderId", label: "Order id", type: "text", placeholder: "A1001", hint: "Sample store orders A1001 to A1004." },
  ],
};

export type RequestValues = Record<string, string | number | { name: string; type: string; size: number; dataBase64: string } | undefined>;

const MAX_FILE = 512 * 1024;

export function emptyValues(spec: RequestSpec): RequestValues {
  const v: RequestValues = {};
  for (const f of spec.fields) v[f.key] = f.type === "file" ? undefined : "";
  return v;
}

export function missingRequired(spec: RequestSpec, v: RequestValues): string | null {
  for (const f of spec.fields) {
    if (!f.required) continue;
    const x = v[f.key];
    if (x === undefined || x === "" || (typeof x === "string" && !x.trim())) return `${f.label} is required.`;
  }
  return null;
}

/** The `input` object sent to the service: trimmed strings, numbers as numbers, files as base64 envelopes. Empty optionals are dropped. */
export function toInput(spec: RequestSpec, v: RequestValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const x = v[f.key];
    if (x === undefined || x === "") continue;
    if (f.type === "number") out[f.key] = Number(x);
    else if (typeof x === "string") out[f.key] = x.trim();
    else out[f.key] = x;
  }
  return out;
}

async function readFile(file: File) {
  if (file.size > MAX_FILE) throw new Error(`${file.name} is larger than 512 KB.`);
  const buf = await file.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { name: file.name, type: file.type || "application/octet-stream", size: file.size, dataBase64: btoa(bin) };
}

function FileField({ f, value, onChange, error }: { f: RequestField; value: RequestValues[string]; onChange: (v: RequestValues[string]) => void; error?: string | null }) {
  const id = useId();
  const [err, setErr] = useState<string | null>(null);
  const file = value && typeof value === "object" ? value : null;
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setErr(null);
    try {
      onChange(await readFile(picked));
    } catch (x) {
      setErr((x as Error).message);
    }
  };
  return (
    <div className={s.fileField}>
      <label htmlFor={id} className={s.fileLabel}>{f.label}{f.required ? "" : <span className={s.opt}> (optional)</span>}</label>
      {file ? (
        <span className={s.fileChip}>
          <Paperclip size={13} aria-hidden />
          <span className={s.fileName}>{file.name}</span>
          <span className={s.fileSize}>{Math.max(1, Math.round(file.size / 1024))} KB</span>
          <button type="button" className={s.fileRemove} onClick={() => onChange(undefined)} aria-label={`Remove ${file.name}`}><X size={13} /></button>
        </span>
      ) : (
        <label className={s.fileDrop}>
          <Paperclip size={14} aria-hidden />
          <span>{f.placeholder ?? "Choose a file"}</span>
          <input id={id} type="file" className="sr-only" onChange={pick} />
        </label>
      )}
      {(f.hint || err || error) && <span className={err || error ? s.fileErr : s.fileHint}>{err ?? error ?? f.hint}</span>}
    </div>
  );
}

/** Renders a product's request spec as fields. Controlled: the parent owns `values`. */
export function RequestForm({ spec, values, onChange, error }: { spec: RequestSpec; values: RequestValues; onChange: (v: RequestValues) => void; error?: string | null }) {
  const set = (k: string, v: RequestValues[string]) => onChange({ ...values, [k]: v });
  return (
    <div className={s.form}>
      {spec.intro && <p className={s.intro}>{spec.intro}</p>}
      {spec.fields.map((f) =>
        f.type === "file" ? (
          <FileField key={f.key} f={f} value={values[f.key]} onChange={(v) => set(f.key, v)} error={error && f.required && !values[f.key] ? error : null} />
        ) : f.type === "textarea" ? (
          <Field key={f.key} multiline rows={3} label={f.required ? f.label : <>{f.label} <span className={s.opt}>(optional)</span></>} placeholder={f.placeholder} hint={f.hint} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} maxLength={4000} />
        ) : (
          <Field key={f.key} label={f.required ? f.label : <>{f.label} <span className={s.opt}>(optional)</span></>} placeholder={f.placeholder} hint={f.hint} inputMode={f.type === "number" ? "decimal" : undefined} value={String(values[f.key] ?? "")} onChange={(e) => set(f.key, e.target.value)} maxLength={2000} />
        ),
      )}
    </div>
  );
}

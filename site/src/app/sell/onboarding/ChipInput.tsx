import { useId, useState, type KeyboardEvent } from "react";
import { AlertCircle, Plus, X } from "lucide-react";
import s from "../sell.module.css";

/** Chip list input: type and press Enter or comma to add; suggestions add in one click. */
export function ChipInput({
  label,
  hint,
  values,
  onChange,
  suggestions = [],
  placeholder,
  error,
  onBlur,
  id: idProp,
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (v: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? `chip${auto}`;
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const v = raw.trim().replace(/,$/, "").trim();
    if (!v || values.some((x) => x.toLowerCase() === v.toLowerCase())) return setDraft("");
    onChange([...values, v]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(draft);
    } else if (e.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  const rest = suggestions.filter((sug) => !values.some((v) => v.toLowerCase() === sug.toLowerCase()));
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={s.chipField}>
      <label htmlFor={id} className={s.label}>
        {label}
      </label>
      <div className={[s.chipBox, error ? s.chipBoxError : ""].join(" ")}>
        {values.map((v) => (
          <span key={v} className={s.chipOn}>
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X size={12} strokeWidth={2.25} aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={values.length ? "" : placeholder}
          onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={onKey}
          onBlur={() => {
            if (draft.trim()) add(draft);
            onBlur?.();
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
      </div>
      {rest.length > 0 && (
        <div className={s.suggest} aria-label={`Suggested ${label.toLowerCase()}`}>
          {rest.map((sug) => (
            <button key={sug} type="button" className={s.chipSuggest} onClick={() => onChange([...values, sug])}>
              <Plus size={12} strokeWidth={2.25} aria-hidden />
              {sug}
            </button>
          ))}
        </div>
      )}
      {hint && (
        <span id={`${id}-hint`} className={s.hint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={`${id}-err`} className={s.error} role="alert">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}

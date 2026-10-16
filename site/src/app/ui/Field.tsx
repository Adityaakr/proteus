import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { AlertCircle } from "lucide-react";
import s from "./ui.module.css";

type Common = {
  label: ReactNode;
  hint?: ReactNode;
  /** Inline error, linked to the input with aria-describedby and aria-invalid. */
  error?: ReactNode;
  className?: string;
  /** Visually hide the label (still read by screen readers). */
  hideLabel?: boolean;
};

export type FieldProps =
  | (Common & { multiline?: false } & Omit<InputHTMLAttributes<HTMLInputElement>, "className">)
  | (Common & { multiline: true } & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">);

export function Field(props: FieldProps) {
  const { label, hint, error, className, hideLabel, multiline, id: idProp, ...rest } = props as Common & { multiline?: boolean; id?: string } & Record<string, unknown>;
  const auto = useId();
  const id = idProp ?? `f${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  const shared = {
    id,
    className: s.input,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };
  return (
    <div className={[s.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={hideLabel ? "sr-only" : s.fieldLabel}>
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input {...shared} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {hint && (
        <span id={hintId} className={s.fieldHint}>
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} className={s.fieldError} role="alert">
          <AlertCircle size={14} strokeWidth={2} aria-hidden />
          {error}
        </span>
      )}
    </div>
  );
}

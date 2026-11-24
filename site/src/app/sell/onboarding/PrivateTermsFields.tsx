import type { ChangeEvent, ReactNode } from "react";
import { Field } from "../../seller/kit";
import { PRIVATE_TERM_FIELDS, type PrivateTerms } from "./privateTerms";
import s from "../sell.module.css";

interface InputProps { id: string; value: string; onChange: (e: ChangeEvent<HTMLInputElement>) => void; onBlur?: () => void; error?: ReactNode }

/** The private cost and policy inputs. Render inside SellerOnly; `input` binds each field to the caller's form state. */
export function PrivateTermsFields({ input }: { input: (key: keyof PrivateTerms) => InputProps }) {
  return (
    <div className={s.grid3}>
      {PRIVATE_TERM_FIELDS.map(({ key, ...field }) => (
        <Field key={key} {...field} {...input(key)} className={s.privField} autoComplete="off" />
      ))}
    </div>
  );
}

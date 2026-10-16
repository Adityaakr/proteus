import { Check } from "lucide-react";
import s from "./ui.module.css";

export const DEAL_STAGES = ["Negotiate", "Accept", "Fund", "Use", "Receipt"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface StepperProps {
  /** Current stage (0 based index or name). Stages before it are done. */
  current: number | DealStage;
  steps?: readonly string[];
  className?: string;
  label?: string;
}

export function Stepper({ current, steps = DEAL_STAGES, className, label = "Deal progress" }: StepperProps) {
  const idx = typeof current === "number" ? current : steps.indexOf(current);
  return (
    <nav aria-label={label} className={className}>
      <ol className={s.stepper}>
        {steps.map((name, i) => {
          const state = i < idx ? "done" : i === idx ? "current" : "todo";
          return (
            <li key={name} className={[s.step, s[`step_${state}`]].filter(Boolean).join(" ")} aria-current={state === "current" ? "step" : undefined}>
              {i > 0 && <span className={[s.stepBar, i <= idx ? s.stepBar_done : ""].join(" ")} aria-hidden />}
              <span className={s.stepDot} aria-hidden>
                {state === "done" ? <Check size={12} strokeWidth={3} /> : i + 1}
              </span>
              <span className={s.stepLabel}>
                {name}
                <span className="sr-only">{state === "done" ? ", done" : state === "current" ? ", current step" : ", not started"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

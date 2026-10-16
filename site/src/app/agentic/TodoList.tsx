import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, LoaderCircle } from "lucide-react";
import { T_DEFAULT } from "../../lib/motion";
import s from "./agentic.module.css";

export type TodoStatus = "pending" | "in-progress" | "completed";

export interface TodoItem {
  id: string;
  label: ReactNode;
  status: TodoStatus;
  detail?: ReactNode;
}

export interface TodoListProps {
  items: TodoItem[];
  title?: ReactNode;
  showProgress?: boolean;
  /** Heading level for the title. Default 2. */
  level?: 2 | 3;
  className?: string;
}

export function TodoList({ items, title, showProgress = true, level = 2, className }: TodoListProps) {
  const done = items.filter((i) => i.status === "completed").length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const H = `h${level}` as "h2";
  return (
    <div className={[s.todo, className].filter(Boolean).join(" ")}>
      {(title || showProgress) && (
        <div className={s.todoHead}>
          {title && <H className="h6">{title}</H>}
          {showProgress && (
            <span className="body3" style={{ fontVariantNumeric: "tabular-nums" }}>
              {done} of {items.length} done
            </span>
          )}
        </div>
      )}
      {showProgress && (
        <div className={s.progress} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
          <motion.span className={s.progressBar} initial={false} animate={{ width: `${pct}%` }} transition={T_DEFAULT} />
        </div>
      )}
      <ol className={s.todoItems}>
        {items.map((it) => {
          const active = it.status === "in-progress";
          const complete = it.status === "completed";
          return (
            <li key={it.id} className={`${s.todoItem} ${active ? s.todoItemActive : ""}`} aria-current={active ? "step" : undefined}>
              <span className={`${s.todoMark} ${complete ? s.todoMarkDone : active ? s.todoMarkActive : ""}`} aria-hidden>
                {complete ? <Check size={13} strokeWidth={3} /> : active ? <LoaderCircle size={13} strokeWidth={2.5} className={s.spin} /> : null}
              </span>
              <span className={s.todoText}>
                <span className={`${s.todoLabel} ${complete ? s.todoLabelDone : ""}`}>
                  {it.label}
                  <span className="sr-only">{complete ? ", completed" : active ? ", in progress" : ", pending"}</span>
                </span>
                {it.detail && <span className={s.todoDetail}>{it.detail}</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

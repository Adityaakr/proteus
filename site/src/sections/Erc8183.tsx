import { Check, CornerDownRight, Workflow } from "lucide-react";
import { erc8183 } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { SectionHeader } from "../ui/SectionHeader";
import s from "./Erc8183.module.css";

/* The "Active" green the How it works order card uses for completed rows (UiCardLoading). */
const ACTIVE_GREEN = "var(--token-03157c8f-9190-4af0-ae5c-b10d22f4922d, rgb(43, 182, 115))";

/**
 * ERC-8183 (id "erc-8183"): a dark section in the register of Payment protection and Why Arc.
 * The standard's roles sit in one strip; below, its job lifecycle is a track with one example
 * order moving along it. Each step shows the standard's step, then a white order card (the How it
 * works agent card, with its green checks) holding the money at that point. Rejected or expired is
 * a dashed branch off Completed, and each thing Proteus adds hangs under the step where it applies.
 * Horizontal on desktop and tablet, a vertical track on phones. The compatible interface is Planned.
 */
export function Erc8183() {
  const d = erc8183;
  return (
    <section id="erc-8183" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader tag={d.tag} icon={<Workflow size={16} strokeWidth={2} />} heading={d.heading} description={d.description} align="center" dark gap={32} textGap={16} headingMaxWidth={680} descriptionMaxWidth={620} />

          <dl className={s.roles}>
            {d.roles.map((r) => (
              <div key={r.name} className={s.role}>
                <dt className={`label ${s.roleName}`}>{r.name}</dt>
                <dd className={`h6 ${s.white}`}>{r.proteus}</dd>
              </div>
            ))}
          </dl>

          <div className={s.track}>
            <p className={`label ${s.caption}`}>{d.order}</p>
            <ol className={s.steps}>
              {d.steps.map((step, i) => (
                <Appear as="li" key={step.state} preset="pop-0.4" className={s.step}>
                  <div className={s.head}>
                    <span className={`label ${s.no}`}>{String(i + 1).padStart(2, "0")}</span>
                    <h3 className={`h5 ${s.white}`}>{step.state}</h3>
                    <p className={`body3 ${s.muted}`}>{step.standard}</p>
                  </div>
                  <div className={s.rail} aria-hidden>
                    <span className={s.dot} />
                  </div>
                  <div className={s.body}>
                    <div className={s.card}>
                      <p className={`h5 ${s.amount}`}>
                        <Check size={18} strokeWidth={2.5} color={ACTIVE_GREEN} aria-hidden />
                        {step.amount}
                      </p>
                      <p className={`body3 ${s.cardText}`}>{step.proteus}</p>
                    </div>
                    {step.branch && (
                      <div className={s.branch}>
                        <span className={`label ${s.branchState}`}>
                          <CornerDownRight size={14} strokeWidth={2} aria-hidden />
                          {step.branch.state}
                        </span>
                        <p className={`h6 ${s.white}`}>{step.branch.amount}</p>
                        <p className={`body3 ${s.muted}`}>{step.branch.proteus}</p>
                      </div>
                    )}
                    {step.adds.map((a) => (
                      <div key={a.title} className={s.add}>
                        <p className={`h6 ${s.white}`}>
                          <span className={s.plus}>+ </span>
                          {a.title} <span className={s.status}>· {a.status}</span>
                        </p>
                        <p className={`body3 ${s.muted}`}>{a.body}</p>
                      </div>
                    ))}
                  </div>
                </Appear>
              ))}
            </ol>
          </div>

          <div className={s.foot}>
            <p className={`h5 ${s.white}`}>{d.closing}</p>
            <p className={`body3 ${s.muted}`}>{d.footnote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

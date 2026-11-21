import { ArrowRight, Workflow } from "lucide-react";
import { erc8183 } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { SectionHeader } from "../ui/SectionHeader";
import s from "./Erc8183.module.css";

/**
 * ERC-8183 (id "erc-8183"): a dark section in the register of Payment protection and Why Arc.
 * Centered white header, then three blocks: the standard's three roles, its job lifecycle as a
 * flow of five states with the same example order on Proteus under each, and what Proteus adds
 * (left-border items, as in Who it's for). The compatible interface is Planned; the footnote says so.
 */
export function Erc8183() {
  const d = erc8183;
  return (
    <section id="erc-8183" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader tag={d.tag} icon={<Workflow size={16} strokeWidth={2} />} heading={d.heading} description={d.description} align="center" dark gap={32} textGap={16} headingMaxWidth={680} descriptionMaxWidth={640} />

          <div className={s.block}>
            <p className={`label ${s.blockTitle}`}>{d.rolesTitle}</p>
            <div className={s.roles}>
              {d.roles.map((r) => (
                <Appear key={r.name} preset="pop-0.4" className={s.role}>
                  <h3 className={`h5 ${s.white}`}>{r.name}</h3>
                  <p className={`body3 ${s.muted}`}>{r.standard}</p>
                  <p className={`body3 ${s.proteus}`}><span className={s.on}>{d.proteusLabel}:</span> {r.proteus}</p>
                </Appear>
              ))}
            </div>
          </div>

          <div className={s.block}>
            <p className={`label ${s.blockTitle}`}>{d.lifecycleTitle}</p>
            <ol className={s.flow}>
              {d.lifecycle.map((step, i) => (
                <li key={step.state} className={s.flowItem}>
                  <Appear preset="pop-0.4" className={s.state}>
                    <span className={`label ${s.stateNo}`}>{String(i + 1).padStart(2, "0")}</span>
                    <h3 className={`h6 ${s.white}`}>{step.state}</h3>
                    <p className={`body3 ${s.muted}`}>{step.standard}</p>
                    <div className={s.divider} />
                    <span className={`label ${s.on}`}>{d.proteusLabel}</span>
                    <p className={`body3 ${s.proteus}`}>{step.proteus}</p>
                  </Appear>
                  {i < d.lifecycle.length - 1 && (
                    <span className={s.arrow} aria-hidden>
                      <ArrowRight size={16} strokeWidth={2} />
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          <div className={s.block}>
            <p className={`label ${s.blockTitle}`}>{d.addsTitle}</p>
            <div className={s.adds}>
              {d.adds.map((a) => (
                <div key={a.title} className={s.add}>
                  <h3 className={`h6 ${s.white}`}>
                    {a.title} <span className={s.status}>· {a.status}</span>
                  </h3>
                  <p className={`body3 ${s.muted}`}>{a.body}</p>
                </div>
              ))}
            </div>
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

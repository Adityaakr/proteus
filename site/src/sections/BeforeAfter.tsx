import { ArrowLeftRight, Check, Minus } from "lucide-react";
import { beforeAfter } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { SectionHeader } from "../ui/SectionHeader";
import t from "./Compare.module.css";
import s from "./BeforeAfter.module.css";

/**
 * "Before and after" (id "before-after"): one example order, stage by stage, run the usual way and
 * through Proteus. It borrows the comparison table's styles (Compare.module.css) so the two tables
 * read as one system: light section, Proteus column on the faint accent, and cards on phones.
 */
function Side({ name, description, accent }: { name: string; description: string; accent?: boolean }) {
  return (
    <div className={`${t.vendor} ${accent ? t.vendorAccent : ""}`}>
      <span className={t.vendorName}>{name}</span>
      <span className={`body3 ${t.vendorDesc}`}>{description}</span>
    </div>
  );
}

function Cell({ text, after }: { text: string; after?: boolean }) {
  const Icon = after ? Check : Minus;
  return (
    <span className={`${s.cell} ${after ? s.cellAfter : ""}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden className={s.icon} />
      <span>{text}</span>
    </span>
  );
}

export function BeforeAfter() {
  const d = beforeAfter;
  return (
    <section id="before-after" className={t.section}>
      <div className={t.container}>
        <div className={t.content}>
          <SectionHeader tag={d.tag} icon={<ArrowLeftRight size={16} strokeWidth={2} />} heading={d.heading} description={d.description} align="center" gap={32} textGap={16} headingMaxWidth={640} descriptionMaxWidth={640} />

          <Appear preset="pop-0.4" className={t.tableWrap}>
            <table className={`${t.table} ${s.table}`}>
              <caption className="sr-only">The same order without Proteus and with Proteus, stage by stage</caption>
              <thead>
                <tr>
                  <th scope="col" className={t.capHead}><span className="label">{d.stageLabel}</span></th>
                  <th scope="col"><Side {...d.before} /></th>
                  <th scope="col" className={t.colAccent}><Side {...d.after} accent /></th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((row) => (
                  <tr key={row.stage}>
                    <th scope="row" className={t.cap}>{row.stage}</th>
                    <td><Cell text={row.before} /></td>
                    <td className={t.colAccent}><Cell text={row.after} after /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Appear>

          <div className={t.cards} aria-label="The order, stage by stage">
            {d.rows.map((row) => (
              <Appear key={row.stage} preset="pop-0.4" className={`${t.card} ${s.card}`}>
                <h3 className={`h6 ${s.stage}`}>{row.stage}</h3>
                <div className={s.side}>
                  <span className={`label ${s.sideLabel}`}>{d.before.name}</span>
                  <Cell text={row.before} />
                </div>
                <div className={`${s.side} ${s.sideAfter}`}>
                  <span className={`label ${s.sideLabel} ${s.sideLabelAfter}`}>{d.after.name}</span>
                  <Cell text={row.after} after />
                </div>
              </Appear>
            ))}
          </div>

          <div className={t.foot}>
            <p className={`h5 ${t.closing} ${s.closing}`}>{d.closing}</p>
            <p className={`body3 ${t.footnote}`}>{d.footnote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

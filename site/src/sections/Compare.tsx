import { ArrowUpRight, Check, Clock, Minus, Scale } from "lucide-react";
import { compare, type CompareMark, type CompareVendor } from "../content/proteus";
import { Appear } from "../lib/Appear";
import { SectionHeader } from "../ui/SectionHeader";
import s from "./Compare.module.css";

/**
 * "How Proteus AI compares": a light, spacious comparison table in the register of Linear, Ramp and
 * Attio. Proteus AI sits in the first column on a faint accent; competitors are plain typographic
 * names linking to their sites. Marks are Yes, Partial, Not core focus or Planned, nothing louder.
 * On phones each product becomes a card. No third-party logos: names only.
 */
const MARK: Record<CompareMark, { label: string; icon: typeof Check }> = {
  yes: { label: "Yes", icon: Check },
  partial: { label: "Partial", icon: Minus },
  "not-core": { label: "Not core focus", icon: Minus },
  planned: { label: "Planned", icon: Clock },
};

function Mark({ mark, note, accent }: { mark: CompareMark; note?: string; accent?: boolean }) {
  const m = MARK[mark];
  const Icon = m.icon;
  return (
    <span className={`${s.mark} ${s[`mark_${mark.replace("-", "_")}`]} ${accent && mark === "yes" ? s.markAccent : ""}`}>
      <span className={s.markRow}>
        <Icon size={14} strokeWidth={2.5} aria-hidden />
        <span>{m.label}</span>
      </span>
      {note && <span className={s.note}>{note}</span>}
    </span>
  );
}

function VendorHead({ v, accent }: { v: CompareVendor; accent?: boolean }) {
  const external = v.href.startsWith("http");
  return (
    <div className={`${s.vendor} ${accent ? s.vendorAccent : ""}`}>
      <a href={v.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={s.vendorName} aria-label={external ? `${v.name}, opens their site` : v.name}>
        {v.logo ? <span className={s.logoBox}><img src={v.logo} alt={v.name} className={s.vendorLogo} style={v.logoHeight ? { height: v.logoHeight } : undefined} decoding="async" /></span> : v.name}
        {external && <ArrowUpRight size={13} strokeWidth={2} aria-hidden />}
      </a>
      <span className={`body3 ${s.vendorDesc}`}>{v.description}</span>
    </div>
  );
}

/** The comparison data; the landing page passes its own, the default is the docs' vendor table. */
export interface CompareData {
  tag: string;
  heading: string;
  description: string;
  capabilities: string[];
  proteus: CompareVendor;
  vendors: CompareVendor[];
  closing: string;
  footnote: string;
}

export function Compare({ data = compare }: { data?: CompareData }) {
  const all = [data.proteus, ...data.vendors];
  return (
    <section id="compare" className={s.section}>
      <div className={s.container}>
        <div className={s.content}>
          <SectionHeader tag={data.tag} icon={<Scale size={16} strokeWidth={2} />} heading={data.heading} description={data.description} align="center" gap={32} textGap={16} headingMaxWidth={620} descriptionMaxWidth={640} />

          <Appear preset="pop-0.4" className={s.tableWrap}>
            <table className={s.table}>
              <caption className="sr-only">{`How Proteus AI compares with ${data.vendors.map((v) => v.name).join(", ")}`}</caption>
              <thead>
                <tr>
                  <th scope="col" className={s.capHead}><span className="label">Capability</span></th>
                  {all.map((v, i) => (
                    <th key={v.name} scope="col" className={i === 0 ? s.colAccent : undefined}>
                      <VendorHead v={v} accent={i === 0} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.capabilities.map((cap, r) => (
                  <tr key={cap}>
                    <th scope="row" className={s.cap}>{cap}</th>
                    {all.map((v, i) => (
                      <td key={v.name} className={i === 0 ? s.colAccent : undefined}>
                        <Mark mark={v.marks[r]!} note={v.notes?.[r]} accent={i === 0} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Appear>

          <div className={s.cards} aria-label="Comparison by product">
            {all.map((v, i) => (
              <Appear key={v.name} preset="pop-0.4" className={`${s.card} ${i === 0 ? s.cardAccent : ""}`}>
                <VendorHead v={v} accent={i === 0} />
                <ul className={s.cardRows}>
                  {data.capabilities.map((cap, r) => (
                    <li key={cap}>
                      <span className={`body3 ${s.cardCap}`}>{cap}</span>
                      <Mark mark={v.marks[r]!} note={v.notes?.[r]} accent={i === 0} />
                    </li>
                  ))}
                </ul>
              </Appear>
            ))}
          </div>

          <div className={s.foot}>
            <p className={`h5 ${s.closing}`}>{data.closing}</p>
            <p className={`body3 ${s.footnote}`}>{data.footnote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

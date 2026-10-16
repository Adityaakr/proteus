import { DataTable, Money, StatusTag, type DataColumn } from "../kit";
import { unitPrice, units } from "../format";
import type { WireCandidate } from "../types";
import { MarginVsFloor, RuleChips } from "./Rules";
import s from "./parts.module.css";

const ORIGIN: Record<WireCandidate["origin"], string> = {
  tier: "List tier",
  budget_fit: "Budget fit",
  requested_units: "Requested units",
  counter: "Buyer counter",
};

/** Candidates with private economics. Render inside a <SellerOnly> panel. */
export function CandidateTable({ candidates, floorBps, caption, highlight }: { candidates: WireCandidate[]; floorBps?: string; caption?: string; highlight?: string }) {
  const cols: DataColumn<WireCandidate>[] = [
    {
      key: "pkg",
      header: "Package",
      render: (c) => (
        <span style={{ display: "block", minWidth: 150 }}>
          <span style={{ color: "var(--c-dark)", fontWeight: 500 }}>
            {c.tierName}
            {highlight === c.candidateId ? " (quoted)" : ""}
          </span>
          <span className={s.cellSub}>
            {units(c.units)} units at {unitPrice(c.unitPrice)} · {c.origins.map((o) => ORIGIN[o]).join(", ")}
          </span>
        </span>
      ),
    },
    { key: "rev", header: "Revenue", numeric: true, render: (c) => <Money micro={c.economics.expectedRevenue} /> },
    { key: "var", header: "Variable cost", numeric: true, render: (c) => <Money micro={c.economics.expectedVariableCost} /> },
    { key: "tx", header: "Tx cost", numeric: true, render: (c) => <Money micro={c.economics.expectedTxCost} /> },
    {
      key: "con",
      header: "Contribution",
      numeric: true,
      render: (c) => (
        <span>
          <Money micro={c.economics.expectedContribution} />
          <span className={s.cellSub} style={{ whiteSpace: "nowrap" }}>
            after <Money micro={c.economics.allocatedDirectCost} /> direct
          </span>
        </span>
      ),
    },
    { key: "mar", header: "Margin vs floor", numeric: true, render: (c) => <MarginVsFloor bps={c.economics.expectedContributionMarginBps} floor={floorBps} /> },
    {
      key: "st",
      header: "Status and rule ids",
      render: (c) => (
        <span style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", minWidth: 150 }}>
          <StatusTag state={c.status} />
          <RuleChips rules={c.rules} />
        </span>
      ),
    },
  ];
  return <DataTable columns={cols} rows={candidates} rowKey={(c) => c.candidateId} caption={caption} />;
}

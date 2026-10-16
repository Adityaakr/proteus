import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { Card, MonoValue, Notice } from "../ui";

/** Signer summary for /app/settings; the full controls live under /app/sell/settings. */
export default function SignerSection() {
  const q = useQuery({ queryKey: ["app", "signer"], queryFn: () => api.app.signer(), retry: false });
  const s = q.data as { address?: string | null; scope?: string | null; payee?: string | null; note?: string } | undefined;
  return (
    <Card title="Seller signer" subtitle="Signs terms and deliveries for your business. It cannot move funds.">
      {s?.address ? (
        <>
          <p className="body2">Signer <MonoValue value={s.address} short copy /> · payee <MonoValue value={s.payee ?? ""} short copy /></p>
          <p className="body3" style={{ opacity: 0.7 }}>{s.note}</p>
        </>
      ) : (
        <Notice tone="info">No signer yet. Publish a product to create one.</Notice>
      )}
      <p className="body2"><Link to="/app/sell/settings">Manage signer and payouts</Link></p>
    </Card>
  );
}

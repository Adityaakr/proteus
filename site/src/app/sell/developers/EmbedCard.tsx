import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2 } from "lucide-react";
import { Field } from "../../ui/Field";
import { ActionButton, Card, KeyValue, MonoValue, Notice, StatusTag } from "../../seller/kit";
import { errorMessage } from "../../seller/transport";
import { v1 } from "../v1";
import s from "../sell.module.css";

/**
 * Put the deal agent on the seller's own website: a one-line floating "Get a quote" button, an inline panel, or a
 * plain link. Visitors chat with the same agent as the market, see public prices, and open Proteus AI in a new tab to
 * sign and fund. Optionally restrict which sites may embed it.
 */
export function EmbedCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["sell", "embed"], queryFn: () => v1.app.embed(), retry: false });
  const [domains, setDomains] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (list: string[]) => v1.app.setEmbedDomains(list),
    onSuccess: (d) => { qc.setQueryData(["sell", "embed"], d); setDomains(null); },
  });
  if (!q.data) return null;
  const origin = window.location.origin;
  const slug = q.data.slug;
  const button = `<script src="${origin}/embed.js" data-seller="${slug}" data-label="Get a quote" async></script>`;
  const inline = `<script src="${origin}/embed.js" data-seller="${slug}" data-mode="inline" async></script>`;
  const link = `${origin}/embed/${slug}`;
  const domainText = domains ?? q.data.domains.join("\n");
  return (
    <Card title="Deal agent on your website" subtitle="Let customers talk to your deal agent on your own site: product info, prices and an offer in seconds, no call needed. Signing and payment open Proteus AI in a new tab." actions={<StatusTag tone="success" label="Ready" icon={<Code2 size={12} />} />}>
      <div className={s.fields}>
        <KeyValue
          items={[
            { k: "Floating button", v: <MonoValue value={button} copy label="button snippet" /> },
            { k: "Inline panel", v: <MonoValue value={inline} copy label="inline snippet" /> },
            { k: "Shareable link", v: <MonoValue value={link} copy label="deal agent link" /> },
          ]}
        />
        <div className={s.row}>
          <ActionButton variant="secondary" href={link} newTab>Preview the agent</ActionButton>
        </div>
        <Field
          label="Allowed websites (optional, one per line)"
          value={domainText}
          onChange={(e) => setDomains(e.target.value)}
          placeholder={"https://yourshop.com\nhttps://www.yourshop.com"}
          multiline
        />
        <p className={s.hint}>Leave empty to allow any site. When listed, browsers refuse to show your agent anywhere else.</p>
        {save.isError && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {save.isSuccess && domains === null && <Notice tone="success">Saved.</Notice>}
        <div className={s.row}>
          <ActionButton onClick={() => save.mutate(domainText.split(/[\s,]+/).filter(Boolean))} loading={save.isPending} loadingLabel="Saving" disabled={domains === null}>
            Save allowed websites
          </ActionButton>
        </div>
      </div>
    </Card>
  );
}


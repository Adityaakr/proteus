/** Sets the seller-defined request spec (what a buyer sends per request) on the listed products. Idempotent. */
import { and, eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { normalizeRequestSpec } from "../src/services/accounts";

type Spec = Parameters<typeof normalizeRequestSpec>[0];
const F = (label: string, type: "text" | "textarea" | "number" | "file", extra: Partial<{ key: string; required: boolean; placeholder: string; hint: string }> = {}) => ({ label, type, required: true, ...extra });

const SPECS: Record<string, Record<string, Spec>> = {
  "lumen-voice": {
    "ai-receptionist": { intro: "The caller's question as your receptionist would hear it.", fields: [F("Caller question", "textarea", { key: "question", placeholder: "What are your opening hours this weekend?" }), F("Caller phone", "text", { key: "phone", required: false, hint: "Used for the callback if the question needs one." })] },
    "callback-booking": { intro: "Who to call back, and when.", fields: [F("Customer name", "text", { key: "customer", placeholder: "Jane Doe" }), F("Phone number", "text", { key: "phone", placeholder: "+1 415 555 0100" }), F("Preferred time", "text", { key: "time", placeholder: "Tomorrow 10:00, Pacific" }), F("Notes", "textarea", { key: "question", required: false, hint: "Anything the agent should know before calling." }), F("Your reference", "text", { key: "orderId", required: false, hint: "Echoed in the receipt." })] },
    "after-hours-answering": { intro: "The message left after hours.", fields: [F("Caller message", "textarea", { key: "question", placeholder: "Hi, I need to move my appointment on Thursday." }), F("Caller phone", "text", { key: "phone", required: false })] },
  },
  "orbit-labs": {
    "inference-capacity": { intro: "One prompt per request. Tokens are metered on the response.", fields: [F("Prompt", "textarea", { key: "prompt", placeholder: "Summarize the attached incident report in five bullet points." }), F("Max tokens", "number", { key: "maxTokens", required: false, placeholder: "512" }), F("Attachment", "file", { key: "attachment", required: false, hint: "Text, JSON or PDF, up to 512 KB." })] },
    embeddings: { intro: "Text to embed, inline or as a file.", fields: [F("Text", "textarea", { key: "text", required: false, placeholder: "One passage per line." }), F("File", "file", { key: "file", required: false, hint: "Plain text or JSONL, up to 512 KB." }), F("Model", "text", { key: "model", required: false, placeholder: "default" })] },
    "gpu-hours": { intro: "The container to run and how long to reserve it.", fields: [F("Container image", "text", { key: "image", placeholder: "ghcr.io/acme/finetune:1.4" }), F("Hours", "number", { key: "hours", placeholder: "2" }), F("Command", "text", { key: "command", required: false, placeholder: "python train.py --epochs 3" }), F("Completion webhook", "text", { key: "webhook", required: false, placeholder: "https://api.acme.com/hooks/orbit" })] },
  },
  "tessera-vendors": { "vendor-evaluations": { intro: "The vendor to evaluate and what you will buy from them.", fields: [F("Vendor name", "text", { key: "vendor", placeholder: "Acme Freight LLC" }), F("Website", "text", { key: "website", required: false, placeholder: "https://acmefreight.com" }), F("What you are buying", "textarea", { key: "scope", placeholder: "Regional LTL freight, ~40 shipments a month." }), F("Documents", "file", { key: "documents", required: false, hint: "Quote, SOC report or W-9, up to 512 KB." })] } },
  "pilotlight-ops": { "operator-tasks": { intro: "One task for the operator agent, with the access it needs.", fields: [F("Task", "textarea", { key: "task", placeholder: "Reconcile this week's Stripe payouts against the bank statement and list mismatches." }), F("Systems", "text", { key: "systems", required: false, placeholder: "Stripe, Mercury" }), F("Attachment", "file", { key: "attachment", required: false, hint: "CSV, PDF or JSON, up to 512 KB." })] } },
  ledgerline: { "invoice-processing": { intro: "Send the invoice as PDF or JSON. Ledgerline extracts, codes and returns the approval-ready record.", fields: [F("Invoice", "file", { key: "invoice", hint: "PDF, image or JSON, up to 512 KB." }), F("Your reference", "text", { key: "reference", required: false, placeholder: "PO-2026-0412", hint: "Purchase order or internal id, echoed in the receipt." }), F("Notes", "textarea", { key: "notes", required: false, placeholder: "Three-way match against PO-2026-0412." })] } },
  "lantern-compliance": { "screening-checks": { intro: "The counterparty to screen.", fields: [F("Legal name", "text", { key: "name", placeholder: "Acme Freight LLC" }), F("Country", "text", { key: "country", placeholder: "US" }), F("Address", "text", { key: "address", required: false }), F("Registration or tax id", "text", { key: "registrationId", required: false }), F("Supporting document", "file", { key: "document", required: false, hint: "Incorporation certificate or ID, up to 512 KB." })] } },
};

async function main() {
  let n = 0;
  for (const [orgSlug, products] of Object.entries(SPECS)) {
    const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.slug, orgSlug));
    if (!org) { console.log(`skip ${orgSlug}: not seeded`); continue; }
    for (const [slug, spec] of Object.entries(products)) {
      const [row] = await db.select().from(schema.products).where(and(eq(schema.products.orgId, org.id), eq(schema.products.slug, slug)));
      if (!row) { console.log(`skip ${orgSlug}/${slug}: no product`); continue; }
      const pub = { ...(row.public as Record<string, unknown>), request: normalizeRequestSpec(spec) };
      await db.update(schema.products).set({ public: pub }).where(eq(schema.products.id, row.id));
      n++;
      console.log(`set ${orgSlug}/${slug}: ${spec.fields.length} fields`);
    }
  }
  console.log(`done, ${n} products`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

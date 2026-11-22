/**
 * "Create your deal agent" (signed-in account, with or without a seller org yet): read a website, answer the
 * questions, run a test negotiation, publish. See services/importer/service.ts.
 */
import { Hono } from "hono";
import { json } from "../lib/http";
import { auth, requireAuth } from "./auth";
import { continueImport, floorsCsv, importView, latestImport, publishImport, sellerMessage, startImport, testNegotiation, updateAnswers } from "../services/importer/service";

export const builderRoutes = new Hono();

builderRoutes.use("/builder/*", requireAuth);

const body = async (c: { req: { json: () => Promise<unknown> } }) => ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;

builderRoutes.post("/builder/imports", async (c) => json(c, await startImport(auth(c).userId, String((await body(c)).url ?? "")), 201));
builderRoutes.get("/builder/imports/latest", async (c) => json(c, await latestImport(auth(c).userId)));
builderRoutes.get("/builder/imports/:id", async (c) => json(c, await importView(auth(c).userId, c.req.param("id"))));
/** Reads the product pages a budget left unread, from where the read stopped. */
builderRoutes.post("/builder/imports/:id/continue", async (c) => json(c, await continueImport(auth(c).userId, c.req.param("id"))));
builderRoutes.patch("/builder/imports/:id/answers", async (c) => json(c, await updateAnswers(auth(c).userId, c.req.param("id"), await body(c))));
builderRoutes.post("/builder/imports/:id/messages", async (c) => json(c, await sellerMessage(auth(c).userId, c.req.param("id"), String((await body(c)).text ?? ""))));
builderRoutes.post("/builder/imports/:id/floors", async (c) => json(c, await floorsCsv(auth(c).userId, c.req.param("id"), String((await body(c)).csv ?? ""))));
builderRoutes.post("/builder/imports/:id/test", async (c) => {
  const b = await body(c);
  return json(c, await testNegotiation(auth(c).userId, c.req.param("id"), { productKey: typeof b.productKey === "string" ? b.productKey : undefined, message: typeof b.message === "string" ? b.message : undefined, counterUsd: typeof b.counterUsd === "string" && /^\$?\d[\d,]*(\.\d{1,2})?$/.test(b.counterUsd.trim()) ? b.counterUsd : undefined }));
});
builderRoutes.post("/builder/imports/:id/publish", async (c) => json(c, await publishImport(auth(c).userId, c.req.param("id"), await body(c))));

import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env, features } from "../env";
import { json } from "../lib/http";
import { GRANT_COOKIE, checkCode, clientIp, hasAccess, issueGrant, listInvites, mintInvites, readGrant, redeemForUser, requireAdminToken, revokeInvite } from "../services/invites";
import { resolveAuth } from "./auth";

export const inviteRoutes = new Hono();
const ip = (c: { req: { header: (n: string) => string | undefined } }) => clientIp((n) => c.req.header(n));

/** Where the caller stands: is the gate on, do they hold a grant cookie, does their account have access. */
inviteRoutes.get("/invites/status", async (c) => {
  const a = await resolveAuth(c).catch(() => undefined);
  const pending = Boolean(readGrant(getCookie(c, GRANT_COOKIE)));
  return json(c, { gate: features.inviteGate, pending, access: a ? await hasAccess(a.userId) : null });
});

/**
 * Redeems a code. Signed in: the code is bound to the account at once. Signed out: the code is checked and a
 * signed grant cookie is set; the account gets access on its first authenticated request after sign-in.
 */
inviteRoutes.post("/invites/redeem", async (c) => {
  const b = z.object({ code: z.string().min(1).max(64) }).parse(await c.req.json());
  const a = await resolveAuth(c).catch(() => undefined);
  if (a) {
    await redeemForUser(a.userId, b.code, ip(c));
    deleteCookie(c, GRANT_COOKIE, { path: "/" });
    return json(c, { ok: true, bound: true });
  }
  const inv = await checkCode(b.code, ip(c));
  const grant = issueGrant(inv.id);
  setCookie(c, GRANT_COOKIE, grant.token, { httpOnly: true, sameSite: "Lax", path: "/", secure: env.NODE_ENV === "production", expires: grant.expires });
  return json(c, { ok: true, bound: false });
});

/* ---------- admin: mint, list, revoke. Bearer ADMIN_TOKEN. Codes are returned once and never stored. ---------- */
inviteRoutes.use("/admin/*", async (c, next) => {
  requireAdminToken(c.req.header("authorization"), ip(c));
  await next();
});
inviteRoutes.post("/admin/invites", async (c) => {
  const b = z.object({ count: z.number().int().min(1).max(500).default(1), label: z.string().max(80).optional(), maxUses: z.number().int().min(1).max(10_000).optional(), expiresInDays: z.number().int().min(1).max(3650).optional() }).parse(await c.req.json().catch(() => ({})));
  const codes = await mintInvites(b);
  return json(c, { codes, count: codes.length, label: b.label ?? null, maxUses: b.maxUses ?? 1, expiresInDays: b.expiresInDays ?? null });
});
inviteRoutes.get("/admin/invites", async (c) => json(c, { gate: features.inviteGate, invites: await listInvites() }));
inviteRoutes.post("/admin/invites/revoke", async (c) => {
  const b = z.object({ invite: z.string().min(1).max(64) }).parse(await c.req.json());
  return json(c, { ok: await revokeInvite(b.invite) });
});

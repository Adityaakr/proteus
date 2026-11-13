/**
 * What a buyer connects to a scheduling service it bought (Lumen Voice's callback booking, after-hours answering
 * and receptionist, or any product that lists the "google-calendar" integration):
 *  - its Google Calendar, through Google OAuth: the agent reads free/busy and creates events on the buyer's own
 *    calendar, never anyone else's;
 *  - a business profile (name, timezone, hours, services, prices, emergency contact) the agent answers from.
 * Tokens and the profile are sealed with the seller's vault key and never returned. The OAuth state is an HMAC over
 * the deal id and an expiry, so a callback can only attach a calendar to the deal that started it.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import { env, features } from "../env";
import { HttpError } from "../lib/http";
import { id } from "../lib/ids";
import { openJsonOr, sealJson } from "../lib/vault";

export const SCHEDULING_PRODUCTS = new Set(["callback-booking", "after-hours-answering", "ai-receptionist"]);
export const isScheduling = (lp: { product: { slug: string; integrations?: string[] } }) =>
  SCHEDULING_PRODUCTS.has(lp.product.slug) || (lp.product.integrations ?? []).includes("google-calendar");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "https://www.googleapis.com/auth/calendar.freebusy"];
const STATE_TTL_MS = 10 * 60_000;
const redirectUri = () => `${env.WEB_ORIGIN.replace(/\/$/, "")}/api/integrations/google/callback`;

export interface BusinessProfile {
  businessName?: string;
  /** IANA timezone, e.g. America/Los_Angeles. */
  timezone?: string;
  hours?: string;
  services?: string;
  prices?: string;
  emergencyContact?: string;
  /** Default appointment length in minutes. */
  slotMinutes?: number;
  notes?: string;
}
interface GoogleTokens { refreshToken: string; accessToken?: string; expiresAt?: number; email?: string }

/* ---------------------------------------------------------------- storage */

async function connection(dealId: string, kind: "google_calendar" | "business_profile") {
  const [row] = await db.select().from(schema.serviceConnections).where(and(eq(schema.serviceConnections.dealId, dealId), eq(schema.serviceConnections.kind, kind)));
  return row ?? null;
}

async function save(dealId: string, orgId: string, kind: "google_calendar" | "business_profile", data: unknown, label: string | null) {
  const sealed = await sealJson(orgId, data);
  await db
    .insert(schema.serviceConnections)
    .values({ id: id("sc"), dealId, orgId, kind, data: sealed, label })
    .onConflictDoUpdate({ target: [schema.serviceConnections.dealId, schema.serviceConnections.kind], set: { data: sealed, label, updatedAt: new Date() } });
}

/* ---------------------------------------------------------------- business profile */

const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);

export function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export async function setProfile(dealId: string, orgId: string, body: Record<string, unknown>): Promise<BusinessProfile> {
  const timezone = clip(body.timezone, 64);
  if (timezone && !validTimezone(timezone)) throw new HttpError(400, `Unknown timezone "${timezone}". Use an IANA name such as America/New_York.`);
  const slot = Number(body.slotMinutes);
  const profile: BusinessProfile = {
    businessName: clip(body.businessName, 120),
    timezone,
    hours: clip(body.hours, 1000),
    services: clip(body.services, 2000),
    prices: clip(body.prices, 2000),
    emergencyContact: clip(body.emergencyContact, 200),
    slotMinutes: Number.isFinite(slot) && slot >= 10 && slot <= 240 ? Math.round(slot) : undefined,
    notes: clip(body.notes, 2000),
  };
  await save(dealId, orgId, "business_profile", profile, profile.businessName ?? null);
  return profile;
}

export async function getProfile(dealId: string, orgId: string): Promise<BusinessProfile | null> {
  const row = await connection(dealId, "business_profile");
  return row ? openJsonOr<BusinessProfile | null>(orgId, row.data, null) : null;
}

/* ---------------------------------------------------------------- Google OAuth */

function sign(payload: string) {
  return createHmac("sha256", env.SESSION_SECRET).update(`google-calendar:${payload}`).digest("base64url");
}

export function googleAuthUrl(dealId: string): string {
  if (!features.googleCalendar) throw new HttpError(503, "Google Calendar is not configured on this server.");
  const payload = `${dealId}.${Date.now() + STATE_TTL_MS}`;
  const state = `${payload}.${sign(payload)}`;
  const q = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri(), response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

function dealFromState(state: string): string {
  const i = state.lastIndexOf(".");
  const payload = state.slice(0, i);
  const mac = state.slice(i + 1);
  const expected = sign(payload);
  if (!mac || mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw new HttpError(400, "invalid state");
  const j = payload.lastIndexOf(".");
  if (Number(payload.slice(j + 1)) < Date.now()) throw new HttpError(400, "This connect link expired. Start again from the deal page.");
  return payload.slice(0, j);
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, ...params }), signal: AbortSignal.timeout(15_000) });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) throw new HttpError(502, `Google did not issue a token (${data.error ?? res.status}).`);
  return data;
}

/** OAuth callback: exchanges the code and stores the tokens for the deal in the signed state. Returns the deal id. */
export async function completeGoogle(code: string, state: string): Promise<string> {
  if (!features.googleCalendar) throw new HttpError(503, "Google Calendar is not configured on this server.");
  const dealId = dealFromState(state);
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, dealId));
  if (!deal) throw new HttpError(404, "deal not found");
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });
  if (!t.refresh_token) throw new HttpError(502, "Google did not return a refresh token. Remove Proteus from your Google account's third-party access and connect again.");
  const tokens: GoogleTokens = { refreshToken: t.refresh_token, accessToken: t.access_token, expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000 };
  const cal = await googleFetch<{ id?: string; timeZone?: string }>(tokens, "GET", "/calendars/primary");
  tokens.email = cal.id;
  await save(dealId, deal.orgId, "google_calendar", tokens, cal.id ?? null);
  return dealId;
}

export async function disconnectGoogle(dealId: string, orgId: string) {
  const row = await connection(dealId, "google_calendar");
  if (!row) return;
  const tokens = await openJsonOr<GoogleTokens | null>(orgId, row.data, null);
  if (tokens?.refreshToken) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refreshToken)}`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(() => {});
  await db.delete(schema.serviceConnections).where(eq(schema.serviceConnections.id, row.id));
}

async function freshAccess(tokens: GoogleTokens) {
  if (tokens.accessToken && (tokens.expiresAt ?? 0) > Date.now() + 60_000) return tokens.accessToken;
  const t = await tokenRequest({ refresh_token: tokens.refreshToken, grant_type: "refresh_token" });
  tokens.accessToken = t.access_token;
  tokens.expiresAt = Date.now() + (t.expires_in ?? 3600) * 1000;
  return tokens.accessToken!;
}

async function googleFetch<T>(tokens: GoogleTokens, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: { authorization: `Bearer ${await freshAccess(tokens)}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(`Google Calendar ${res.status}: ${(data as { error?: { message?: string } }).error?.message ?? "error"}`);
  return data;
}

/* ---------------------------------------------------------------- calendar the agent uses */

export interface Busy { start: string; end: string }
export interface BookedEvent { id: string; link: string; start: string; end: string }

export interface DealCalendar {
  email: string | null;
  busy(startIso: string, endIso: string): Promise<Busy[]>;
  book(e: { start: string; end: string; title: string; description: string; timezone?: string }): Promise<BookedEvent>;
}

const overlaps = (a: Busy, s: number, e: number) => Date.parse(a.start) < e && Date.parse(a.end) > s;

/** The buyer's connected calendar for this deal, or null. Bookings are re-checked against free/busy first. */
export async function calendarFor(dealId: string, orgId: string): Promise<DealCalendar | null> {
  if (!features.googleCalendar) return null;
  const row = await connection(dealId, "google_calendar");
  if (!row) return null;
  const tokens = await openJsonOr<GoogleTokens | null>(orgId, row.data, null);
  if (!tokens?.refreshToken) return null;
  const busy = async (startIso: string, endIso: string) => {
    const r = await googleFetch<{ calendars?: Record<string, { busy?: Busy[] }> }>(tokens, "POST", "/freeBusy", { timeMin: new Date(startIso).toISOString(), timeMax: new Date(endIso).toISOString(), items: [{ id: "primary" }] });
    return r.calendars?.primary?.busy ?? [];
  };
  return {
    email: tokens.email ?? null,
    busy,
    async book(e) {
      const s = Date.parse(e.start);
      const en = Date.parse(e.end);
      if (!Number.isFinite(s) || !Number.isFinite(en) || en <= s) throw new Error("The start and end times are not valid.");
      if (s < Date.now() - 5 * 60_000) throw new Error("That time is in the past.");
      if (en - s > 4 * 3600_000) throw new Error("Appointments are limited to 4 hours.");
      const clash = (await busy(new Date(s).toISOString(), new Date(en).toISOString())).some((b) => overlaps(b, s, en));
      if (clash) throw new Error("That slot is already busy on the calendar. Pick another free slot.");
      const ev = await googleFetch<{ id: string; htmlLink: string; start?: { dateTime?: string }; end?: { dateTime?: string } }>(tokens, "POST", "/calendars/primary/events", {
        summary: e.title.slice(0, 200),
        description: `${e.description.slice(0, 4000)}\n\nBooked by the Proteus AI agent.`,
        start: { dateTime: new Date(s).toISOString(), ...(e.timezone ? { timeZone: e.timezone } : {}) },
        end: { dateTime: new Date(en).toISOString(), ...(e.timezone ? { timeZone: e.timezone } : {}) },
      });
      return { id: ev.id, link: ev.htmlLink, start: ev.start?.dateTime ?? e.start, end: ev.end?.dateTime ?? e.end };
    },
  };
}

/** What the deal page shows. Never includes tokens. */
export async function connectionsView(dealId: string) {
  const [cal, prof] = await Promise.all([connection(dealId, "google_calendar"), connection(dealId, "business_profile")]);
  return {
    googleCalendar: { available: features.googleCalendar, connected: Boolean(cal), account: cal?.label ?? null, connectedAt: cal?.updatedAt ?? null },
    profileSaved: Boolean(prof),
  };
}

/**
 * What a scheduling service actually does on this deployment, stated plainly for its reference page and skill.md, so
 * product copy written for a phone and calendar product never promises more than the code delivers.
 */
export function howItWorksToday(): string[] {
  return [
    "Your customers reach it by chat or by voice in the browser, on a customer link you share or embed on your website, or through this API from your own app. There is no phone number yet: it does not answer phone calls.",
    "It asks for what it needs (name, phone, the time and the service) one question at a time, then books or takes the message. It answers from the business profile you set: hours, services, prices.",
    features.googleCalendar
      ? "With your Google Calendar connected it checks when you are free and puts the appointment on your calendar; without it, it records a booking request for you to confirm."
      : "It records each booking as a request for you to confirm; booking straight into Google Calendar is built but not switched on for this deployment yet.",
    "Every request lands in your inbox with the full note, and you can get each one by webhook, Telegram or email. One finished request is one billable unit; follow-up questions and requests it could not complete are never billed.",
  ];
}

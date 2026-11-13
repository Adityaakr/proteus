import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX } from "lucide-react";
import { api, errorMessage, type BusinessProfile } from "../lib/api";
import { ActionButton } from "../ui/ActionButton";
import { Field } from "../ui/Field";
import { Notice } from "../ui/misc";
import f from "./fund.module.css";

/** Scheduling services read this: the business's own facts and, when connected, its Google Calendar. */
export function BusinessSetup({ productSlug, apiKey, dealId }: { productSlug: string; apiKey: string; dealId: string }) {
  const qc = useQueryClient();
  const key = ["service-connections", dealId] as const;
  const q = useQuery({ queryKey: key, queryFn: () => api.serviceConnections(productSlug, apiKey) });
  const browserTz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  })();
  const [p, setP] = useState<BusinessProfile>({ timezone: browserTz, slotMinutes: 30 });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (q.data?.profile) setP({ ...q.data.profile, timezone: q.data.profile.timezone || browserTz });
  }, [q.data?.profile, browserTz]);

  // Coming back from Google: ?calendar=connected|denied|failed
  const [returned, setReturned] = useState<string | null>(null);
  useEffect(() => {
    const u = new URL(window.location.href);
    const c = u.searchParams.get("calendar");
    if (c) {
      setReturned(c);
      u.searchParams.delete("calendar");
      window.history.replaceState(null, "", u.toString());
    }
  }, []);

  const save = useMutation({
    mutationFn: () => api.saveBusinessProfile(productSlug, apiKey, p),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: key });
    },
  });
  const connect = useMutation({
    mutationFn: () => api.connectGoogleCalendar(productSlug, apiKey),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
  });
  const disconnect = useMutation({
    mutationFn: () => api.disconnectGoogleCalendar(productSlug, apiKey),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const set = (k: keyof BusinessProfile, v: string) => {
    setSaved(false);
    setP((x) => ({ ...x, [k]: k === "slotMinutes" ? (v === "" ? undefined : Number(v)) : v }));
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  const cal = q.data?.googleCalendar;

  return (
    <section className={f.section} aria-labelledby="h-business">
      <div className={f.sectionHead}>
        <h2 id="h-business" className={f.h2}>Your business</h2>
        <span className={f.h2Sub}>The agent answers callers from these facts and books into your own calendar. Stored encrypted for this deal only.</span>
      </div>

      {returned === "connected" && <Notice tone="success">Google Calendar connected. New bookings go straight onto it.</Notice>}
      {returned === "denied" && <Notice tone="warn">Google access was not granted, so nothing was connected.</Notice>}
      {returned === "failed" && <Notice tone="danger">Connecting Google Calendar failed. Try again; if it keeps failing, remove Proteus from your Google account's third-party access first.</Notice>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className={f.label}>Calendar</span>
        {q.isLoading ? (
          <p className={f.fine}>Checking…</p>
        ) : !cal?.available ? (
          <p className={f.fine}>Calendar connection is not switched on for this deployment yet. Until it is, the agent records each booking request and tells the caller you will confirm.</p>
        ) : cal.connected ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span className={`${f.badge} ${f.badgeOk}`}><CalendarCheck size={12} aria-hidden /> Connected{cal.account ? `: ${cal.account}` : ""}</span>
            <button type="button" className={f.textBtn} onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
              <CalendarX size={12} aria-hidden /> Disconnect
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p className={f.fine}>Connect Google Calendar so the agent checks when you are free and books real appointments. It only reads busy times and adds events; it never reads event details or deletes anything.</p>
            <div><ActionButton size="sm" variant="secondary" loading={connect.isPending} loadingLabel="Opening Google" onClick={() => connect.mutate()}>Connect Google Calendar</ActionButton></div>
          </div>
        )}
        {(connect.error || disconnect.error) && <Notice tone="danger">{errorMessage(connect.error ?? disconnect.error)}</Notice>}
      </div>

      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        <span className={f.label}>Business profile</span>
        <Field label="Business name" placeholder="Bay Area Plumbing" value={p.businessName ?? ""} onChange={(e) => set("businessName", e.target.value)} maxLength={120} />
        <Field label="Timezone" hint="IANA name, detected from this browser." placeholder="America/Los_Angeles" value={p.timezone ?? ""} onChange={(e) => set("timezone", e.target.value)} maxLength={64} />
        <Field multiline rows={2} label="Opening hours" placeholder="Mon to Fri 8:00 to 18:00, Sat 9:00 to 13:00, closed Sunday" value={p.hours ?? ""} onChange={(e) => set("hours", e.target.value)} maxLength={1000} />
        <Field multiline rows={2} label="Services" placeholder="Boiler service, leak repair, drain cleaning, new installs" value={p.services ?? ""} onChange={(e) => set("services", e.target.value)} maxLength={2000} />
        <Field multiline rows={2} label="Prices the agent may quote" placeholder="Call-out $89, boiler service $149, hourly $95" value={p.prices ?? ""} onChange={(e) => set("prices", e.target.value)} maxLength={2000} />
        <Field label="Emergency line" placeholder="+1 415 555 0199" value={p.emergencyContact ?? ""} onChange={(e) => set("emergencyContact", e.target.value)} maxLength={200} />
        <Field label="Appointment length (minutes)" inputMode="numeric" placeholder="30" value={p.slotMinutes === undefined ? "" : String(p.slotMinutes)} onChange={(e) => set("slotMinutes", e.target.value.replace(/\D/g, ""))} maxLength={3} />
        <Field multiline rows={2} label="Anything else the agent should know" placeholder="We cover San Francisco and Oakland only. Ask for the boiler model." value={p.notes ?? ""} onChange={(e) => set("notes", e.target.value)} maxLength={2000} />
        {save.error && <Notice tone="danger">{errorMessage(save.error)}</Notice>}
        {saved && <Notice tone="success">Saved. The next request uses it.</Notice>}
        <div className={f.actions}>
          <ActionButton type="submit" size="sm" loading={save.isPending} loadingLabel="Saving">Save business profile</ActionButton>
        </div>
      </form>
    </section>
  );
}

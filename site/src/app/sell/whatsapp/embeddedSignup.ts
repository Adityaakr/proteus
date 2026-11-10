/**
 * Meta's WhatsApp Embedded Signup in the browser (version v5; see
 * developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation).
 * The Facebook SDK loads only when the seller clicks Connect. Meta's popup returns a one-time code (valid about
 * 30 seconds) through FB.login and the account ids through a window message; both go straight to our server.
 */

type FB = {
  init(o: { appId: string; autoLogAppEvents: boolean; xfbml: boolean; version: string }): void;
  login(cb: (r: { authResponse?: { code?: string } | null; status?: string }) => void, o: Record<string, unknown>): void;
};
declare global {
  interface Window {
    FB?: FB;
    fbAsyncInit?: () => void;
  }
}

const GRAPH_VERSION = "v27.0";
let sdk: Promise<FB> | null = null;

function loadSdk(appId: string): Promise<FB> {
  if (sdk) return sdk;
  sdk = new Promise<FB>((resolve, reject) => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: true, version: GRAPH_VERSION });
      resolve(window.FB!);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/en_US/sdk.js";
    s.async = true;
    s.defer = true;
    s.crossOrigin = "anonymous";
    s.onerror = () => {
      sdk = null;
      reject(new Error("Could not load Meta's sign-in. Check that no blocker is stopping connect.facebook.net."));
    };
    document.body.appendChild(s);
  });
  return sdk;
}

export interface SignupResult {
  code: string;
  event: string;
  wabaId: string;
  phoneNumberId?: string;
}

/** Opens Meta's popup and resolves once both the code and the account ids are in hand. Rejects on cancel or error. */
export async function runEmbeddedSignup(cfg: { appId: string; configId: string }): Promise<SignupResult> {
  const fb = await loadSdk(cfg.appId);
  return new Promise<SignupResult>((resolve, reject) => {
    let session: { event: string; wabaId: string; phoneNumberId?: string } | null = null;
    let code: string | null = null;
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      if (!err && !(code && session)) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      if (err) reject(err);
      else resolve({ code: code!, ...session! });
    };
    const onMessage = (e: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(e.origin).hostname)) return;
      let d: { type?: string; event?: string; data?: { waba_id?: string; phone_number_id?: string; error_message?: string } };
      try {
        d = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
      } catch {
        return;
      }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event === "CANCEL") return finish(new Error("WhatsApp sign-up was closed before it finished."));
      if (d.event === "ERROR") return finish(new Error(d.data?.error_message ? `WhatsApp: ${d.data.error_message}` : "WhatsApp sign-up reported an error."));
      if (d.event?.startsWith("FINISH") && d.data?.waba_id) {
        session = { event: d.event, wabaId: d.data.waba_id, phoneNumberId: d.data.phone_number_id };
        finish();
      }
    };
    window.addEventListener("message", onMessage);
    fb.login(
      (r) => {
        if (!r.authResponse?.code) return finish(new Error("WhatsApp sign-up was not completed."));
        code = r.authResponse.code;
        finish();
        // The ids message normally arrives first; if it has not after a few seconds, the flow did not finish.
        setTimeout(() => finish(new Error("WhatsApp did not report which account was connected. Please try again.")), 5000);
      },
      { config_id: cfg.configId, response_type: "code", override_default_response_type: true, extras: { version: "v5" } },
    );
  });
}

/** A random 6-digit PIN for registering a new number (WhatsApp two-step verification). */
export function randomPin(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return String(100000 + (a[0]! % 900000));
}

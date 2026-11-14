// Padel: sender notifikationer. Kaldes kun af databasen (pg_net) med en hemmelig nøgle.
// Web push (browser/hjemmeskærm), Android-appen via Firebase (FCM) og iPhone-appen via Apple (APNs).
// Første gang laves web push-nøglerne her og gemmes i Supabase Vault (den private nøgle forlader aldrig Supabase).
// Hemmeligheder (Edge Function secrets): FCM_SERVICE_ACCOUNT (JSON), APNS_KEY (.p8), APNS_KEY_ID, APNS_TEAM_ID.
import webpush from "npm:web-push@3.6.7";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const BUNDLE = "dk.padelklubben.app";
let cfg: { public: string; private: string; hook: string } | null = null;

async function config() {
  if (cfg) return cfg;
  let { data, error } = await sb.rpc("padel_push_config");
  if (error) throw new Error("config: " + error.message);
  if (!data?.public || !data?.private) {
    const keys = webpush.generateVAPIDKeys();
    const r = await sb.rpc("padel_push_store_keys", { p_public: keys.publicKey, p_private: keys.privateKey });
    if (r.error) throw new Error("keys: " + r.error.message);
    ({ data, error } = await sb.rpc("padel_push_config"));
    if (error) throw new Error("config: " + error.message);
  }
  if (!data?.hook) throw new Error("config: mangler hook");
  cfg = data;
  webpush.setVapidDetails("mailto:kontakt@padelklubben.dk", cfg!.public, cfg!.private);
  return cfg!;
}

// ---------- Android (Firebase Cloud Messaging v1) ----------
let fcm: { project: string; token: string; exp: number } | null = null;
async function fcmAuth() {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT");
  if (!raw) return null;
  if (fcm && fcm.exp > Date.now() + 60_000) return fcm;
  const sa = JSON.parse(raw);
  const key = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" }).setIssuer(sa.client_email).setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now).setExpirationTime(now + 3600).sign(key);
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("fcm auth: " + JSON.stringify(j));
  fcm = { project: sa.project_id, token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return fcm;
}
async function sendFcm(token: string, m: Msg): Promise<"ok" | "gone" | "skip"> {
  const a = await fcmAuth();
  if (!a) return "skip";
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project}/messages:send`, {
    method: "POST", headers: { Authorization: `Bearer ${a.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token,
      notification: { title: m.title, body: m.body },
      data: { url: m.url },
      android: { priority: "high", ttl: "86400s", notification: { icon: "ic_stat_notify", color: "#5b3ee6", tag: m.tag, channel_id: "padel" } },
    } }),
  });
  if (r.ok) return "ok";
  const t = await r.text();
  if (r.status === 404 || t.includes("UNREGISTERED") || t.includes("INVALID_ARGUMENT")) return "gone";
  throw new Error(`fcm ${r.status}: ${t.slice(0, 300)}`);
}

// ---------- iPhone (Apple Push Notification service) ----------
let apns: { jwt: string; at: number } | null = null;
async function apnsJwt() {
  const p8 = Deno.env.get("APNS_KEY"), kid = Deno.env.get("APNS_KEY_ID"), team = Deno.env.get("APNS_TEAM_ID");
  if (!p8 || !kid || !team) return null;
  if (apns && Date.now() - apns.at < 40 * 60_000) return apns.jwt;
  const key = await importPKCS8(p8.replace(/\\n/g, "\n"), "ES256");
  const jwt = await new SignJWT({}).setProtectedHeader({ alg: "ES256", kid }).setIssuer(team).setIssuedAt().sign(key);
  apns = { jwt, at: Date.now() };
  return jwt;
}
async function sendApns(token: string, m: Msg): Promise<"ok" | "gone" | "skip"> {
  const jwt = await apnsJwt();
  if (!jwt) return "skip";
  const host = Deno.env.get("APNS_SANDBOX") === "1" ? "api.sandbox.push.apple.com" : "api.push.apple.com";
  const r = await fetch(`https://${host}/3/device/${token}`, {
    method: "POST",
    headers: { authorization: `bearer ${jwt}`, "apns-topic": BUNDLE, "apns-push-type": "alert", "apns-priority": "10", "apns-expiration": String(Math.floor(Date.now() / 1000) + 86400), ...(m.tag ? { "apns-collapse-id": m.tag.slice(0, 64) } : {}) },
    body: JSON.stringify({ aps: { alert: { title: m.title, body: m.body }, sound: "default" }, url: m.url }),
  });
  if (r.ok) return "ok";
  const t = await r.text();
  if (r.status === 410 || t.includes("BadDeviceToken") || t.includes("Unregistered")) return "gone";
  throw new Error(`apns ${r.status}: ${t.slice(0, 300)}`);
}

type Msg = { title: string; body: string; url: string; tag?: string };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let c;
  try { c = await config(); } catch (e) { console.error(e); return new Response("config", { status: 500 }); }
  const body = await req.json().catch(() => null);
  if (req.headers.get("x-hook-secret") !== c.hook) return new Response("Forbidden", { status: 403 });
  if (body?.init) return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
  if (!body || !Array.isArray(body.users) || !body.users.length) return new Response("Bad request", { status: 400 });
  const { data: all, error } = await sb.from("padel_push_subs").select("endpoint,p256dh,auth,user_id,mobile").eq("enabled", true).in("user_id", body.users.slice(0, 200));
  if (error) { console.error(error); return new Response("db", { status: 500 }); }
  // Ingen dobbelte: har en spiller appen (Android/iPhone), springes notifikationer i telefonens browser over. Computerens browser får stadig besked.
  const hasApp = new Set((all ?? []).filter((s) => /^(fcm|apns):/.test(s.endpoint)).map((s) => s.user_id));
  const subs = (all ?? []).filter((s) => /^(fcm|apns):/.test(s.endpoint) || !(hasApp.has(s.user_id) && s.mobile === true));
  const m: Msg = { title: String(body.title ?? "Padelklubben").slice(0, 120), body: String(body.body ?? "").slice(0, 240), url: String(body.url ?? "/"), tag: body.tag ? String(body.tag) : undefined };
  const payload = JSON.stringify(m);
  let sent = 0, skipped = 0; const gone: string[] = [];
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      let res: "ok" | "gone" | "skip";
      if (s.endpoint.startsWith("fcm:")) res = await sendFcm(s.endpoint.slice(4), m);
      else if (s.endpoint.startsWith("apns:")) res = await sendApns(s.endpoint.slice(5), m);
      else {
        try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 24, urgency: "high" }); res = "ok"; }
        catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) res = "gone"; else throw e; }
      }
      if (res === "ok") sent++; else if (res === "gone") gone.push(s.endpoint); else skipped++;
    } catch (e) { console.error("push fejl", s.endpoint.slice(0, 12), (e as Error).message); }
  }));
  if (gone.length) await sb.from("padel_push_subs").update({ enabled: false }).in("endpoint", gone);
  return new Response(JSON.stringify({ sent, skipped, disabled: gone.length }), { headers: { "Content-Type": "application/json" } });
});

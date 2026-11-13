// Padel: sender et nyhedsbrev fra en gruppe eller klub i et pænt design. Kaldes kun af databasen (padel_newsletter_send_v2) med den hemmelige nøgle.
// Krop: { group, color, reply_to, test, title, intro, sections: [{ heading, text, button_text, button_url }], by, recipients: [{ to, unsub }] }
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const APP = "https://padelklubben.dk";
let hook: string | null = null;
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const okMail = (x: unknown) => typeof x === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mask = (m: string) => m.replace(/^(.{2}).*@/, "$1***@");
const okUrl = (u: unknown) => typeof u === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(u.trim());
const hex = (c: unknown) => (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? c : "#5b3ee6");
// Lys eller mørk tekst på farven
const ink = (c: string) => { const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#14112b" : "#ffffff"; };
// Tekst: afsnit ved tomme linjer, linjeskift bevares, links bliver klikbare, linjer med "- " bliver en punktliste
const link = (h: string, color: string) => h.replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${color};font-weight:bold">$1</a>`);
const BUL = /^\s*[-•*]\s+/;
const para = (t: unknown, color: string) => String(t ?? "").trim().split(/\n\s*\n/).filter(Boolean).map((blk) => {
  const out: string[] = []; let txt: string[] = [], li: string[] = [];
  const flushT = () => { if (txt.length) out.push(`<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#2b2a3d">${link(txt.map(esc).join("<br>"), color)}</p>`); txt = []; };
  const flushL = () => { if (li.length) out.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 14px">${li.map((x) => `<tr><td valign="top" style="padding:0 10px 6px 2px;color:${color};font-size:16px;line-height:1.6">●</td><td style="padding:0 0 6px;font-size:16px;line-height:1.6;color:#2b2a3d">${link(esc(x), color)}</td></tr>`).join("")}</table>`); li = []; };
  for (const ln of blk.split("\n")) { if (BUL.test(ln)) { flushT(); li.push(ln.replace(BUL, "")); } else { flushL(); txt.push(ln); } }
  flushT(); flushL();
  return out.join("");
}).join("");

type Sec = { heading?: string; text?: string; button_text?: string; button_url?: string };
function render(b: Record<string, unknown>, unsub: string | null) {
  const color = hex(b.color), on = ink(color);
  const date = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Copenhagen" }).format(new Date());
  const secs = (Array.isArray(b.sections) ? b.sections : []).slice(0, 12) as Sec[];
  const btn = (txt: string, url: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px"><tr><td style="background:${color};border-radius:12px">
    <a href="${esc(url)}" style="display:inline-block;padding:13px 22px;color:${on};font-weight:bold;font-size:15px;text-decoration:none;font-family:Arial,sans-serif">${esc(txt)} →</a></td></tr></table>`;
  const sections = secs.map((s, i) => `<tr><td style="padding:${i ? "8px" : "4px"} 32px 18px">
      ${s.heading ? `<h2 style="margin:0 0 10px;font-size:20px;line-height:1.3;color:#14112b;font-family:Arial,sans-serif"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};margin:0 10px 3px 0"></span>${esc(s.heading)}</h2>` : ""}
      ${para(s.text, color)}
      ${s.button_text && okUrl(s.button_url) ? btn(s.button_text, s.button_url!.trim()) : ""}
    </td></tr>${i < secs.length - 1 ? `<tr><td style="padding:0 32px"><div style="height:1px;background:#ecebf5"></div></td></tr>` : ""}`).join("");
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(b.title)}</title></head>
<body style="margin:0;padding:0;background:#f1f0f8">
<div style="display:none;max-height:0;overflow:hidden">${esc(String(b.intro || "").slice(0, 120))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f0f8;padding:24px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <tr><td style="background:${color};padding:28px 32px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:12px;letter-spacing:2px;text-transform:uppercase;font-weight:bold;color:${on};opacity:.85">${esc(b.group)}</td>
      <td align="right"><img src="${APP}/icon-192.png" width="40" height="40" alt="" style="border-radius:10px;display:block"></td></tr></table>
    <h1 style="margin:18px 0 6px;font-size:30px;line-height:1.15;color:${on};font-family:Arial,sans-serif">${esc(b.title)}</h1>
    <div style="font-size:14px;color:${on};opacity:.8">Nyhedsbrev · ${esc(date)}</div>
  </td></tr>
  ${b.intro ? `<tr><td style="padding:28px 32px 8px">${para(b.intro, color).replace(/font-size:16px/g, "font-size:17px")}</td></tr>` : `<tr><td style="height:20px"></td></tr>`}
  ${sections}
  <tr><td style="padding:10px 32px 30px">${btn("Åbn Padelklubben", APP)}</td></tr>
  <tr><td style="background:#f7f6fc;padding:20px 32px;font-size:12px;line-height:1.6;color:#6b6985">
    ${b.by ? `Skrevet af ${esc(b.by)} · ` : ""}${esc(b.group)} via <a href="${APP}" style="color:#6b6985">Padelklubben</a>.<br>
    ${unsub ? `Vil du ikke have nyhedsbreve fra ${esc(b.group)}? <a href="${esc(APP + unsub)}" style="color:#6b6985">Afmeld her</a>.` : "Dette er en testmail, kun sendt til dig."}
  </td></tr>
</table></td></tr></table></body></html>`;
}
const plain = (b: Record<string, unknown>, unsub: string | null) => [String(b.title), "", String(b.intro || ""), ...((b.sections as Sec[]) || []).flatMap((s) => ["", s.heading || "", s.text || "", s.button_text && okUrl(s.button_url) ? `${s.button_text}: ${s.button_url}` : ""]),
  "", `Åbn Padelklubben: ${APP}`, unsub ? `Afmeld: ${APP}${unsub}` : ""].filter((x, i, a) => x !== "" || a[i - 1] !== "").join("\n");

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!hook) { const { data, error } = await sb.rpc("padel_push_config"); if (error || !data?.hook) return json({ error: "config" }, 500); hook = data.hook; }
    if (req.headers.get("x-hook-secret") !== hook) return new Response("Forbidden", { status: 403 });
    const user = Deno.env.get("GMAIL_USER")?.trim(), pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
    if (!user || !pass) return json({ sent: 0, reason: "mail er ikke sat op" }, 503);
    const b = await req.json().catch(() => null);
    if (!b || !Array.isArray(b.recipients)) return json({ error: "bad request" }, 400);
    const from = String(b.group || "Padelklubben").replace(/["<>\r\n]/g, "").slice(0, 80);
    const replyTo = okMail(b.reply_to) ? b.reply_to : undefined;
    const subject = (b.test ? "[TEST] " : "") + String(b.title || "Nyhedsbrev").replace(/[\r\n]+/g, " ").slice(0, 150);
    const list = b.recipients.filter((r: { to?: unknown }) => okMail(r?.to)).slice(0, 150);
    const tr = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, pool: true, maxConnections: 1, auth: { user, pass } });
    let sent = 0; const failed: string[] = [];
    for (const r of list) {
      const unsub = typeof r.unsub === "string" && r.unsub.startsWith("/afmeld?t=") ? r.unsub : null;
      const headers: Record<string, string> = unsub ? { "List-Unsubscribe": `<${APP}${unsub}>` } : {};
      let ok = false;
      for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
        try { await tr.sendMail({ from: { name: from, address: user }, to: r.to, replyTo, subject, text: plain(b, unsub), html: render(b, unsub), headers }); ok = true; sent++; }
        catch (e) { const msg = (e as Error).message; console.error("nyhedsbrev fejl", mask(r.to), attempt, msg.slice(0, 120)); if (!/^4|\b4\d\d\b|ETIMEDOUT|ECONNRESET/.test(msg)) break; await sleep(1500 * attempt); }
      }
      if (!ok) failed.push(mask(r.to));
      await sleep(400);
    }
    tr.close();
    console.log("nyhedsbrev sendt", sent, "fejlede", failed.length);
    return json({ sent, failed });
  } catch (e) { console.error("padel-newsletter", (e as Error).message); return json({ error: (e as Error).message.slice(0, 300) }, 500); }
});

// Padel: sender mails (træningspåmindelser, påmindelser om spilledage, invitationer).
// Afsender: Er RESEND_API_KEY og MAIL_FROM sat (fx noreply@padelklubben.dk), sendes via Resend fra vores eget domæne
// (SPF/DKIM, så mailene ikke havner i spam). Ellers via appens Gmail (GMAIL_USER + GMAIL_APP_PASSWORD).
// Kaldes kun af databasen (pg_net) med den hemmelige nøgle. Afsendernavn = gruppens navn, svar går til gruppens egen mail.
// To former: { to: [...], subject, text } (samme tekst til alle) eller { messages: [{ to, subject, text }] } (personlige tekster).
import nodemailer from "npm:nodemailer@6.9.16";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const APP = "https://padelklubben.dk";
let hook: string | null = null;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\r\n]+/g, " ").slice(0, n);
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "Content-Type": "application/json" } });
const okMail = (x: unknown) => typeof x === "string" && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const mask = (m: string) => m.replace(/^(.{2}).*@/, "$1***@");

type Mail = { fromName: string; to: string; replyTo?: string; subject: string; text: string; html: string; headers?: Record<string, string> };
// Én afsender for alle: Resend (eget domæne) hvis sat op, ellers Gmail
function mailer() {
  const key = Deno.env.get("RESEND_API_KEY")?.trim(), fromAddr = Deno.env.get("MAIL_FROM")?.trim();
  if (key && okMail(fromAddr)) {
    return {
      kind: "resend",
      async send(m: Mail) {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ from: `${m.fromName} <${fromAddr}>`, to: [m.to], reply_to: m.replyTo, subject: m.subject, text: m.text, html: m.html, headers: m.headers }),
        });
        if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 150)}`);
      },
      close() {},
    };
  }
  const user = Deno.env.get("GMAIL_USER")?.trim(), pass = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "");
  if (!user || !pass) return null;
  const tr = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, pool: true, maxConnections: 1, auth: { user, pass } });
  return {
    kind: "gmail",
    async send(m: Mail) { await tr.sendMail({ from: { name: m.fromName, address: user }, to: m.to, replyTo: m.replyTo, subject: m.subject, text: m.text, html: m.html, headers: m.headers }); },
    close() { tr.close(); },
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    if (!hook) {
      const { data, error } = await sb.rpc("padel_push_config");
      if (error || !data?.hook) return json({ error: "config" }, 500);
      hook = data.hook;
    }
    if (req.headers.get("x-hook-secret") !== hook) return new Response("Forbidden", { status: 403 });
    const mx = mailer();
    if (!mx) return json({ sent: 0, reason: "mail er ikke sat op" }, 503);
    const b = await req.json().catch(() => null);
    if (!b) return json({ error: "bad request" }, 400);
    const from = clean(b.from_name || "Padelklubben", 80).replace(/["<>]/g, "");
    const link = APP + (String(b.url || "/").startsWith("/") ? String(b.url || "/") : "/");
    const replyTo = okMail(b.reply_to) ? b.reply_to : undefined;
    const foot = clean(b.foot || "Du får denne mail, fordi der endnu ikke er svaret på træningen. Svar Kommer eller Afbud i appen, så ved træneren, hvem der kommer.", 400);
    const cta = clean(b.cta || "Åbn appen og svar", 40);
    let msgs: { to: string; subject: string; text: string }[] = [];
    if (Array.isArray(b.messages)) msgs = b.messages.filter((m: { to?: unknown }) => okMail(m?.to)).slice(0, 200).map((m: { to: string; subject?: string; text?: string }) => ({ to: m.to, subject: clean(m.subject || "Padel", 150), text: clean(m.text, 1200) }));
    else if (Array.isArray(b.to)) msgs = b.to.filter(okMail).slice(0, 200).map((t: string) => ({ to: t, subject: clean(b.subject || "Padel", 150), text: clean(b.text, 1200) }));
    if (!msgs.length) return json({ error: "ingen modtagere" }, 400);
    const html = (subject: string, text: string) => `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f4f6f9">
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px 20px;color:#0c1b2a;background:#ffffff">
      <p style="font-size:13px;color:#5a6f86;margin:0 0 8px">${esc(from)}</p>
      <h2 style="font-size:20px;margin:0 0 10px">${esc(subject)}</h2>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px">${esc(text)}</p>
      <p><a href="${esc(link)}" style="background:#16a34a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">${esc(cta)}</a></p>
      <p style="font-size:12px;color:#5a6f86;margin-top:28px">${esc(foot)}<br>Sendt fra Padelklubben · <a href="${APP}" style="color:#5a6f86">padelklubben.dk</a></p></div></body></html>`;
    let sent = 0; const failed: string[] = [];
    for (const m of msgs) {
      let ok = false;
      for (let attempt = 1; attempt <= 4 && !ok; attempt++) {
        try {
          await mx.send({ fromName: from, to: m.to, replyTo, subject: m.subject, text: `${m.text}\n\n${cta}: ${link}\n\n${foot}`, html: html(m.subject, m.text) });
          ok = true; sent++;
        } catch (e) {
          const msg = (e as Error).message;
          console.error("mail fejl", mx.kind, mask(m.to), "forsøg", attempt, msg.slice(0, 120));
          if (!/^4|\b4\d\d\b|^429|ETIMEDOUT|ECONNRESET/.test(msg)) break;
          await sleep(1500 * attempt);
        }
      }
      if (!ok) failed.push(mask(m.to));
      await sleep(mx.kind === "resend" ? 600 : 400);
    }
    mx.close();
    console.log("mails sendt", sent, "fejlede", failed.length, "via", mx.kind);
    return json({ sent, failed });
  } catch (e) {
    console.error("padel-mail", (e as Error).message);
    return json({ error: (e as Error).message.slice(0, 300) }, 500);
  }
});

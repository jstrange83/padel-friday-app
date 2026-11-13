// Padel: AI-hjælp til nyhedsbreve. Retter stavefejl, foreslår bedre formuleringer og stiller mailen pænt op.
// Kaldes fra appen af superadmin eller en med rettigheden "nyhedsbrev" i en gruppe med den betalte udgave. Krop: { group, title, intro, sections: [{ heading, text, button_text, button_url }] }
// Svar: { title, intro, sections, changes: [tekst] }. Nøglen ANTHROPIC_API_KEY ligger som hemmelighed i Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const PER_DAY = 40;
const str = (x: unknown, n: number) => String(x ?? "").slice(0, n);

const SYSTEM = `Du er redaktør på nyhedsbreve for padelgrupper, padelklubber og padelcentre i Danmark. Du får et udkast til et nyhedsbrev, som en frivillig har skrevet, og skal gøre det klar til at blive sendt på mail.

Gør sådan:
1. Ret alle stave-, komma- og grammatikfejl efter dansk retskrivning.
2. Gør formuleringerne klarere, mere levende og lette at læse, men behold afsenderens stemme, indhold og tone. Det skal lyde som en glad og venlig klub, ikke som reklame eller AI.
3. Stil det pænt op: korte afsnit (en tom linje mellem afsnit), en god overskrift til hvert afsnit, og del gerne en lang tekst op i flere afsnit med hver sin overskrift. Brug punktopstilling (linjer der starter med "- ") til lister som datoer, tider, priser eller ting man skal huske. Et par passende emojis i overskrifterne er fint, men ikke for mange.
4. Hovedoverskriften skal være kort og fange læseren. Indledningen skal være et par venlige sætninger.
5. Er der et link til tilmelding eller lignende, så lav en knap til det i afsnittet (button_text kort, fx "Tilmeld dig", og button_url = linket). Behold eksisterende knapper og links præcis som de er.

Du må ALDRIG finde på nye fakta: ingen nye datoer, tider, priser, navne, steder, links eller løfter, som ikke står i udkastet. Er noget uklart, så lad det stå, og nævn det i changes.
Skriv "bat", aldrig "ketsjer". Brug ikke tankestreger som pynt.
Brug værktøjet nyhedsbrev til at svare. I changes skriver du 2 til 6 korte punkter på dansk om, hvad du har ændret (fx "Rettet 4 stavefejl", "Delt teksten op i 3 afsnit med overskrifter").`;

const TOOL = {
  name: "nyhedsbrev",
  description: "Det færdige nyhedsbrev",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Hovedoverskrift, højst 80 tegn" },
      intro: { type: "string", description: "Indledning" },
      sections: {
        type: "array", maxItems: 12,
        items: { type: "object", properties: { heading: { type: "string" }, text: { type: "string" }, button_text: { type: "string" }, button_url: { type: "string" } }, required: ["heading", "text"] },
      },
      changes: { type: "array", items: { type: "string" }, description: "Hvad der er ændret, 2 til 6 korte punkter" },
    },
    required: ["title", "intro", "sections", "changes"],
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const key = Deno.env.get("ANTHROPIC_API_KEY")?.trim();
    if (!key) return json({ error: "AI er ikke sat op endnu" }, 503);
    const auth = req.headers.get("Authorization") || "";
    const user = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: u } = await user.auth.getUser();
    if (!u?.user) return json({ error: "Du skal være logget ind" }, 401);
    const b = await req.json().catch(() => null);
    if (!b?.group) return json({ error: "Mangler gruppe" }, 400);
    // Superadmin altid; ellers kun grupper med den betalte udgave
    const { data: ok } = await user.rpc("padel_ai_allowed_v2", { g: b.group });
    if (!ok) return json({ error: "AI-hjælpen kræver den betalte udgave" }, 402);
    // Højst PER_DAY forslag pr. person pr. dag
    const { data: used, error: uerr } = await admin.rpc("padel_ai_use_v2", { p_user: u.user.id, p_max: PER_DAY });
    if (uerr) return json({ error: "Prøv igen om lidt" }, 500);
    if (!used) return json({ error: `Du har brugt AI-hjælpen ${PER_DAY} gange i dag. Prøv igen i morgen.` }, 429);

    const draft = {
      overskrift: str(b.title, 150), indledning: str(b.intro, 3000),
      afsnit: (Array.isArray(b.sections) ? b.sections : []).slice(0, 12).map((s: Record<string, unknown>) => ({ heading: str(s.heading, 120), text: str(s.text, 4000), button_text: str(s.button_text, 40), button_url: str(s.button_url, 500) })),
    };
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5-5", max_tokens: 6000, system: SYSTEM,
        tools: [TOOL], tool_choice: { type: "tool", name: "nyhedsbrev" },
        messages: [{ role: "user", content: `Nyhedsbrev fra ${str(b.group_name, 80) || "gruppen"}. Her er udkastet som JSON:\n\n${JSON.stringify(draft, null, 2)}` }],
      }),
    });
    if (!r.ok) { console.error("anthropic", r.status, (await r.text()).slice(0, 300)); return json({ error: "AI'en svarede ikke. Prøv igen om lidt." }, 502); }
    const out = await r.json();
    const t = out.content?.find((c: { type: string }) => c.type === "tool_use")?.input;
    if (!t) return json({ error: "AI'en svarede ikke rigtigt. Prøv igen." }, 502);
    const okUrl = (x: unknown) => typeof x === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(x.trim());
    // Knapper må kun pege på links, der stod i udkastet
    const known = JSON.stringify(draft);
    return json({
      title: str(t.title, 150), intro: str(t.intro, 3000),
      sections: (t.sections || []).slice(0, 12).map((s: Record<string, unknown>) => {
        const url = okUrl(s.button_url) && known.includes(String(s.button_url).trim()) ? String(s.button_url).trim() : "";
        return { heading: str(s.heading, 120), text: str(s.text, 4000), button_text: url ? str(s.button_text, 40) : "", button_url: url };
      }),
      changes: (t.changes || []).slice(0, 8).map((c: unknown) => str(c, 200)),
    });
  } catch (e) { console.error("padel-newsletter-ai", (e as Error).message); return json({ error: "Noget gik galt. Prøv igen." }, 500); }
});

// Kalender-abonnement: klubbens træninger og de spilledage, man er tilmeldt. Adgang via personligt, hemmeligt token (?t=...).
Deno.serve(async (req: Request) => {
  const t = new URL(req.url).searchParams.get('t') || '';
  if (!/^[A-Za-z0-9_]{20,80}$/.test(t)) return new Response('Ugyldigt link', { status: 400 });
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_ANON_KEY')!;
  const r = await fetch(`${url}/rest/v1/rpc/padel_ical_v2`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: t }),
  });
  if (!r.ok) return new Response('Fejl', { status: 502 });
  const ics = await r.json();
  if (!ics) return new Response('Linket virker ikke længere', { status: 404 });
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="padel.ics"',
      'Cache-Control': 'max-age=900',
    },
  });
});

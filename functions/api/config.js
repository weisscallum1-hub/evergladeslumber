export function handlePublicConfig(request, env) {
  if (request.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: { "content-type": "application/json; charset=utf-8", allow: "GET" } });
  return new Response(JSON.stringify({
    turnstile_required: !!(env.LEADS_DB && (env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SITE_KEY)),
    turnstile_site_key: env.LEADS_DB && env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY || "" : "",
  }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

const STATUSES = new Set(["new", "reviewing", "waiting_buyer", "supplier_outreach", "quoted", "closed", "spam", "published", "paused"]);

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !a.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

function authorized(request, env) {
  const provided = request.headers.get("x-elx-admin-key") || "";
  return !!env.ADMIN_API_KEY && safeEqual(provided, env.ADMIN_API_KEY);
}

async function bodyJson(request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 5_000) return null;
  try { return await request.json(); } catch { return null; }
}

export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/suppliers") {
    if (!env.LEADS_DB) return json({ suppliers: [] });
    const { results = [] } = await env.LEADS_DB.prepare("SELECT id, data_json FROM leads WHERE kind = 'supplier' AND status = 'published' ORDER BY created_at DESC LIMIT 100").all();
    const suppliers = results.map((row) => {
      const data = JSON.parse(row.data_json);
      return { id: row.id, company: data.company, phone: data.phone, location: data.location, radius: data.radius, categories: data.categories, website: data.website };
    });
    return json({ suppliers });
  }
  if (!env.LEADS_DB || !env.ADMIN_API_KEY) return json({ error: "Admin lead inbox is not configured." }, 503);
  if (!authorized(request, env)) return json({ error: "Admin authentication failed." }, 401);

  if (request.method === "GET" && url.pathname === "/api/admin/leads") {
    const status = url.searchParams.get("status") || "";
    const requestedLimit = Number(url.searchParams.get("limit") || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
    const query = status && STATUSES.has(status)
      ? env.LEADS_DB.prepare("SELECT * FROM leads WHERE status = ? ORDER BY created_at DESC LIMIT ?").bind(status, limit)
      : env.LEADS_DB.prepare("SELECT * FROM leads ORDER BY created_at DESC LIMIT ?").bind(limit);
    const { results = [] } = await query.all();
    const ids = results.map((lead) => lead.id);
    const quotesByLead = new Map();
    const eventsByLead = new Map();
    const ordersByLead = new Map();
    if (ids.length) {
      const placeholders = ids.map(() => "?").join(",");
      const [quotes, events] = await Promise.all([
        env.LEADS_DB.prepare(`SELECT * FROM supplier_quotes WHERE lead_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all(),
        env.LEADS_DB.prepare(`SELECT lead_id, event_type, detail_json, created_at FROM lead_events WHERE lead_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all(),
      ]);
      let orders = { results: [] };
      try { orders = await env.LEADS_DB.prepare(`SELECT * FROM orders WHERE lead_id IN (${placeholders}) ORDER BY created_at DESC`).bind(...ids).all(); } catch { /* migration 0002 not applied yet */ }
      for (const order of orders.results || []) ordersByLead.set(order.lead_id, [...(ordersByLead.get(order.lead_id) || []), order]);
      for (const quote of quotes.results || []) quotesByLead.set(quote.lead_id, [...(quotesByLead.get(quote.lead_id) || []), quote]);
      for (const event of events.results || []) eventsByLead.set(event.lead_id, [...(eventsByLead.get(event.lead_id) || []), { ...event, detail: JSON.parse(event.detail_json) }]);
    }
    return json({ leads: results.map((lead) => ({ ...lead, data: JSON.parse(lead.data_json), ai_review: JSON.parse(lead.ai_review_json), quotes: quotesByLead.get(lead.id) || [], orders: ordersByLead.get(lead.id) || [], events: eventsByLead.get(lead.id) || [] })) });
  }

  const match = url.pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})$/i);
  const quoteMatch = url.pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})\/quotes$/i);
  const redactMatch = url.pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})\/redact$/i);
  const orderCreateMatch = url.pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})\/orders$/i);
  const orderMatch = url.pathname.match(/^\/api\/admin\/orders\/([0-9a-f-]{36})$/i);
  if (request.method === "DELETE" && redactMatch) {
    const existing = await env.LEADS_DB.prepare("SELECT id FROM leads WHERE id = ?").bind(redactMatch[1]).first();
    if (!existing) return json({ error: "Lead not found." }, 404);
    try {
      const hasOrder = await env.LEADS_DB.prepare("SELECT id FROM orders WHERE lead_id = ? LIMIT 1").bind(redactMatch[1]).first();
      if (hasOrder) return json({ error: "This request has a recorded order and referral fee, so it cannot be deleted. Keep it for your records." }, 409);
    } catch { /* orders table not created yet */ }
    await env.LEADS_DB.batch([
      env.LEADS_DB.prepare("DELETE FROM supplier_quotes WHERE lead_id = ?").bind(redactMatch[1]),
      env.LEADS_DB.prepare("DELETE FROM lead_events WHERE lead_id = ?").bind(redactMatch[1]),
      env.LEADS_DB.prepare("DELETE FROM leads WHERE id = ?").bind(redactMatch[1]),
    ]);
    return json({ ok: true, deleted: true });
  }
  if (request.method === "POST" && orderCreateMatch) {
    const input = await bodyJson(request);
    if (!input || typeof input !== "object") return json({ error: "Enter the order details." }, 400);
    const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const supplierName = clean(input.supplier_name, 200);
    const total = Number(input.material_total);
    const ratePercent = input.rate_percent === undefined || input.rate_percent === "" ? 5 : Number(input.rate_percent);
    const orderedOn = clean(input.ordered_on, 10);
    if (!supplierName || !Number.isFinite(total) || total < 0 || total > 10_000_000 || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(orderedOn) || Number.isNaN(Date.parse(orderedOn))) {
      return json({ error: "Provide the supplier, the material total in USD (before tax and delivery), a rate between 0 and 100, and the order date." }, 400);
    }
    const lead = await env.LEADS_DB.prepare("SELECT kind FROM leads WHERE id = ?").bind(orderCreateMatch[1]).first();
    if (!lead) return json({ error: "Lead not found." }, 404);
    if (lead.kind !== "buyer") return json({ error: "Orders can only be attached to buyer requests." }, 400);
    const totalCents = Math.round(total * 100);
    const rateBps = Math.round(ratePercent * 100);
    const referralCents = Math.round(totalCents * rateBps / 10_000);
    const due = new Date(Date.parse(orderedOn) + 30 * 86_400_000).toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await env.LEADS_DB.batch([
        env.LEADS_DB.prepare("INSERT INTO orders (id, lead_id, supplier_name, material_total_cents, referral_rate_bps, referral_cents, ordered_on, due_on, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(id, orderCreateMatch[1], supplierName, totalCents, rateBps, referralCents, orderedOn, due, clean(input.notes, 1_000), now, now),
        env.LEADS_DB.prepare("INSERT INTO lead_events (lead_id, event_type, detail_json, created_at) VALUES (?, 'order_recorded', ?, ?)")
          .bind(orderCreateMatch[1], JSON.stringify({ order_id: id, supplier_name: supplierName, total_cents: totalCents, referral_cents: referralCents }), now),
      ]);
    } catch {
      return json({ error: "Could not save the order. Apply migration 0002 (orders table) first." }, 503);
    }
    return json({ ok: true, id, referral_cents: referralCents, due_on: due }, 201);
  }
  if (request.method === "PATCH" && orderMatch) {
    const input = await bodyJson(request);
    const allowed = new Set(["pending", "invoiced", "paid", "waived"]);
    if (!input || !allowed.has(input.referral_status) || (input.notes !== undefined && typeof input.notes !== "string")) return json({ error: "Provide a valid referral status and optional note." }, 400);
    let current;
    try { current = await env.LEADS_DB.prepare("SELECT id, lead_id, referral_status, invoiced_on, paid_on FROM orders WHERE id = ?").bind(orderMatch[1]).first(); }
    catch { return json({ error: "Orders table is not set up yet." }, 503); }
    if (!current) return json({ error: "Order not found." }, 404);
    const today = new Date().toISOString().slice(0, 10);
    const invoicedOn = input.referral_status === "pending" ? "" : (current.invoiced_on || today);
    const paidOn = input.referral_status === "paid" ? (current.paid_on || today) : "";
    const now = new Date().toISOString();
    await env.LEADS_DB.batch([
      env.LEADS_DB.prepare("UPDATE orders SET referral_status = ?, invoiced_on = ?, paid_on = ?, notes = ?, updated_at = ? WHERE id = ?")
        .bind(input.referral_status, invoicedOn, paidOn, typeof input.notes === "string" ? input.notes.trim().slice(0, 1_000) : "", now, orderMatch[1]),
      env.LEADS_DB.prepare("INSERT INTO lead_events (lead_id, event_type, detail_json, created_at) VALUES (?, 'referral_status_changed', ?, ?)")
        .bind(current.lead_id, JSON.stringify({ from: current.referral_status, to: input.referral_status }), now),
    ]);
    return json({ ok: true, id: orderMatch[1], referral_status: input.referral_status });
  }
  if (request.method === "POST" && quoteMatch) {
    const input = await bodyJson(request);
    const clean = (value, max = 500) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const money = (value, required = false) => {
      if ((value === "" || value === undefined || value === null) && !required) return 0;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000_000 ? Math.round(parsed * 100) : null;
    };
    if (!input || typeof input !== "object") return json({ error: "Enter a quote." }, 400);
    const supplierName = clean(input.supplier_name, 200);
    const productSpec = clean(input.product_spec, 1_000);
    const quantity = Number(input.quantity);
    const unit = clean(input.unit, 80);
    const unitPrice = money(input.unit_price, true);
    const freight = money(input.freight);
    const tax = money(input.tax);
    const otherFees = money(input.other_fees);
    if (!supplierName || !productSpec || !unit || !Number.isFinite(quantity) || quantity <= 0 || quantity > 100_000_000 || unitPrice === null || freight === null || tax === null || otherFees === null) {
      return json({ error: "Provide supplier, product, positive quantity, unit, and valid non-negative USD amounts." }, 400);
    }
    const lead = await env.LEADS_DB.prepare("SELECT kind FROM leads WHERE id = ?").bind(quoteMatch[1]).first();
    if (!lead) return json({ error: "Lead not found." }, 404);
    if (lead.kind !== "buyer") return json({ error: "Supplier quotes can only be attached to buyer requests." }, 400);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const total = Math.round(unitPrice * quantity) + freight + tax + otherFees;
    if (!Number.isSafeInteger(total)) return json({ error: "Quote total is outside the supported range." }, 400);
    const record = {
      id, lead_id: quoteMatch[1], supplier_name: supplierName, quote_reference: clean(input.quote_reference, 120),
      product_spec: productSpec, quantity, unit, unit_price_cents: unitPrice, freight_cents: freight,
      tax_cents: tax, other_fees_cents: otherFees, total_cents: total, currency: "USD",
      fob_point: clean(input.fob_point, 300), stock_status: clean(input.stock_status, 200),
      delivery_timing: clean(input.delivery_timing, 200), valid_until: clean(input.valid_until, 80),
      payment_terms: clean(input.payment_terms, 300), notes: clean(input.notes, 2_000), received_at: clean(input.received_at, 80) || now, created_at: now,
    };
    await env.LEADS_DB.batch([
      env.LEADS_DB.prepare(`INSERT INTO supplier_quotes (id, lead_id, supplier_name, quote_reference, product_spec, quantity, unit, unit_price_cents, freight_cents, tax_cents, other_fees_cents, total_cents, currency, fob_point, stock_status, delivery_timing, valid_until, payment_terms, notes, received_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(record.id, record.lead_id, record.supplier_name, record.quote_reference, record.product_spec, record.quantity, record.unit, record.unit_price_cents, record.freight_cents, record.tax_cents, record.other_fees_cents, record.total_cents, record.currency, record.fob_point, record.stock_status, record.delivery_timing, record.valid_until, record.payment_terms, record.notes, record.received_at, record.created_at),
      env.LEADS_DB.prepare("INSERT INTO lead_events (lead_id, event_type, detail_json, created_at) VALUES (?, 'quote_recorded', ?, ?)")
        .bind(quoteMatch[1], JSON.stringify({ quote_id: id, supplier_name: supplierName, total_cents: total }), now),
    ]);
    return json({ ok: true, quote: record }, 201);
  }
  if (request.method === "PATCH" && match) {
    const input = await bodyJson(request);
    if (!input || !STATUSES.has(input.status) || (input.note !== undefined && typeof input.note !== "string") || (input.business_verified !== undefined && typeof input.business_verified !== "boolean")) return json({ error: "Provide a valid status, verification choice, and optional note." }, 400);
    const note = typeof input.note === "string" ? input.note.trim().slice(0, 2_000) : "";
    const current = await env.LEADS_DB.prepare("SELECT kind, status, data_json FROM leads WHERE id = ?").bind(match[1]).first();
    if (!current) return json({ error: "Lead not found." }, 404);
    if (input.status === "published") {
      if (current.kind !== "supplier") return json({ error: "Only supplier applications can be published." }, 400);
      const data = JSON.parse(current.data_json);
      const verified = input.business_verified === true || (input.business_verified === undefined && data.business_verified === true);
      if (!data.listing_consent || !verified) return json({ error: "Publishing requires supplier opt-in and independent business verification." }, 400);
    }
    const data = JSON.parse(current.data_json);
    if (current.kind === "supplier" && input.business_verified !== undefined) data.business_verified = input.business_verified;
    const now = new Date().toISOString();
    const result = await env.LEADS_DB.batch([
      env.LEADS_DB.prepare("UPDATE leads SET status = ?, internal_note = ?, data_json = ?, updated_at = ? WHERE id = ?")
        .bind(input.status, note, JSON.stringify(data), now, match[1]),
      env.LEADS_DB.prepare("INSERT INTO lead_events (lead_id, event_type, detail_json, created_at) VALUES (?, 'status_changed', ?, ?)")
        .bind(match[1], JSON.stringify({ from: current.status, to: input.status }), now),
    ]);
    if (!result[0]?.meta?.changes) return json({ error: "Lead not found." }, 404);
    return json({ ok: true, id: match[1], status: input.status });
  }

  return json({ error: "Not found." }, 404);
}

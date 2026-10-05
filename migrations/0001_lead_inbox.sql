PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('buyer', 'supplier')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'waiting_buyer', 'supplier_outreach', 'quoted', 'closed', 'spam', 'published', 'paused')),
  data_json TEXT NOT NULL,
  ai_review_json TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  internal_note TEXT NOT NULL DEFAULT '',
  notification_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS leads_created_at_idx ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_created_at_idx ON leads(status, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_kind_created_at_idx ON leads(kind, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS lead_events_lead_id_created_at_idx ON lead_events(lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS supplier_quotes (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  supplier_name TEXT NOT NULL,
  quote_reference TEXT NOT NULL DEFAULT '',
  product_spec TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT '',
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  freight_cents INTEGER NOT NULL DEFAULT 0 CHECK (freight_cents >= 0),
  tax_cents INTEGER NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  other_fees_cents INTEGER NOT NULL DEFAULT 0 CHECK (other_fees_cents >= 0),
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  fob_point TEXT NOT NULL DEFAULT '',
  stock_status TEXT NOT NULL DEFAULT '',
  delivery_timing TEXT NOT NULL DEFAULT '',
  valid_until TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS supplier_quotes_lead_created_idx ON supplier_quotes(lead_id, created_at DESC);

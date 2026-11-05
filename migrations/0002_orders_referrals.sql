-- Tracks orders that came from ELX introductions and the referral fee owed on each.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads(id),
  supplier_name TEXT NOT NULL,
  material_total_cents INTEGER NOT NULL CHECK (material_total_cents >= 0),
  referral_rate_bps INTEGER NOT NULL DEFAULT 500 CHECK (referral_rate_bps >= 0 AND referral_rate_bps <= 10000),
  referral_cents INTEGER NOT NULL CHECK (referral_cents >= 0),
  ordered_on TEXT NOT NULL,
  due_on TEXT NOT NULL,
  referral_status TEXT NOT NULL DEFAULT 'pending' CHECK (referral_status IN ('pending', 'invoiced', 'paid', 'waived')),
  invoiced_on TEXT NOT NULL DEFAULT '',
  paid_on TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_lead_idx ON orders(lead_id);
CREATE INDEX IF NOT EXISTS orders_status_due_idx ON orders(referral_status, due_on);

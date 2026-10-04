# Everglades Lumber Exchange — Cloudflare Worker

The production service is the Cloudflare Worker `evergladeslumber`, connected to the GitHub repository `weisscallum1-hub/evergladeslumber`. Deploy from the repository root so Wrangler reads `wrangler.jsonc`, publishes `Site/` as static assets, and runs `worker.js` for `/api/scout`.

## Publish through the connected GitHub build

1. In Cloudflare, open **Workers & Pages → evergladeslumber → Settings → Builds**. Confirm the connected repository, production branch, and root directory (repository root). Use no build command and `npx wrangler deploy` as the deploy command.
2. In **Settings → Bindings**, add `GROQ_API_KEY` as an encrypted Secret for the Production Worker, then save/deploy. Optionally set `GROQ_MODEL`; the default is `openai/gpt-oss-20b`.
3. Commit and push reviewed changes to the configured production branch. Cloudflare's connected build should publish the Worker and its assets together. Review the build result before treating the update as live.

The static upload panel only accepts static assets; it cannot deploy the `/api/scout` Worker handler. Do not use `wrangler pages deploy` for this Worker.

## Local deployment alternative

From the repository root, run `npx wrangler deploy`. This publishes to the Worker name in `wrangler.jsonc`. The command is a production deployment; check the Cloudflare account and Worker name before running it. Do not run it while a GitHub production build is in progress.

## Lumber Scout secret and limits

The API key is read only by the Worker at runtime. Never put it in `Site/` or browser JavaScript. A provider key was previously present in published browser code; revoke that old credential in the provider console and use only a replacement saved as the encrypted Cloudflare secret.

Without `GROQ_API_KEY`, Lumber Scout falls back to local keyword-based drafting. It does not verify inventory, pricing, specifications, code compliance, or supplier capability.

## Forms and search

Buyer quote and supplier application forms use FormSubmit to deliver to `hello@evergladeslumber.com`. Confirm mailbox routing and FormSubmit's one-time recipient confirmation. A thank-you page alone does not confirm email delivery.

Add `evergladeslumber.com` to Google Search Console, verify domain ownership, and submit `https://evergladeslumber.com/sitemap.xml`.

## Site contents

- `Site/index.html` — marketplace home and buyer intake
- `Site/directory.html` — dated supplier research shortlist, not endorsements or confirmed partners
- `Site/suppliers.html` — supplier application
- `Site/thank-you.html` and `Site/supplier-thank-you.html` — form confirmations
- `Site/privacy.html` and `Site/terms.html` — service disclosures
- `Site/_headers`, `Site/_redirects`, `Site/robots.txt`, `Site/sitemap.xml`
- `Site/assets/` — ELX mark and favicon
- `worker.js` — Worker API routing and static asset delivery
- `functions/api/scout.js` — request validation and Lumber Scout handler

## Operating workflow

1. Review each buyer request manually; clarify size, grade/species, treatment/use class, quantity, ZIP, schedule, substitutions, and delivery access.
2. Research suppliers for the exact material and service area. Confirm business identity, current stock, price validity, order minimum, delivery, lead time, and product documentation directly.
3. Get the buyer's approval before sharing their contact details or RFQ with a supplier.
4. Record quotes with date/time, expiration, quoted specifications, freight/tax treatment, and supplier contact. Compare like for like and state exclusions.
5. Keep supplier directory facts dated and distinguish researched listings from partners or paid placements.

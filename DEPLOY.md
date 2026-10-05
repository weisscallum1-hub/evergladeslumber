# Everglades Lumber Exchange — production operations

Production is the Cloudflare Worker `evergladeslumber`, connected to `weisscallum1-hub/evergladeslumber`. The repository root contains `wrangler.jsonc`; the Worker serves `Site/`, `/api/scout`, `/api/intake`, `/api/admin/*`, and the public `/api/suppliers` feed. The live site keeps FormSubmit as a temporary fallback until the D1 inbox binding is configured.

## Production deployment

Cloudflare Workers Builds watches `main`. In **Workers & Pages → evergladeslumber → Settings → Builds**, use the repository root, no build command, and `npx wrangler deploy`. A push deploys the Worker and assets together; check the build result and live routes after each change. Do not use `wrangler pages deploy` or the static-file upload panel for this Worker.

## Enable the structured lead inbox

1. Create a Cloudflare D1 database called `elx-leads` in the same account.
2. Bind it to the `evergladeslumber` Worker as **`LEADS_DB`**. The runtime reads that exact binding name.
3. Add the database binding to `wrangler.jsonc` so Git builds deploy it consistently:

   ```jsonc
   "d1_databases": [
     {
       "binding": "LEADS_DB",
       "database_name": "elx-leads",
       "database_id": "PASTE_THE_DATABASE_ID_FROM_CLOUDFLARE"
     }
   ]
   ```

4. Run the first migration against the remote database from this repository root:

   ```powershell
   npx wrangler d1 execute elx-leads --remote --file=./migrations/0001_lead_inbox.sql
   ```

5. Set `ADMIN_API_KEY` as an encrypted **Production Secret** with a random value of at least 32 characters. Keep it in a password manager; never put it in source control or the page URL. The private operations page is `/admin`; search crawlers are disallowed, but the API key is the actual access control.
6. Commit the real database ID in `wrangler.jsonc`, push to `main`, and confirm Cloudflare reports a successful production deployment. Test with a synthetic request, then verify it appears in `/admin` and can be moved through the workflow. Do not use a real customer request as a test.

Until steps 1–6 are complete, the website's forms fall back to the existing FormSubmit delivery route, and `/admin` cannot show an inbox. After D1 is active, requests are stored in D1; D1 is the system of record even if optional email notifications fail.

## Optional AI and email bindings

In **Settings → Variables & Secrets**, configure for Production:

- `GROQ_API_KEY` as an encrypted Secret. It powers Scout and contact-detail-free first-pass intake triage. The key is server-only. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`.
- `TURNSTILE_SECRET_KEY` as an encrypted Secret and `TURNSTILE_SITE_KEY` as a public runtime variable. Create a Managed widget for `evergladeslumber.com` (and `www.evergladeslumber.com` if that hostname serves the form). When both keys and D1 are configured, the Worker requires Siteverify success for the correct hostname and `elx_intake` action.
- `RESEND_API_KEY` as an encrypted Secret, after verifying the sending domain in Resend.
- `ELX_FROM_EMAIL` as a plain runtime variable using an address on the verified domain, e.g. `Everglades Lumber Exchange <hello@evergladeslumber.com>`.
- `ELX_NOTIFY_EMAIL` as a plain runtime variable set to the monitored ELX inbox.

When all email settings are valid, the Worker sends a receipt to the person who submitted a form and a reference-only alert to ELX. No buyer details are included in the operations alert. D1 saves the request first; notification failure does not discard it. Until email is configured, review `/admin` regularly. Never paste secrets into this repository, email, or chat.

## What AI automates—and what it must not

- Lumber Scout groups likely product categories, restates the request, and flags missing details. A local rule-based review remains available without Groq.
- Intake triage creates a first-pass summary and missing-detail list without sending contact name, email, or phone to Groq.
- The authenticated inbox records buyer requests, supplier applications, status, internal notes, supplier-confirmed quotes, and activity history.
- A supplier profile can appear in the separate public directory only when the supplier opted in **and** an ELX administrator independently verifies the business.
- AI cannot confirm supplier identity, inventory, grade, price, code compliance, credit, delivery, or engineering. It does not contact a supplier, share buyer information, publish a profile, accept a quote, or commit to commercial terms. A buyer must approve any introduction before contact details are shared.

## Supplier quote handling

Record only a quote received directly from the named supplier. Enter exact specification and quantity, unit price, freight, tax, other fees, total, named FOB point, live stock/lead time, quote expiry, and supplier-approved payment terms. Compare like-for-like offers. The admin comparison is internal; it does not publish or send a quote to the buyer. ELX has no supplier inventory feed, checkout, payment processing, or automatically refreshed lumber prices.

## Privacy and abuse controls

`Site/privacy.html` describes the current data flow. D1 stores submitted form details and consent timestamp; only the buyer email is needed for service follow-up. Groq receives no contact name, email, or phone. The optional public-profile consent is separate from contact consent, and public cards expose only company name, business phone, location/service area, categories, and website. Do not expose the admin key in query parameters or browser storage. Turnstile is supported but must be configured in Production; also add a Cloudflare rate-limit rule before paid promotion. The honeypot and field checks alone are baseline controls, not a complete anti-bot defense. Review D1 daily limits and usage in Cloudflare, especially on the Workers Free plan: https://developers.cloudflare.com/d1/platform/pricing/.

## Outreach prospect queue

`SUPPLIER-OUTREACH.md` contains three first-pass Miami-Dade prospects, official published business email/contact links, product fit, and an opt-in outreach draft. They have not been contacted and are not ELX partners. Only use an authorized `hello@evergladeslumber.com` mailbox. Never share a buyer's request with suppliers during directory recruitment.

## Search and discovery

Add the property to Google Search Console, verify domain ownership, and submit `https://evergladeslumber.com/sitemap.xml`. Use Cloudflare Web Analytics or an equivalent privacy-reviewed analytics product before adding tracking code. Track quote-form starts/completions, qualified requests, supplier response time, quote coverage, and buyer approval rate. Do not interpret page views as marketplace traction without successful quote fulfillment.

## Main files

- `Site/index.html` — marketplace homepage, buyer intake, and Lumber Scout
- `Site/directory.html` — opt-in verified supplier profiles plus separately labeled supplier research
- `Site/suppliers.html` — supplier application and distinct optional listing consent
- `Site/admin.html` — private inbox, human review, quote comparison, status and note updates
- `functions/api/intake.js` — intake validation, D1 persistence, AI triage and optional transactional email
- `functions/api/config.js` — public-only form security configuration (never returns secrets)
- `functions/api/admin.js` — token-protected inbox, quote entry/status history, and published supplier feed
- `functions/api/scout.js` — Lumber Scout API
- `migrations/0001_lead_inbox.sql` — leads, activity, and supplier-quote schema
- `worker.js`, `wrangler.jsonc` — routing, static assets and Worker bindings
- `SUPPLIER-LEAD-REVIEW.md` — review of the two earlier inquiries; the DPR sender/domain mismatch remains unverified
- `SUPPLIER-OUTREACH.md` — current South Florida supplier recruitment queue and outreach draft

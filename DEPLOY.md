# Everglades Lumber Exchange — production operations

Production is the Cloudflare Worker `evergladeslumber`, connected to `weisscallum1-hub/evergladeslumber`. The repository root contains `wrangler.jsonc`; the Worker serves `Site/`, `/api/scout`, `/api/intake`, `/api/admin/*`, and the public `/api/suppliers` feed. The live site stores submissions in D1. FormSubmit remains an emergency fallback only if the D1 binding is missing. Turnstile protects live buyer and supplier form submissions; human review is still required.

## Production deployment

Cloudflare Workers Builds watches `main`. In **Workers & Pages → evergladeslumber → Settings → Builds**, use the repository root, no build command, and `npx wrangler deploy`. A push deploys the Worker and assets together; check the build result and live routes after each change. Do not use `wrangler pages deploy` or the static-file upload panel for this Worker.

## Lead inbox production setup

The production D1 database `elx-leads` is bound as `LEADS_DB`. Migration `0001_lead_inbox.sql` is applied remotely. `ADMIN_API_KEY` is stored as an encrypted Worker secret; the admin page is `/admin` and requires that key. The database ID is safe to version in `wrangler.jsonc`. Never put the admin key in source control, a URL, or browser storage; save it in a password manager.

D1 is the system of record even if optional email notifications fail. Do not use a real customer request as a test.

## Optional AI and email bindings

In **Settings → Variables & Secrets**, configure for Production:

- `GROQ_API_KEY` as an encrypted Secret. It powers Scout and contact-detail-free first-pass intake triage. The key is server-only. `GROQ_MODEL` is optional and defaults to `openai/gpt-oss-20b`.
- `TURNSTILE_SECRET_KEY` is an encrypted Secret and `TURNSTILE_SITE_KEY` is a public runtime variable. A Managed widget is scoped to `evergladeslumber.com` and `www.evergladeslumber.com`. The Worker requires Siteverify success for the correct hostname and `elx_intake` action.
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

`Site/privacy.html` describes the current data flow. D1 stores submitted form details and consent timestamp; only the buyer email is needed for service follow-up. Groq receives no contact name, email, or phone. The optional public-profile consent is separate from contact consent, and public cards expose only company name, business phone, location/service area, categories, and website. Do not expose the admin key in query parameters or browser storage. The Worker applies per-IP limits to intake (5 requests/minute) and Scout (12 requests/minute), screens obvious promotional pitches, and requires Turnstile on submissions. Review D1 usage and limits in Cloudflare: https://developers.cloudflare.com/d1/platform/pricing/.

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

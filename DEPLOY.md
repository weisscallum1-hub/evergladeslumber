# Everglades Lumber Exchange — Deployment Guide

## Quick deploy (Cloudflare Pages)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial build — Everglades Lumber Exchange"
git remote add origin https://github.com/YOUR_USERNAME/evergladeslumber.git
git push -u origin main
```

### 2. Connect to Cloudflare Pages
- Log in to dash.cloudflare.com → Pages → Create a project
- Connect to your GitHub repo
- **Build settings:**
  - Framework preset: None
  - Build command: _(leave blank)_
  - Build output directory: `/` (root — all files are already in the root)
- Click Save and Deploy

### 3. Connect the domain
- In Cloudflare Pages → Custom domains → Add evergladeslumber.com
- If DNS is already on Cloudflare: automatic
- If not: point evergladeslumber.com's nameservers to Cloudflare first

### 4. Set up email routing (Cloudflare Email Routing)
- Cloudflare dashboard → Email → Email Routing → Enable
- Add route: `hello@evergladeslumber.com` → forwards to `weisscallum1@gmail.com`
- This activates FormSubmit delivery to hello@ which then hits your Gmail

### 5. Activate FormSubmit
FormSubmit requires a one-time email confirmation per recipient address.
- Deploy the site first
- Submit a test quote request via the form on the live site
- Check weisscallum1@gmail.com for a FormSubmit confirmation email
- Click confirm — forms are now live

### 6. Submit to Google Search Console
- https://search.google.com/search-console
- Add property: evergladeslumber.com
- Verify via DNS TXT record (Cloudflare makes this easy)
- Submit sitemap: https://evergladeslumber.com/sitemap.xml

---

## SEO notes
- The "formerly searched for Everglades Lumber?" notice on the homepage is strategic:
  people searching the old closed business will land here, see the callout,
  and understand the new offering immediately.
- Directory page (/directory.html) is built for local SEO with keyword-rich
  category descriptions for Miami-Dade and Broward.
- Sitemap is pre-built at /sitemap.xml

## File structure
```
/
├── index.html          ← Homepage (main SEO landing)
├── directory.html      ← Supplier directory (local SEO)
├── suppliers.html      ← Supplier application
├── thank-you.html      ← Form confirmation (noindex)
├── privacy.html        ← Privacy policy (noindex)
├── terms.html          ← Terms of service (noindex)
├── robots.txt
├── sitemap.xml
├── _headers            ← Cloudflare Pages security headers
├── _redirects          ← Cloudflare Pages clean URLs
└── assets/
    └── favicon.svg
```

## Forms
Both forms use FormSubmit (free, no account needed):
- Quote request → hello@evergladeslumber.com (subject: "New ELX Quote Request")
- Supplier application → hello@evergladeslumber.com (subject: "New ELX Supplier Application")
- Both redirect to /thank-you.html on success

## Next steps after launch
1. Personally email 5–10 South Florida lumber yards with the founding partner offer
2. Add them as featured listings in directory.html
3. Submit to Google Business (as a marketplace, not a physical store)
4. Post in South Florida contractor Facebook groups / Reddit (r/Homebuilding)
5. Once 10+ supplier listings are live, start pushing the buyer-side via contractor forums

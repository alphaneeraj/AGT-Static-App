# AGT-Static-App

Promotional website for **[Airlines Group Travel](https://www.airlinesgrouptravel.com)** hosted on **[static.app](https://static.app)** at `https://airlinesgrouptravel.staticdomains.app`. It includes:

- An SEO-ready static site: 33+ pages, schema, breadcrumbs, and a sitemap that builds itself
- A **blog** managed from an **admin portal** at `/admin/` with a rich text editor
- **Lead capture**: quote forms on the site, with leads viewable in the same admin portal

Phone number used site-wide: **+1-888-609-1015** (edit it once in `site.config.json`).

---

## How it works

```
 /admin/ (rich text editor) ──commit──▶ GitHub repo (content/posts/*.json)
                                              │  push / daily cron / "Rebuild" button
                                              ▼
                               GitHub Action: node scripts/build.mjs
                     (pages, blog, sitemap.xml, llms.txt, llms-full.txt, RSS, schema)
                                              │
                                              ▼
                        static.app (designmodo/static-app-deploy-action)

 Quote forms on site ──insert──▶ Supabase `leads` table ◀──read── /admin/ Leads tab
```

- **No framework and no dependencies.** The build is one Node script (`scripts/build.mjs`) and runs in about 1 second.
- **Blog posts** are JSON files in `content/posts/`. The admin portal commits them through the GitHub API. Every commit triggers a rebuild and deploy, so new posts show up on the blog, in the sitemap, the RSS feed and `llms-full.txt` automatically.
- **Scheduled posts:** give a post a future publish date. The daily 06:00 UTC rebuild publishes it once the date passes.
- **Leads** go into a Supabase table. Row-level security means the public site can only *insert* leads, and only emails listed in `admins` can read them.

## Project structure

| Path | Purpose |
|---|---|
| `site.config.json` | Site URL, name, **phone**, email, address, GitHub repo, Supabase keys, analytics IDs |
| `scripts/content.mjs` | Copy for every static page (services, airlines, group types, FAQs, legal) |
| `scripts/build.mjs` | Static site generator: HTML, JSON-LD, breadcrumbs, sitemap, robots, llms, RSS, manifest |
| `scripts/serve.mjs` | Local preview server |
| `content/posts/*.json` | Blog posts (written by the admin portal) |
| `static/` | Copied to the site root: favicons, `uploads/` (blog images from the admin) |
| `src/assets/` | CSS, JS, images |
| `src/admin/` | Admin portal (blog CMS + leads) |
| `supabase/schema.sql` | Leads / admins / settings tables with row-level security |
| `.github/workflows/deploy.yml` | Build and deploy to static.app on push, daily, or on demand |

## SEO & ranking features included

- Unique `<title>`, meta description, canonical and robots tags on every page
- **Open Graph and Twitter cards** (`summary_large_image`) with a 1200×630 social image
- **JSON-LD schema**: `TravelAgency`/`Organization`, `WebSite`, `WebPage`, `BreadcrumbList`, `Service`, `FAQPage`, `Blog`, `BlogPosting`, `ItemList`, `ContactPage`, `AboutPage`
- **Breadcrumbs**, both visible and in schema, on every inner page
- **`sitemap.xml`** generated automatically with real `lastmod` dates, plus an HTML `/sitemap/` page
- **`robots.txt`** (admin blocked, AI crawlers allowed), **`llms.txt`** and **`llms-full.txt`** (full site and blog text for AI assistants)
- **RSS feed** (`/feed.xml`), web manifest, favicons (`.ico`, `.svg`, Apple touch icon, 192/512 PNG), `humans.txt`, `.well-known/security.txt`
- Blog: table of contents, reading time, related posts, prev/next links, lazy-loaded images, WebP image optimisation on upload
- Fast pages: no framework, one CSS file, system fonts, sticky click-to-call button on mobile
- Pages targeting long-tail searches: 10 airline group-booking pages and 6 group-type pages (corporate, sports, weddings, …)
- A 404 page and a noindexed thank-you page that works as a conversion goal

---

## Setup

### 1. static.app hosting

1. Sign in at static.app and create a site (for example, upload the `site-dist` zip from the first GitHub Actions run, or any placeholder file). Name it **airlinesgrouptravel**.
2. Check the site's address. If it isn't `https://airlinesgrouptravel.staticdomains.app`, update `siteUrl` in `site.config.json`. Canonicals, the sitemap and schema all use this value. If you later connect a custom domain, change `siteUrl` to it.
3. Copy the site's **PID** from *Site → Settings → General*.
4. Create an **API key** from *Account → API Keys*. It starts with `sk_`. API deploys require a paid static.app plan.
5. In this GitHub repo, go to *Settings → Secrets and variables → Actions*:
   - **Secret** `STATIC_APP_API_KEY` = your `sk_…` key
   - **Variable** `STATIC_APP_PID` = the site PID
6. Push a commit or run the workflow manually (*Actions → Build & deploy → Run workflow*).

Until both are set, the workflow still builds the site and attaches it as a downloadable **`site-dist`** artifact, which you can upload to static.app by hand.

### 2. Admin portal: blog publishing

The admin lives at `https://<your-site>/admin/`.

It needs a GitHub **fine-grained personal access token**:
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)

- Repository access: **Only select repositories → AGT-Static-App**
- Permissions: **Contents: Read and write**, **Actions: Read and write**

Before Supabase is set up, you sign in to the admin by pasting this token. After Supabase is set up, you sign in with email and password, and the token is saved once under *Settings* and shared by all admins.

### 3. Leads setup (Supabase, free tier)

1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor**, paste in `supabase/schema.sql`, and run it.
3. Under **Authentication → Users → Add user**, create your admin login (email + password, auto-confirm).
4. Add that email to the admin list in the SQL Editor:
   ```sql
   insert into public.admins (email) values ('you@example.com');
   ```
5. Under **Authentication → Sign In / Providers**, turn off *Allow new users to sign up*.
6. Copy **Project URL** and the **anon public key** from *Project Settings → API* into `site.config.json`:
   ```json
   "supabase": { "url": "https://xxxx.supabase.co", "anonKey": "eyJ..." }
   ```
   The anon key is meant to be public. Row-level security is what protects the leads.
7. Commit and push. Quote forms now save to Supabase, and leads appear under **Admin → Leads**. From there you can search them, filter by status (new / contacted / quoted / booked / closed / spam), add notes, delete them, and export to CSV.

Until Supabase is configured, forms carry static.app's `static-form` attribute as a fallback, so submissions can still reach your static.app dashboard if static.app forms are enabled on your plan.

Spam protection: a hidden honeypot field, a minimum time before submitting, and length checks in the database.

### 4. Search engines

- Submit `https://<site>/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Put the verification codes in `googleSiteVerification` / `bingSiteVerification`, and a GA4 ID in `gaId`, inside `site.config.json`. The form sends a `generate_lead` event.

---

## Local development

```bash
npm run dev      # build + serve at http://localhost:8080
npm run build    # build only → dist/
```

Node 18 or newer. No `npm install` needed.

## Editing content

- **Phone, email, address, site URL:** `site.config.json`
- **Page copy, FAQs, airlines, group types:** `scripts/content.mjs`. Set `pagesUpdated` in the config to today's date when you change it, so the sitemap `lastmod` stays accurate.
- **Blog:** use `/admin/`, or add or edit JSON files in `content/posts/` by hand:
  ```json
  { "title": "…", "slug": "…", "status": "published", "date": "2026-10-01T09:00:00Z",
    "tags": ["Group Travel"], "metaDescription": "…", "cover": "/uploads/…", "content": "<p>…</p>" }
  ```

## Compliance notes

- The footer, About page and airline pages state that AGT is an independent agency not affiliated with any airline. Airline names are used descriptively, and no airline logos are included.
- No reviews, ratings or certifications are claimed. If you hold IATA / ARC / ASTA accreditation, add it to `scripts/content.mjs` along with your accreditation numbers.

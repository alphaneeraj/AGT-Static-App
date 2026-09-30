#!/usr/bin/env node
// Builds the whole site into ./dist with zero dependencies.
// Pages, blog, JSON-LD schema, breadcrumbs, sitemap.xml, robots.txt,
// llms.txt, llms-full.txt, RSS feed and web manifest are all generated here,
// so every blog post published from /admin/ is picked up automatically.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as C from './content.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
// The admin portal is published to GitHub Pages from dist-admin/, because
// static.app's CSP (connect-src) blocks browser calls to api.github.com.
const DIST_ADMIN = path.join(ROOT, 'dist-admin');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const NOW = new Date();
const BUILD_DATE = NOW.toISOString();
const PAGES_UPDATED = cfg.pagesUpdated || BUILD_DATE.slice(0, 10);
const useSupabase = Boolean(cfg.supabase?.url && cfg.supabase?.anonKey);

// ---------- helpers ----------
const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const abs = p => (/^https?:/.test(p) ? p : SITE + (p.startsWith('/') ? p : '/' + p));
const ld = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const stripTags = html => String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const fmtDate = d => new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
const truncate = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)).replace(/[,.;:]$/, '') + '…');

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === '.gitkeep' || entry.name === '.DS_Store') continue;
    const s = path.join(src, entry.name), d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else { fs.mkdirSync(dest, { recursive: true }); fs.copyFileSync(s, d); }
  }
}

// Admin-authored HTML is trusted, but strip anything executable anyway.
function sanitize(html = '') {
  return String(html)
    .replace(/<(script|style|object|embed|form|input|button|textarea|select|meta|link|base)\b[\s\S]*?(<\/\1>|\/?>)/gi, '')
    .replace(/<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi, (m, attrs) =>
      /src=["']https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//i.test(attrs) ? m : '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(javascript|vbscript|data:text\/html)[^"']*\2/gi, '$1="#"')
    .replace(/&nbsp;/g, ' ');
}

const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

// ---------- icons ----------
const icons = {
  group: '<path d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm0 2c-2.3 0-7 1.2-7 3.5V19h14v-2.5C15 14.2 10.3 13 8 13Zm8 0c-.3 0-.6 0-1 .1a4.2 4.2 0 0 1 2 3.4V19h6v-2.5c0-2.3-4.7-3.5-7-3.5Z"/>',
  seat: '<path d="M7 4a2 2 0 1 1 4 0v8h5a2 2 0 0 1 2 1.6l1 5.4h-2.5l-.9-4H9a2 2 0 0 1-2-2V4Zm-2 9h1v5h9v2H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z"/>',
  jet: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"/>',
  tag: '<path d="M21.4 11.6 12.4 2.6A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8ZM6.5 8A1.5 1.5 0 1 1 8 6.5 1.5 1.5 0 0 1 6.5 8Z"/>',
  phone: '<path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .6 3.6 1 1 0 0 1-.3 1Z"/>',
  mail: '<path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 4-8 5-8-5V6l8 5 8-5Z"/>',
  pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 14.5 9 2.5 2.5 0 0 1 12 11.5Z"/>',
  clock: '<path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7Z"/>',
  check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4Z"/>',
  plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5Z"/>',
  menu: '<path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z"/>',
};
const icon = (n, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[n]}</svg>`;

// ---------- shared schema ----------
const ORG_ID = SITE + '/#organization';
const WEBSITE_ID = SITE + '/#website';
const orgSchema = {
  '@type': ['TravelAgency', 'Organization'],
  '@id': ORG_ID,
  name: cfg.name,
  alternateName: 'AGT',
  url: SITE + '/',
  logo: { '@type': 'ImageObject', url: abs('/assets/img/logo-512.png'), width: 512, height: 512 },
  image: abs('/assets/img/og-image.jpg'),
  description: cfg.description,
  telephone: cfg.phone,
  email: cfg.email,
  foundingDate: cfg.foundingYear,
  priceRange: '$$',
  address: { '@type': 'PostalAddress', streetAddress: cfg.address.street, addressLocality: cfg.address.city, addressRegion: cfg.address.region, postalCode: cfg.address.postalCode, addressCountry: cfg.address.country },
  areaServed: [{ '@type': 'Country', name: 'United States' }, 'Worldwide'],
  openingHoursSpecification: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' },
  contactPoint: [{ '@type': 'ContactPoint', telephone: cfg.phone, contactType: 'reservations', areaServed: 'US', availableLanguage: ['English'], hoursAvailable: { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: '00:00', closes: '23:59' } }],
  sameAs: [cfg.mainSite, ...(cfg.social || [])].filter(Boolean),
  knowsAbout: ['Group flight booking', 'Business class flights', 'Private jet charter', 'Corporate travel', 'Group airfare'],
};
const websiteSchema = { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE + '/', name: cfg.name, description: cfg.description, publisher: { '@id': ORG_ID }, inLanguage: 'en-US' };

function breadcrumbSchema(crumbs) {
  return { '@type': 'BreadcrumbList', '@id': abs(crumbs.at(-1).url) + '#breadcrumb', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: abs(c.url) })) };
}
function faqSchema(faqs) {
  return { '@type': 'FAQPage', mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
}

// ---------- layout ----------
let nav = [
  ['Group Travel', '/group-travel/'],
  ['Business Class', '/business-class/'],
  ['Private Jet', '/private-jet-charter/'],
  ['Group Types', '/groups/'],
  ['Deals', '/deals/'],
  ['Blog', '/blog/'],
  ['Contact', '/contact/'],
];

function head(p) {
  const url = abs(p.path);
  const title = p.metaTitle ? `${p.metaTitle}${p.metaTitle.includes(cfg.name) ? '' : ' | ' + cfg.name}` : cfg.name;
  const img = abs(p.image || '/assets/img/og-image.jpg');
  const graph = [orgSchema, websiteSchema, {
    '@type': p.pageType || 'WebPage', '@id': url + '#webpage', url, name: title, description: p.description,
    isPartOf: { '@id': WEBSITE_ID }, about: { '@id': ORG_ID }, inLanguage: 'en-US',
    primaryImageOfPage: { '@type': 'ImageObject', url: img },
    ...(p.crumbs ? { breadcrumb: { '@id': url + '#breadcrumb' } } : {}),
    ...(p.dateModified ? { dateModified: p.dateModified } : {}),
  }];
  if (p.crumbs) graph.push(breadcrumbSchema(p.crumbs));
  if (p.schema) graph.push(...[].concat(p.schema));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${p.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'}">
<meta name="author" content="${esc(p.author || cfg.name)}">
<meta name="theme-color" content="${cfg.themeColor}">
<meta name="format-detection" content="telephone=yes">
${cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">\n` : ''}${cfg.bingSiteVerification ? `<meta name="msvalidate.01" content="${esc(cfg.bingSiteVerification)}">\n` : ''}<meta property="og:type" content="${p.ogType || 'website'}">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:locale" content="${cfg.locale}">
<meta property="og:title" content="${esc(p.ogTitle || title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:alt" content="${esc(p.imageAlt || cfg.name + ' – ' + cfg.tagline)}">
${p.image ? '' : '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'}${p.article ? `<meta property="article:published_time" content="${p.article.published}">
<meta property="article:modified_time" content="${p.article.modified}">
${(p.article.tags || []).map(t => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}
` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(p.ogTitle || title)}">
<meta name="twitter:description" content="${esc(p.description)}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${esc(p.imageAlt || cfg.name)}">
${cfg.twitter ? `<meta name="twitter:site" content="${esc(cfg.twitter)}">\n` : ''}<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)} Blog" href="/feed.xml">
<link rel="stylesheet" href="/assets/css/style.css?v=${BUILD_DATE.slice(0, 10).replace(/-/g, '')}">
${p.prev ? `<link rel="prev" href="${abs(p.prev)}">\n` : ''}${p.next ? `<link rel="next" href="${abs(p.next)}">\n` : ''}${ld({ '@context': 'https://schema.org', '@graph': graph })}
${cfg.gaId ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.gaId)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.gaId)}');</script>
` : ''}</head>`;
}

function header(current) {
  return `<a class="skip" href="#main">Skip to content</a>
<div class="topbar"><div class="wrap"><span>${icon('clock')} 24/7 group travel experts</span><a href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a></div></div>
<header class="site-header"><div class="wrap">
<a class="brand" href="/" aria-label="${esc(cfg.name)} home"><img src="/favicon.svg" width="36" height="36" alt=""><span><strong>Airlines</strong> Group Travel</span></a>
<button class="menu-btn" aria-expanded="false" aria-controls="nav" aria-label="Open menu">${icon('menu')}</button>
<nav id="nav" aria-label="Main"><ul>
${nav.map(([t, u]) => `<li><a href="${u}"${current && current.startsWith(u) ? ' aria-current="page"' : ''}>${t}</a></li>`).join('\n')}
</ul><a class="btn btn-call" href="tel:${cfg.phoneHref}">${icon('phone')} ${cfg.phone}</a></nav>
</div></header>`;
}

function breadcrumbs(crumbs) {
  if (!crumbs) return '';
  return `<nav class="breadcrumbs wrap" aria-label="Breadcrumb"><ol>${crumbs.map((c, i) =>
    i === crumbs.length - 1 ? `<li aria-current="page">${esc(c.name)}</li>` : `<li><a href="${c.url}">${esc(c.name)}</a></li>`).join('')}</ol></nav>`;
}

function footer() {
  const a = cfg.address;
  return `<section class="cta-band"><div class="wrap">
<div><h2>Ready to fly together?</h2><p>Talk to a group travel specialist now for a free, no-obligation quote.</p></div>
<a class="btn btn-accent btn-lg" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a>
</div></section>
<footer class="site-footer"><div class="wrap footer-grid">
<div>
<a class="brand brand-light" href="/"><img src="/favicon.svg" width="32" height="32" alt="" loading="lazy"><span><strong>Airlines</strong> Group Travel</span></a>
<p>${esc(cfg.tagline)}. Discounted group airfare on 150+ airlines with 24/7 support.</p>
<ul class="contact-list">
<li>${icon('phone')}<a href="tel:${cfg.phoneHref}">${cfg.phone}</a></li>
<li>${icon('mail')}<a href="mailto:${cfg.email}">${cfg.email}</a></li>
<li>${icon('pin')}<span>${esc(a.street)}, ${esc(a.city)}, ${a.region} ${a.postalCode}</span></li>
</ul>
</div>
<div><h3>Services</h3><ul>${C.services.map(s => `<li><a href="/${s.slug}/">${s.title}</a></li>`).join('')}<li><a href="/groups/">Group Types</a></li></ul></div>
${airlinePages.length
  ? `<div><h3>Airlines</h3><ul>${airlinePages.slice(0, 6).map(a => `<li><a href="${a.url}">${esc(a.title)}</a></li>`).join('')}<li><a href="/airlines/">All airlines</a></li></ul></div>`
  : `<div><h3>Group Types</h3><ul>${C.groupTypes.map(g => `<li><a href="/groups/${g.slug}/">${g.name}</a></li>`).join('')}</ul></div>`}
<div><h3>Company</h3><ul><li><a href="/about/">About Us</a></li><li><a href="/blog/">Travel Blog</a></li><li><a href="/faq/">FAQ</a></li><li><a href="/contact/">Contact</a></li><li><a href="/sitemap/">Sitemap</a></li><li><a href="/privacy-policy/">Privacy Policy</a></li><li><a href="/terms/">Terms</a></li></ul></div>
</div>
<div class="wrap legal"><p>Airlines Group Travel is an independent travel agency and is not affiliated with, endorsed by or sponsored by any airline. All airline names and trademarks belong to their respective owners. Fares are subject to availability and may change without notice.</p>
<p>© ${NOW.getUTCFullYear()} ${esc(cfg.name)}. All rights reserved. Main website: <a href="${cfg.mainSite}" rel="noopener">${cfg.mainSite.replace(/^https?:\/\//, '')}</a></p></div>
</footer>
<a class="call-float" href="tel:${cfg.phoneHref}" aria-label="Call ${cfg.phone}">${icon('phone')}<span>Call ${cfg.phone}</span></a>
<script src="/assets/js/config.js" defer></script>
<script src="/assets/js/main.js" defer></script>`;
}

function page(p, bodyHtml) {
  return `${head(p)}
<body class="${p.bodyClass || ''}">
${header(p.path)}
${breadcrumbs(p.crumbs)}
<main id="main">
${bodyHtml}
</main>
${footer()}
</body>
</html>`;
}

// ---------- components ----------
function quoteForm(id = 'quote', heading = 'Get a free group quote') {
  return `<form class="quote-form" id="${id}" method="post" data-lead-form${useSupabase ? '' : ` static-form static-form-id="leads"`} novalidate>
<h2 class="form-title">${heading}</h2>
<p class="form-sub">Or call <a href="tel:${cfg.phoneHref}">${cfg.phone}</a> – 24/7</p>
<fieldset class="trip-type"><legend class="sr-only">Trip type</legend>
<label><input type="radio" name="trip_type" value="Round trip" checked> Round trip</label>
<label><input type="radio" name="trip_type" value="One way"> One way</label>
<label><input type="radio" name="trip_type" value="Multi-city"> Multi-city</label>
</fieldset>
<div class="grid-2">
<label>From<input name="origin" required maxlength="80" placeholder="City or airport" autocomplete="off"></label>
<label>To<input name="destination" required maxlength="80" placeholder="City or airport" autocomplete="off"></label>
<label>Departure<input type="date" name="depart_date" required></label>
<label>Return<input type="date" name="return_date"></label>
<label>Travelers<input type="number" name="passengers" min="1" max="999" value="10" required inputmode="numeric"></label>
<label>Cabin<select name="cabin"><option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option><option>Private Jet</option></select></label>
<label>Full name<input name="name" required maxlength="100" autocomplete="name"></label>
<label>Phone<input type="tel" name="phone" required maxlength="30" autocomplete="tel"></label>
</div>
<label>Email<input type="email" name="email" required maxlength="120" autocomplete="email"></label>
<label>Notes <span class="muted">(optional)</span><textarea name="message" rows="2" maxlength="2000" placeholder="Group type, flexible dates, special requests…"></textarea></label>
<div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<button class="btn btn-accent btn-block" type="submit">Get my free quote</button>
<p class="form-note">By submitting you agree to be contacted about your trip. See our <a href="/privacy-policy/">privacy policy</a>.</p>
<p class="form-status" role="status" aria-live="polite"></p>
</form>`;
}

function faqBlock(faqs, heading = 'Frequently asked questions') {
  return `<section class="section faq"><div class="wrap narrow"><h2>${heading}</h2>
${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n')}
</div></section>`;
}

function postCard(p) {
  return `<article class="card post-card">
${p.cover ? `<a href="${p.url}" class="post-thumb" tabindex="-1"><img src="${esc(p.cover)}" alt="${esc(p.coverAlt || p.title)}" loading="lazy" decoding="async" width="640" height="360"></a>` : `<a href="${p.url}" class="post-thumb post-thumb-empty" tabindex="-1" aria-hidden="true">${icon('plane', 'ico-xl')}</a>`}
<div class="card-body"><p class="meta"><time datetime="${p.date}">${fmtDate(p.date)}</time> · ${p.readMins} min read</p>
<h3><a href="${p.url}">${esc(p.title)}</a></h3><p>${esc(p.excerpt)}</p></div></article>`;
}

function pageHero(title, lead, extra = '') {
  return `<section class="page-hero"><div class="wrap"><h1>${esc(title)}</h1>${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
<div class="hero-actions"><a class="btn btn-accent" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a>${extra}</div></div></section>`;
}

// ---------- blog data ----------
function loadPosts(folder = 'posts', base = '/blog/') {
  const dir = path.join(ROOT, 'content', folder);
  if (!fs.existsSync(dir)) return [];
  const posts = [];
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
    let p;
    try { p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); }
    catch (e) { console.warn(`! Skipping ${f}: ${e.message}`); continue; }
    if ((p.status || 'published') !== 'published') continue;
    if (!p.title || !p.content) { console.warn(`! Skipping ${f}: missing title/content`); continue; }
    const date = new Date(p.date || NOW);
    if (date > NOW) { console.log(`  scheduled: ${f} (${date.toISOString()})`); continue; }
    const slug = slugify(p.slug || f.replace(/\.json$/, ''));
    let content = sanitize(p.content);
    // IDs on h2 for the table of contents; lazy images.
    const toc = [];
    content = content.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, (m, attrs, inner) => {
      const text = decode(stripTags(inner));
      const id = slugify(text) || 'section-' + (toc.length + 1);
      toc.push({ id, text });
      return `<h2${attrs.replace(/\sid=("[^"]*"|'[^']*')/i, '')} id="${id}">${inner}</h2>`;
    }).replace(/<img(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
    const text = decode(stripTags(content));
    posts.push({
      ...p, slug, content, toc,
      url: `${base}${slug}/`,
      date: date.toISOString(),
      updated: new Date(p.updated || p.date || NOW).toISOString(),
      excerpt: p.excerpt || truncate(text, 160),
      description: p.metaDescription || p.excerpt || truncate(text, 155),
      readMins: Math.max(1, Math.round(text.split(/\s+/).length / 220)),
      tags: (p.tags || []).filter(Boolean),
      author: p.author || cfg.name,
      text,
    });
  }
  return posts.sort((a, b) => b.date.localeCompare(a.date));
}

// ---------- build ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.rmSync(DIST_ADMIN, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copyDir(path.join(ROOT, 'src'), DIST);
fs.rmSync(path.join(DIST, 'admin'), { recursive: true, force: true });
copyDir(path.join(ROOT, 'static'), DIST);

const posts = loadPosts();
// Airline pages are authored in the admin (content/airlines) like blog posts.
const airlinePages = loadPosts('airlines', '/airlines/').sort((a, b) => a.title.localeCompare(b.title));
if (airlinePages.length) nav.splice(3, 0, ['Airlines', '/airlines/']);
// Home/sitemap change when content changes, not on every daily rebuild.
const SITE_UPDATED = [PAGES_UPDATED, ...posts.map(p => p.updated.slice(0, 10)), ...airlinePages.map(p => p.updated.slice(0, 10))].sort().at(-1);
const sitemap = []; // {loc, lastmod, priority, changefreq}
const llms = [];    // {section, title, url, desc, text}
const addUrl = (loc, lastmod, priority = 0.7, changefreq = 'monthly') => sitemap.push({ loc: abs(loc), lastmod, priority, changefreq });
const addLlm = (section, title, url, desc, html) => llms.push({ section, title, url: abs(url), desc, html });

const home = { name: 'Home', url: '/' };

// Home
{
  const p = {
    path: '/', metaTitle: `${cfg.name} | Group Flights, Business Class & Jet Charters`, description: cfg.description,
    schema: faqSchema(C.homeFaqs), bodyClass: 'home',
  };
  const latest = posts.slice(0, 3);
  const body = `
<section class="hero"><div class="wrap hero-grid">
<div class="hero-copy">
<p class="eyebrow">${icon('clock')} 24/7 group travel specialists</p>
<h1>Group Flight Booking for 10+ Travelers – Save on Every Seat</h1>
<p class="lead">Discounted group airfare, business class deals and private jet charters on 150+ airlines. Hold seats with a deposit, add names later and let one dedicated agent handle it all.</p>
<ul class="ticks">
<li>${icon('check')} One locked-in fare for the whole group</li>
<li>${icon('check')} Book now, pay later with a deposit</li>
<li>${icon('check')} Domestic, international &amp; multi-city</li>
</ul>
<div class="hero-actions"><a class="btn btn-accent btn-lg" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a><a class="btn btn-ghost btn-lg" href="#quote">Get a quote</a></div>
</div>
${quoteForm('quote')}
</div></section>

<section class="trust"><div class="wrap trust-grid">
<div><strong>150+</strong><span>airlines worldwide</span></div>
<div><strong>24/7</strong><span>live phone support</span></div>
<div><strong>10+</strong><span>travelers per group fare</span></div>
<div><strong>${cfg.foundingYear}</strong><span>serving groups since</span></div>
</div></section>

<section class="section"><div class="wrap">
<h2 class="section-title">Travel services for groups and premium travelers</h2>
<div class="cards cards-4">
${C.services.map(s => `<a class="card service-card" href="/${s.slug}/">${icon(s.icon, 'ico-lg')}<h3>${s.title}</h3><p>${s.short}</p><span class="more">Learn more →</span></a>`).join('\n')}
</div></div></section>

<section class="section alt"><div class="wrap">
<h2 class="section-title">How group booking works</h2>
<ol class="steps">${C.steps.map(([t, d], i) => `<li><span class="step-n">${i + 1}</span><h3>${t}</h3><p>${d}</p></li>`).join('')}</ol>
</div></section>

<section class="section"><div class="wrap two-col">
<div><h2>Why book with Airlines Group Travel?</h2>
<p>Booking 10, 50 or 300 seats is very different from booking one. Our specialists deal directly with airline group desks so your party gets one fare, one itinerary and one person to call.</p>
<a class="btn btn-primary" href="/about/">About us</a></div>
<ul class="why">${C.whyUs.map(([t, d]) => `<li>${icon('check', 'ico-check')}<div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ul>
</div></section>

<section class="section alt"><div class="wrap">
<h2 class="section-title">Group flights for every occasion</h2>
<div class="cards cards-3">
${C.groupTypes.map(g => `<a class="card" href="/groups/${g.slug}/"><h3>${g.name}</h3><p>${g.short}</p><span class="more">Learn more →</span></a>`).join('\n')}
</div></div></section>

<section class="section"><div class="wrap">
<h2 class="section-title">Airlines we book for groups</h2>
<ul class="chips">
${airlinePages.map(a => `<li><a href="${a.url}">${esc(a.title)}</a></li>`).join('')}
${C.airlines.map(a => `<li><span>${a.name}</span></li>`).join('')}
${C.moreAirlines.map(a => `<li><span>${a}</span></li>`).join('')}
<li><span>+ 120 more</span></li></ul>
</div></section>

${latest.length ? `<section class="section alt"><div class="wrap">
<div class="section-head"><h2 class="section-title">From the travel blog</h2><a href="/blog/">All articles →</a></div>
<div class="cards cards-3">${latest.map(postCard).join('\n')}</div></div></section>` : ''}

${faqBlock(C.homeFaqs)}`;
  write('index.html', page(p, body));
  addUrl('/', SITE_UPDATED, 1.0, 'weekly');
  addLlm('Main', cfg.name, '/', cfg.description, `<p>${cfg.description}</p><h2>How it works</h2><ol>${C.steps.map(([t, d]) => `<li>${t}: ${d}</li>`).join('')}</ol><h2>Why us</h2><ul>${C.whyUs.map(([t, d]) => `<li>${t}: ${d}</li>`).join('')}</ul>`);
}

// Service & info pages
for (const [slug, d] of Object.entries(C.staticPages)) {
  const url = `/${slug}/`;
  const crumbs = [home, { name: d.title.replace(/ &.*| for .*/, ''), url }];
  const schema = [];
  if (d.serviceType) schema.push({ '@type': 'Service', '@id': abs(url) + '#service', name: d.title, serviceType: d.serviceType, description: d.description, provider: { '@id': ORG_ID }, areaServed: 'Worldwide', url: abs(url), offers: { '@type': 'Offer', availability: 'https://schema.org/InStock', url: abs(url) } });
  if (d.faqs) schema.push(faqSchema(d.faqs));
  if (slug === 'contact') schema.push({ '@type': 'ContactPage', '@id': abs(url) + '#contact', url: abs(url), name: d.title, mainEntity: { '@id': ORG_ID } });
  if (slug === 'about') schema.push({ '@type': 'AboutPage', '@id': abs(url) + '#about', url: abs(url), name: d.title, mainEntity: { '@id': ORG_ID } });
  const p = { path: url, metaTitle: d.metaTitle, description: d.description, crumbs, schema, dateModified: PAGES_UPDATED };

  let body;
  if (slug === 'contact') {
    const a = cfg.address;
    body = `${pageHero(d.title, d.lead)}
<section class="section"><div class="wrap two-col">
<div class="contact-cards">
<a class="card" href="tel:${cfg.phoneHref}">${icon('phone', 'ico-lg')}<h2>Call us 24/7</h2><p class="big">${cfg.phone}</p><p>Group flights, business class, charters, changes and support.</p></a>
<a class="card" href="mailto:${cfg.email}">${icon('mail', 'ico-lg')}<h2>Email</h2><p>${cfg.email}</p></a>
<div class="card">${icon('pin', 'ico-lg')}<h2>Office</h2><address>${esc(cfg.name)}<br>${esc(a.street)}<br>${esc(a.city)}, ${a.region} ${a.postalCode}, USA</address></div>
</div>
${quoteForm('quote', 'Send us your trip details')}
</div></section>`;
  } else if (d.faqs) {
    body = `${pageHero(d.title, d.lead)}${faqBlock(d.faqs, 'Questions & answers')}`;
  } else if (d.legal) {
    body = `<section class="section"><div class="wrap narrow prose"><h1>${esc(d.title)}</h1>${d.body}</div></section>`;
  } else {
    body = `${pageHero(d.title, d.lead, '<a class="btn btn-ghost" href="#quote">Request a quote</a>')}
<section class="section"><div class="wrap content-grid">
<article class="prose">${d.body}</article>
<aside>${quoteForm('quote')}</aside>
</div></section>`;
    if (slug === 'group-travel') body += faqBlock(C.homeFaqs);
  }
  write(`${slug}/index.html`, page(p, body));
  addUrl(url, PAGES_UPDATED, d.legal ? 0.3 : d.serviceType ? 0.9 : 0.6, d.legal ? 'yearly' : 'monthly');
  addLlm(d.legal ? 'Optional' : d.serviceType ? 'Services' : 'Company', d.title, url, d.description,
    (d.body || '') + (d.faqs ? d.faqs.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('') : '') +
    (slug === 'contact' ? `<p>Phone: ${cfg.phone} (24/7). Email: ${cfg.email}. Address: ${cfg.address.street}, ${cfg.address.city}, ${cfg.address.region} ${cfg.address.postalCode}, USA.</p>` : ''));
}

// Airline pages (from the admin) + hub
if (airlinePages.length) {
  const hub = '/airlines/';
  const p = {
    path: hub, metaTitle: 'Airline Group Booking | Group Fares on 150+ Airlines', crumbs: [home, { name: 'Airlines', url: hub }],
    dateModified: airlinePages.map(a => a.updated).sort().at(-1),
    description: `Group bookings and fares on major US and international airlines. Independent agency, 24/7 support. Call ${cfg.phone}.`,
    schema: { '@type': 'ItemList', itemListElement: airlinePages.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(a.url), name: a.title })) },
  };
  const body = `${pageHero('Airline Group Booking', 'Group fares for 10+ passengers on major US and international airlines.')}
<section class="section"><div class="wrap"><div class="cards cards-3">
${airlinePages.map(a => `<a class="card" href="${a.url}"><h2 class="h3">${esc(a.title)}</h2><p>${esc(a.excerpt)}</p><span class="more">Group fares →</span></a>`).join('\n')}
</div>
<p class="muted small mt">Airlines Group Travel is an independent agency and is not affiliated with the airlines listed.</p>
</div></section>`;
  write('airlines/index.html', page(p, body));
  addUrl(hub, p.dateModified.slice(0, 10), 0.8);

  for (const a of airlinePages) {
    const pp = {
      path: a.url, metaTitle: a.metaTitle || a.title, ogTitle: a.title, description: a.description,
      image: a.cover || null, imageAlt: a.coverAlt || a.title, dateModified: a.updated,
      crumbs: [home, { name: 'Airlines', url: hub }, { name: truncate(a.title, 60), url: a.url }],
      schema: { '@type': 'Service', '@id': abs(a.url) + '#service', name: a.title, serviceType: 'Group airline ticket booking', description: a.description, provider: { '@id': ORG_ID }, areaServed: 'Worldwide', url: abs(a.url) },
    };
    const b = `${pageHero(a.title, a.excerpt, '<a class="btn btn-ghost" href="#quote">Request a quote</a>')}
${a.cover ? `<div class="wrap"><img class="page-cover" src="${esc(a.cover)}" alt="${esc(a.coverAlt || a.title)}" width="1200" height="630" fetchpriority="high"></div>` : ''}
<section class="section"><div class="wrap content-grid">
<article class="prose">${a.toc.length >= 3 ? `<nav class="toc" aria-label="On this page"><strong>On this page</strong><ol>${a.toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}${a.content}
<p class="muted small">Airline names are trademarks of their respective owners. Airlines Group Travel is an independent travel agency and is not affiliated with any airline.</p></article>
<aside>${quoteForm('quote', `${esc(a.title)} quote`)}</aside>
</div></section>`;
    write(`${a.url.slice(1)}index.html`, page(pp, b));
    addUrl(a.url, a.updated.slice(0, 10), 0.7);
    addLlm('Airlines', a.title, a.url, a.description, a.content);
  }
}

// Group types hub + pages
{
  const url = '/groups/';
  const crumbs = [home, { name: 'Group Types', url }];
  const p = {
    path: url, metaTitle: 'Group Travel for Every Occasion | Corporate, Sports, Weddings', crumbs, dateModified: PAGES_UPDATED,
    description: `Group flights for corporate teams, sports teams, weddings, schools, church trips and family reunions. Call ${cfg.phone}.`,
    schema: { '@type': 'ItemList', itemListElement: C.groupTypes.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/groups/${g.slug}/`), name: g.name })) },
  };
  const body = `${pageHero('Group Travel for Every Occasion', 'Whatever brings your group together, we get everyone there on one fare.')}
<section class="section"><div class="wrap"><div class="cards cards-3">
${C.groupTypes.map(g => `<a class="card" href="/groups/${g.slug}/"><h2 class="h3">${g.name}</h2><p>${g.short}</p><span class="more">Learn more →</span></a>`).join('\n')}
</div></div></section>`;
  write('groups/index.html', page(p, body));
  addUrl(url, PAGES_UPDATED, 0.7);

  for (const g of C.groupTypes) {
    const gurl = `/groups/${g.slug}/`;
    const html = `
<h2>${esc(g.name)} flights, handled end to end</h2>
<p>${esc(g.short)} Airlines Group Travel requests group contracts from 150+ airlines so your whole party flies on one fare, with one agent managing every detail.</p>
<h2>What we take care of</h2>
<ul>${g.points.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<h2>How to get started</h2>
<ol>${C.steps.map(([t, d]) => `<li><strong>${t}.</strong> ${d}</li>`).join('')}</ol>
<p>Call <a href="tel:${cfg.phoneHref}">${cfg.phone}</a> any time, or send your details with the form.</p>`;
    const pp = {
      path: gurl, metaTitle: `${g.name} | Group Flight Booking`, dateModified: PAGES_UPDATED,
      description: `${g.short} Discounted group airfare, deposits and flexible names. Call ${cfg.phone} 24/7.`,
      crumbs: [home, { name: 'Group Types', url }, { name: g.name, url: gurl }],
      schema: { '@type': 'Service', name: `${g.name} flight booking`, serviceType: 'Group airline ticket booking', provider: { '@id': ORG_ID }, areaServed: 'Worldwide', url: abs(gurl) },
    };
    const b = `${pageHero(g.name, g.short, '<a class="btn btn-ghost" href="#quote">Request a quote</a>')}
<section class="section"><div class="wrap content-grid"><article class="prose">${html}</article><aside>${quoteForm('quote')}</aside></div></section>`;
    write(`groups/${g.slug}/index.html`, page(pp, b));
    addUrl(gurl, PAGES_UPDATED, 0.7);
    addLlm('Group types', g.name, gurl, pp.description, html);
  }
}

// Blog index with pagination
{
  const per = cfg.postsPerPage || 9;
  const pages = Math.max(1, Math.ceil(posts.length / per));
  for (let i = 0; i < pages; i++) {
    const n = i + 1;
    const url = n === 1 ? '/blog/' : `/blog/page/${n}/`;
    const slice = posts.slice(i * per, n * per);
    const crumbs = n === 1 ? [home, { name: 'Blog', url }] : [home, { name: 'Blog', url: '/blog/' }, { name: `Page ${n}`, url }];
    const p = {
      path: url, crumbs, pageType: 'CollectionPage',
      metaTitle: `Group Travel Blog${n > 1 ? ` – Page ${n}` : ''} | Tips, Guides & Airline News`,
      description: 'Group travel tips, airline group booking guides, business class advice and destination ideas from Airlines Group Travel.',
      prev: n > 1 ? (n === 2 ? '/blog/' : `/blog/page/${n - 1}/`) : null,
      next: n < pages ? `/blog/page/${n + 1}/` : null,
      schema: { '@type': 'Blog', '@id': abs('/blog/') + '#blog', name: `${cfg.name} Blog`, url: abs('/blog/'), publisher: { '@id': ORG_ID }, blogPost: slice.map(x => ({ '@type': 'BlogPosting', headline: x.title, url: abs(x.url), datePublished: x.date })) },
    };
    const body = `${pageHero('Group Travel Blog', 'Guides, tips and news to help your group fly smarter.')}
<section class="section"><div class="wrap">
${slice.length ? `<div class="cards cards-3">${slice.map(postCard).join('\n')}</div>` : '<p class="empty">New articles are coming soon.</p>'}
${pages > 1 ? `<nav class="pagination" aria-label="Blog pages">${p.prev ? `<a href="${p.prev}" rel="prev">← Newer</a>` : '<span></span>'}<span>Page ${n} of ${pages}</span>${p.next ? `<a href="${p.next}" rel="next">Older →</a>` : '<span></span>'}</nav>` : ''}
</div></section>`;
    write(`${url.slice(1)}index.html`, page(p, body));
    addUrl(url, posts[0]?.updated.slice(0, 10) || PAGES_UPDATED, n === 1 ? 0.8 : 0.4, 'daily');
  }
}

// Blog posts
posts.forEach((post, i) => {
  const url = post.url;
  const related = posts.filter(x => x !== post)
    .map(x => ({ x, score: x.tags.filter(t => post.tags.includes(t)).length }))
    .sort((a, b) => b.score - a.score || b.x.date.localeCompare(a.x.date)).slice(0, 3).map(r => r.x);
  const newer = posts[i - 1], older = posts[i + 1];
  const p = {
    path: url, metaTitle: post.metaTitle || post.title, ogTitle: post.title, description: post.description,
    image: post.cover || null, imageAlt: post.coverAlt || post.title, ogType: 'article', author: post.author,
    article: { published: post.date, modified: post.updated, tags: post.tags },
    crumbs: [home, { name: 'Blog', url: '/blog/' }, { name: truncate(post.title, 60), url }],
    schema: {
      '@type': 'BlogPosting', '@id': abs(url) + '#article', headline: post.title, description: post.description,
      image: abs(post.cover || '/assets/img/og-image.jpg'), datePublished: post.date, dateModified: post.updated,
      author: post.author === cfg.name ? { '@id': ORG_ID } : { '@type': 'Person', name: post.author },
      publisher: { '@id': ORG_ID }, mainEntityOfPage: { '@id': abs(url) + '#webpage' }, isPartOf: { '@id': abs('/blog/') + '#blog' },
      wordCount: post.text.split(/\s+/).length, keywords: post.tags.join(', '), articleSection: post.tags[0] || 'Group Travel', inLanguage: 'en-US',
    },
  };
  const body = `<article class="post">
<header class="post-header wrap narrow">
${post.tags.length ? `<p class="tags">${post.tags.map(t => `<span>${esc(t)}</span>`).join('')}</p>` : ''}
<h1>${esc(post.title)}</h1>
<p class="meta">By ${esc(post.author)} · <time datetime="${post.date}">${fmtDate(post.date)}</time>${post.updated.slice(0, 10) !== post.date.slice(0, 10) ? ` · Updated <time datetime="${post.updated}">${fmtDate(post.updated)}</time>` : ''} · ${post.readMins} min read</p>
</header>
${post.cover ? `<figure class="post-cover wrap narrow"><img src="${esc(post.cover)}" alt="${esc(post.coverAlt || post.title)}" width="1200" height="630" fetchpriority="high"></figure>` : ''}
<div class="wrap narrow">
${post.toc.length >= 3 ? `<nav class="toc" aria-label="Table of contents"><strong>In this article</strong><ol>${post.toc.map(t => `<li><a href="#${t.id}">${esc(t.text)}</a></li>`).join('')}</ol></nav>` : ''}
<div class="prose">${post.content}</div>
<aside class="post-cta"><h2>Planning a group trip?</h2><p>Get a free quote from a group travel specialist – 24/7.</p><a class="btn btn-accent" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a> <a class="btn btn-ghost-dark" href="/contact/">Request a quote</a></aside>
<nav class="post-nav" aria-label="More articles">${newer ? `<a href="${newer.url}" rel="next"><small>Newer</small>${esc(newer.title)}</a>` : '<span></span>'}${older ? `<a href="${older.url}" rel="prev"><small>Older</small>${esc(older.title)}</a>` : '<span></span>'}</nav>
</div></article>
${related.length ? `<section class="section alt"><div class="wrap"><h2 class="section-title">Related articles</h2><div class="cards cards-3">${related.map(postCard).join('\n')}</div></div></section>` : ''}`;
  write(`blog/${post.slug}/index.html`, page(p, body));
  addUrl(url, post.updated.slice(0, 10), 0.7, 'monthly');
  addLlm('Blog', post.title, url, post.description, post.content);
});

// HTML sitemap page
{
  const url = '/sitemap/';
  const groups = {};
  for (const l of llms) (groups[l.section] ||= []).push(l);
  const p = { path: url, metaTitle: 'Sitemap', description: `All pages on the ${cfg.name} website.`, crumbs: [home, { name: 'Sitemap', url }] };
  const body = `<section class="section"><div class="wrap narrow prose"><h1>Sitemap</h1>
<ul><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li>${airlinePages.length ? '<li><a href="/airlines/">Airlines</a></li>' : ''}<li><a href="/groups/">Group Types</a></li></ul>
${Object.entries(groups).filter(([k]) => k !== 'Main').map(([k, arr]) => `<h2>${k}</h2><ul>${arr.map(l => `<li><a href="${l.url.replace(SITE, '')}">${esc(l.title)}</a></li>`).join('')}</ul>`).join('\n')}
</div></section>`;
  write('sitemap/index.html', page(p, body));
  addUrl(url, SITE_UPDATED, 0.3);
}

// Thank-you + 404 (noindex, not in sitemap)
write('thank-you/index.html', page({ path: '/thank-you/', metaTitle: 'Thank You', description: 'Your request was received.', noindex: true },
  `<section class="section"><div class="wrap narrow center"><h1>Thank you! Your request is in.</h1>
<p class="lead">A group travel specialist will contact you shortly. For the fastest response, call us now.</p>
<p><a class="btn btn-accent btn-lg" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a></p>
<p><a href="/blog/">Browse travel tips while you wait →</a></p></div></section>`));
write('404.html', page({ path: '/404.html', metaTitle: 'Page Not Found', description: 'The page you requested could not be found.', noindex: true },
  `<section class="section"><div class="wrap narrow center"><h1>Page not found</h1>
<p class="lead">The page you are looking for may have moved. Try one of these instead, or call us 24/7.</p>
<ul class="chips center-chips"><li><a href="/">Home</a></li><li><a href="/group-travel/">Group Travel</a></li><li><a href="/business-class/">Business Class</a></li><li><a href="/blog/">Blog</a></li><li><a href="/contact/">Contact</a></li></ul>
<p><a class="btn btn-accent" href="tel:${cfg.phoneHref}">${icon('phone')} Call ${cfg.phone}</a></p></div></section>`));

// ---------- machine-readable files ----------
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map(u => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);

write('robots.txt', `# ${cfg.name} – ${SITE}
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /thank-you/

# AI crawlers are welcome to read public content
User-agent: GPTBot
Allow: /
Disallow: /admin/

User-agent: ClaudeBot
Allow: /
Disallow: /admin/

User-agent: PerplexityBot
Allow: /
Disallow: /admin/

User-agent: Google-Extended
Allow: /

Sitemap: ${SITE}/sitemap.xml
`);

// HTML -> Markdown-ish plain text for LLM files
function toMd(html) {
  return decode(String(html)
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (m, t) => `\n\n## ${stripTags(t)}\n\n`)
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (m, t) => `\n\n### ${stripTags(t)}\n\n`)
    .replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (m, t) => `\n\n#### ${stripTags(t)}\n\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (m, t) => `\n- ${stripTags(t.replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2'))}`)
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, h, t) => `[${stripTags(t)}](${h.startsWith('/') ? SITE + h : h})`)
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '_$2_')
    .replace(/<\/(p|ul|ol|blockquote|div|figure|table)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ').replace(/\n /g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const sections = ['Services', 'Airlines', 'Group types', 'Company', 'Blog', 'Optional'];
const contactLine = `Phone (24/7): ${cfg.phone} · Email: ${cfg.email} · Address: ${cfg.address.street}, ${cfg.address.city}, ${cfg.address.region} ${cfg.address.postalCode}, USA`;
write('llms.txt', `# ${cfg.name}

> ${cfg.description}

${cfg.name} is an independent US travel agency (founded ${cfg.foundingYear}) that specializes in group flight bookings for 10+ passengers, discounted business class fares and private jet charters on 150+ airlines. It is not affiliated with any airline.

- ${contactLine}
- Main website: ${cfg.mainSite}
- Full content for LLMs: ${SITE}/llms-full.txt

${sections.map(s => {
  const items = llms.filter(l => l.section === s);
  return items.length ? `## ${s}\n\n${items.map(l => `- [${l.title}](${l.url}): ${l.desc}`).join('\n')}\n` : '';
}).filter(Boolean).join('\n')}`);

write('llms-full.txt', `# ${cfg.name} – full site content

> ${cfg.description}

${contactLine}
Website: ${SITE}/ · Generated: ${BUILD_DATE}

${llms.map(l => `---

# ${l.title}

URL: ${l.url}
${l.desc}

${toMd(l.html)}
`).join('\n')}`);

// RSS feed
const xmlEsc = s => esc(s).replace(/&#39;/g, '&apos;');
write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>${xmlEsc(cfg.name)} Blog</title>
<link>${SITE}/blog/</link>
<description>${xmlEsc('Group travel tips, airline guides and deals from ' + cfg.name)}</description>
<language>en-us</language>
<lastBuildDate>${NOW.toUTCString()}</lastBuildDate>
<atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
${posts.slice(0, 30).map(p => `<item><title>${xmlEsc(p.title)}</title><link>${abs(p.url)}</link><guid isPermaLink="true">${abs(p.url)}</guid><pubDate>${new Date(p.date).toUTCString()}</pubDate><description>${xmlEsc(p.description)}</description>${p.tags.map(t => `<category>${xmlEsc(t)}</category>`).join('')}<content:encoded><![CDATA[${p.content.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded></item>`).join('\n')}
</channel>
</rss>
`);

write('site.webmanifest', JSON.stringify({
  name: cfg.name, short_name: cfg.shortName, description: cfg.description, start_url: '/', display: 'standalone',
  background_color: '#ffffff', theme_color: cfg.themeColor,
  icons: [
    { src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

write('humans.txt', `/* TEAM */\n${cfg.name}\nContact: ${cfg.email}\nPhone: ${cfg.phone}\nLocation: ${cfg.address.city}, ${cfg.address.region}, USA\n\n/* SITE */\nLast update: ${BUILD_DATE.slice(0, 10)}\nStandards: HTML5, CSS3, Schema.org\n`);
write('.well-known/security.txt', `Contact: mailto:${cfg.email}\nExpires: ${new Date(NOW.getTime() + 365 * 864e5).toISOString()}\nPreferred-Languages: en\nCanonical: ${SITE}/.well-known/security.txt\n`);

// Public runtime config for forms + admin (the Supabase anon key is public by design).
const runtimeConfig = `window.AGT_CONFIG=${JSON.stringify({
  siteUrl: SITE, adminUrl: cfg.adminUrl || '', phone: cfg.phone, email: cfg.email,
  supabaseUrl: cfg.supabase?.url || '', supabaseAnonKey: cfg.supabase?.anonKey || '',
  github: cfg.github, builtAt: BUILD_DATE,
})};\n`;
write('assets/js/config.js', runtimeConfig);

// Admin portal → dist-admin/admin/ (GitHub Pages); /admin/ on the site redirects there.
copyDir(path.join(ROOT, 'src', 'admin'), path.join(DIST_ADMIN, 'admin'));
fs.writeFileSync(path.join(DIST_ADMIN, 'admin', 'config.js'), runtimeConfig);
fs.copyFileSync(path.join(ROOT, 'static', 'favicon.svg'), path.join(DIST_ADMIN, 'admin', 'favicon.svg'));
fs.writeFileSync(path.join(DIST_ADMIN, 'index.html'), '<!doctype html><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=admin/"><a href="admin/">Admin</a>\n');
fs.writeFileSync(path.join(DIST_ADMIN, '.nojekyll'), '');
if (cfg.adminUrl) {
  write('admin/index.html', `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow">
<title>Admin</title><meta http-equiv="refresh" content="0;url=${esc(cfg.adminUrl)}"></head>
<body><p>Redirecting to the <a href="${esc(cfg.adminUrl)}">admin portal</a>…</p></body></html>\n`);
}

console.log(`✓ Built ${sitemap.length} indexable URLs, ${posts.length} blog posts, ${airlinePages.length} airline pages → dist/`);

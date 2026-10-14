#!/usr/bin/env node
// Export published airline pages and blog posts for reposting elsewhere:
//   export/AGT-Published-Pages.pdf   all pages in one PDF
//   export/pdf/<slug>.pdf            one PDF per page
//   export/html/<slug>.html          clean copy-paste HTML (images next to it)
// Usage: npm run export   (needs Google Chrome installed locally)

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'export');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
const SITE = cfg.siteUrl.replace(/\/$/, '');
const CHROME = process.env.CHROME || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium',
].find(p => fs.existsSync(p));

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');

function load(folder, kind, base) {
  const dir = path.join(ROOT, 'content', folder);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    return { ...d, slug: d.slug || f.replace(/\.json$/, ''), kind, base };
  }).filter(d => (d.status || 'published') === 'published')
    .sort((a, b) => String(a.title).localeCompare(String(b.title)));
}

const items = [...load('airlines', 'Airline page', '/airlines/'), ...load('posts', 'Blog post', '/blog/')];
if (!items.length) { console.log('Nothing published to export.'); process.exit(0); }

fs.rmSync(OUT, { recursive: true, force: true });
for (const d of ['pdf', 'html/images', '.tmp']) fs.mkdirSync(path.join(OUT, d), { recursive: true });

// Images: copy uploads next to the HTML; PDFs reference the local files.
const localUpload = src => path.join(ROOT, 'static', src.replace(/^\/+/, ''));
function copyImage(src) {
  if (!src || !src.startsWith('/uploads/')) return src;
  const file = localUpload(src);
  if (!fs.existsSync(file)) return SITE + src;
  const name = path.basename(file);
  fs.copyFileSync(file, path.join(OUT, 'html', 'images', name));
  return name;
}
const absLinks = html => html.replace(/href="\/(?!\/)/g, `href="${SITE}/`);
const forPdf = html => absLinks(html).replace(/src="(\/uploads\/[^"]+)"/g, (m, s) => `src="${pathToFileURL(localUpload(s)).href}"`);
const forHtml = html => absLinks(html).replace(/src="(\/uploads\/[^"]+)"/g, (m, s) => `src="images/${path.basename(s)}"`);

const css = `
@page { size: A4; margin: 18mm 16mm 20mm; }
* { box-sizing: border-box; }
body { font: 11pt/1.6 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #14213d; margin: 0; }
h1 { font-size: 22pt; line-height: 1.2; color: #06214f; margin: 0 0 10pt; }
h2 { font-size: 15pt; color: #0b3d91; margin: 18pt 0 6pt; page-break-after: avoid; }
h3 { font-size: 12.5pt; color: #0b3d91; margin: 14pt 0 4pt; page-break-after: avoid; }
p, li { orphans: 3; widows: 3; }
img { max-width: 100%; height: auto; border-radius: 6pt; }
a { color: #0b3d91; }
blockquote { border-left: 3pt solid #ff7a00; margin: 10pt 0; padding: 4pt 12pt; background: #f5f8fd; }
table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #dfe5ef; padding: 4pt 6pt; }
.page { page-break-after: always; }
.page:last-child { page-break-after: auto; }
.kind { display: inline-block; font-size: 8.5pt; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #fff; background: #0b3d91; padding: 2pt 8pt; border-radius: 99pt; margin-bottom: 8pt; }
.seo { border: 1px solid #dfe5ef; background: #f5f8fd; border-radius: 6pt; padding: 8pt 12pt; margin: 0 0 14pt; font-size: 9.5pt; page-break-inside: avoid; }
.seo table td { border: 0; padding: 2pt 6pt 2pt 0; vertical-align: top; }
.seo td:first-child { font-weight: 700; white-space: nowrap; color: #5b6477; width: 120pt; }
.cover { margin: 0 0 14pt; }
.cover img { width: 100%; }
.toc-page h1 { font-size: 26pt; }
.toc-page ol { font-size: 12pt; line-height: 2; }
.muted { color: #5b6477; font-size: 9.5pt; }
.ql-align-center { text-align: center; } .ql-align-right { text-align: right; } .ql-align-justify { text-align: justify; }
.ql-indent-1 { padding-left: 3em; } .ql-indent-2 { padding-left: 6em; }`;

function seoTable(d) {
  const rows = [
    ['Type', d.kind],
    ['Title (H1)', d.title],
    ['Meta title', d.metaTitle || d.title],
    ['Meta description', d.metaDescription || ''],
    ['URL slug', d.slug],
    ['Original URL', SITE + d.base + d.slug + '/'],
    ['Excerpt', d.excerpt || ''],
    ['Tags', (d.tags || []).join(', ')],
    ['Published', fmtDate(d.date)],
    ['Cover image alt', d.coverAlt || ''],
  ].filter(r => r[1]);
  return `<div class="seo"><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></div>`;
}

function article(d, mode) {
  const body = mode === 'pdf' ? forPdf(d.content) : forHtml(d.content);
  const cover = d.cover ? (mode === 'pdf' ? pathToFileURL(localUpload(d.cover)).href : 'images/' + path.basename(d.cover)) : '';
  return `<section class="page">
<span class="kind">${esc(d.kind)}</span>
<h1>${esc(d.title)}</h1>
${mode === 'pdf' ? seoTable(d) : ''}
${cover ? `<figure class="cover"><img src="${cover}" alt="${esc(d.coverAlt || d.title)}"></figure>` : ''}
${body}
</section>`;
}

const doc = (title, inner) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${inner}</body></html>`;

function printPdf(htmlFile, pdfFile) {
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', '--allow-file-access-from-files',
    `--print-to-pdf=${pdfFile}`, pathToFileURL(htmlFile).href], { stdio: 'ignore' });
}

if (!CHROME) { console.error('Google Chrome not found – set CHROME=/path/to/chrome'); process.exit(1); }

const tmp = path.join(OUT, '.tmp');
// Combined PDF with contents page
const toc = `<section class="page toc-page"><span class="kind">Content export</span><h1>${esc(cfg.name)} – Published Pages</h1>
<p class="muted">Exported ${fmtDate(new Date())} · ${items.length} page${items.length > 1 ? 's' : ''} · Phone ${esc(cfg.phone)}</p>
<ol>${items.map(d => `<li>${esc(d.title)} <span class="muted">(${esc(d.kind)})</span></li>`).join('')}</ol>
<p class="muted">Each page starts with an SEO box (meta title, meta description, slug, tags) followed by the cover image and the full article.</p></section>`;
fs.writeFileSync(path.join(tmp, 'all.html'), doc('Published pages', toc + items.map(d => article(d, 'pdf')).join('\n')));
printPdf(path.join(tmp, 'all.html'), path.join(OUT, 'AGT-Published-Pages.pdf'));

for (const d of items) {
  const h = path.join(tmp, d.slug + '.html');
  fs.writeFileSync(h, doc(d.title, article(d, 'pdf')));
  printPdf(h, path.join(OUT, 'pdf', d.slug + '.pdf'));
  // Clean HTML for copy-paste (no SEO box; SEO fields as a comment block at top)
  copyImage(d.cover);
  (d.content.match(/src="(\/uploads\/[^"]+)"/g) || []).forEach(m => copyImage(m.slice(5, -1)));
  const seo = `<!--\nMeta title: ${d.metaTitle || d.title}\nMeta description: ${d.metaDescription || ''}\nSlug: ${d.slug}\nTags: ${(d.tags || []).join(', ')}\nCover alt: ${d.coverAlt || ''}\n-->\n`;
  fs.writeFileSync(path.join(OUT, 'html', d.slug + '.html'), seo + doc(d.title, article(d, 'html')));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ Exported ${items.length} pages → export/ (AGT-Published-Pages.pdf, pdf/, html/)`);

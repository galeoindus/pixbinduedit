#!/usr/bin/env node
/* Weekly repository audit, run by .github/workflows/scheduled-health.yml.
 *
 * Push-time CI proves the current commit works. This checks the slower things
 * that no push catches: an asset referenced from index.html that was renamed,
 * a service-worker shell entry that no longer exists, a sitemap that drifted
 * away from the files on disk.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignored = new Set(['.git', 'node_modules', '.wrangler', 'dist', 'build']);
const problems = [];
const notes = [];

function walk(dir, out = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (ignored.has(item.name)) continue;
    const full = join(dir, item.name);
    if (item.isDirectory()) walk(full, out);
    else if (item.isFile()) out.push(full);
  }
  return out;
}

const files = walk(ROOT);
const rel = (f) => f.slice(ROOT.length + 1);

/* 1. Every asset referenced from index.html must exist. */
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
let refCount = 0;
for (const m of html.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
  const raw = m[1].trim();
  if (!raw || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) continue;
  const clean = raw.split('#')[0].split('?')[0];
  if (!clean) continue;
  refCount += 1;
  /* An absolute reference ("/assets/x.png") is resolved from the site root and a
     relative one from the folder index.html lives in — which is the repository
     root, so both land in the same place. Written out rather than as a ternary
     with two identical branches. */
  const target = join(ROOT, clean.replace(/^\/+/, ''));
  if (!existsSync(target)) problems.push(`index.html → ${raw} does not exist`);
}
notes.push(`${refCount} local references from index.html`);

/* 2. The manifest and its icons. */
const manifestPath = join(ROOT, 'manifest.json');
if (!existsSync(manifestPath)) {
  problems.push('manifest.json is missing');
} else {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (err) {
    problems.push(`manifest.json is not valid JSON: ${err.message}`);
  }
  if (manifest) {
    const icons = manifest.icons || [];
    if (icons.length === 0) problems.push('manifest.json declares no icons');
    for (const icon of icons) {
      if (!existsSync(join(ROOT, icon.src))) problems.push(`manifest icon missing: ${icon.src}`);
    }
    notes.push(`${icons.length} manifest icons`);
  }
}

/* 3. Every file the service worker precaches must exist. */
const swPath = join(ROOT, 'sw.js');
if (!existsSync(swPath)) {
  problems.push('sw.js is missing');
} else {
  const sw = readFileSync(swPath, 'utf8');
  /* The shell is written with relative paths ('index.html', 'fonts/x.woff2')
     because the editor is served from a sub-path. The old regex only matched
     paths that started with a slash, so it quietly checked nothing at all. */
  const start = sw.indexOf('const SHELL');
  const end = start === -1 ? -1 : sw.indexOf('];', start);
  if (start === -1 || end === -1) {
    problems.push('sw.js has no SHELL array to check');
  } else {
    const block = sw.slice(start, end);
    const shell = [...block.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
    const unique = [...new Set(shell)];
    for (const entry of unique) {
      const clean = entry.replace(/^(\.\/|\/)+/, '');
      const target = clean === '' ? join(ROOT, 'index.html') : join(ROOT, clean);
      if (!existsSync(target)) problems.push(`service worker precaches a missing file: ${entry}`);
    }
    if (unique.length === 0) problems.push('the service worker shell is empty');
    notes.push(`${unique.length} precached shell entries`);
  }
}

/* 4. sitemap.xml and robots.txt must still describe the site. */
for (const required of ['sitemap.xml', 'robots.txt', 'llms.txt']) {
  if (!existsSync(join(ROOT, required))) problems.push(`${required} is missing`);
}
const sitemapPath = join(ROOT, 'sitemap.xml');
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, 'utf8');
  const locs = [...sitemap.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
  if (locs.length === 0) problems.push('sitemap.xml lists no URLs');
  notes.push(`${locs.length} URLs in sitemap.xml`);

  /* Indexing hygiene: the canonical, the one sitemap URL and the robots.txt
     Sitemap line all have to name the same address. When they drift, Google
     keeps the old one in its index and a stale link keeps showing up. */
  const canonical = (html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i) || [])[1];
  if (!canonical) problems.push('index.html has no canonical link');
  else {
    if (locs.length && !locs.includes(canonical)) {
      problems.push(`canonical ${canonical} is not the URL in sitemap.xml`);
    }
    const robotsPath = join(ROOT, 'robots.txt');
    if (existsSync(robotsPath)) {
      const robots = readFileSync(robotsPath, 'utf8');
      const declared = (robots.match(/^Sitemap:\s*(\S+)/im) || [])[1];
      const expected = new URL('sitemap.xml', canonical).href;
      if (!declared) problems.push('robots.txt declares no Sitemap');
      else if (declared !== expected) problems.push(`robots.txt Sitemap ${declared} does not match ${expected}`);
    }
  }

  /* Anything that is not the canonical page must say so. The host answers
     every other path with 404.html; if that page is indexable, Google keeps
     old addresses alive. */
  const notFoundPath = join(ROOT, '404.html');
  if (!existsSync(notFoundPath)) {
    problems.push('404.html is missing: the host would serve its own indexable 404');
  } else if (!/<meta\s+name=["']robots["'][^>]*noindex/i.test(readFileSync(notFoundPath, 'utf8'))) {
    problems.push('404.html is not marked noindex');
  }
}

/* 5. Fonts: the editor promises a self-hosted set, so an empty file is a bug. */
const fontDir = join(ROOT, 'fonts');
if (!existsSync(fontDir)) {
  problems.push('fonts/ is missing');
} else {
  const fonts = readdirSync(fontDir).filter((f) => f.endsWith('.woff2'));
  for (const font of fonts) {
    if (statSync(join(fontDir, font)).size === 0) problems.push(`empty font file: fonts/${font}`);
  }
  notes.push(`${fonts.length} woff2 fonts`);
}

/* 6. Nothing that looks like a committed secret. */
const secretPatterns = [
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
  [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'private key'],
  [/\bsk-[A-Za-z0-9]{32,}\b/, 'OpenAI-style secret key'],
];
for (const file of files) {
  if (/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|zip|gz)$/i.test(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const [pattern, label] of secretPatterns) {
    if (pattern.test(text)) problems.push(`${rel(file)} looks like it contains a ${label}`);
  }
}

console.log(notes.join('\n'));
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exit(1);
}
console.log('weekly audit: clean');

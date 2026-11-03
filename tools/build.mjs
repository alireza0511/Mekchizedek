// Melchizedek private reading site — build script.
// Reads ../english, ../farsi, ../media (never committed), writes an
// AES-encrypted static site to ../docs (the only thing that is pushed).
//
//   cd tools && STATICRYPT_PASSWORD='your long password' node build.mjs
//   (or put STATICRYPT_PASSWORD=... in tools/.env, which is gitignored)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, 'docs');
const PLAIN = process.env.PLAIN_DIR ? path.resolve(process.env.PLAIN_DIR) : path.join(ROOT, 'build', 'plain');      // readable, gitignored
const IMGCACHE = path.join(ROOT, 'build', 'img');     // compressed images, gitignored
const IMG_WIDTH = 1400, IMG_QUALITY = 76;

// ---- password ----
if (fs.existsSync(path.join(import.meta.dirname, '.env'))) {
  for (const l of fs.readFileSync(path.join(import.meta.dirname, '.env'), 'utf8').split('\n')) {
    const m = l.match(/^\s*STATICRYPT_PASSWORD\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && !process.env.STATICRYPT_PASSWORD) process.env.STATICRYPT_PASSWORD = m[1];
  }
}
const PW = process.env.STATICRYPT_PASSWORD || '';
if (PW.length < 14 || /[^\x21-\x7e]/.test(PW)) {
  console.error('Set STATICRYPT_PASSWORD: at least 14 characters, Latin letters/digits/symbols only, no spaces.');
  process.exit(1);
}

// ---- image index (match by file name; md links point at an old "new set/" path) ----
const imgIndex = new Map();
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(png|jpe?g|webp)$/i.test(e.name)) imgIndex.set(e.name.normalize('NFC'), p);
  }
})(path.join(ROOT, 'media'));

fs.mkdirSync(IMGCACHE, { recursive: true });
async function dataUri(ref) {
  const name = decodeURIComponent(path.basename(ref)).normalize('NFC');
  const src = imgIndex.get(name);
  if (!src) throw new Error('Image not found: ' + ref);
  const cached = path.join(IMGCACHE, name.replace(/\.[^.]+$/, '') + `.${IMG_WIDTH}q${IMG_QUALITY}.webp`);
  if (!fs.existsSync(cached) || fs.statSync(cached).mtimeMs < fs.statSync(src).mtimeMs) {
    await sharp(src).resize({ width: IMG_WIDTH, withoutEnlargement: true }).webp({ quality: IMG_QUALITY }).toFile(cached);
  }
  return 'data:image/webp;base64,' + fs.readFileSync(cached).toString('base64');
}

// ---- parts ----
const PARTS = [1, 2, 3, 4, 5, 6, 7, 8];
const LANGS = {
  en: { dir: 'english', file: n => `part-${n}.md`, html: 'ltr', label: 'English', other: 'fa', otherLabel: 'فارسی',
        title: 'MELCHIZEDEK', part: n => `Part ${n}`, prev: '← Previous', next: 'Next →', contents: 'Contents' },
  fa: { dir: 'farsi', file: n => `part-${n}-fa.md`, html: 'rtl', label: 'فارسی', other: 'en', otherLabel: 'English',
        title: 'ملکی‌صدق', part: n => `بخش ${'۱۲۳۴۵۶۷۸'[n - 1]}`, prev: 'قبلی →', next: '← بعدی', contents: 'فهرست' },
};
const YEAR = new Date().getFullYear();
const FOOTER = `© ${YEAR} Alireza Khakpour. All Rights Reserved. Unpublished screenplay — do not copy, share or distribute.`;

const css = `
:root{--bg:#f7f4ee;--fg:#1d1b18;--mute:#6f6a62;--rule:#d9d2c5;--accent:#2f6f68}
@media (prefers-color-scheme:dark){:root{--bg:#141312;--fg:#e9e4da;--mute:#9b958b;--rule:#34312c;--accent:#6fb5ac}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 Georgia,'Iowan Old Style',serif}
[dir=rtl] body,body[dir=rtl]{font-family:Vazirmatn,Tahoma,sans-serif;font-size:18px;line-height:2}
main{max-width:720px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
h1{font-size:2rem;letter-spacing:.12em;text-align:center;margin:.5rem 0}
h2{font-size:1.35rem;letter-spacing:.06em;margin:2.5rem 0 1rem;border-bottom:1px solid var(--rule);padding-bottom:.4rem}
h3{font-size:1.1rem}
hr{border:0;border-top:1px solid var(--rule);margin:2rem 0}
img{display:block;width:100%;height:auto;border-radius:6px;margin:1.75rem 0}
strong{font-weight:700}
a{color:var(--accent)}
nav.top,nav.pager{display:flex;justify-content:space-between;gap:1rem;font:15px/1.4 system-ui,sans-serif;color:var(--mute)}
nav.top{max-width:720px;margin:0 auto;padding:1rem 1.25rem 0}
nav.pager{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--rule)}
nav a{text-decoration:none}
footer{font:13px/1.5 system-ui,sans-serif;color:var(--mute);text-align:center;padding:2rem 1rem 3rem}
.toc{list-style:none;padding:0;font:17px/1.5 system-ui,sans-serif}
.toc li{display:flex;justify-content:space-between;padding:.7rem 0;border-bottom:1px solid var(--rule)}
.sub{text-align:center;color:var(--mute);font-style:italic}
`;

function page({ lang, dir, title, body, rel }) {
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;700&display=swap">
<style>${css}</style></head><body dir="${dir}">${body}<footer>${FOOTER}</footer></body></html>`;
}

marked.use({ breaks: true });   // keep screenplay line breaks (cue / parenthetical / dialogue)

async function renderMd(md) {
  const refs = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map(m => m[1]);
  let html = marked.parse(md.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, a, r) => `![${a}](IMG:${encodeURIComponent(r)})`));
  for (const r of new Set(refs)) {
    const uri = await dataUri(r);
    html = html.split(`IMG:${encodeURIComponent(r).replace(/[()]/g, c => encodeURIComponent(c))}`).join(uri)
               .split(`IMG:${encodeURIComponent(r)}`).join(uri);
  }
  return html.replace(/alt="alt text"/g, 'alt=""');
}

fs.rmSync(PLAIN, { recursive: true, force: true });
for (const code of Object.keys(LANGS)) {
  const L = LANGS[code];
  fs.mkdirSync(path.join(PLAIN, code), { recursive: true });
  for (const n of PARTS) {
    const md = fs.readFileSync(path.join(ROOT, L.dir, L.file(n)), 'utf8');
    const content = await renderMd(md);
    const prev = n > 1 ? `<a href="part-${n - 1}.html">${L.prev}</a>` : '<span></span>';
    const next = n < 8 ? `<a href="part-${n + 1}.html">${L.next}</a>` : '<span></span>';
    const body = `<nav class="top"><a href="../index.html">${L.title} · ${L.contents}</a><a href="../${L.other}/part-${n}.html" lang="${L.other}">${L.otherLabel}</a></nav>
<main>${content}<nav class="pager">${prev}${next}</nav></main>`;
    fs.writeFileSync(path.join(PLAIN, code, `part-${n}.html`), page({ lang: code, dir: L.html, title: `${L.title} — ${L.part(n)}`, body }));
    console.log(`built ${code}/part-${n}.html`);
  }
}
// contents page
const toc = PARTS.map(n => `<li><a href="en/part-${n}.html">Part ${n}</a><a href="fa/part-${n}.html" lang="fa" dir="rtl">${LANGS.fa.part(n)}</a></li>`).join('');
fs.writeFileSync(path.join(PLAIN, 'index.html'), page({ lang: 'en', dir: 'ltr', title: 'Melchizedek',
  body: `<main><h1>MELCHIZEDEK</h1><p class="sub" lang="fa" dir="rtl">ملکی‌صدق</p><p class="sub">A film. Approx. 90 minutes.</p><ul class="toc">${toc}</ul></main>` }));

// ---- encrypt everything with one password + one salt (one login unlocks all pages) ----
fs.rmSync(OUT, { recursive: true, force: true });
execFileSync(path.join(import.meta.dirname, 'node_modules/.bin/staticrypt'), [
  PLAIN, '-r', '-d', OUT, '--short', '--remember', '30',
  '--config', '.staticrypt.json',
  '--template-title', 'Melchizedek',
  '--template-instructions', 'Private reading draft. Please enter your password.',
  '--template-button', 'Open',
  '--template-color-primary', '#2f6f68', '--template-color-secondary', '#f7f4ee',
], { cwd: import.meta.dirname, env: { ...process.env, STATICRYPT_PASSWORD: PW }, stdio: 'inherit' });
// staticrypt -r -d puts files under OUT/<basename of PLAIN>/ in some versions; flatten if so
const nested = path.join(OUT, path.basename(PLAIN));
if (fs.existsSync(nested)) { for (const f of fs.readdirSync(nested)) fs.renameSync(path.join(nested, f), path.join(OUT, f)); fs.rmdirSync(nested); }
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('\nEncrypted site written to', OUT);

// Melchizedek private reading site — build script.
// Reads ../english, ../farsi, ../chinese, ../media (never committed), writes an
// AES-encrypted static site to ../docs (the only thing that is pushed).
//
//   cd tools && STATICRYPT_PASSWORD='your long password' node build.mjs
//   (or put STATICRYPT_PASSWORD=... in tools/.env, which is gitignored)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { marked } from 'marked';
import sharp from 'sharp';
import subsetFont from 'subset-font';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = process.env.OUT_DIR ? path.resolve(process.env.OUT_DIR) : path.join(ROOT, 'docs');
const PLAIN = process.env.PLAIN_DIR ? path.resolve(process.env.PLAIN_DIR) : path.join(ROOT, 'build', 'plain');      // readable, gitignored
const IMGCACHE = path.join(ROOT, 'build', 'img');     // compressed images, gitignored
const IMG_WIDTH = 1400, IMG_QUALITY = 76;

// ---- passwords: one per part (PART1_PASSWORD ... PART8_PASSWORD) ----
const envFile = path.join(import.meta.dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const l of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*['"]?(.*?)['"]?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const PASSWORDS = {};
const problems = [];
for (let n = 1; n <= 8; n++) {
  const pw = process.env[`PART${n}_PASSWORD`] || '';
  if (pw.length < 14 || /[^\x21-\x7e]/.test(pw)) problems.push(`PART${n}_PASSWORD`);
  PASSWORDS[n] = pw;
}
if (problems.length) {
  console.error('Missing or too weak in tools/.env: ' + problems.join(', '));
  console.error('Each needs at least 14 characters, Latin letters/digits/symbols only, no spaces.');
  process.exit(1);
}
if (new Set(Object.values(PASSWORDS)).size < 8) console.warn('Note: some parts share the same password.');

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
const ZH_NUM = '一二三四五六七八';
const LANGS = {
  en: { dir: 'english', file: n => `part-${n}.md`, html: 'ltr', label: 'English',
        title: 'MELCHIZEDEK', part: n => `Part ${n}`, prev: '← Previous', next: 'Next →', contents: 'Contents' },
  fa: { dir: 'farsi', file: n => `part-${n}-fa.md`, html: 'rtl', label: 'فارسی',
        title: 'سایه‌ی سبز', part: n => `بخش ${'۱۲۳۴۵۶۷۸'[n - 1]}`, prev: 'قبلی →', next: '← بعدی', contents: 'فهرست' },
  // Chinese is optional per part: a part with no chinese/part-N-zh.md yet is skipped,
  // and Chinese links to it fall back to the English page.
  zh: { dir: 'chinese', file: n => `part-${n}-zh.md`, html: 'ltr', label: '中文', optional: true,
        title: '绿影', part: n => `第${ZH_NUM[n - 1]}部分`, prev: '← 上一部分', next: '下一部分 →',
        prevEn: '← 上一部分（英文）', nextEn: '下一部分（英文）→', contents: '目录' },
};
const has = (code, n) => fs.existsSync(path.join(ROOT, LANGS[code].dir, LANGS[code].file(n)));
// wording on each language's password page
const LOCK = {
  en: { title: n => `Melchizedek — Part ${n}`, text: n => `Enter the password for Part ${n}.`, button: 'Open' },
  fa: { title: n => `Melchizedek — ${LANGS.fa.part(n)}`, text: () => 'رمز این بخش را وارد کنید.', button: 'باز کن' },
  zh: { title: n => `Melchizedek — ${LANGS.zh.part(n)}`, text: () => '请输入本部分的密码。', button: '打开' },
};
const YEAR = new Date().getFullYear();
const FOOTER = `© ${YEAR} Alireza Khakpour. All Rights Reserved. Unpublished screenplay — do not copy, share or distribute.`;

// ---- embedded fonts (no Google Fonts request; works offline and privately) ----
function face(pkg, file, family, weight, style = 'normal', range = '') {
  const f = path.join(import.meta.dirname, 'node_modules/@fontsource', pkg, 'files', file);
  return `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};font-display:swap;${range ? 'unicode-range:' + range + ';' : ''}src:url(data:font/woff2;base64,${fs.readFileSync(f).toString('base64')}) format('woff2')}`;
}
const AR_RANGE = 'U+0600-06FF,U+0750-077F,U+0870-088E,U+0890-0891,U+0897-08E1,U+08E3-08FF,U+200C-200E,U+2010-2011,U+204F,U+2E41,U+FB50-FDFF,U+FE70-FE74,U+FE76-FEFC';
const LAT_RANGE = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-200B,U+2012-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
// Farsi: Noto Naskh Arabic (Persian letters only). Latin/digits inside Farsi pages fall back to the serif stack.
const FA_FONTS = ['400', '600'].map(w => face('noto-naskh-arabic', `noto-naskh-arabic-arabic-${w}-normal.woff2`, 'Noto Naskh Arabic', w, 'normal', AR_RANGE)).join('');
const EN_FONTS = [['300', 'normal'], ['500', 'normal'], ['400', 'italic']]
  .map(([w, st]) => face('cormorant-garamond', `cormorant-garamond-latin-${w}-${st}.woff2`, 'Cormorant Garamond', w, st)).join('');
// Chinese: Noto Serif SC. The full font is ~10 MB per weight, so each page embeds a subset
// holding only the characters that page actually uses (a few hundred KB).
const ZH_PKG = path.join(import.meta.dirname, 'node_modules/@fontsource/noto-serif-sc');
const zhSliceCache = {};
function zhSlices(weight) {
  if (zhSliceCache[weight]) return zhSliceCache[weight];
  const list = [];
  for (const m of fs.readFileSync(path.join(ZH_PKG, `${weight}.css`), 'utf8').matchAll(/@font-face\s*{([^}]*)}/g)) {
    const file = m[1].match(/url\(\.\/files\/([^)]+\.woff2)\)/)?.[1];
    const range = m[1].match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!file || !range) continue;
    const ranges = range.split(',').map(r => r.trim().replace(/^U\+/i, '').split('-').map(h => parseInt(h, 16)))
      .map(([a, b]) => [a, b ?? a]);
    list.push({ file, ranges, cjk: /-\d+-\d+-normal\.woff2$/.test(file) });
  }
  list.sort((x, y) => y.cjk - x.cjk);   // CJK slices first; latin etc. only for what they don't cover
  return (zhSliceCache[weight] = list);
}
function unicodeRange(cps) {
  const s = [...cps].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) {
    let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    out.push(i === j ? `U+${s[i].toString(16)}` : `U+${s[i].toString(16)}-${s[j].toString(16)}`); i = j;
  }
  return out.join(',');
}
async function zhFonts(text, weight) {
  const groups = new Map();
  for (const cp of new Set([...text].map(c => c.codePointAt(0)))) {
    if (cp <= 32) continue;
    const slice = zhSlices(weight).find(sl => sl.ranges.some(([a, b]) => cp >= a && cp <= b));
    if (!slice) continue;   // e.g. Persian letters: left to the fallback fonts
    if (!groups.has(slice)) groups.set(slice, []);
    groups.get(slice).push(cp);
  }
  let out = '';
  for (const [slice, cps] of groups) {
    const buf = await subsetFont(fs.readFileSync(path.join(ZH_PKG, 'files', slice.file)), String.fromCodePoint(...cps), { targetFormat: 'woff2' });
    out += `@font-face{font-family:'Noto Serif SC';font-style:normal;font-weight:${weight};font-display:swap;unicode-range:${unicodeRange(cps)};src:url(data:font/woff2;base64,${Buffer.from(buf).toString('base64')}) format('woff2')}`;
  }
  return out;
}
const textOf = html => html.replace(/<[^>]*>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ');
const boldOf = html => [...html.matchAll(/<(strong|h[1-3])[^>]*>([\s\S]*?)<\/\1>/g)].map(m => textOf(m[2])).join('');

const css = `
:root{--bg:#f7f4ee;--fg:#1d1b18;--mute:#6f6a62;--rule:#d9d2c5;--accent:#2f6f68}
@media (prefers-color-scheme:dark){:root{--bg:#141312;--fg:#e9e4da;--mute:#9b958b;--rule:#34312c;--accent:#6fb5ac}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 Georgia,'Iowan Old Style',serif}
[dir=rtl] body,body[dir=rtl]{font-family:'Noto Naskh Arabic',Georgia,serif;font-size:19px;line-height:2.05}
html[lang=zh] body{font-family:'Noto Serif SC','Songti SC','STSong',serif;font-size:18px;line-height:1.95;letter-spacing:.02em}
html[lang=zh] strong,html[lang=zh] h1,html[lang=zh] h2,html[lang=zh] h3{font-weight:600}
html[lang=zh] h1{letter-spacing:.3em;padding-left:.3em}
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

function page({ lang, dir, title, body, fonts = '' }) {
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${title}</title>
<style>${lang === 'fa' ? FA_FONTS : ''}${fonts}${css}</style></head><body dir="${dir}">${body}<footer>${FOOTER}</footer></body></html>`;
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
const BUILT = {};   // language -> part numbers that have a page
for (const code of Object.keys(LANGS)) {
  const L = LANGS[code];
  BUILT[code] = [];
  fs.mkdirSync(path.join(PLAIN, code), { recursive: true });
  for (const n of PARTS) {
    if (L.optional && !has(code, n)) continue;
    let md = fs.readFileSync(path.join(ROOT, L.dir, L.file(n)), 'utf8');
    if (code === 'fa') md = md.replace(/^#\s+ملکی‌صدق\s*$/m, '# سایه‌ی سبز');
    const content = await renderMd(md);
    // prev/next stay in this language; an optional language falls back to English where a part is missing
    const link = (m, label, labelEn) => (!L.optional || has(code, m))
      ? `<a href="part-${m}.html">${label}</a>` : `<a href="../en/part-${m}.html">${labelEn}</a>`;
    const prev = n > 1 ? link(n - 1, L.prev, L.prevEn) : '<span></span>';
    const next = n < 8 ? link(n + 1, L.next, L.nextEn) : '<span></span>';
    const others = Object.keys(LANGS).filter(c => c !== code && (!LANGS[c].optional || has(c, n)))
      .map(c => `<a href="../${c}/part-${n}.html" lang="${c}">${LANGS[c].label}</a>`).join(' · ');
    const body = `<nav class="top"><a href="../index.html">${L.title} · ${L.contents}</a><span>${others}</span></nav>
<main>${content}<nav class="pager">${prev}${next}</nav></main>`;
    const fonts = code === 'zh' ? (await zhFonts(textOf(body) + L.title + L.part(n), 400)) + (await zhFonts(boldOf(content), 600)) : '';
    fs.writeFileSync(path.join(PLAIN, code, `part-${n}.html`), page({ lang: code, dir: L.html, title: `${L.title} — ${L.part(n)}`, body, fonts }));
    BUILT[code].push(n);
    console.log(`built ${code}/part-${n}.html`);
  }
}
// ---- dashboard (open, no password): title, author, carousel of parts ----
// Cover image per part (file name from media/). Missing → painted gradient card.
// NOTE: the dashboard is public, so these covers are visible without a password.
const COVERS = {
  1: 'Woman in a Golden Hotel Corridor.png',
  2: 'Rainy London Departure.png',
  3: 'Foggy Cable Car Over San Francisco.png',
  4: 'Footprints Toward Distant Sea Stacks.png',
  5: 'Rainy Solitude at the Grand Steps.png',
  6: null, 7: null, 8: null,
};
const PAINT = { 6: ['#c89a5a', '#5b3a1e'], 7: ['#3c4d7a', '#120f24'], 8: ['#1fa5a0', '#05303a'] };
// Weekly release: Part 1 on Sat 7 Nov 2026, then every 7 days, at midnight US Central time.
const FIRST_RELEASE = '2026-11-07T00:00:00-06:00';
// Parts whose card is clickable before their release date (the date still shows; the password still applies).
const EARLY_OPEN = [1];
const RELEASE = n => new Date(Date.parse(FIRST_RELEASE) + (n - 1) * 7 * 864e5).toISOString();
const AUTHOR = { en: 'Alireza Khakpour', fa: 'علیرضا خاکپور' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const FA_ORD = ['یکم', 'دوم', 'سوم', 'چهارم', 'پنجم', 'ششم', 'هفتم', 'هشتم'];
async function coverUri(name) {
  const src = imgIndex.get(name.normalize('NFC'));
  if (!src) throw new Error('Cover not found: ' + name);
  const buf = await sharp(src).resize({ width: 900, height: 1200, fit: 'cover', position: 'attention' }).webp({ quality: 72 }).toBuffer();
  return 'data:image/webp;base64,' + buf.toString('base64');
}
const cards = [];
for (const n of PARTS) {
  const bg = COVERS[n]
    ? `background-image:url(${await coverUri(COVERS[n])})`
    : `background:radial-gradient(120% 90% at 30% 20%, ${PAINT[n][0]}, transparent 60%), radial-gradient(90% 80% at 80% 90%, ${PAINT[n][1]}, #050605)`;
  cards.push(`<a class="card" data-n="${n}" data-release="${RELEASE(n)}"${EARLY_OPEN.includes(n) ? ' data-early="1"' : ''}${BUILT.zh.includes(n) ? ' data-zh-ok="1"' : ''} href="en/part-${n}.html" style="${bg}" aria-label="Part ${n}">
  <span class="shade"></span>
  <span class="num">${ROMAN[n - 1]}</span>
  <span class="soon"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg><em></em></span>
  <span class="lbl" data-en="Part ${ROMAN[n - 1]}" data-fa="بخش ${FA_ORD[n - 1]}" data-zh="${LANGS.zh.part(n)}">Part ${ROMAN[n - 1]}</span>
</a>`);
}
const dashCss = `
*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#060807;color:#ece6da;font-family:'Cormorant Garamond',Georgia,serif;overflow-x:hidden;-webkit-font-smoothing:antialiased}
.sky{position:fixed;inset:-20%;z-index:0;pointer-events:none;
 background:radial-gradient(40% 35% at 25% 30%,rgba(31,165,140,.28),transparent 70%),
            radial-gradient(35% 30% at 75% 20%,rgba(214,178,110,.16),transparent 70%),
            radial-gradient(50% 45% at 60% 85%,rgba(18,90,96,.30),transparent 70%);
 filter:blur(20px);animation:drift 28s ease-in-out infinite alternate}
@keyframes drift{0%{transform:translate3d(0,0,0) rotate(0)}100%{transform:translate3d(4%,-3%,0) rotate(6deg)}}
.grain{position:fixed;inset:0;z-index:1;pointer-events:none;opacity:.10;mix-blend-mode:overlay;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.wrap{position:relative;z-index:2;min-height:100%;display:flex;flex-direction:column;justify-content:center;padding:6vh 0 4vh}
header{text-align:center;padding:0 1.5rem;margin-bottom:5.5vh}
.ring{width:54px;height:54px;margin:0 auto 2.2rem;border-radius:50%;
 border:1.5px solid rgba(64,196,170,.75);box-shadow:0 0 28px rgba(64,196,170,.35),inset 0 0 14px rgba(64,196,170,.25);
 animation:breathe 6s ease-in-out infinite}
@keyframes breathe{50%{box-shadow:0 0 46px rgba(64,196,170,.55),inset 0 0 20px rgba(64,196,170,.35)}}
h1{font-weight:300;font-size:clamp(2.4rem,8.5vw,5.6rem);letter-spacing:.32em;margin-right:-.32em;line-height:1.05;
 background:linear-gradient(180deg,#fbf6ea 30%,#b9ab8f);-webkit-background-clip:text;background-clip:text;color:transparent;
 animation:rise 1.8s cubic-bezier(.2,.7,.2,1) both}
.fa{font-family:'Noto Naskh Arabic',Georgia,serif;font-weight:400;font-size:clamp(1.5rem,4vw,2.1rem);color:#9fd8c9;margin-top:.9rem;
 animation:rise 1.8s .25s cubic-bezier(.2,.7,.2,1) both}
.zh{font-family:'Noto Serif SC',serif;font-weight:400;font-size:clamp(1.05rem,2.6vw,1.4rem);letter-spacing:.6em;padding-left:.6em;color:#9fd8c9;opacity:.8;margin-top:.55rem;
 animation:rise 1.8s .35s cubic-bezier(.2,.7,.2,1) both}
.by{margin-top:2.2rem;font-style:italic;font-size:1.15rem;letter-spacing:.06em;color:#b7ad9b;animation:rise 1.8s .5s cubic-bezier(.2,.7,.2,1) both}
.by b{font-style:normal;font-weight:500;letter-spacing:.18em;text-transform:uppercase;font-size:.95rem;color:#e8dfcd;margin-left:.35em}
@keyframes rise{from{opacity:0;transform:translateY(14px);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
.rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;
 padding:8px max(24px,calc(50vw - 170px));animation:rise 1.8s .8s cubic-bezier(.2,.7,.2,1) both}
.rail::-webkit-scrollbar{display:none}
.card{--k:0;position:relative;flex:0 0 340px;height:min(56vh,460px);border-radius:28px;scroll-snap-align:center;
 background-size:cover;background-position:center;text-decoration:none;color:#fff;overflow:hidden;
 clip-path:inset(0 var(--r,0%) 0 var(--l,0%) round 28px);
 filter:saturate(calc(1 - var(--k) * .6)) brightness(calc(1 - var(--k) * .45))}
.card:focus-visible{outline:2px solid #40c4aa;outline-offset:4px}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 45%,rgba(0,0,0,.72))}
.num{position:absolute;left:var(--l,0%);right:var(--r,0%);top:50%;transform:translateY(-50%);text-align:center;
 font-weight:300;font-size:5.2rem;letter-spacing:.06em;color:rgba(255,255,255,.88);text-shadow:0 2px 30px rgba(0,0,0,.5)}
.lbl{position:absolute;left:calc(var(--l,0%) + 24px);bottom:22px;font-size:.95rem;letter-spacing:.28em;text-transform:uppercase;opacity:calc(1 - var(--k) * 1.6)}
html[lang=fa] .lbl{font-family:'Noto Naskh Arabic',Georgia,serif;letter-spacing:0;text-transform:none;left:auto;right:calc(var(--r,0%) + 24px);font-size:1.1rem}
html[lang=zh] .lbl{font-family:'Noto Serif SC',serif;letter-spacing:.24em;text-transform:none;font-size:1rem}
.controls{display:flex;align-items:center;justify-content:center;gap:1.5rem;margin-top:3.5vh;font-family:system-ui,sans-serif;animation:rise 1.8s 1s cubic-bezier(.2,.7,.2,1) both}
.dots{display:flex;gap:8px}
.dots i{width:6px;height:6px;border-radius:3px;background:rgba(236,230,218,.25);transition:all .3s}
.dots i.on{width:22px;background:#40c4aa}
.arrow{background:none;border:1px solid rgba(236,230,218,.25);color:#ece6da;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:1rem}
.arrow:hover{border-color:#40c4aa}
.lang{display:flex;border:1px solid rgba(236,230,218,.25);border-radius:999px;overflow:hidden}
.lang button{background:none;border:0;color:#b7ad9b;padding:.45rem .95rem;font:500 .85rem system-ui,sans-serif;cursor:pointer}
.lang button[aria-pressed=true]{background:#ece6da;color:#0b0d0c}
.lang button[data-l=fa]{font-family:'Noto Naskh Arabic',Georgia,serif;font-size:.95rem;padding-block:.35rem}
.lang button[data-l=zh]{font-family:'Noto Serif SC',serif;font-size:.9rem;letter-spacing:.08em}
footer{position:relative;z-index:2;text-align:center;font:12px/1.5 system-ui,sans-serif;color:#6f685d;padding:2rem 1rem 2.5rem;letter-spacing:.03em}
@media (max-width:520px){h1{font-size:9.4vw;letter-spacing:.16em;margin-right:-.16em}.ring{margin-bottom:1.6rem}header{margin-bottom:4vh}.by{margin-top:1.6rem;font-size:1rem}.card{flex-basis:74vw;height:58vh}.rail{padding-inline:13vw}.arrow{display:none}.controls{gap:1rem}}
.soon{display:none;position:absolute;left:var(--l,0%);right:var(--r,0%);top:calc(50% + 3.6rem);flex-direction:column;align-items:center;gap:.4rem;color:#e8dfcd;font-size:1.05rem;letter-spacing:.14em;text-transform:uppercase;opacity:calc(1 - var(--k) * .5)}
.soon em{font-style:normal}
html[lang=fa] .soon{font-family:'Noto Naskh Arabic',Georgia,serif;letter-spacing:0;text-transform:none;font-size:1.1rem}
html[lang=zh] .soon{font-family:'Noto Serif SC',serif;letter-spacing:.12em;text-transform:none;font-size:1.05rem}
.card.locked{cursor:default;filter:saturate(calc(.35 - var(--k) * .3)) brightness(calc(.62 - var(--k) * .3))}
.card.locked .soon{display:flex}
.card.locked .num{color:rgba(255,255,255,.6)}
.card.locked .soon{color:#f3ead8;text-shadow:0 1px 12px rgba(0,0,0,.8)}
.card.early .soon{display:flex;color:#f3ead8;text-shadow:0 1px 12px rgba(0,0,0,.8)}
.card.early .soon svg{display:none}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
`;
const dashJs = `
const rail=document.querySelector('.rail'),cards=[...rail.children],dots=document.querySelector('.dots');
cards.forEach(()=>dots.appendChild(document.createElement('i')));
function tick(){const c=rail.scrollLeft+rail.clientWidth/2;let best=0,bd=1e9;
 const info=cards.map((el,i)=>{const m=el.offsetLeft+el.offsetWidth/2,d=Math.abs(m-c);if(d<bd){bd=d;best=i}
  const k=Math.min(1,d/(el.offsetWidth*1.4));return {el,m,k,cutPx:k*.42*el.offsetWidth}});
 let sr=0,sl=0;
 for(let i=best;i<info.length;i++){const o=info[i];if(o.m<=c&&i===best){o.shift=0;continue}o.shift=-sr;sr+=o.cutPx}
 for(let i=best;i>=0;i--){const o=info[i];if(i===best&&o.m>c){o.shift=0;continue}if(i===best){o.shift=0;sl+=o.cutPx;continue}o.shift=sl;sl+=o.cutPx}
 info.forEach((o,i)=>{const cut=(o.k*42).toFixed(1)+'%';o.el.style.setProperty('--k',o.k.toFixed(3));
  o.el.style.setProperty('--l',o.m<c?cut:'0%');o.el.style.setProperty('--r',o.m>c?cut:'0%');
  o.el.style.transform='translateX('+(o.shift||0).toFixed(1)+'px)'});
 [...dots.children].forEach((d,i)=>d.classList.toggle('on',i===best));return best}
rail.addEventListener('scroll',()=>requestAnimationFrame(tick),{passive:true});addEventListener('resize',tick);
function go(i){const el=cards[Math.max(0,Math.min(cards.length-1,i))];rail.scrollTo({left:el.offsetLeft-(rail.clientWidth-el.offsetWidth)/2,behavior:'smooth'})}
document.querySelector('.prev').onclick=()=>go(tick()-1);document.querySelector('.next').onclick=()=>go(tick()+1);
addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(tick()+1);if(e.key==='ArrowLeft')go(tick()-1)});
const preview=new URLSearchParams(location.search).has('all');
const fmt={en:new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'America/Chicago'}),
 fa:new Intl.DateTimeFormat('fa-IR-u-ca-persian',{month:'long',day:'numeric',timeZone:'America/Chicago'}),
 zh:new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric',timeZone:'America/Chicago'})};
const now=Date.now();let latest=0;
cards.forEach((a,i)=>{const t=Date.parse(a.dataset.release);const out=now>=t,early=a.dataset.early==='1';const open=preview||out||early;a.classList.toggle('locked',!open);a.classList.toggle('early',early&&!out&&!preview);if(open)latest=i;
 a.addEventListener('click',e=>{if(a.classList.contains('locked'))e.preventDefault()})});
let lang='en';try{lang=localStorage.getItem('mz_lang')||'en'}catch(e){}
function setLang(l){lang=l;document.documentElement.lang=l;
 cards.forEach(a=>{a.href=(l==='zh'&&!a.dataset.zhOk?'en':l)+'/part-'+a.dataset.n+'.html';const s=a.querySelector('.lbl');s.textContent=s.dataset[l];
  const d=fmt[l].format(new Date(a.dataset.release));a.querySelector('.soon em').textContent=d;
  if(a.classList.contains('locked'))a.setAttribute('aria-label',({fa:'به‌زودی ',zh:'即将推出 '}[l]||'Coming ')+d)});
 document.querySelectorAll('.lang button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.l===l));
 try{localStorage.setItem('mz_lang',l)}catch(e){}}
document.querySelectorAll('.lang button').forEach(b=>b.onclick=()=>setLang(b.dataset.l));
setLang(lang);requestAnimationFrame(()=>{const el=cards[latest];rail.scrollLeft=el.offsetLeft-(rail.clientWidth-el.offsetWidth)/2;tick()});
`;
const ZH_DASH_FONTS = await zhFonts(LANGS.zh.title + LANGS.zh.label + PARTS.map(LANGS.zh.part).join('') + '0123456789月日', 400);
fs.writeFileSync(path.join(PLAIN, 'index.html'), `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>Melchizedek · ${LANGS.fa.title} · ${LANGS.zh.title}</title><meta name="theme-color" content="#060807">
<style>${EN_FONTS}${FA_FONTS}${ZH_DASH_FONTS}${dashCss}</style></head><body>
<div class="sky"></div><div class="grain"></div>
<div class="wrap">
<header><div class="ring"></div><h1>MELCHIZEDEK</h1><div class="fa" lang="fa" dir="rtl">${LANGS.fa.title}</div><div class="zh" lang="zh">${LANGS.zh.title}</div>
<p class="by">written by<b>${AUTHOR.en}</b></p></header>
<nav class="rail" aria-label="Parts">${cards.join('')}</nav>
<div class="controls"><button class="arrow prev" aria-label="Previous">←</button><div class="dots"></div>
<div class="lang" role="group" aria-label="Language"><button data-l="en">English</button><button data-l="fa">فارسی</button><button data-l="zh">中文</button></div>
<button class="arrow next" aria-label="Next">→</button></div>
</div><footer>${FOOTER}</footer><script>${dashJs}</script></body></html>`);

// ---- encrypt: each part (every language it exists in) with its own password; contents page stays open ----
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(path.join(PLAIN, 'index.html'), path.join(OUT, 'index.html'));   // titles only, no story
const bin = path.join(import.meta.dirname, 'node_modules/.bin/staticrypt');
for (const n of PARTS) {
  const codes = Object.keys(LANGS).filter(c => BUILT[c].includes(n));
  for (const code of codes) {
    const outDir = path.join(OUT, code);
    execFileSync(bin, [path.join(PLAIN, code, `part-${n}.html`), '-d', outDir, '--short', '--remember', '30',
      '--config', '.staticrypt.json',
      '--template-title', LOCK[code].title(n),
      '--template-instructions', LOCK[code].text(n),
      '--template-button', LOCK[code].button,
      '--template-color-primary', '#2f6f68', '--template-color-secondary', '#f7f4ee',
    ], { cwd: import.meta.dirname, env: { ...process.env, STATICRYPT_PASSWORD: PASSWORDS[n] }, stdio: 'pipe' });
    // give each part its own "Remember me" slot so parts don't log each other out
    const f = path.join(outDir, `part-${n}.html`);
    const html = fs.readFileSync(f, 'utf8')
      .replace('"staticrypt_expiration"', `"melchizedek_exp_part${n}"`)
      .replace('"staticrypt_passphrase"', `"melchizedek_pw_part${n}"`);
    if (!html.includes(`melchizedek_pw_part${n}`)) throw new Error('Could not set remember key for ' + f);
    fs.writeFileSync(f, html);
  }
  console.log(`encrypted part ${n} (${codes.join(' + ')})`);
}
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('\nEncrypted site written to', OUT);

// 每頁獨有內容（src/data/unique/**/*.json）的守門。
//
// 為什麼有這支（2026-10-03）：收錄從 66/66 掉到 28/66，判定是頁面高度模板化，
// 於是每頁補「只有這一頁才有」的內容。這些內容有法律後果，又是多個 agent 並行填，
// 所以欄位、字數、出處格式、AI 腔、簡體字都要能**單檔、不 build** 就驗完。
//
// 用法：
//   node scripts/check-unique.mjs                         # 掃全部（build 走這條）
//   node scripts/check-unique.mjs src/data/unique/cases/road-repair.json   # 只驗指定檔
//   node scripts/check-unique.mjs --online <檔...>        # 另外實際打開每一條法條／出處連結：
//                                                          #   法條頁要有該法名稱與條號、quote 要逐字出現在條文裡，
//                                                          #   條號落在「尚未施行」的修正裡會警告
//
// 檔名對應網址：unique/cases/<slug>.json → /cases/<slug>/；unique/home.json → /；
// unique/cases.json → /cases/。對不到現有頁面的檔名直接擋（多半是 slug 打錯，頁面不會出現它）。
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { ERROR_TELLS, WARN_LAYERS, BANNED_OPENINGS, ALLOW } from './lib/ai-tone.mjs';
import { CASES } from '../src/data/cases.js';
import { CITIZEN_EXAMPLES } from '../src/data/citizen-examples.js';
import { PRIVATE_DOCS } from '../src/data/private-docs.js';

const ROOT = 'src/data/unique';
const MAP = JSON.parse(readFileSync('src/data/simplified-chars.json', 'utf8')).map;
const args = process.argv.slice(2);
const ONLINE = args.includes('--online');
const walk = (dir) =>
  existsSync(dir)
    ? readdirSync(dir).flatMap((n) => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : [];
      })
    : [];
const files = args.filter((a) => !a.startsWith('--'));
const targets = files.length ? files : walk(ROOT);

// ── 現有頁面（不 build，從 src/pages 與資料檔推） ──
const DYNAMIC = {
  cases: CASES.map((c) => c.slug),
  citizens: CITIZEN_EXAMPLES.map((c) => c.slug),
  'private-documents': PRIVATE_DOCS.map((d) => d.slug),
};
const routes = new Set();
for (const f of walk('src/pages').concat(
  readdirSync('src/pages', { recursive: true })
    .map((p) => join('src/pages', String(p)))
    .filter((p) => p.endsWith('.astro')),
)) {
  if (!f.endsWith('.astro')) continue;
  const rel = relative('src/pages', f).split(sep).join('/').replace(/\.astro$/, '');
  if (rel === '404') continue;
  if (rel.endsWith('[slug]')) {
    const dir = rel.replace(/\/?\[slug\]$/, '');
    for (const s of DYNAMIC[dir] ?? []) routes.add(`/${dir}/${s}/`);
  } else {
    const r = rel.replace(/(^|\/)index$/, '');
    routes.add(r ? `/${r}/` : '/');
  }
}
const keyToRoute = (key) => (key === 'home' ? '/' : `/${key}/`);

// ── 欄位規格（字數＝去掉空白後的字元數） ──
const len = (s) => String(s ?? '').replace(/\s+/g, '').length;
const SPEC = {
  scenario: { min: 1, max: 3, total: [100, 400], each: [40, 220] },
  structure: { min: 3, max: 8, fields: { part: [2, 20, true], explain: [25, 150, true] } },
  mistakes: { min: 2, max: 5, fields: { wrong: [8, 100, true], fix: [8, 120, true], why: [15, 160, false] } },
  compare: { min: 1, max: 3, fields: { with: [2, 30, true], diff: [30, 180, true], href: [1, 120, false] } },
  legal: {
    min: 1, max: 6,
    fields: { law: [2, 30, true], article: [3, 20, false], url: [10, 200, true], point: [20, 160, true], quote: [5, 200, false] },
  },
  sources: { min: 1, max: 4, fields: { title: [4, 60, true], publisher: [2, 30, true], url: [10, 300, true], point: [15, 160, false] } },
  faq: { min: 1, max: 4, fields: { q: [6, 50, true], a: [40, 220, true] } },
};
const HEADING_KEYS = new Set(['scenario', 'structure', 'mistakes', 'compare', 'legal', 'faq']);
const LAW_URL = /^https:\/\/law\.moj\.gov\.tw\/LawClass\/(LawSingle|LawAll)\.aspx\?pcode=[A-Z]\d{7}(&flno=(\d+(-\d+)?))?$/;
const GOV_URL = /^https:\/\/([a-z0-9-]+\.)+gov\.tw(\/|$)/i;
const CASE_NO = /\d{2,3}\s*年度\s*[一-鿿]{1,6}字第\s*\d+\s*號/g;

const flnoOf = (article) => {
  const m = String(article).match(/第\s*(\d+)\s*條(?:之\s*(\d+))?/) || String(article).match(/(\d+)(?:-(\d+))?/);
  return m ? (m[2] ? `${m[1]}-${m[2]}` : m[1]) : null;
};

const curl = (url, minLen = 2000) => {
  // 任何非 200 或內容過短都重試：全國法規資料庫連續請求會回短頁，行政院網站偶爾回 302 挑戰頁。
  let last = { code: 0, body: '' };
  for (let i = 0; i < 4; i += 1) {
    try {
      const out = execFileSync('curl', ['-s', '-4', '-L', '--max-time', '40', '-A', 'Mozilla/5.0', '-w', '\n%{http_code}', url], {
        encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
      });
      const code = Number(out.slice(out.lastIndexOf('\n') + 1));
      const body = out.slice(0, out.lastIndexOf('\n'));
      last = { code, body };
      if (code === 200 && body.length >= minLen) {
        execFileSync('sleep', ['1.2']);
        return last;
      }
    } catch { /* 重試 */ }
    execFileSync('sleep', ['3']);
  }
  return last;
};
const plain = (h) =>
  h.replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
const squash = (s) => String(s).replace(/[\s　]/g, '');

let errors = 0;
let warns = 0;
for (const file of targets) {
  const errs = [];
  const warn = [];
  const key = relative(ROOT, file).split(sep).join('/').replace(/\.json$/, '');
  if (!routes.has(keyToRoute(key))) errs.push(`檔名對不到現有頁面：${keyToRoute(key)}（slug 打錯？）`);

  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`❌ ${file}\n   JSON 解析失敗：${e.message}`);
    errors += 1;
    continue;
  }

  const strings = [];   // [欄位路徑, 字串]
  for (const k of Object.keys(data)) {
    if (k.startsWith('_')) continue;
    if (k === 'headings') {
      for (const [hk, hv] of Object.entries(data.headings ?? {})) {
        if (!HEADING_KEYS.has(hk)) errs.push(`headings.${hk}：沒有這個區塊`);
        else if (len(hv) < 4 || len(hv) > 20) errs.push(`headings.${hk}：標題 4～20 字`);
        strings.push([`headings.${hk}`, hv]);
      }
      continue;
    }
    if (!SPEC[k]) { errs.push(`未知欄位「${k}」（可用：${Object.keys(SPEC).join('、')}、headings、_開頭的備註）`); continue; }
    const v = data[k];
    const spec = SPEC[k];
    if (!Array.isArray(v)) { errs.push(`${k} 要是陣列`); continue; }
    if (v.length === 0) continue;   // 空陣列＝不渲染，允許
    if (v.length < spec.min || v.length > spec.max) errs.push(`${k}：${spec.min}～${spec.max} 項，現在 ${v.length}`);
    if (k === 'scenario') {
      v.forEach((p, i) => {
        if (typeof p !== 'string') return errs.push(`scenario[${i}] 要是字串`);
        if (len(p) < spec.each[0] || len(p) > spec.each[1]) errs.push(`scenario[${i}]：每段 ${spec.each.join('～')} 字，現在 ${len(p)}`);
        strings.push([`scenario[${i}]`, p]);
      });
      const t = v.reduce((a, p) => a + len(p), 0);
      if (t < spec.total[0] || t > spec.total[1]) errs.push(`scenario：合計 ${spec.total.join('～')} 字，現在 ${t}`);
      continue;
    }
    v.forEach((item, i) => {
      if (!item || typeof item !== 'object') return errs.push(`${k}[${i}] 要是物件`);
      for (const f of Object.keys(item)) if (!spec.fields[f]) errs.push(`${k}[${i}].${f}：未知欄位`);
      for (const [f, [lo, hi, req]] of Object.entries(spec.fields)) {
        const val = item[f];
        if (val == null || val === '') { if (req) errs.push(`${k}[${i}].${f}：必填`); continue; }
        if (typeof val !== 'string') { errs.push(`${k}[${i}].${f}：要是字串`); continue; }
        if (f !== 'url' && f !== 'href' && (len(val) < lo || len(val) > hi)) errs.push(`${k}[${i}].${f}：${lo}～${hi} 字，現在 ${len(val)}`);
        if (f !== 'url' && f !== 'href') strings.push([`${k}[${i}].${f}`, val]);
      }
      if (k === 'compare' && item.href) {
        const path = item.href.split('#')[0];
        if (!item.href.startsWith('/')) errs.push(`compare[${i}].href：只收站內路徑（/ 開頭）`);
        else if (!routes.has(path)) errs.push(`compare[${i}].href：站內沒有 ${path}`);
      }
      if (k === 'legal' && item.url) {
        const m = item.url.match(LAW_URL);
        if (!m) errs.push(`legal[${i}].url：法條一律連全國法規資料庫 LawSingle（有條號）或 LawAll，例 https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=A0030055&flno=171`);
        else if (item.article) {
          if (m[1] !== 'LawSingle') errs.push(`legal[${i}].url：有寫條號就要連 LawSingle 單條頁`);
          else if (flnoOf(item.article) !== m[3]) errs.push(`legal[${i}]：article「${item.article}」與網址 flno=${m[3]} 對不上`);
        }
      }
      if (k === 'sources' && item.url && !GOV_URL.test(item.url)) {
        errs.push(`sources[${i}].url：只收政府網域（*.gov.tw，含司法院 judicial.gov.tw）`);
      }
    });
  }

  // ── 字串層：簡體字、Markdown、HTML、佔位、AI 腔、判決字號要有出處 ──
  const layers = new Set();
  const sourceText = JSON.stringify(data.sources ?? []);
  for (const [path, s] of strings) {
    for (const ch of String(s)) if (MAP[ch]) errs.push(`${path}：簡體字「${ch}」→ ${MAP[ch].join('／')}`);
    if (/\*\*/.test(s)) errs.push(`${path}：Markdown 記號（字串不會被算繪，畫面會直接看到 **）`);
    if (/<[a-z/][^>]*>/i.test(s)) errs.push(`${path}：不收 HTML 標籤，純文字就好`);
    if (/(TODO|TBD|待補|待查|XXX|○○○○)/.test(s)) errs.push(`${path}：還有佔位字`);
    for (const [name, re] of ERROR_TELLS) {
      const hit = String(s).match(new RegExp(re, 'g'));
      if (hit && !hit.every((h) => ALLOW.some((a) => a.test(h)))) errs.push(`${path}：AI 腔「${name}」：${hit[0]}`);
    }
    for (const [layer, tells] of Object.entries(WARN_LAYERS)) {
      for (const [, re] of tells) if (re.test(s)) layers.add(layer);
    }
    for (const no of String(s).match(CASE_NO) ?? []) {
      if (!/judicial\.gov\.tw/.test(sourceText)) {
        errs.push(`${path}：引用判決「${no}」，sources 裡要有司法院裁判書系統（judicial.gov.tw）的連結`);
      }
    }
  }
  const first = Array.isArray(data.scenario) ? data.scenario[0] : null;
  if (first && BANNED_OPENINGS.some((re) => re.test(first))) errs.push('scenario[0]：模板化開頭（我…／隨著…／近年來…）');
  if (layers.size >= 3) errs.push(`AI 腔軟訊號跨 ${layers.size} 層（${[...layers].join('、')}），改掉其中一層`);
  const dash = strings.reduce((a, [, s]) => a + (String(s).match(/——|—/g)?.length ?? 0), 0);
  if (dash > 2) warn.push(`破折號 ${dash} 個，少用（軟訊號）`);

  // 份量：細節頁補的獨有字數太少等於沒補
  const total = strings.reduce((a, [p, s]) => a + (p.startsWith('headings') ? 0 : len(s)), 0);
  if (key.includes('/') && total < 500) warn.push(`獨有字數 ${total}，細節頁建議 600～1500 字`);
  if (total > 2200) warn.push(`獨有字數 ${total}，超過 2200，留意是不是灌水`);

  // ── 線上驗證 ──
  if (ONLINE) {
    for (const [i, l] of (data.legal ?? []).entries()) {
      const m = String(l.url ?? '').match(LAW_URL);
      if (!m) continue;
      const { code, body } = curl(l.url);
      if (code !== 200 || !body) { errs.push(`legal[${i}]：打不開（HTTP ${code}）${l.url}`); continue; }
      const t = plain(body);
      const name = t.match(/法規名稱：\s*(\S+)/)?.[1];
      if (name !== l.law) errs.push(`legal[${i}]：網址是「${name}」，欄位寫「${l.law}」`);
      if (m[3]) {
        const head = `第 ${m[3]} 條`;
        const at = t.indexOf(head);
        if (at < 0) { errs.push(`legal[${i}]：頁面上找不到「${head}」`); continue; }
        const art = t.slice(at, t.indexOf(':::', at) > 0 ? t.indexOf(':::', at) : at + 3000);
        if (l.quote && !squash(art).includes(squash(l.quote))) {
          errs.push(`legal[${i}].quote：在條文裡找不到這段原文（要逐字，含標點）`);
        }
        const pending = t.match(/修正公布第\s*([\d\-、\s及]+)\s*條[^。]*?施行/g) ?? [];
        if (pending.some((p) => p.includes(m[3]))) {
          warn.push(`legal[${i}]：第 ${m[3]} 條有已公布未施行的修正，確認引用的是現行版本（見 scripts/fetch-laws.py 說明）`);
        }
      }
    }
    for (const [i, s] of (data.sources ?? []).entries()) {
      if (!GOV_URL.test(s.url ?? '')) continue;
      const { code } = curl(s.url, 1);
      if (code !== 200) errs.push(`sources[${i}]：打不開（HTTP ${code}）${s.url}`);
    }
  }

  if (errs.length) {
    errors += 1;
    console.error(`❌ ${file}`);
    for (const e of errs) console.error(`   ${e}`);
  }
  if (warn.length) {
    warns += 1;
    console.warn(`⚠️  ${file}`);
    for (const w of warn) console.warn(`   ${w}`);
  }
}

if (errors) {
  console.error(`\n獨有內容守門：${targets.length} 檔中 ${errors} 檔不合格。`);
  process.exit(1);
}
console.log(`獨有內容守門：${targets.length} 檔通過${ONLINE ? '（含線上出處驗證）' : ''}${warns ? `，${warns} 檔有提醒` : ''}。`);

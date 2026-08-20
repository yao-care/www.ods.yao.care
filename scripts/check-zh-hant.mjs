// 簡體字守門 —— 掛進 pnpm build，與 check-design / check-content 同框架。
//
// ⚠️ Unicode 沒有「繁體中文區間」：繁簡同住 CJK 統一漢字 U+4E00–U+9FFF
// （「該」U+8A72 與它的簡化形 U+8BE5 都在區間內），所以「檢查碼點落在哪個區間」抓不到簡體字。
// 唯一能用程式做的是逐字比對一份簡體專用碼點集合 —— 那份集合在 src/data/simplified-chars.json，
// 由 scripts/gen-simplified-set.py 從 OpenCC 字典與 Unicode Unihan 推導（判準見該檔說明）。
//
// 集合刻意放行兩類字，否則會在合法公文上狂誤報：
//   ・正體通用、同時是別字簡化形者（后里面台志表出合回同借…共 99 字）
//     —— 本站公文案例語料實測出現 250+ 次：符合、提出、書面、回覆、里長、借款、代表、一台。
//   ・異體選字（群羣／秘祕／峰峯／床牀）與台灣標準字（灶竈）—— 台標與舊字形之爭，非簡繁。
//
// 用法：
//   node scripts/check-zh-hant.mjs            # 掃 src/** 全部內容來源（build 走這條）
//   node scripts/check-zh-hant.mjs <檔...>    # 只掃指定檔
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const MAP = JSON.parse(readFileSync("src/data/simplified-chars.json", "utf8")).map;
const EXT = new Set([".astro", ".js", ".mjs", ".json", ".md", ".mdx", ".css"]);
const SKIP = new Set(["simplified-chars.json"]);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.has(extname(name)) && !SKIP.has(name)) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
const files = args.length ? args : walk("src");

let bad = 0;
let chars = 0;
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const hits = [];
  let line = 1;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") { line += 1; continue; }
    const trad = MAP[text[i]];
    if (trad) hits.push({ ch: text[i], line, i, trad });
  }
  if (!hits.length) continue;
  bad += 1;
  chars += hits.length;
  console.error(`\n❌ ${f}：${hits.length} 個簡體字`);
  const seen = new Set();
  for (const h of hits) {
    if (seen.has(h.ch)) continue;
    seen.add(h.ch);
    const cp = `U+${h.ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`;
    const ctx = text.slice(Math.max(0, h.i - 10), h.i + 11).replace(/\n/g, "⏎");
    console.error(`   ${h.ch}（${cp}）→ 應作 ${h.trad.join("／")}　第 ${h.line} 行：…${ctx}…`);
  }
}

if (bad) {
  console.error(`\n簡體字守門未通過：${bad} 個檔、${chars} 個字。公文與站上文字一律用正體。`);
  process.exit(1);
}
console.log(`簡體字守門通過：${files.length} 個檔，無簡體字。`);

// 頁面文案的去 AI 味守門 —— 在 astro build **之後**跑，掃 dist/**/*.html。
//
// 為什麼掃產物而不是原始碼（2026-08-27）：這個站的文案散在三種地方——
// `.astro` 的模板與 frontmatter、`src/data/*.js` 的 watchOut／lead、`src/data/*.json`。
// 掃 `.astro` 會漏掉後兩種（實測 citizen-examples.js 就有一句命中）。
// 掃 dist 才全涵蓋，而且那正是使用者看到的字。
//
// 🔴 這支存在的理由：check-content.mjs 只掃 `src/**/*.md(x)`，而本站 **0 個 .md**，
// 所以它從上線起掃了 0 個檔。每次 build 都印「無變動的 .md/.mdx 內容檔」，
// 看起來全綠，其實一句話都沒檢查過。**綠燈不等於檢查過，要驗的是它到底掃了什麼。**
//
// 判定沿用 check-content 的兩級制（規則來自共用的 lib/ai-tone.mjs）：
//   ERROR：near-zero 誤判的強指紋，單一命中即擋 build。
//   WARN ：高誤判軟訊號，分詞彙/句式/結構/語氣四層；**同一頁跨 ≥3 層**才升級為 ERROR。
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { ERROR_TELLS, WARN_LAYERS, ALLOW } from "./lib/ai-tone.mjs";

const DIST = "dist";
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".html") ? [full] : [];
  });

/** 只留使用者看得到的字：拿掉 script/style、標籤與實體。 */
const prose = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:[a-z]+|#\d+);/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const allowed = (s) => ALLOW.some((re) => re.test(s));

const errors = [];
const warnTotals = new Map();
let pages = 0;

for (const file of walk(DIST)) {
  const route = file.slice(DIST.length).replace(/index\.html$/, "") || "/";
  const text = prose(readFileSync(file, "utf8"));
  if (!text) continue;
  pages += 1;

  for (const [name, re] of ERROR_TELLS) {
    const hit = text.match(new RegExp(re, "g"));
    if (hit && !hit.every(allowed)) {
      errors.push({ route, name, sample: [...new Set(hit)].slice(0, 3).join("／") });
    }
  }

  const layersHit = new Set();
  for (const [layer, tells] of Object.entries(WARN_LAYERS)) {
    for (const [name, re] of tells) {
      const hit = text.match(new RegExp(re, "g"));
      if (!hit) continue;
      layersHit.add(layer);
      const key = `${layer}／${name}`;
      warnTotals.set(key, (warnTotals.get(key) ?? 0) + hit.length);
    }
  }
  // 記憶鐵則：命中 3 項不同層級才算 AI 味
  if (layersHit.size >= 3) {
    errors.push({ route, name: `跨 ${layersHit.size} 個軟訊號層（${[...layersHit].join("、")}）`, sample: "" });
  }
}

if (warnTotals.size) {
  console.log("文案守門　軟訊號統計（不擋 build，同一頁跨 3 層才擋）：");
  for (const [k, n] of [...warnTotals].sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(4)} × ${k}`);
  }
}

if (errors.length) {
  console.error(`\n❌ 文案守門：${errors.length} 處強 AI 指紋\n`);
  for (const e of errors) console.error(`   ${e.route}　${e.name}${e.sample ? `　例：${e.sample}` : ""}`);
  console.error("\n   這幾條是 near-zero 誤判的句型，出現就代表那句話不是人會這樣寫的。");
  console.error("   「不是X，而是Y」改寫成「是Y，不是X」通常同義而且更像人話。\n");
  process.exit(1);
}

console.log(`文案守門：${pages} 頁，無強 AI 指紋，無單頁跨 3 層軟訊號。`);

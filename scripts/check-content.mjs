// 內容守門（去 AI 味）——與 check-design.mjs 同框架，掛進 pnpm build 前置。
// 規則來源：credo audit-ai-tone / appi check-ai-tone / evidence audit-ai-tone / yao style-guide 的跨站交集
// （見記憶 content-no-ai-flavor 的四層檢查表）。站台特化規則（folk 療癒詩／yao 顧問腔／credo 括號）不放這，各站自行擴充。
//
// 兩級判定：
//   ERROR（擋 build，exit 1）：near-zero 誤判的強 AI 指紋，單一命中即擋。
//   WARN （只印，不擋）：高誤判軟訊號，分「詞彙/句式/結構/語氣」四層；
//     單一檔案跨 ≥3 個不同層級命中 → 升級為 ERROR（記憶鐵則：命中 3 項不同層級才算 AI 味）。
//
// 掃描範圍（grandfather 存量，關鍵）：
//   預設＝只掃「相對 origin/main 的變動檔」（已提交＋工作區＋未追蹤）中的 src/**/*.md(x)；
//     抓不到 git base（CI 淺 checkout）→ 掃 0 檔、exit 0，永不誤擋。
//   `--all`＝全站盤點（永遠 exit 0，供人工普查）。
//   `<file>...`＝只掃指定檔（供 newsroom/產線產文後自檢）。
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const fileArgs = args.filter((a) => !a.startsWith("--"));

import {
  ERROR_TELLS, BANNED_OPENINGS, WARN_LAYERS, ALLOW,
} from "./lib/ai-tone.mjs";

// ── 只留正文：遮掉 frontmatter / fenced code / inline code / 連結URL / HTML，保留行結構 ──
function proseMask(raw) {
  const lines = raw.split("\n");
  let inFence = false, fmEnd = -1;
  if (lines[0]?.trim() === "---") {
    for (let i = 1; i < lines.length; i++) if (lines[i].trim() === "---") { fmEnd = i; break; }
  }
  return lines.map((line, i) => {
    if (fmEnd >= 0 && i <= fmEnd) return "";
    if (/^\s*```/.test(line)) { inFence = !inFence; return ""; }
    if (inFence) return "";
    return line
      .replace(/`[^`]*`/g, " ")            // inline code
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // 連結/圖：留文字去 URL
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ");
  });
}

const verbatimSkipped = [];

function firstProseSentence(masked) {
  for (const line of masked) {
    const t = line.trim().replace(/^#+\s*/, "").replace(/^[-*>]\s*/, "");
    if (t) return t;
  }
  return "";
}

function scanFile(file) {
  if (!existsSync(file)) return { errors: [], warns: [] };
  const src = readFileSync(file, "utf8");
  // 逐字轉錄豁免（2026-07-28 ttpa 建站加）：frontmatter 標 `sourceVerbatim: true`
  // ＝一字不改搬自客戶／原站的既有文案。原文若有「不僅…更」這類句型是對方自己寫的，
  // 不是 AI 腔，為了過守門改寫它等於竄改客戶內容——故整檔跳過。
  // ⚠ 只准用於逐字轉錄；新寫的文案掛這個旗標＝自廢守門，審查時會被抓。
  if (/^---[\s\S]*?^sourceVerbatim:\s*true\s*$[\s\S]*?^---/m.test(src)) {
    verbatimSkipped.push(file);
    return { errors: [], warns: [] };
  }
  const masked = proseMask(src);
  const whole = masked.join("\n");
  const errors = [], warns = [];
  const allowed = (s) => ALLOW.some((re) => re.test(s));

  masked.forEach((line, i) => {
    if (!line.trim() || allowed(line)) return;
    for (const [label, re] of ERROR_TELLS)
      if (re.test(line)) errors.push({ loc: `${file}:${i + 1}`, label, text: line.trim() });
  });

  const first = firstProseSentence(masked);
  if (BANNED_OPENINGS.some((re) => re.test(first)))
    errors.push({ loc: `${file}:開頭`, label: "模板化開頭", text: first.slice(0, 40) });

  const hitLayers = new Set();
  for (const [layer, tells] of Object.entries(WARN_LAYERS))
    for (const [label, re] of tells) {
      const m = re.exec(whole);
      if (m) { warns.push({ file, layer, label, text: m[0].slice(0, 30) }); hitLayers.add(layer); }
    }
  // 跨 ≥3 層 → 整檔升級為 ERROR
  if (hitLayers.size >= 3) {
    errors.push({ loc: file, label: `AI 味跨 ${hitLayers.size} 層（${[...hitLayers].join("/")}）`, text: "軟訊號累積達鐵則門檻" });
  }
  return { errors, warns };
}

function targetFiles() {
  if (fileArgs.length) return fileArgs.filter((f) => /\.mdx?$/.test(f));
  const run = (cmd) => { try { return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; } };
  // 注意：Astro 在子目錄（如 sutta 的 site/）時，本腳本在該子目錄下跑——
  //   `:(glob)` pathspec magic 才會匹配 src/ 直屬檔（純 `src/**` 會漏一層）；
  //   `git diff --relative` 才會輸出相對 cwd 的 `src/…`（否則是 repo-root 相對，被 ^src/ 濾掉）。
  if (ALL) {
    // 已追蹤 ＋ 未追蹤都要掃：只用 git ls-files 會漏掉尚未 commit 的內容檔，
    // 全站普查卻看不到剛寫的檔＝普查失去意義（2026-07-28 ttpa 獨立驗收抓到）。
    const sets = [
      run("git ls-files ':(glob)src/**/*.md' ':(glob)src/**/*.mdx'"),
      run("git ls-files --others --exclude-standard ':(glob)src/**/*.md' ':(glob)src/**/*.mdx'"),
    ];
    return [...new Set(sets.filter(Boolean).join("\n").split("\n"))].filter(Boolean);
  }
  const base = run("git merge-base origin/main HEAD");
  if (!base) { console.log("內容守門：抓不到 git base（origin/main），跳過變動掃描。"); return null; }
  const sets = [
    run(`git diff --relative --name-only --diff-filter=ACMR ${base} HEAD`),
    run("git diff --relative --name-only --diff-filter=ACMR HEAD"),
    run("git ls-files --others --exclude-standard ':(glob)src/**/*.md' ':(glob)src/**/*.mdx'"),
  ];
  const files = [...new Set(sets.filter(Boolean).join("\n").split("\n"))]
    .filter((f) => /^src\/.*\.mdx?$/.test(f));
  return files;
}

const files = targetFiles();
if (files === null) process.exit(0); // 無 git base，安全放行
if (!files.length) {
  // 🔴 這一行原本只寫「無變動的 .md/.mdx 內容檔」，讀起來像「檢查過了、沒問題」，
  //    但本站 0 個 .md，它其實一個檔都沒掃——我因此連續幾十次 build 誤以為文案檢查過了。
  //    訊息要講實話：說清楚它掃了幾個檔、以及頁面文案由誰負責。
  console.log(
    "內容守門：本站沒有 .md/.mdx，這支掃 0 個檔（頁面文案由 check-copy.mjs 掃 dist 負責）。",
  );
  process.exit(0);
}

let errors = [], warns = [];
for (const f of files) { const r = scanFile(f); errors.push(...r.errors); warns.push(...r.warns); }

if (warns.length) {
  console.error(`內容守門 WARN（軟訊號 ${warns.length}，未達 3 層不擋）：`);
  for (const w of warns) console.error(`  · [${w.layer}] ${w.file}：${w.label}（${w.text}）`);
}
if (errors.length && !ALL) {
  console.error(`\n去 AI 味違規 ${errors.length} 處（擋 build）：`);
  for (const e of errors) console.error(`  ✗ ${e.loc} ${e.label}：${e.text}`);
  console.error(`\n改法見記憶 content-no-ai-flavor：AI 出初稿、人味靠最後 20% 手動微調。`);
  process.exit(1);
}
if (verbatimSkipped.length)
  console.log(`內容守門：${verbatimSkipped.length} 檔標 sourceVerbatim（逐字轉錄，豁免掃描）：${verbatimSkipped.join("、")}`);
console.log(`內容守門通過：掃 ${files.length - verbatimSkipped.length} 檔，無 AI 味 ERROR${warns.length ? `（${warns.length} 則 WARN 見上）` : ""}。`);

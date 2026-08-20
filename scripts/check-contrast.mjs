// 色彩對比守門（2026-08-20）——只讀 src/styles/variables.css，不需要 dist，所以掛在 build 最前面。
//
// 為什麼要有：2026-08-20 實算才發現 --color-ink-muted 是 #999999，在白底只有 2.85:1，
// 連 WCAG AA 大字的 3.0 都沒過 —— 而它在 17 個地方是當**文字顏色**用的（出處、註記、次要說明）。
// 這種問題肉眼看不出來（灰字看起來就是「比較淡」而已），只有算出來才知道，
// 而且機關採購的無障礙檢核會逐項對。所以用 build 擋。
//
// 判準：WCAG 2.1 AA，一般內文 4.5:1、大字 3:1。這裡列的都是實際成對出現的組合，
// 不自動窮舉所有 token 兩兩配對（那會對「背景色 vs 背景色」這種不存在的組合誤報）。
// 新增會成對出現的顏色時，同一回合把它加進 PAIRS。
import { readFileSync } from 'node:fs';

const TOKENS_FILE = 'src/styles/variables.css';
const AA_TEXT = 4.5;

// [說明, 前景 token, 背景 token]
const PAIRS = [
  ['內文', 'text', 'white'],
  ['內文於淺灰底', 'text', 'bg-light'],
  ['次要文字', 'ink-soft', 'white'],
  ['次要文字於淺灰底', 'ink-soft', 'bg-light'],
  ['註記文字', 'ink-muted', 'white'],
  ['註記文字於淺灰底', 'ink-muted', 'bg-light'],
  ['連結', 'primary', 'white'],
  ['連結 hover', 'accent', 'white'],
  ['按鈕白字於朱磚', 'white', 'accent'],
  ['按鈕白字於朱磚 hover', 'white', 'accent-dark'],
  ['skip link 白字於墨青', 'white', 'primary'],
  ['檢核 critical', 'critical', 'white'],
  ['檢核 warn', 'warn', 'white'],
  ['檢核 pass', 'pass', 'white'],
  ['檢核 info', 'info', 'white'],
];

const css = readFileSync(TOKENS_FILE, 'utf8');
// 只取 hex fallback（oklch 那份是同一個顏色的另一種寫法，兩邊要一起改）
const tokens = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]),
);

const luminance = (hex) => {
  const parts = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const problems = [];
for (const [label, fg, bg] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) {
    problems.push(`${label}：找不到 token（--color-${fg} 或 --color-${bg}），PAIRS 與 ${TOKENS_FILE} 不同步`);
    continue;
  }
  const r = ratio(tokens[fg], tokens[bg]);
  if (r < AA_TEXT) {
    problems.push(
      `${label}：${tokens[fg]} 於 ${tokens[bg]} 只有 ${r.toFixed(2)}:1，未達 AA 內文標準 ${AA_TEXT}:1`,
    );
  }
}

if (problems.length) {
  console.error(`\n❌ 色彩對比守門：${problems.length} 組不合格\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error(`\n   改 ${TOKENS_FILE}，hex 與 oklch 兩份要一起改（同一個顏色的兩種寫法）。\n`);
  process.exit(1);
}
console.log(`色彩對比守門：${PAIRS.length} 組全部達 WCAG AA 內文標準（${AA_TEXT}:1）。`);

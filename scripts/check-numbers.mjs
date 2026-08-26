// 國字大寫換算守門 —— 掛進 pnpm build，與 check-design / check-scenarios 同框架。
//
// 為什麼要守（2026-08-26）：/numbers/ 的換算是站上第一個「會算東西」的功能，
// 而且伺服器端與瀏覽器端吃同一份實作。算錯不會有任何畫面異常 —— 使用者拿到一個
// 看起來很像的錯字串，把它抄進核銷憑證，被退的是他不是我們。
//
// 案例挑的是會踩到補零與跳節的邊界，不是隨便列幾個好看的：
// 中間連續零只補一個、結尾零不寫、整節皆零要隔位、跨萬與億的進位。
import { toUppercase, toCurrency } from '../src/data/uppercase-number.js';

const CASES = [
  [0, '零'],
  [1, '壹'],
  [10, '壹拾'],
  [11, '壹拾壹'],
  [100, '壹佰'],
  [101, '壹佰零壹'],
  [110, '壹佰壹拾'],
  [1000, '壹仟'],
  [1001, '壹仟零壹'],
  [10000, '壹萬'],
  [10001, '壹萬零壹'],
  [100000, '壹拾萬'],
  [100005, '壹拾萬零伍'],
  [500000, '伍拾萬'],
  [486320, '肆拾捌萬陸仟參佰貳拾'],
  [1000000, '壹佰萬'],
  [10000000, '壹仟萬'],
  [100000000, '壹億'],
  [100000001, '壹億零壹'],
  [120000000, '壹億貳仟萬'],
  [1000000000, '壹拾億'],
  [20250901, '貳仟零貳拾伍萬零玖佰零壹'],
  [2140, '貳仟壹佰肆拾'],
  [9800, '玖仟捌佰'],
  [98000, '玖萬捌仟'],
  [620, '陸佰貳拾'],
];

// 拒絕的輸入：小數與非數字在公文金額不適用，靜默算出一個數字比報錯更危險。
const REJECTS = ['12.5', 'abc', '', '-1'];

const problems = [];

for (const [input, expected] of CASES) {
  const got = toUppercase(input);
  if (!got.ok) problems.push(`${input} 應該算得出來，卻回了「${got.reason}」`);
  else if (got.text !== expected) problems.push(`${input} → 得「${got.text}」，應為「${expected}」`);
}

for (const input of REJECTS) {
  if (toUppercase(input).ok) problems.push(`「${input}」不該被接受`);
}

const currency = toCurrency(486320);
if (currency.text !== '新臺幣肆拾捌萬陸仟參佰貳拾元整') {
  problems.push(`金額寫法錯了：${currency.text}`);
}

// 三的大寫必須是「參」，不能是那個筆畫相近的簡化字形。這條同時被 check-zh-hant 守著，
// 但那支掃的是 src/ 的文字，掃不到「換算函式算出來的字」。
// 碼點寫成跳脫字元，否則這支腳本自己會被簡體字守門擋下。
const SIMPLIFIED_THREE = '\u53c1';
if (CASES.some(([n]) => (toUppercase(n).text ?? '').includes(SIMPLIFIED_THREE))) {
  problems.push('換算結果出現三的簡化字形（U+53C1）——公文用「參」');
}

if (problems.length) {
  console.error(`\n❌ 國字大寫換算守門：${problems.length} 個問題\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   實作在 src/data/uppercase-number.js，/numbers/ 與瀏覽器端吃同一份。\n');
  process.exit(1);
}

console.log(`國字大寫換算守門：${CASES.length} 個邊界案例與 ${REJECTS.length} 個拒絕輸入全部正確。`);

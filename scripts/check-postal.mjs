// 存證信函格數／頁數／存證費守門。
//
// 為什麼要有這支：這組數字**算錯不會有任何畫面異常**，使用者只會在郵局櫃檯
// 被告知頁數不對、錢不夠——跟 check-numbers.mjs 守國字大寫是同一個道理。
//
// 而且它真的錯過：2026-08-27 本 session 一開始把用紙講成「20 格 × 20 行 ＝ 400 字」，
// 實際去抓官方 PDF（存證信函新格式10206.pdf）數出來是「20 格 × 10 行 ＝ 200 字」，差一倍。
// 頁數直接決定存證費（首頁 50、續頁每頁 30），所以邊界要釘死。
import { GRID, rowsFor, pagesForRows, certifyFee, estimate } from '../src/data/postal.js';

const CASES = [
  // [說明, 段落, 期望行, 期望頁]
  ['空內容至少算一頁', [], 0, 1],
  ['一段一字', ['甲'], 1, 1],
  ['一段剛好 20 字＝1 行', ['字'.repeat(20)], 1, 1],
  ['一段 21 字＝2 行（不是 1.05 行）', ['字'.repeat(21)], 2, 1],
  ['三段各 20 字＝3 行（不是 60/20=3 字元除法巧合）', ['一'.repeat(20), '二'.repeat(20), '三'.repeat(20)], 3, 1],
  ['三段各 21 字＝6 行（逐段進位，這是與 chars/20 的差別）', ['一'.repeat(21), '二'.repeat(21), '三'.repeat(21)], 6, 1],
  ['滿 10 行＝1 頁', Array.from({ length: 10 }, () => '字'.repeat(20)), 10, 1],
  ['11 行＝2 頁', Array.from({ length: 11 }, () => '字'.repeat(20)), 11, 2],
  ['20 行＝2 頁', Array.from({ length: 20 }, () => '字'.repeat(20)), 20, 2],
  ['21 行＝3 頁', Array.from({ length: 21 }, () => '字'.repeat(20)), 21, 3],
  ['空白段落不佔行', ['甲', '   ', '', '乙'], 2, 1],
];

const FEES = [
  // [說明, 頁, 附件, 期望費用]
  ['首頁 50', 1, 0, 50],
  ['2 頁＝50+30', 2, 0, 80],
  ['3 頁＝50+60', 3, 0, 110],
  ['1 頁+附件 1 張＝50+30', 1, 1, 80],
  ['2 頁+附件 2 張＝50+3×30', 2, 2, 140],
  ['頁數 0 視為 1 頁', 0, 0, 50],
];

const problems = [];
if (GRID.charsPerPage !== 200) problems.push(`每頁字數應為 200（20 格 × 10 行），實際 ${GRID.charsPerPage}`);
for (const [name, paras, rows, pages] of CASES) {
  const got = { rows: rowsFor(paras), pages: pagesForRows(rowsFor(paras)) };
  if (got.rows !== rows) problems.push(`${name}：行數應為 ${rows}，實際 ${got.rows}`);
  if (got.pages !== pages) problems.push(`${name}：頁數應為 ${pages}，實際 ${got.pages}`);
}
for (const [name, pages, att, fee] of FEES) {
  const got = certifyFee(pages, att);
  if (got !== fee) problems.push(`存證費 ${name}：應為 ${fee}，實際 ${got}`);
}
// estimate() 是頁面與這支共用的入口，順帶驗它三個欄位一致
const e = estimate(['字'.repeat(21)], 1);
if (e.rows !== 2 || e.pages !== 1 || e.fee !== 80) {
  problems.push(`estimate() 不一致：${JSON.stringify(e)}`);
}

if (problems.length) {
  console.error(`\n❌ 存證信函守門：${problems.length} 個問題\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   格線規格逐格數自官方 PDF，改動前先回 GRID.file 那份重數。\n');
  process.exit(1);
}
console.log(`存證信函守門：每頁 ${GRID.columns} 格 × ${GRID.rows} 行，${CASES.length} 個分頁案例與 ${FEES.length} 個費用案例全部正確。`);

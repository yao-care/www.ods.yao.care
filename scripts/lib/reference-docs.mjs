/**
 * 不是公文、但沿用同一套紙張與字級的可下載檔。
 *
 * 為什麼另開一支而不是塞進 gov-format.mjs：那一支的職責是「把草稿填進**政府文書格式
 * 參考規範**的欄位順序」，領據與數字大寫對照表都不在那份規範裡（領據的通案規定在
 * 《政府支出憑證處理要點》第四點，對照表根本不是一種文書）。放進去會讓下一個人以為
 * 這兩份的版面也有官方出處。共用的只有紙張、邊界與字級，讓下載檔看起來是一套。
 *
 * 為什麼有這兩份（2026-09-27，GSC 實證）：近 28 天全站 10,509 曝光裡，
 * /numbers/ 佔 6,817（點閱率 0.22%）、/receipt/ 佔 1,796（3.29%），
 * 而點閱率最高的是有檔可下載的 /templates/（456 曝光、66 點擊、14.47%）。
 * 這兩頁的曝光是全站最大的一塊，但站上 62 個 Word 檔裡一份領據與對照表都沒有。
 * 判定過程見 docs/keyword-validation/2026-09-27-gsc-wording-correction.md。
 *
 * ⚠️ 欄位與對照表的值一律從 src/data/ 匯入，不要在這裡手抄：
 * 領據欄位走 receipt.js（與網頁同一份）、對照表走 uppercase-number.js
 * （那份另有 pnpm check:numbers 守 26 個邊界案例）、條文走 voucher-rule.json。
 */
import { p, blank } from './docx.mjs';
import { RECEIPT_FIELDS, RECEIPT_PAYEE_LINES } from '../../src/data/receipt.js';
import { DIGIT_TABLE, UNIT_TABLE, EXAMPLES, toCurrency } from '../../src/data/uppercase-number.js';
import format from '../../src/data/gov-format.json' with { type: 'json' };

const S = format.styles;
/** 表單的欄位行比公文的主旨短，用同一個字級但不要 hanging indent，填的人才好對齊。 */
const FIELD = { fontSize: S.subject.fontSize, lineHeight: S.subject.lineHeight };
const SMALL = { fontSize: 12, lineHeight: 18 };

/**
 * 領據。
 * @param {boolean} filled true 產範例（帶 receipt.js 的示範值），false 產空白表。
 */
export function receiptForm(filled = false) {
  const field = (key) => RECEIPT_FIELDS.find((f) => f.key === key);
  const value = (key) => (filled ? field(key).example : '');
  const amount = field('amount');
  const payee = field('payee');
  // 「受領人：」只當抬頭，實際的姓名與統編填在下面那幾行 —— 範例檔兩邊都填才不會
  // 看起來像「上面寫了、下面又空著」。地址、電話與簽章在範例檔裡一律留白，
  // 那是每個人自己的資料，填了示範值反而有人照抄。
  const payeeLines = RECEIPT_PAYEE_LINES.map((line) => {
    if (!filled) return line;
    if (line.includes('姓名或名稱')) return `${line}${payee.exampleName}`;
    if (line.includes('統一編號')) return `${line}${payee.exampleId}`;
    return line;
  });

  return [
    p('領　　據', S.agency_title),
    blank(FIELD),
    p(`受領事由：${value('reason')}`, FIELD),
    // 大寫與阿拉伯數字兩行都留：《政府支出憑證處理要點》第十三點要求總數用大寫，
    // 阿拉伯數字那行是給對帳用的，不是替代品。
    p(`實收數額：${filled ? amount.example : '新臺幣　　　　　　　　　　元整'}`, FIELD),
    p(`　　　　　（阿拉伯數字 NT$ ${filled ? amount.arabic : '　　　　　　'}）`, FIELD),
    p(`機關名稱：${value('agency')}`, FIELD),
    p('受領人：', FIELD),
    ...payeeLines.map((line) => p(line, FIELD)),
    blank(FIELD),
    p(`開立日期：${filled ? value('date') : '中華民國　　年　　月　　日'}`, FIELD),
  ].join('');
}

/** 數字國字大寫對照表。docx.mjs 沒有表格，逐行「數字＋大寫」反而好複製貼上。 */
export function uppercaseSheet(voucher) {
  const point = (no) => voucher.points.find((x) => x.no === no);
  const row = (a, u) => p(`${a}　　${u}`, FIELD);

  return [
    p('數字國字大寫對照表', S.agency_title),
    blank(FIELD),

    p('一、0 到 9', S.section_head),
    ...DIGIT_TABLE.map((d) => row(d.arabic, d.upper)),
    blank(FIELD),

    p('二、位數', S.section_head),
    ...UNIT_TABLE.map((u) => row(u.arabic, u.upper)),
    p('位數只有拾、佰、仟、萬、億，沒有「十」「百」「千」的寫法。', SMALL),
    blank(FIELD),

    // 這一節的範例與 /numbers/ 第三節同一份 EXAMPLES（含一個刻意用來示範進位的日期），
    // 所以標題跟著那頁叫「進位與補零」，不要寫成「金額寫法」——那會讓最後一則看起來自相矛盾。
    p('三、進位與補零', S.section_head),
    ...EXAMPLES.map((e) => p(`${e.n.toLocaleString('en-US')}　　${toCurrency(e.n).text}　（${e.why}）`, FIELD)),
    blank(FIELD),

    p('四、為什麼一定要大寫', S.section_head),
    p(`《${voucher._source.name}》第十三點（${point('十三').title}）：`, SMALL),
    p(point('十三').text, SMALL),
    blank(FIELD),
    // ⚠️ 這裡不要寫出那個簡化字形（碼點 U+53C1）——pnpm check:zh-hant 會當場擋下，
    // /numbers/ 那頁刻意連原始碼都不放它，理由同。
    p('三的大寫是「參」。輸入法裡另有一個筆畫相近的簡化字形，公文與核銷憑證用它會被退；「陸」也有對應的簡化字形。', SMALL),
  ].join('');
}

/**
 * 領據的欄位定義 —— 網頁與 Word 共用這一份。
 *
 * 為什麼抽出來（2026-09-27）：`/receipt/` 那頁原本把這份表寫在頁面 frontmatter 裡，
 * 而 `.astro` 沒辦法被 `scripts/` 匯入。要產可下載的領據 Word 就得在腳本裡再抄一份，
 * 於是「網頁對、Word 錯」的漂移就只是時間問題 —— 那正是 `meeting.js` 與 `note.js`
 * 當初被抽出來共用要避免的事（見 CLAUDE.md 的開會通知單那段）。
 *
 * 欄位本身不是想出來的：逐款對應《政府支出憑證處理要點》第四點第一項(一)～(五)。
 * 條文原文一律從 `voucher-rule.json` 取，**不要在這裡手抄條文**。
 * 第(六)款「其他由各機關依其業務性質及實際需要增列之事項」刻意不列成欄位 ——
 * 那是各機關自己加的，站上給通案的那五款就好。
 */
import { toCurrency } from './uppercase-number.js';

/** 示範用的金額。同一個值同時餵給網頁的例子欄與 Word 的範例檔。 */
const EXAMPLE_AMOUNT = 240000;

export const RECEIPT_FIELDS = [
  {
    key: 'reason',
    law: '受領事由',
    plain: '這筆錢是為了什麼付的',
    example: '114年度社區照顧關懷據點補助款',
  },
  {
    key: 'amount',
    law: '實收數額',
    plain: '實際收到多少，金額用國字大寫',
    example: toCurrency(EXAMPLE_AMOUNT).text,
    /** 大寫那一行才是決勝的，阿拉伯數字只是輔助；Word 版兩行都留。 */
    arabic: EXAMPLE_AMOUNT.toLocaleString('en-US'),
  },
  {
    key: 'agency',
    law: '機關名稱',
    plain: '付錢的機關全銜，不是自己的名字',
    example: '○○縣政府社會處',
  },
  {
    key: 'payee',
    law: '受領人之姓名或名稱、身分證明文件字號、統一編號',
    plain: '收錢的人或團體；團體填名稱與統一編號，個人填姓名與身分證字號',
    example: '○○社區發展協會（統一編號 00000000）',
    /** 網頁的例子欄是一句話，Word 的表單要分行填，所以同一個示範值拆成兩欄。 */
    exampleName: '○○社區發展協會',
    exampleId: '00000000',
  },
  {
    key: 'date',
    law: '開立日期',
    plain: '開立這張領據的日期，用民國紀年',
    example: '中華民國114年9月10日',
  },
];

/** Word 版的受領人區塊：條文把姓名、證號、統編寫成同一款，實際表單要拆成好幾行填。 */
export const RECEIPT_PAYEE_LINES = [
  '　　姓名或名稱：',
  '　　身分證明文件字號或統一編號：',
  '　　地址：',
  '　　電話：',
  '　　簽名或蓋章：',
];

/**
 * 阿拉伯數字 → 國字大寫（會計用字）。
 *
 * 為什麼站上要有這個（2026-08-26）：Bing 關鍵字需求量測顯示「數字大寫」近三個月精準比對
 * 7,829、「大寫數字」936、「國字大寫」1,048、「支票大寫」294、「金額大寫」245 ——
 * 是本站量到的最大一群需求，而站上原本只有 `/writing/` 一節在講「什麼時候用阿拉伯數字」，
 * 沒有任何一頁回答「這個數字大寫怎麼寫」。查這個字的人手上已經有一個數字要換。
 *
 * 這支同時給伺服器端（產對照表與範例，沒有 JS 也讀得到）與瀏覽器端（輸入即換算）用，
 * 兩邊吃同一份實作，換算結果不會有兩套。
 *
 * 用字取《文書處理手冊》擬稿規定與會計慣用的那一組：零壹貳參肆伍陸柒捌玖拾佰仟萬億。
 * 三的大寫是「參」，**不是那個筆畫相近的簡化字形（U+53C1）**——後者在公文與核銷憑證會被退
 * （本站 check:zh-hant 與應用端 no_simplified 用的是同一份 3,730 字集合，那個碼點在集合裡）。
 * 本檔刻意不把那個字寫進原始碼，否則簡體字守門會擋下這支檔案本身。
 */
const DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖'];
const UNITS = ['', '拾', '佰', '仟'];
/** 每四位一節：個、萬、億、兆。超過兆的金額不在公文與核銷憑證的合理範圍，明確拒絕而不是算錯。 */
const GROUPS = ['', '萬', '億', '兆'];

/** 一節（1～4 位）轉大寫。回傳不含節名，內部的零已經收斂成最多一個。 */
function convertGroup(group) {
  let out = '';
  let pendingZero = false;
  for (let i = 0; i < group.length; i += 1) {
    const digit = Number(group[i]);
    const unit = UNITS[group.length - 1 - i];
    if (digit === 0) {
      pendingZero = true;
      continue;
    }
    if (pendingZero && out) out += '零';
    pendingZero = false;
    out += DIGITS[digit] + unit;
  }
  return out;
}

/**
 * @param {string|number} input 只接受非負整數（可含逗號）。小數與負數在公文金額不適用。
 * @returns {{ ok: true, text: string } | { ok: false, reason: string }}
 */
export function toUppercase(input) {
  const raw = String(input ?? '').trim().replace(/[,，\s]/g, '');
  if (!raw) return { ok: false, reason: '請輸入數字' };
  if (!/^\d+$/.test(raw)) {
    if (/[.．]/.test(raw)) return { ok: false, reason: '公文與核銷憑證的金額寫到元為止，不寫小數' };
    if (/^-/.test(raw)) return { ok: false, reason: '不支援負數' };
    return { ok: false, reason: '只接受阿拉伯數字' };
  }
  const digits = raw.replace(/^0+(?=\d)/, '');
  if (digits === '0') return { ok: true, text: '零' };
  if (digits.length > 16) return { ok: false, reason: '超過兆位，請確認數字是否正確' };

  // 由低位往高位切成每 4 位一節
  const groups = [];
  for (let end = digits.length; end > 0; end -= 4) {
    groups.unshift(digits.slice(Math.max(0, end - 4), end));
  }

  let out = '';
  groups.forEach((group, i) => {
    const name = GROUPS[groups.length - 1 - i];
    const body = convertGroup(group);
    if (!body) {
      // 整節都是零：只有在後面還有非零節時才需要補一個「零」當隔位
      if (out && !out.endsWith('零')) out += '零';
      return;
    }
    // 該節不足 4 位且前面已有內容 → 節首要補零（如 100000005 → 壹億零伍元）
    if (out && !out.endsWith('零') && group.replace(/^0+/, '').length < group.length) out += '零';
    out += body + name;
  });

  return { ok: true, text: out.replace(/零+$/, '') };
}

/** 金額寫法：新臺幣＋大寫＋元整。核銷憑證與公文的慣用格式。 */
export function toCurrency(input) {
  const result = toUppercase(input);
  if (!result.ok) return result;
  return { ok: true, text: `新臺幣${result.text}元整` };
}

/** 對照表：伺服器端渲染用，沒有 JS 也看得到。 */
export const DIGIT_TABLE = DIGITS.map((upper, i) => ({ arabic: String(i), upper }));
export const UNIT_TABLE = [
  { arabic: '10', upper: '拾' },
  { arabic: '100', upper: '佰' },
  { arabic: '1,000', upper: '仟' },
  { arabic: '10,000', upper: '萬' },
  { arabic: '100,000,000', upper: '億' },
];

/** 範例：挑會踩到補零與跳節的數字，不是隨便列幾個好看的。 */
export const EXAMPLES = [
  { n: 1000, why: '整千，後面的零不寫' },
  { n: 30000, why: '整萬' },
  { n: 500000, why: '核定金額常見寫法' },
  { n: 486320, why: '每一位都有數字' },
  { n: 100005, why: '中間連續是零，只補一個「零」' },
  { n: 1000000, why: '百萬要寫「壹佰萬」，不是「壹百萬」' },
  { n: 20250901, why: '日期不用大寫，這裡只示範進位' },
];

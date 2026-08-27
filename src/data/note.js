/**
 * 本票的固定欄位重排 —— 網頁與 Word 共用的單一真實來源（比照 meeting.js 的作法）。
 *
 * 本票不是三段式：票據法第 120 條第 1 項列了八款應記載事項，由發票人簽名。
 * 應用端（ods.yao.care）直接產這些欄位（`draft.fields` 的 `note_*`），這裡只負責排版與判讀。
 *
 * 🔴 八款分兩種，**排版上要看得出差別**，因為法律效果差很多：
 *
 *   絕對必要（第 120 條沒有補充規定，缺了依第 11 條第 1 項票據無效）：
 *     表明其為本票之文字、一定之金額、無條件擔任支付、發票年月日，加上發票人簽名。
 *   有補充規定（未載不會無效，但效果改變）：
 *     到期日（未載視為見票即付，第 2 項）、受款人（未載以執票人為受款人，第 3 項）、
 *     發票地（第 4 項）、付款地（第 5 項）。
 *
 * 所以未填的欄位不能只留白 —— 要把「未載的後果」寫出來，那才是使用者需要知道的事。
 */

/** 法定文義，由應用端固定填入，不讓模型改寫（票據法第 120 條第 1 項第 4 款）。 */
export const UNCONDITIONAL = '無條件擔任支付';

/**
 * 使用者要填的欄位。**注意這裡是 7 列不是 8 款**：
 * 第 120 條第 1 項的八款裡，第 1 款（表明其為本票之文字）由文別與版面提供、
 * 第 4 款（無條件擔任支付）是固定文義由應用端填入，兩者都不是使用者欄位；
 * 其餘六款展開成 7 列，因為金額拆成國字大寫與阿拉伯數字兩欄（第 7 條的緣故）。
 *
 * `required` 標的是「絕對必要記載事項」，`absent` 是未載時的法定效果
 * （取自條文本身，不是我們的推論）。
 */
export const NOTE_FIELDS = [
  {
    key: 'note_amount',
    label: '金額（國字大寫）',
    law: '第 120 條第 1 項第 2 款',
    required: true,
    absent: '未載金額，票據無效（第 11 條第 1 項）。',
    note: '票據法第 7 條：記載金額之文字與號碼不符時，以文字為準——大寫這一欄才是決勝的。',
  },
  {
    key: 'note_amount_digits',
    label: '金額（阿拉伯數字）',
    law: '第 120 條第 1 項第 2 款',
    required: true,
    absent: '未載金額，票據無效（第 11 條第 1 項）。',
  },
  {
    key: 'note_payee',
    label: '受款人',
    law: '第 120 條第 1 項第 3 款',
    required: false,
    absent: '未載受款人者，以執票人為受款人（第 3 項）——也就是無記名，誰拿到誰能行使，轉手風險比記名高。',
  },
  {
    key: 'note_due_date',
    label: '到期日',
    law: '第 120 條第 1 項第 8 款',
    required: false,
    absent: '未載到期日者，視為見票即付（第 2 項）——對方隨時可以提示請求付款。',
  },
  {
    key: 'note_issue_date',
    label: '發票年月日',
    law: '第 120 條第 1 項第 6 款',
    required: true,
    absent: '未載發票日，票據無效（第 11 條第 1 項）。**這一款沒有補充規定**，與到期日、受款人不同。',
  },
  {
    key: 'note_issue_place',
    label: '發票地',
    law: '第 120 條第 1 項第 5 款',
    required: false,
    absent: '未載發票地者，以發票人之營業所、住所或居所所在地為發票地（第 4 項）。',
  },
  {
    key: 'note_payment_place',
    label: '付款地',
    law: '第 120 條第 1 項第 7 款',
    required: false,
    absent: '未載付款地者，以發票地為付款地（第 5 項）。',
  },
];

const val = (draft, key) => String(draft?.fields?.[key] ?? '').trim();

/** 把草稿排成八款的顯示列。未填的帶上法定效果，不留白。 */
export function noteRows(draft) {
  return NOTE_FIELDS.map((f) => {
    const value = val(draft, f.key);
    return { ...f, value, filled: Boolean(value) };
  });
}

/**
 * 這張本票的兩個風險旗標。判準直接取自條文，不是我們的評價：
 *   無記名＝未載受款人（第 3 項）／見票即付＝未載到期日（第 2 項）。
 * 兩者同時成立時，第 6 項另要求金額須在五百元以上。
 */
export function noteFlags(draft) {
  const unnamed = !val(draft, 'note_payee');
  const sightPay = !val(draft, 'note_due_date');
  const digits = Number(val(draft, 'note_amount_digits').replace(/[,，\s]/g, '').match(/\d+/)?.[0] ?? NaN);
  return {
    unnamed,
    sightPay,
    /** 第 120 條第 6 項：見票即付且不記載受款人者，金額須在五百元以上。 */
    minAmountApplies: unnamed && sightPay,
    minAmountOk: !(unnamed && sightPay) || (Number.isFinite(digits) && digits >= 500),
  };
}

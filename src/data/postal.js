/**
 * 存證信函的官方事實：資費、份數、用紙規定、保存年限。
 *
 * **全部逐條出自中華郵政官方檔案，不是整理自部落格，也沒有推估。**
 * 查證日期 2026-08-20；每一條都帶 source 連結，改版時逐條回官網重核。
 *
 * 為什麼要有這個檔（2026-08-20 的教訓）：站上五個存證信函範例頁只回答「格式對不對」，
 * 但實搜「存證信函怎麼寫」的人問的是費用、份數、怎麼寄、寄了有什麼用。實測本站對
 * 費用／郵資／份數／掛號／回執／效力這些字的覆蓋率是 0，前排全被律師事務所與法律內容站佔滿。
 * 見 docs/keyword-validation/2026-08-20-pinned-14.md。
 *
 * ⚠️ 資費會調整。頁面上一律附官方連結並註明查證日期，**不要把金額寫死在文案裡當承諾**。
 */

export const VERIFIED_ON = '2026-08-20';

export const SOURCES = {
  fee: {
    label: '中華郵政　客戶服務專區：存證信函',
    url: 'https://www.post.gov.tw/post/internet/Customer_service/index.jsp?ID=1610075122269&defaultAllOpen=1&sn=C84617EA-1EB6-4FD7-8C02-086735B00CC7',
  },
  postage: {
    label: '中華郵政　簡明國內函件資費表',
    url: 'https://www.post.gov.tw/post/internet/Postal/index.jsp?ID=2020106',
  },
  form: {
    label: '中華郵政　下載專區：存證信函用紙與使用說明',
    url: 'https://www.post.gov.tw/post/internet/Download/index.jsp?ID=220301',
  },
  online: {
    label: '中華郵政　存證信函網路交寄',
    url: 'https://www.post.gov.tw/post/internet/Customer_service/index.jsp?ID=1610075206586',
  },
};

/** 存證費（官方原文：存證信函存證費首頁 50 元，續頁每頁或附件每張 30 元）。 */
export const CERTIFY_FEE = {
  firstPage: 50,
  extraPage: 30,
  note: '續頁每頁或附件每張同價。',
  source: SOURCES.fee,
};

/**
 * 郵資。官方資費表生效日 108-11-01，頁面最後更新 112-03-22。
 * 只列不逾 20 公克這一級距——存證信函多為數頁，仍以櫃檯實際計收為準。
 */
export const POSTAGE = {
  effective: '民國 108 年 11 月 1 日起實施（資費表最後更新民國 112 年 3 月 22 日）',
  rows: [
    { label: '平信　不逾 20 公克', amount: 8 },
    { label: '掛號費　每件另加', amount: 20 },
    { label: '普通掛號　不逾 20 公克', amount: 28, note: '＝平信 8 ＋ 掛號 20' },
    { label: '掛號附回執（回執以平信寄回）　不逾 20 公克', amount: 43, note: '起' },
    { label: '掛號附回執（回執以掛號寄回）　不逾 20 公克', amount: 53, note: '起' },
  ],
  source: SOURCES.postage,
};

/**
 * 用紙上「備註」欄印的三條規定，逐字照抄。這是最權威的來源——它就印在你要交寄的那張紙上。
 */
export const FORM_RULES = [
  {
    key: 'validity',
    title: '要送到郵局辦證明手續才有效，郵局保存副本三年',
    quote:
      '存證信函需送交郵局辦理證明手續後始有效，自交寄之日起由郵局保存之副本，於三年期滿後銷燬之。',
  },
  {
    key: 'amend',
    title: '塗改增刪每頁不得逾二十字，且要填註並蓋章',
    quote:
      '在　　頁　　行第　　　格下塗改增刪　　字（如有修改應填註本欄並蓋用寄件人印章），但塗改增刪每頁至多不得逾二十字。',
  },
  {
    key: 'copies',
    title: '每件一式三份，每格限書一字',
    quote:
      '每件一式三份，用不脫色筆或打字機複寫，或書寫後複印、影印，每格限書一字，色澤明顯、字跡端正。',
  },
  {
    key: 'org',
    title: '寄件人是機關、團體、學校、公司、商號時要加蓋單位圖章',
    quote: '寄件人如為機關、團體、學校、公司、商號請加蓋單位圖章及法定代理人簽名或蓋章。',
  },
];

/** 使用說明 ODT 裡的軟體設定（本站產生的 Word 已照這些值設定）。 */
export const TYPESETTING = {
  quote:
    '英文、數字、符號等請用「全形」輸入。字體大小設定為 18；段落行距設定為固定行高 34pt 及靠左對齊；字元間距加寬及點數設定為 2.9pt。',
  prohibition: '請依所提供之格式使用，變更樣式內容者，不予收寄。',
  source: SOURCES.form,
};

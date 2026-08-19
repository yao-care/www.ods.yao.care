/**
 * 案例頁的中繼資料。公文全文與檢核結果不在這裡 —— 那些由 ods.yao.care 的
 * `scripts/export-demo.js --llm` 產出，放在 ./scenarios/*.json，是同一套程式碼的真實產物。
 * 這個檔只放「站台自己的」欄位：網址 slug、搜尋用標題、業務分類、情境說明。
 */
export const CASES = [
  {
    key: 'grant_report',
    slug: 'grant-settlement',
    seoTitle: '補助經費核銷公文範例',
    category: '補助核銷',
    lead: '核定金額與實支金額不一致、餘款要繳回，這種案子最常卡在金額寫法與附件清單。',
    watchOut: ['金額要用國字大寫（新臺幣伍拾萬元整）', '餘款要在主旨或說明明確交代', '附件清單漏列會被退補'],
  },
  {
    key: 'subsidy_apply',
    slug: 'subsidy-application',
    seoTitle: '申請中央補助計畫公文範例',
    category: '補助核銷',
    lead: '向上級或中央部會申請補助，期望語用錯是最常見的退件原因。',
    watchOut: ['對上級機關用「請鑒核」，不是「請查照」', '計畫書份數要寫明', '金額同樣用國字大寫'],
  },
  {
    key: 'repair',
    slug: 'road-repair',
    seoTitle: '民眾陳情轉請權責單位處理公文範例',
    category: '陳情與轉請',
    lead: '陳情案轉給權責單位，要交代陳情來源、會勘結果與具體請求。',
    watchOut: ['陳情人姓名屬個資，行文時只寫「林姓民眾」', '會勘日期用民國紀年', '請求事項要具體到可執行'],
  },
  {
    key: 'petition_reply',
    slug: 'noise-petition-reply',
    seoTitle: '民眾陳情案函復範例',
    category: '陳情與轉請',
    lead: '稽查結果不利於陳情人時，用語要中性、依據要寫清楚，避免衍生爭議。',
    watchOut: ['函復用「復」起首', '稽查數據要附管制標準對照', '書函與函的使用時機不同'],
  },
  {
    key: 'meeting',
    slug: 'meeting-notice',
    seoTitle: '開會通知單範例',
    category: '會議與通知',
    lead: '開會通知單的時間、地點、出席人員各有固定欄位，寫進主旨反而不合格式。',
    watchOut: ['主旨不要以「開會通知單：」開頭', '期望語仍用「請查照」', '時間寫到星期與時分'],
    // 開會通知單的固定欄位（規範第八點）。應用產出的草稿是函的形狀 —— 時間地點寫在說明分項裡、
    // 主旨帶期望語；排成正式通知單時要拆進這些欄位。absorbedPrefixes 列出因此不再重複進備註的分項。
    // 主持人與聯絡人草稿沒有，照規範範例用 ○ 佔位。
    meeting: {
      topic: '研商114年度基層建設需求，召開里長座談會',
      time: '中華民國114年4月10日（星期四）下午2時',
      place: '本所三樓會議室',
      chair: '○鄉長○○',
      contact: '○○○　00-0000000 分機 0000',
      attendees: '本鄉各里辦公處',
      absorbedPrefixes: ['會議時間：'],
    },
  },
  {
    key: 'notice',
    slug: 'open-burning-notice',
    seoTitle: '行政公告範例',
    category: '會議與通知',
    lead: '公告要讓民眾看得懂，同時把法源與罰則交代清楚。',
    watchOut: ['公告沒有受文者', '罰則要引法條', '生效日期用民國紀年'],
  },
  {
    key: 'sign',
    slug: 'procurement-sign',
    seoTitle: '簽辦採購案範例',
    category: '內部簽核',
    lead: '簽是對內文書，結尾用「簽請核示」，不是對外的期望語。',
    watchOut: ['簽不需要受文者', '金額牽涉採購級距，要對照政府採購法', '擬辦事項要具體'],
  },
  {
    key: 'low_income',
    slug: 'low-income-review',
    seoTitle: '社會救助資格審查結果通知範例',
    category: '社會行政',
    lead: '對民眾的不利處分，要載明法令依據與救濟方式，否則程序有瑕疵。',
    watchOut: ['引具體法條（社會救助法第4條）', '行政程序法第96條要求載明救濟教示', '當事人姓名是個資'],
  },
];

export const CATEGORIES = [...new Set(CASES.map((c) => c.category))];

export function findCaseBySlug(slug) {
  return CASES.find((c) => c.slug === slug);
}

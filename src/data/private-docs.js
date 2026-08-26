/**
 * 民間書件頁的中繼資料。
 *
 * 與 cases.js 同一個分工：公文全文與檢核結果**不在這裡** —— 那些是 ods 應用用
 * `export-demo.js --llm` 產的真實產物，放在 ./scenarios/*.json。這個檔只放站台自己的
 * 欄位：網址 slug、搜尋用標題、分類、情境說明、常踩的點。
 *
 * ⚠️ 與 citizen-examples.js 的差別：那一份是**手寫**的（連檢核清單都是手抄的常數），
 * 這一份不是。新增民間書件時要在應用端 `src/lib/demo.js` 加情境、重烘，
 * 不要在站上手寫一份看起來很像的假產物。
 *
 * 為什麼有這一群（2026-08-26，第四波關鍵字）：Bing 需求量實測
 * 委託書 1,865／切結書 958／和解書 829／車禍和解書 982／授權書 536／聲明書 293，
 * 站上一頁都沒有，同期 GSC 這些字本網域一次曝光都沒有。
 * 判定過程見 docs/keyword-validation/2026-08-26-demand.md。
 */
export const PRIVATE_DOCS = [
  {
    key: 'poa_household',
    slug: 'power-of-attorney-household',
    seoTitle: '委託書範例：代領戶籍謄本',
    category: '委託與授權',
    lead: '沒空自己跑戶政事務所，請人代領謄本。承辦看的是「委託事項寫得夠不夠具體」。',
    watchOut: [
      '委託事項要寫到承辦看得懂能不能受理，不要寫「處理相關事宜」',
      '結尾一定要有「如有虛偽不實，本人願負相關法律責任」，沒有這句就不構成委託',
      '雙方身分證影本通常都要附，受託人還要帶自己的證件與印章',
      '委託期間要有起訖日 —— 外交部領事事務局的授權書填寫說明就是這樣要求的',
    ],
  },
  {
    key: 'poa_vehicle',
    slug: 'power-of-attorney-vehicle',
    seoTitle: '委託書範例：代辦車輛過戶',
    category: '委託與授權',
    lead: '人在國外或無法親自到監理站，委託別人辦過戶。但只有一張委託書辦不成——法規要的是證件。',
    watchOut: [
      '委託買賣業以外的人代辦過戶，道路交通安全規則第 16 條要的是「代辦人身分證」加上「車主有效駕駛執照或健保卡或護照」，不是只有委託書；也可以用法院或民間公證人的認證文件代替',
      '過戶、簽署表單、領新行照是三件事，要分項列清楚',
      '委託期間要有起訖，不要開放式授權',
    ],
  },
  {
    key: 'auth_collect',
    slug: 'authorization-collect-payment',
    seoTitle: '授權書範例：代為領取款項',
    category: '委託與授權',
    lead: '授權別人代領補助款。這種授權最該寫清楚的是「不含什麼」。',
    watchOut: [
      '授權範圍要明確排除變更帳戶、代為申請其他補助',
      '授權期間要有起訖日',
      '涉及款項的授權，機關常另外要求存摺封面影本',
      '撤回授權要通知對方或機關才生效（行政程序法第 24 條、民法第 107 條），光是口頭說不算',
    ],
  },
  {
    key: 'affidavit_documents',
    slug: 'affidavit-documents-true',
    seoTitle: '切結書範例：切結所附文件屬實',
    category: '切結與聲明',
    lead: '申請補助時機關要求切結檢附文件與正本相符。切結書的核心不是敘述，是那句法律責任。',
    watchOut: [
      '「如有不實，致他人權益受損害者，立切結書人願負法律責任」——沒有這句就只是一段敘述',
      '切結的事項要逐項列，含糊的「相關文件」會被要求補正',
      '很多機關有自己的制式切結書，以該機關的表格為準',
    ],
  },
  {
    key: 'affidavit_lost',
    slug: 'affidavit-lost-document',
    seoTitle: '切結書範例：證件遺失申請補發',
    category: '切結與聲明',
    lead: '證件遺失要補發，機關要你切結遺失屬實。遺失的時間、地點與尋找經過都要寫。',
    watchOut: [
      '遺失時間、地點與「遍尋未獲」的經過要具體',
      '身分證、權狀類的補發各機關規定不同，先確認要不要登報',
      '結尾同樣要有法律責任那句話',
    ],
  },
  {
    key: 'statement_income',
    slug: 'statement-no-income',
    seoTitle: '聲明書範例：聲明無固定工作收入',
    category: '切結與聲明',
    lead: '申請社福資格時要聲明自己的收入狀況。聲明的是你知道的事實，不要把推測寫成既成事實。',
    watchOut: [
      '只聲明自己知道的事實，別人的行為與收入不要替他寫',
      '起始時間要具體到月，機關會拿去對其他資料',
      '聲明書不等於證明，機關通常還會要求離職證明之類的佐證',
    ],
  },
];

export const PRIVATE_CATEGORIES = [...new Set(PRIVATE_DOCS.map((d) => d.category))];

export function findPrivateDocBySlug(slug) {
  return PRIVATE_DOCS.find((d) => d.slug === slug);
}

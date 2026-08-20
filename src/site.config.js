// GA4 評量 ID 沿用 yao.care 既有 Property 242590219 的網站串流。
// 這不是密鑰；服務帳號金鑰只放在主機上的 seo-ops 設定，不進 repo。
// 藥提醒科技有限公司在外部權威平台的身分。**不是本站憑空造的** —— 這些是 www.yao.care 的
// Organization 節點早就公開宣告的同一組，本站的 Organization 用同一個 @id
// （https://www.yao.care/#organization），卻一直沒帶 sameAs，等於同一個實體在兩個站說法不一致。
// 只收「真正在站外」的身分：Wikidata、GitHub 組織、Google 商家檔案、LINE 官方帳號。
// yao.care 那份 sameAs 另含約 45 個自家子網域，那是自我參照（我＝我），對實體判定沒有價值，
// 還會讓每一頁多背幾 KB，故不抄過來。
export const ORG_SAME_AS = [
  'https://www.wikidata.org/wiki/Q140265007',
  'https://github.com/yao-care',
  'https://www.google.com/maps?cid=12025785010180313919',
  'https://lin.ee/1F7s4pP',
];

export const SITE = {
  gaId: 'G-W7ZNBYKJHJ',
  linkerDomains: [
    'yao.care',
    'www.yao.care',
    'twtxgnn.yao.care',
    'www.ods.yao.care',
    'app.ods.yao.care',
  ],
};

// 站內與 app.ods.yao.care 的 CTA 一律用乾淨網址，不掛 utm_source／utm_medium。
// 這裡曾經每條連結都帶 UTM，兩個代價都實測到了：
//   1) Google 只認得帶參數那一版 —— /apply/ 的 referringUrls 只有 UTM 變體，
//      乾淨路徑一條純內鏈都沒有，收錄長期卡在 Discovered - currently not indexed。
//   2) 上面的 linkerDomains 已經把 yao.care／app.ods.yao.care 串成同一個 GA4 量測範圍，
//      跨站本來就保留原始來源；utm_medium=owned 反而會在 session 中途覆寫 session_source／medium，
//      把 google／organic 洗成 owned，讓「台灣自然搜尋訪客」這個北極星指標系統性低估。
// 入口位置改用 data-cta 屬性帶，由 Analytics.astro 的 cta_click 送成 link_content —— 
// 量得到一樣的東西，但不動到網址，也不動到歸因。
const serviceLink = (href, content) => ({ href, 'data-cta': content });

// ODS 的公開內容與實際服務是同一條漏斗；統一產生 CTA 屬性，讓 GA4 能分辨入口位置。
// 用法是展開而不是只取 href：<a {...SERVICE_LINKS.agencyApply('header_apply')}>
export const SERVICE_LINKS = {
  agencyApply: (content = 'agency_apply') => serviceLink('/apply/', content),
  selfRegister: (content = 'self_register') =>
    serviceLink('https://app.ods.yao.care/', content),
};

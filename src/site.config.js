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

const withCampaign = (url, content) =>
  `${url}${url.includes('?') ? '&' : '?'}utm_source=ods.yao.care&utm_medium=owned&utm_campaign=ods_service&utm_content=${content}`;

// ODS 的公開內容與實際服務是同一條漏斗；統一產生 CTA 連結，讓 GA4 能分辨入口位置。
export const SERVICE_LINKS = {
  agencyApply: (content = 'agency_apply') => withCampaign('/apply/', content),
  selfRegister: (content = 'self_register') =>
    withCampaign('https://app.ods.yao.care/', content),
};

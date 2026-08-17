// GA4 評量 ID 沿用 yao.care 既有 Property 242590219 的網站串流。
// 這不是密鑰；服務帳號金鑰只放在主機上的 seo-ops 設定，不進 repo。
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

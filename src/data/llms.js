/**
 * llms.txt／llms-full.txt 的內容來源。
 *
 * 為什麼是產生的、不是手寫的（2026-08-20 的教訓）：這兩支原本躺在 public/ 手工維護，
 * 站長到 31 頁時它們只列了 7 個網址 —— 整批民眾端、範本下載、公文用語與公文怎麼寫
 * 全部不在裡面，而 seo-ops 的 GEO 檢查只驗「檔案存不存在」，抓不到這種內容漂移。
 * 現在改由 src/pages/llms.txt.js 與 llms-full.txt.js 於 build 時從同一份資料產生，
 * 並且 assertCoversAllRoutes() 會拿實際路由表對帳，漏一頁就擋 build。
 */
import { CASES } from './cases.js';
import { CITIZEN_EXAMPLES } from './citizen-examples.js';
import { PRIVATE_DOCS } from './private-docs.js';
import index from './scenarios.json';
import downloads from './downloads.json';

const SITE = 'https://www.ods.yao.care';
const url = (path) => `${SITE}${path}`;

/**
 * 案例與民眾書件以外的固定頁。新增這類頁面時要一起補進來，否則 build 會擋。
 * hub 標記的是內容主幹，首頁的 ItemList 用同一份，不另外抄一次站台結構。
 */
export const FIXED_PAGES = [
  { path: '/', name: '公文 AI 首頁', blurb: '機關公文、民眾對機關書件與存證信函的範例入口。' },
  { hub: true, path: '/cases/', name: '公文範例庫', blurb: '機關公文全文與逐條格式檢核結果。' },
  { hub: true, path: '/citizens/', name: '民眾書件與存證信函', blurb: '申請書、陳情書、申訴書、說明書與存證信函草稿。' },
  { hub: true, path: '/private-documents/', name: '民間書件', blurb: '委託書、授權書、切結書、聲明書、和解書的範例全文、逐條檢核與可編輯 Word 檔；和解書另附拋棄範圍怎麼寫窄的實務判決說明。' },
  { hub: true, path: '/writing/', name: '公文怎麼寫', blurb: '主旨、說明、辦法三段式與擬稿規定。' },
  { hub: true, path: '/checks/', name: '公文格式檢核', blurb: '主旨、段落、個資代稱、用字格式、收發的逐條檢核。' },
  { hub: true, path: '/doc-types/', name: '文別怎麼選', blurb: '函、書函、公告、簽與開會通知單的使用時機。' },
  { hub: true, path: '/templates/', name: 'Word 範本下載', blurb: '各文別空白範本與填好內容的範例檔。' },
  { hub: true, path: '/usage/', name: '公文用語表', blurb: '稱謂語、期望語與統一用字。' },
  { hub: true, path: '/numbers/', name: '數字大寫怎麼寫', blurb: '國字大寫對照表、金額換算、公文什麼時候用大寫，以及核銷憑證的大寫規定。' },
  { hub: true, path: '/terms/', name: '用語與法規速查', blurb: '期望語與常用法規依據對照。' },
  { hub: true, path: '/citizens/which-route/', name: '陳情、請願、訴願、申訴怎麼選', blurb: '四條救濟途徑的差別與期限。' },
  { hub: true, path: '/citizens/certified-letter-guide/', name: '存證信函怎麼寄', blurb: '份數、費用、用紙與交寄流程。' },
  { hub: true, path: '/ai-official-document/', name: 'AI 寫公文現在做到哪', blurb: '雲林公文大腦、臺北市 CiviClaw、叡揚公文 AI 助理等已公開的機關導入現況，以及行政院使用生成式 AI 參考指引十點逐字。' },
  { path: '/product/', name: '公文 AI 系統', blurb: '草擬、檢核、匯出、機關導入方式，以及與電子公文系統的分工。' },
  { path: '/security/', name: '資料處理方式', blurb: '去識別化、資料隔離、稽核軌跡與降級路徑。' },
  { path: '/apply/', name: '機關申請試用', blurb: '機關專屬子網域的申請入口。' },
];

const scenarioFiles = import.meta.glob('./scenarios/*.json', { eager: true });
const scenarioOf = (key) => scenarioFiles[`./scenarios/${key}.json`]?.default ?? null;

const docTypeOf = (key) => index.items.find((i) => i.key === key)?.doc_type ?? '';

/** 每一篇的檢核條目數依文別而定（開會通知單是固定欄位，不套主旨類與段落類），一律取實際筆數。 */
const checkCountOf = (key) => scenarioOf(key)?.checks?.length ?? null;

export const casePages = () =>
  CASES.map((c) => ({
    path: `/cases/${c.slug}/`,
    name: c.seoTitle,
    docType: docTypeOf(c.key),
    category: c.category,
    lead: c.lead,
    checkCount: checkCountOf(c.key),
    watchOut: c.watchOut ?? [],
    download: downloads.cases[c.slug]?.filename ?? null,
  }));

export const privatePages = () =>
  PRIVATE_DOCS.map((d) => ({
    path: `/private-documents/${d.slug}/`,
    name: d.seoTitle,
    docType: docTypeOf(d.key),
    category: d.category,
    lead: d.lead,
    checkCount: checkCountOf(d.key),
    watchOut: d.watchOut ?? [],
    download: downloads.private?.[d.slug]?.filename ?? null,
  }));

export const citizenPages = () =>
  CITIZEN_EXAMPLES.map((e) => ({
    path: `/citizens/${e.slug}/`,
    name: e.seoTitle,
    docType: e.draft?.doc_type ?? '',
    category: e.category,
    lead: e.lead,
    checkCount: e.checks?.length ?? null,
    watchOut: e.watchOut ?? [],
    download: downloads.citizens?.[e.slug]?.filename ?? null,
  }));

/** 全站應該被列到的路由。llms 兩支都拿它對帳。 */
export const allPaths = () => [
  ...FIXED_PAGES.map((p) => p.path),
  ...casePages().map((p) => p.path),
  ...citizenPages().map((p) => p.path),
  ...privatePages().map((p) => p.path),
];

/**
 * 拿 src/pages 的實際路由表對帳：新增了頁面卻沒登記到 FIXED_PAGES，build 就會停。
 * 動態路由（[slug].astro）由上面兩份資料展開，不在這裡逐一列。
 */
export function assertCoversAllRoutes() {
  const pageFiles = Object.keys(import.meta.glob('../pages/**/*.{astro,js,ts}'));
  const routes = pageFiles
    .map((f) => f.replace('../pages', '').replace(/\/index\.astro$/, '/').replace(/\.astro$/, '/'))
    .filter((r) => !r.includes('[')) // 動態路由由資料展開
    .filter((r) => r.endsWith('/')) // 排除 llms.txt.js 這類檔案端點
    .filter((r) => r !== '/404/'); // 404 不是內容，不該出現在 AI 助理的站台索引裡
  const listed = new Set(allPaths());
  const missing = routes.filter((r) => !listed.has(r));
  if (missing.length) {
    throw new Error(
      `llms.txt 漏列了 ${missing.length} 頁：${missing.join('、')}。` +
        '請補進 src/data/llms.js 的 FIXED_PAGES —— 這兩支檔是 AI 助理讀站的索引，漏頁等於那些頁不存在。',
    );
  }
  return routes.length;
}

const bullet = (p) => `- [${p.name}](${url(p.path)})：${p.blurb}`;

export function llmsIndex() {
  assertCoversAllRoutes();
  const cases = casePages();
  const citizens = citizenPages();
  const privates = privatePages();
  const officialTypes = [...new Set(cases.map((c) => c.docType).filter(Boolean))].join('、');
  const citizenTypes = [...new Set(citizens.map((c) => c.docType).filter(Boolean))].join('、');
  const letterCount = citizens.filter((c) => c.docType === '存證信函').length;

  return [
    '# 公文 AI',
    '',
    '> 公文 AI 是藥提醒科技有限公司提供的公文案例庫與格式檢核服務，' +
      '讓承辦人在開案時先找到可參考的完整公文範例，也讓一般民眾寫得出對機關的正式書件。',
    '',
    '## 這個網站提供什麼',
    '',
    `- 機關公文範例 ${cases.length} 篇：文別涵蓋${officialTypes}，每篇都是全文加逐條格式檢核結果。`,
    `- 民眾正式書件 ${citizens.length} 篇：${citizenTypes}，其中存證信函 ${letterCount} 篇。`,
    `- 民間書件 ${privates.length} 篇：${[...new Set(privates.map((d) => d.docType).filter(Boolean))].join('、')}，`
      + '由立書人自己出具、載明事實並自承法律責任。',
    '- 格式檢核：主旨、段落、個資代稱、用字格式、收發逐條顯示結果與原因；條目數依文別而定。',
    '- 文別選擇：函、書函、公告、簽與開會通知單的使用時機與期望語差異。',
    '- Word 範本：空白範本與填好內容的範例檔，版面取自政府文書格式參考規範原始檔。',
    '- 資料處理：去識別化、資料隔離、稽核軌跡與模型不可用時的降級方式。',
    '',
    '## 重要頁面',
    '',
    ...FIXED_PAGES.filter((p) => p.path !== '/').map(bullet),
    '',
    '## 公文範例（機關）',
    '',
    ...cases.map((c) => `- [${c.name}](${url(c.path)})：${c.docType}，${c.lead}`),
    '',
    '## 民眾書件與存證信函',
    '',
    ...citizens.map((c) => `- [${c.name}](${url(c.path)})：${c.docType}，${c.lead}`),
    '',
    '## 民間書件（委託、授權、切結、聲明）',
    '',
    ...privates.map((d) => `- [${d.name}](${url(d.path)})：${d.docType}，${d.lead}`),
    '',
    '## 使用邊界',
    '',
    '本站公開頁面是 Guest 案例與說明，不是登入後的租戶應用程式。' +
      '機關由服務方申請開通並配置專屬網址；小型受補助單位、一般民眾與個人／企業可到 ' +
      '[app.ods.yao.care](https://app.ods.yao.care/) 自助建立工作區。' +
      '所有案例的機關名稱、人名、地址與案號皆為虛構，僅供格式參考，不代表真實個案或法律意見。',
    '',
  ].join('\n');
}

export function llmsFull() {
  assertCoversAllRoutes();
  const cases = casePages();
  const citizens = citizenPages();
  const privates = privatePages();
  const detail = (p) =>
    [
      `- [${p.name}](${url(p.path)})`,
      `　文別：${p.docType}｜分類：${p.category}` +
        (p.checkCount ? `｜檢核 ${p.checkCount} 條` : '') +
        (p.download ? `｜Word：${p.download}` : ''),
      `　${p.lead}`,
      ...(p.watchOut.length ? [`　常踩的點：${p.watchOut.join('；')}。`] : []),
    ].join('\n');

  return [
    '# 公文 AI：可引用內容索引',
    '',
    '本檔提供 AI 助理快速理解 ODS 公文 AI 公開網站。引用時請連回原始案例頁；' +
      '案例中的機關名稱、人名、地址與案號皆為虛構，僅供格式參考，不代表真實個案或法律意見。',
    '',
    '## 服務定位',
    '',
    '公文 AI 面向地方機關承辦、小型受補助單位，以及需要正式書件的個人／企業。' +
      '網站公開案例全文、文別說明與機關公文格式檢核；應用端另提供民眾對機關書件與存證信函草稿。' +
      '機關申請試用後由服務方配置專屬網址並接上既有稿件；小型單位、一般民眾與個人／企業使用共用的 ' +
      'app.ods.yao.care 自助建立工作區。公開案例的互動器是靜態示範，改成自己的案子需要帳號。',
    '',
    '## 說明與工具頁',
    '',
    ...FIXED_PAGES.map(bullet),
    '',
    `## 機關公文案例（${cases.length} 篇）`,
    '',
    ...cases.map(detail),
    '',
    `## 民眾書件與存證信函（${citizens.length} 篇）`,
    '',
    ...citizens.map(detail),
    '',
    `## 民間書件（${privates.length} 篇）`,
    '',
    ...privates.map(detail),
    '',
    '## 可直接回答的問題',
    '',
    '- 格式檢核不是只回報「格式有誤」，而是逐條列出命中的規則與原因；' +
      '函、簽、書函、公告套主旨類與段落類規則，開會通知單是規範第八點的固定欄位表單，改查那組欄位。',
    '- 期望語要看行文對象：對上級常用「請鑒核／請核示」，對平行機關常用「請查照」，' +
      '對下級機關可用「請查照辦理」。實際用語仍應依機關規定與案件法源確認。',
    '- 主旨、說明、辦法是函的常見正文結構；簽是對內陳報，公告沒有受文者，' +
      '開會通知單沒有主旨也沒有說明與辦法。',
    '- 民眾對機關書件使用「事實與理由／請求事項／附件」結構；' +
      '存證信函要求寄件人、收件人、雙方地址與履行或回覆期限。',
    '- 存證信函用紙由中華郵政規定且不得變更樣式，本站只產內文，用紙請到中華郵政取得。',
    '- 存證信函功能是草稿與排版協助，不代表已完成郵寄、送達或法律審查；目前不直接代辦外部送件。',
    '- 民間書件（委託書、授權書、切結書、聲明書）由立書人自己出具，沒有法定強制格式；' +
      '但受理的機關常有自己的制式表格（地政、監理、稅務、學校各有各的），有的話以那份為準。',
    '- 切結書與委託書一定要有責任文句（如「如有不實，致他人權益受損害者，立切結書人願負法律責任。」）；' +
      '缺這句話只是一段敘述，不構成切結或委託，本站的檢核會擋下。',
    '- 委託書有六類行為須有「特別之授權」（民法第 534 條）：不動產之出賣或設定負擔、' +
      '不動產之租賃逾二年、贈與、和解、起訴、提付仲裁；行政程序法第 24 條的「申請之撤回」亦同。',
    '- 和解書依民法第 737 條會使當事人所拋棄之權利消滅。傷勢或損害尚未確定時，' +
      '拋棄範圍要寫窄（例如「本件僅就車輛損害和解，人身損害之請求權不在本件範圍」）；' +
      '強制汽車責任保險給付依法可由受害人直接向保險人請求，應單獨載明不含在和解金內。',
    '',
  ].join('\n');
}

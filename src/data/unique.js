/**
 * 每頁獨有內容（2026-10-03 起）。
 *
 * 為什麼有這一層：收錄在 2026-10-02～03 從 66/66 掉到 28/66（Crawled - currently not indexed），
 * 技術面全部排除，判定是頁面高度模板化 —— 案例頁 <main> 裡與他頁共用的字常佔七成以上
 * （逐條檢核清單、下載說明、同類案例、CTA）。這一層放的是「只有這一頁才有」的內容：
 * 使用情境、逐段說明、實際常見錯誤與改法、與相近文件的差異、法源與出處、常見問題。
 *
 * 檔案位置對應網址：/cases/grant-settlement/ → unique/cases/grant-settlement.json，
 * 首頁 → unique/home.json，/cases/ → unique/cases.json。一頁一檔，所以多人並行填寫不會撞檔。
 * 欄位規格與守門見 scripts/check-unique.mjs（`node scripts/check-unique.mjs <檔>` 單檔可跑）。
 * 欄位缺就不渲染；檔案不存在等於這頁還沒補。
 */
const FILES = import.meta.glob('./unique/**/*.json', { eager: true, import: 'default' });

/** @param {string} key 網址路徑去頭尾斜線，例如 'cases/grant-settlement'；首頁用 'home' */
export const uniqueFor = (key) => FILES[`./unique/${key}.json`] ?? null;

/** 給 FAQPage 結構化資料用：只回畫面上真的會渲染的問答（官方要求問答對人可見）。 */
export const uniqueFaqEntities = (data) =>
  (data?.faq ?? []).map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  }));

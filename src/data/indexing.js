/**
 * 收錄範圍的單一真實來源（2026-10-04 用戶拍板）。astro.config.mjs（sitemap、轉址）與
 * BaseLayout（robots meta）都讀這一份，不要在別處另列清單。
 *
 * 為什麼縮範圍：2026-10-01 起全站 66/66 變成 Crawled - currently not indexed（首頁也是），
 * 技術面全數正常、期間沒有部署，與 Google 9 月 spam update 重疊，判定為全站層級的品質降級。
 * 用戶查過 GSC：人工判決處罰、安全性問題都是「未偵測到任何問題」。處置是把離公文主體最遠、
 * 法律風險最高的民間書件與遺囑先退出索引，並把內容相近的三組配對頁合併。
 *
 * - NOINDEX：頁面照常存在、站內照常連，`<meta name="robots" content="noindex, follow">`，
 *   不進 sitemap。robots.txt 絕不能擋這些路徑 —— Google 要爬得到才看得見 noindex。
 * - 合併：被併的網址在 GitHub Pages 上沒有伺服器端 301，改用 Astro `redirects` 產出的
 *   轉址頁（meta refresh 0 秒＋canonical 指向主頁＋noindex），也不進 sitemap。
 *
 * 重新開放的條件寫在 seo-ops playbooks/ods.yao.care.md 的 strategy 區塊。
 */
import { CASES } from './cases.js';
import { PRIVATE_DOCS } from './private-docs.js';

/** 退出索引的路徑（含頭尾斜線）。民間書件入口頁 /private-documents/ 本身保留收錄，讓使用者從搜尋進得來。 */
export const NOINDEX_PATHS = new Set([
  ...PRIVATE_DOCS.filter((d) => !d.mergedInto).map((d) => `/private-documents/${d.slug}/`),
  '/wills/',
]);

/** 被併掉的網址 → 主頁段落。 */
export const REDIRECTS = Object.fromEntries([
  ...CASES.filter((c) => c.mergedInto).map((c) => [`/cases/${c.slug}`, `/cases/${c.mergedInto}/#v-${c.slug}`]),
  ...PRIVATE_DOCS.filter((d) => d.mergedInto).map((d) => [
    `/private-documents/${d.slug}`,
    `/private-documents/${d.mergedInto}/#v-${d.slug}`,
  ]),
]);

const norm = (p) => (p.endsWith('/') ? p : `${p}/`);
export const isNoindex = (pathname) => NOINDEX_PATHS.has(norm(pathname));
/** sitemap 用：退出索引的與被轉址的都不列。 */
export const inSitemap = (url) => {
  const p = norm(new URL(url).pathname);
  return !NOINDEX_PATHS.has(p) && !Object.keys(REDIRECTS).some((r) => norm(r) === p);
};

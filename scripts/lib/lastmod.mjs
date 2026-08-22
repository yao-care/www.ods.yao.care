// 每頁的 <lastmod>：給 @astrojs/sitemap 的 serialize 用。
//
// 為什麼需要（2026-08-20 實測）：上線後 sitemap 27 個 <url> 只有 <loc>，一個 lastmod 都沒有。
// GSC 顯示 Google 每天都有下載 sitemap（0 錯誤），但逐頁查 URL Inspection，全站最後爬取時間
// 停在 08-17／08-18 —— 08-19 補的內鏈與 08-20 補的結構化資料它一次都沒看到，
// 於是 8 個民眾端子頁的 referringUrls 永遠是 0、永遠停在 Discovered 未收錄。
// 沒有 lastmod，重新下載 sitemap 等於告訴 Google「什麼都沒變」。
// （同一課見 seo-ops MAINTENANCE.md 的 arthurs.tw：lastmod 補上前 32 頁沒被告知過。）
//
// 日期取自 git commit 時間，不是 build 時間 —— build 時間會讓每次部署都宣稱「全站都改了」，
// Google 幾次之後就不信這個欄位了。
import { execFileSync } from 'node:child_process';

const iso = (paths) => {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cI', '--', ...paths], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return out || null;
  } catch {
    return null;              // 非 git 環境／淺 checkout 抓不到 → 交給呼叫端退回 build 時間
  }
};

const newest = (...dates) => dates.filter(Boolean).sort().pop() ?? null;

// 🔴 **刻意不再算「影響每一頁的檔案」**（2026-08-22 移除）。
//    原本有 GLOBAL = ['src/layouts','src/components','src/styles','src/site.config.js']，
//    再讓每頁取 newest(globalDate, 自己的日期, 區段資料日期)——版面或元件一動，
//    全站 lastmod 一起跳到那天。實測後果：線上 sitemap 31 個網址**全部**同一個日期。
//    這跟本檔下面那段「刻意逐段列 SECTION_DATA，不要一律吃整個 src/data，
//    那會讓任何一份資料變動就把全站 lastmod 一起推新」是同一個道理，
//    只是 GLOBAL 自己犯了它警告過的錯。
//    （seo-ops 守則亦同：olderkkk 實測 SHARED 把 65 頁裡 60 頁拉成同一天；
//     forme-cro.org 的同型實作 2026-08-22 一併修掉。）

// 各區段的資料相依。刻意逐段列，不要一律吃整個 src/data ——
// 那會讓任何一份資料變動就把全站 lastmod 一起推新，等於又回到「宣稱全站都改了」。
const SECTION_DATA = {
  cases: ['src/data/cases.js', 'src/data/scenarios', 'src/data/scenarios.json', 'src/data/downloads.json'],
  citizens: ['src/data/citizen-examples.js', 'src/data/downloads.json'],
  templates: ['src/data/downloads.json', 'src/data/gov-format.json'],
  checks: ['src/data/scenarios'],
  'doc-types': ['src/data/cases.js', 'src/data/citizen-examples.js', 'src/data/scenarios.json'],
};

/** 由網址路徑推回產生它的 .astro 檔（靜態頁優先，其次同層的動態路由）。 */
const routeFiles = (segments) => {
  if (!segments.length) return ['src/pages/index.astro'];
  const dir = `src/pages/${segments.join('/')}`;
  return segments.length === 1
    ? [`${dir}/index.astro`, `${dir}.astro`]
    : [`${dir}/index.astro`, `${dir}.astro`, `src/pages/${segments.slice(0, -1).join('/')}/[slug].astro`];
};

export function createLastmod(buildTime = new Date().toISOString()) {
  let warned = false;

  return (url) => {
    const segments = new URL(url).pathname.split('/').filter(Boolean);
    const section = segments[0];
    const date = newest(
      iso(routeFiles(segments)),
      SECTION_DATA[section] ? iso(SECTION_DATA[section]) : null,
    );
    if (!date && !warned) {
      warned = true;
      console.warn('[sitemap] 抓不到 git commit 時間（淺 checkout？），lastmod 退回 build 時間');
    }
    return date ?? buildTime;
  };
}

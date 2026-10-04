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
  cases: ['src/data/cases.js', 'src/data/scenarios', 'src/data/scenarios.json'],
  citizens: ['src/data/citizen-examples.js'],
  templates: ['src/data/downloads.json', 'src/data/gov-format.json'],
  checks: ['src/data/scenarios'],
  'doc-types': ['src/data/cases.js', 'src/data/citizen-examples.js', 'src/data/scenarios.json'],
  // 這兩頁自 2026-09-27 起也有可下載的檔（領據、數字大寫對照表）；下載清單改走下面的 DOWNLOADS 逐頁投影。
  receipt: ['src/data/receipt.js', 'src/data/voucher-rule.json'],
  numbers: ['src/data/uppercase-number.js', 'src/data/voucher-rule.json'],
};

// 🔴 downloads.json 是 build-docx 產的「全站下載清單」，一份檔被 50 幾頁吃到（2026-10-04 補）。
//    原本把它整份列進 cases／citizens／receipt／numbers 的 SECTION_DATA：commit de4c4ac 只改了
//    借據那一筆的檔名，線上 sitemap 就有 53 頁 lastmod 跳到同一刻——案例頁一個字都沒變。
//    改成「逐頁投影」：只取該頁真的讀到的那幾筆（自己的檔＋同文別空白範本＋版面出處），
//    沿 git 歷史找最後一次「投影結果」有變的 commit。/templates/ 列的是全部檔案，仍吃整份。
const DOWNLOADS = 'src/data/downloads.json';
const blankFor = (d, docType) => (d.templates || []).find((t) => t.docType === docType) ?? null;
const DOWNLOAD_VIEW = {
  // 明細頁：自己的那份＋同文別空白範本（docType 取自己那筆）＋版面出處名稱
  cases: (d, slug) => slug && [d.cases?.[slug], blankFor(d, d.cases?.[slug]?.docType), d.source?.name],
  citizens: (d, slug) =>
    slug === 'certified-letter-guide'
      ? [blankFor(d, '存證信函')]
      : slug && [d.citizens?.[slug], blankFor(d, d.citizens?.[slug]?.docType), d.source?.name, d.postalGuide],
  receipt: (d) => [(d.extras || []).filter((x) => x.page === 'receipt/'), (d.templates || []).length],
  numbers: (d) => [(d.extras || []).filter((x) => x.page === 'numbers/')],
};

let dlHistory = null;   // [{ date, data }]，新到舊
const downloadsHistory = () => {
  if (dlHistory) return dlHistory;
  dlHistory = [];
  try {
    const log = execFileSync('git', ['log', '--format=%H %cI', '--', DOWNLOADS], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    for (const line of log ? log.split('\n') : []) {
      const [sha, date] = line.split(' ');
      try {
        const raw = execFileSync('git', ['show', `${sha}:${DOWNLOADS}`], {
          encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 16 << 20,
        });
        dlHistory.push({ date, data: JSON.parse(raw) });
      } catch { dlHistory.push({ date, data: null }); }
    }
  } catch { /* 非 git 環境 → 空歷史，呼叫端退回其他日期 */ }
  return dlHistory;
};

/** 該頁讀到的下載清單投影，最後一次改變的 commit 時間。 */
const downloadsDate = (section, slug) => {
  const view = DOWNLOAD_VIEW[section];
  if (!view) return null;
  const hist = downloadsHistory();
  const key = (d) => (d ? JSON.stringify(view(d, slug) ?? null) : null);
  for (let i = 0; i < hist.length; i++) {
    const cur = key(hist[i].data);
    const prev = i + 1 < hist.length ? key(hist[i + 1].data) : undefined;
    if (cur !== prev) return hist[i].date;   // 沒有下載的頁投影恆為空，只會落到最舊那筆，不會壓過其他日期
  }
  return null;
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
      downloadsDate(section, segments[1]),
      // 每頁獨有內容（2026-10-03 起，src/data/unique.js）：一頁一檔，只推動那一頁。
      iso([`src/data/unique/${segments.join('/') || 'home'}.json`]),
    );
    if (!date && !warned) {
      warned = true;
      // 最常見的原因是**新頁面還沒 commit**（commit 之後就有日期了），其次才是 CI 淺 checkout。
      // 把網址印出來，才不用為了一行警告去翻整份 sitemap。
      console.warn(`[sitemap] ${url} 抓不到 git commit 時間（新增未 commit 的頁面？淺 checkout？），lastmod 退回 build 時間`);
    }
    return date ?? buildTime;
  };
}

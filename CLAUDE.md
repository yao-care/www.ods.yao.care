# www.ods.yao.care

公文 AI 訂閱服務的行銷站（Astro → GitHub Pages）。應用本體在 `/root/ods.yao.care`（private repo），
本站與它**完全分離**：純靜態、不呼叫應用的 API。

**站的主體是公文案例庫**，不是產品簡報 —— 承辦開案時搜的是「補助核銷 公文 範例」，不是「公文 AI」。
產品介紹是配角。

## 開工前先建立正確的網站模型

處理網域、註冊、使用流程、GA4、SEO、AEO 或 GEO 前，先讀本檔的「網域架構與客群」及應用 repo `/root/ods.yao.care/CLAUDE.md` 同名章節。以程式碼、測試與部署設定為準，不從 hostname 自行推測流程。

- `www.ods.yao.care` 是本 repo 的公文案例庫、純靜態 Guest 體驗與行銷站；案例全文和檢核結果預先渲染進 HTML。
- `ods.yao.care` 是 apex；目前部署定義為 301 導向 `www.ods.yao.care`。
- `app.ods.yao.care` 是小型受補助單位、一般民眾與個人／企業共用的應用入口，可自助建立工作區。
- 機關使用專屬 `<機關>.ods.yao.care`，由服務方建立租戶和邀請；行銷站的 `/apply/` 是這條申請路徑。
- Guest 體驗中會改變資料的動作導向 `/apply/` 或 `app.ods.yao.care`；不要把它描述成一般登入後產品流程。

## 里程碑（帶日期的歷史；**現況一律用下面的指令查，不要信本表**）

| 事件（日期） | 內容 |
|---|---|
| 2026-08-14 | 骨架、設計 token、守門腳本、案例頁全數建好；repo＋GitHub Pages＋deploy workflow 上線（用戶完成） |
| 2026-08-14 | 申請表單 Worker 全通：`ods-apply-form.lightman-chang.workers.dev`（CF 帳號 Lightman，用戶拍板）、`BREVO_API_KEY` 已設（副本 secrets.md § SMTP）、以 Brevo `delivered` 事件驗證、apply 頁 `ENDPOINT` 已接上 |
| 2026-08-16 | 品牌色與表單接線 push 上線 |
| 2026-08-17 | apex 改由主機 NPM 轉址（見下段） |

2026-08-26：第三波關鍵字（見 `docs/keyword-validation/2026-08-26-market-vocabulary.md`）——
新增 `/ai-official-document/`、案例庫 8 → 23、`/writing/` 補稿面欄位與核擬流程兩節。
頁數與收錄現況一律用下面的指令查。

2026-08-17：Phase 4–5（Slack、GA4/GSC、seo-ops 納管）已接通。共用 GA4 Property 242590219、GSC `sc-domain:yao.care`、Bing sitemap／IndexNow 與既有 SEO Slack 報表；正式狀態查 `grep ods /etc/cron.d/seo-ops`、`gh run list` 與 `seo-data/`。www.yao.care → ODS → 申請／自助註冊是立即運作的導流漏斗，2–4 週只作轉換比較，不是導流前置等待。

現況查法：`gh repo view yao-care/www.ods.yao.care`、`gh run list`、
`curl -s -o /dev/null -w '%{http_code}' https://www.ods.yao.care/`、
頁數看 `pnpm build` 輸出、Worker 投遞看 Brevo `/v3/smtp/statistics/events`。

DNS 已就緒（用戶設定）：www CNAME 到 `yao-care.github.io`；apex `ods.yao.care` 於
2026-08-17 改 A/AAAA 指主機、由 NPM redirection host（自簽 LE 憑證）301 到 www——
GitHub 不為「巢狀 www」的上層網域簽憑證，掛 GitHub 時 https apex 恆憑證警告。
`*.ods.yao.care` 亦 A/AAAA 指向主機（那是應用，不是本站）。

## 技術棧與規範

Astro 6 + @astrojs/sitemap，pnpm，無框架、無外部 CDN。

**設計規範五條**（`pnpm check:design` 自動擋）：
1. 禁 px 字級，一律 `var(--text-*)`，最小 18px
2. 顏色只准寫在 `src/styles/variables.css`（oklch＋hex fallback）
3. 禁 `!important`
4. 禁外部 CDN
5. `src/` 下只准 `styles/{variables,global}.css` 兩支 css，元件樣式寫 scoped `<style>`

語意色 `--color-{pass,critical,warn,info}` 與應用端 `ods.yao.care/public/css/tokens.css` **同值**，
兩邊視覺一致，勿各自改。

品牌色已定案（2026-08-14，用戶授權代決）：主色「墨青」`oklch(0.38 0.09 250)`／`#154470`
—— 與應用端 tokens.css 整套冷藍軸（色相 250）同軸；強調色「朱磚」`oklch(0.58 0.13 40)`／`#b95c3a`
—— 色相 40 與語意色 critical(25)、warn(80) 保持距離，不會被誤讀成檢核狀態。

## 一律正體字（`pnpm check:zh-hant` 自動擋）

**Unicode 沒有「繁體中文區間」**——繁簡同住 CJK 統一漢字 U+4E00–U+9FFF（「該」U+8A72 與它的
簡化形 U+8BE5 都在區間內），所以「檢查碼點在不在繁體區」做不到。能用程式做的只有逐字比對
一份簡體專用碼點集合：`src/data/simplified-chars.json`（3730 字，要 commit），
由 `scripts/gen-simplified-set.py` 從 OpenCC 字典與 Unicode Unihan 推導。

集合刻意**放行**兩類字，收進來會在合法公文上狂誤報：

- **雙身分字 99 個**：`后里面台志表出合回同借几云谷千只…` 本身是正體字，只是同時也是別字的
  簡化形。實測本站公文案例語料出現 **250+ 次**（合 88、出 35、面 26、回 20、里 15、同 12、
  借 9、志 8、表 4＝符合／提出／書面／回覆／里長／同時／借款／陳志宏／代表），
  同一份語料裡純簡體字 **0 次**。
- **異體選字與台灣標準字**：`群羣／秘祕／峰峯／床牀／灶竈`——台標與舊字形之爭，不是簡繁。

應用端 `ods.yao.care` 的 24 條檢核裡那條 `no_simplified`（critical）用的是**同一份集合**
（`src/lib/simplified-chars.json`）。原本它是 81 字的手寫清單，漏掉「這、與、錄、門、頁、測、
試、樣、獨、經、額、補、東、車、馬、鳥、龍、飛、歲、眾、開、時、麼、來」等常見字的簡化形，
也誤收了「據」的異體（`拮据` 在正體中合法）。兩邊集合要同步，改一邊記得改另一邊。

## 案例資料從哪來（不要手改）

`src/data/scenarios/*.json` 與 `knowledge.json` 是 **ods 應用產出的**，不是手寫的：

```bash
cd /root/ods.yao.care
ODS_DATA_DIR=/tmp/…/demo-llm node --env-file-if-exists=.env scripts/export-demo.js --llm /tmp/…/out
cp -r /tmp/…/out/scenarios /tmp/…/out/scenarios.json /tmp/…/out/knowledge.json /root/www.ods.yao.care/src/data/
```

**一律用 `--llm`**：不加的話拿到的是規則引擎（降級路徑）產物，等於用產品最差的路徑做廣告。
產品改版後重跑重烘，兩邊才不會漂移。JSON 結構刻意與 `/guest/scenarios` API 一致，
日後要改成打即時 API，前端不用改解析。

同一次 `--llm` 也會產出 `ods.yao.care/src/lib/demo-drafts.json`，那是**線上 Guest 體驗**
播種用的成品 —— 兩邊因此吃同一份，訪客從行銷站點進應用不會看到品質落差。
重烘後要一起處理：應用端 commit `demo-drafts.json` 並 `seed-demo.js --force` ＋ `pm2 restart ods`，
本站 copy `scenarios/`、`scenarios.json`、`knowledge.json`。

兩道守門盯著這件事：
- 本站 `pnpm check:scenarios`（在 build 內）驗 engine 必須是 `llm`、檢核不得有未通過、
  開會通知單不得有主旨或段落。
- 應用端 `npm test` 的「烘好的展示成品與現行檢核規則一致」會把每一篇重跑 `validateDraft`
  跟烘好的結果比對 —— 改了檢核規則卻沒重烘，那裡會 fail。

`src/data/cases.js` 是本站自己的欄位（slug、搜尋用標題、分類、常踩的點），與上面互補。

開會通知單自 2026-08-20 起由應用端直接產規範第八點的固定欄位（`draft.fields` 的
`meeting_topic`／`meeting_time`／`meeting_place`／`meeting_chair`／`meeting_contact`／
`attendees`／`observers`／`remarks`），`subject` 為空字串、`sections` 為空陣列 ——
**它不是三段式，沒有主旨也沒有說明／辦法**。網頁與 Word 共用 `src/data/meeting.js` 重排；
`cases.js` 的 `meeting` 只留作重烘前舊資料的後備。

檢核條目數也依文別而定：函／簽／書函 24 條，公告 23 條，開會通知單 22 條。
開會通知單不套主旨類 6 條與段落類 5 條，改查那組固定欄位；**公告不套「主旨期望語」那一條**
（2026-08-26 修正）—— 手冊對公告只要求主旨「扼要敘述公告之目的及要求」，沒有要求期望語，
附錄 6 的兩則公告作法舉例主旨也都沒有（「主旨：公告民國00年出生的役男應辦理身家調查。」），
套下去等於連手冊自己的範例都會被判不合格。頁面上不要再寫死「24 條」，用 `payload.checks.length`；
CaseDemo 的進度文字也走 `data-check-count`，不寫死。`/checks/` 與 `/cases/` 的標題、
說明與 FAQ 也一律 import `scenarios/grant_report.json` 與 `scenarios/meeting.json` 取 `checks.length`。

## 體驗器的設計（`src/components/CaseDemo.astro`）

- **漸進增強**：伺服器端就把公文全文與逐條檢核渲染進 HTML，沒有 JS 時整頁照樣可讀 ——
  這是本站能被搜到的關鍵，**不要改成 JS 注入**
- JS 載入後才收合成互動流程：填事由 → 產生草稿（分段進度）→ 結果 → 動作列
- 凡會改變狀態的動作（改事由、改文別、編輯、儲存、簽核）一律攔截，跳 gate 對話框導向
  申請頁或 `app.ods.yao.care` 自助註冊
- **下載 Word 不攔截**：範例本身是固定內容，下載不是狀態改變，而且「公文格式 word 範本下載」
  正是承辦會搜的字串。被攔的是「匯出你自己改過的稿件」，那條路本來就先被編輯 gate 擋住了

## 內鏈結構是這個站的收錄命脈（2026-08-19 的教訓）

民眾端 10 頁上線後只有 2 頁被 Google 爬，8 頁停在 Discovered／unknown，`referringUrls` 全 0；
同期機關端 9 頁全部 indexed。差別只在內鏈：機關端有首頁直連＋文別頁直連＋案例互連三條路，
民眾端只有 `/citizens/` 一個入口。**新增任何一批頁面時，同一回合就要補上這三條路**，
只靠 sitemap 不會被爬。

**收錄與內鏈的現況一律用這支查**（全站逐頁，`referringUrls` 為 0 就是「Google 眼中沒人連它」，
那才是卡 Discovered 的原因；單頁把 sitemap 那行換成該網址即可）：

```bash
node -e "
import('/root/seo-ops/lib/google.mjs').then(async g=>{
  const SA='/root/.config/yaocare/ga4-sa.json', SITE='sc-domain:yao.care';
  const xml=await (await fetch('https://www.ods.yao.care/sitemap-0.xml')).text();
  for (const u of [...xml.matchAll(/<loc>([^<]+)/g)].map(m=>m[1])) {
    const r=await g.inspectUrl(SA,SITE,u);
    console.log([r.coverageState,(r.lastCrawlTime||'-').slice(0,10),
      'ref='+(r.referringUrls||[]).length, u].join(' | '));
  }})"
```

⚠️ 這支一頁約 3–4 秒（URL Inspection API 有速率限制），全站跑要幾分鐘，別放在前景等。

`/templates/` 是為「公文格式 word」「公文範本下載」這類高意圖字開的落地頁，
同時也是全站每一頁都連得到的 Word 下載入口（導覽列「格式與用語」群組內）。

**站外那一條也算內鏈**：`www.yao.care/ai/ods/` 是 ODS 在 yao.care 的產品落地頁，
2026-08-20 實查時它當天就被重爬過，是本站最快的被發現管道；那頁同日補上民眾書件與參考內容的
產品段落（此前只描述機關側）—— **改的是 `/root/www.yao.care`，兩邊要一起維持**。
seo-ops 有一條「不為了 SEO 從自家站連自家站」的紅線，2026-08-20 用戶澄清過**判準是動機與內容，不是有沒有跨網域**：官網產品頁把自家產品講完＝產品說明，照做；為了灌連結而建的互推連結牆＝禁。所以那頁只寫 ODS 實際提供什麼。（判準原文見 `.claude/ops/seo-ops.md` 的互連那節）
現況查法（那頁現在連過來幾條、有沒有被重爬）：

```bash
curl -s https://www.yao.care/ai/ods/ | grep -o 'href="https://www\.ods\.yao\.care[^"]*"' | sort | uniq -c
node -e "import('/root/seo-ops/lib/google.mjs').then(async g=>{
  const r=await g.inspectUrl('/root/.config/yaocare/ga4-sa.json','sc-domain:yao.care','https://www.yao.care/ai/ods/');
  console.log(r.coverageState, r.lastCrawlTime);})"
```

## 長頁一定要有錨點（2026-08-20 的教訓）

上線後逐頁查已上線的 HTML，長參考頁的 `id=` 屬性數量**全部是 0** ——
沒有錨點就沒有段落深連結，Google 的「跳至相關部分」也沒有落點可指；
像 pinned query「公文數字寫法」對應的是 `/writing/` 裡的一節，在此之前連不進去。

**判準不是清單，是頁型**：只要一頁有多個 `<h2>` 章節、是拿來「查」的參考頁（不是列表頁、不是案例明細），
就該有錨點與「本頁章節」。哪些頁現在有、有幾個，一律查：

```bash
# 已 build 的產物（開發時用這個，最快）。注意不能用 `grep -c`——Astro 壓過的 HTML
# 一頁擠成一行，grep -c 數的是行數，每頁都會印 1；也不能用 dist/**/ ——
# 預設沒開 globstar，只吃得到一層，兩層深的 /citizens/<slug>/ 會被漏掉。
find dist -name index.html | while read f; do
  n=$(grep -o ' id="' "$f" | wc -l); [ "$n" -gt 0 ] && echo "$n ${f#dist}"; done | sort -rn
# 線上實況（同樣的計數方式，逐頁抓）
for u in $(curl -s https://www.ods.yao.care/sitemap-0.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//'); do
  echo "$(curl -s "$u" | grep -o ' id=\"' | wc -l) $u"; done | sort -rn
```

作法：頁面 frontmatter 宣告一份章節物件當**單一真實來源**，`<h2>` 的 `id` 與文字都從那份取，
`src/components/PageToc.astro` 吃同一份陣列產出「本頁章節」：

```astro
const S = { numbers: { id: 'numbers', label: '六、數字怎麼寫' }, … };
<PageToc items={Object.values(S)} />
<h2 id={S.numbers.id}>{S.numbers.label}</h2>
```

漂移由 `pnpm check:anchors`（在 `astro build` **之後**跑，掃 `dist/**/*.html`）守門：
同頁 `href="#x"` 找不到 `id="x"` 就擋 build。導覽列是 sticky，錨點落點靠 `global.css`
的 `:target { scroll-margin-top }`，改導覽列高度記得一起改。

## sitemap 的 `lastmod` 是易碎品，別零星 commit（2026-08-20 的教訓）

`scripts/lib/lastmod.mjs` 取的是「該頁自己的檔案，與**逐段列出**的相依資料（`SECTION_DATA`）
的 git commit 時間**取最大值**」。原本還有一份 GLOBAL（`src/layouts`、`src/components`、
`src/styles`、`src/site.config.js`），動到任何一個就把全站 `lastmod` 一起推新 ——
2026-08-22（commit 541946f）已移除，因為線上實測 31 個網址**全部**同一個日期。

現在動到版面不會再拉動全站，但**同一份資料被多頁吃到時仍會一起跳**（例如重烘案例資料，
所有案例頁一起動）。如果連續幾天每天推一點小修，這個欄位一樣會退化成 build 時間，
等於天天對 Google 宣稱「全站都改了」，幾次之後它就不信這個欄位 ——
而這個欄位正是上線初期唯一能催重爬的訊號（沒有它的那幾天，Google 每天下載 sitemap，
逐頁查 URL Inspection 卻停在同一個爬取時間）。

**規矩：內容或版面要改就攢起來一次推，不要為了「順手」分成好幾個 commit。**
查現在全站是不是同一個時間（全部相同＝最近一次動到全域檔）：

```bash
curl -s https://www.ods.yao.care/sitemap-0.xml | grep -o '<lastmod>[^<]*' | sort | uniq -c
git -C /root/www.ods.yao.care log -1 --format=%cI -- src/layouts src/components src/styles src/site.config.js
```

## CTA 一律用乾淨網址，入口位置用 `data-cta`（2026-08-20 的教訓）

`SERVICE_LINKS`（`src/site.config.js`）產出的是**屬性物件**，用展開而不是取 href：

```astro
<a {...SERVICE_LINKS.agencyApply('header_apply')}>機關申請試用</a>
```

原本它會在網址後面掛 `?utm_source=ods.yao.care&utm_medium=owned&...`，兩個代價都實測到了：

- **收錄**：GSC 對 `/apply/` 唯一已知的 referringUrl 就是那個帶參數版本，乾淨路徑一條純內鏈都沒有，
  狀態長期卡在 `Discovered - currently not indexed`。
- **歸因**：`SITE.linkerDomains` 已經把 `yao.care`／`www.ods.yao.care`／`app.ods.yao.care` 串成同一個
  GA4 資源（三站共用 `G-W7ZNBYKJHJ`），cross-domain linker 本來就保留原始來源；`utm_medium=owned`
  反而會覆寫 `session_source`／`medium`，把 google／organic 洗成 owned，
  讓「台灣自然搜尋訪客」這個北極星指標系統性低估。

入口位置改由 `data-cta` 屬性帶，`Analytics.astro` 的 `cta_click` 讀它送成 `link_content`
（`utm_content` 留作 fallback，站外帶參數進來的一樣量得到）。**`www.yao.care` 那側連過來的連結
同樣不掛 UTM**（`src/pages/ai/ods.astro`、`src/products.config.ts` 的 `cta.content`），
兩邊要一起維持，只改一邊等於沒改。

Word 下載另有 `file_download` 事件（file_name／file_extension／link_url／link_text）——
同站 `/downloads/**` 的點擊原本會被 `cta_click` 的判斷整個略過，一筆都沒送，
而「公文格式 word」正是站上意圖最高的一組字。

## 站徽與分享圖是產生的（不要手改，也不要在 build 時產）

`public/favicon.{ico,svg}`、`public/apple-touch-icon.png`、`public/og/*.png` 與清單
`src/data/og.json` 全部由 `pnpm gen:brand`（`scripts/gen-brand-images.py`）產生，**產物要 commit**。

```bash
pnpm build       # 先有 dist/，標題才有得取
pnpm gen:brand   # 產站徽與每頁 1200×630 分享圖 + src/data/og.json
pnpm build       # 再跑一次，讓 check-og 對帳
```

為什麼不在 build 時產：這站的 Word 產生器刻意零 npm 相依，CI 上也就沒有 Pillow 與中文字型；
為了幾張幾乎不變的圖讓 GitHub Actions 每次 `apt install fonts-noto-cjk` 不划算。
改走 `gov-format.json`／`simplified-chars.json` 同一套路 —— 本機產、產物進版控、漂移由守門擋。

**兩個 Discover 硬條件缺一不可**（2026-08-20 查到站上兩個都沒有）：圖寬 ≥1200px，
且頁面要有 `max-image-preview:large`。只給圖不開 meta，只會拿到縮圖版位，等於白做。

- 分享圖與 favicon 的 meta、`<link rel="icon">` 全部集中在 `BaseLayout.astro`，不要在單頁重複。
- **單頁 JSON-LD 一律走 `schemas` prop**，不要自己在 slot 裡塞 `<script type="application/ld+json">`。
  BaseLayout 會用 `withImage()` 統一把 `image` 補進 Article／CollectionPage／ContactPage；
  繞過它的頁面就拿不到（`cases/`、`cases/[slug]`、`citizens/[slug]`、`templates/` 原本都是這樣漏掉的）。
- 品牌色不寫死在腳本裡，`gen-brand-images.py` 從 `src/styles/variables.css` 的 hex fallback 讀。
- 字型路徑也不寫死，用 `fc-match` 問系統要。

`pnpm check:og`（在 `astro build` **之後**跑）拿實際 `<title>` 對帳 `src/data/og.json`：
**改了頁面標題卻沒重跑 `gen:brand`，分享出去的卡片還是舊標題，畫面上完全看不出來** —— 所以用 build 擋。
一併驗 `og:image` 指到的檔案存在、頁面有 `max-image-preview:large`。

`src/pages/404.astro` 會產成 `dist/404.html`，GitHub Pages 直接吃。它借用首頁那張圖、
不進 sitemap，也在 `src/data/llms.js` 的路由對帳裡排除 —— 404 不是內容。

## 選字先量需求，不要憑「我覺得承辦會搜什麼」（2026-08-26 的教訓）

前三波關鍵字判定靠的是 SERP 觀察（每字實搜一次，看前排是誰）。那判斷得了意圖，
**判斷不了量**——三份文件都留著同一句「這些字的實際搜尋量沒有數據」。

第四波把量測補上，結果是：釘著的 20 個字**只有 4 個有量**，而量最大的一群
（數字大寫 7,829／國字大寫 1,048／大寫數字 936）根本不在清單裡，站上一頁都沒有；
同期 GSC 逐字比對，這些有量的字**本網域一次曝光都沒有**。判定過程見
`docs/keyword-validation/2026-08-26-demand.md`。

**往後選字的順序固定成四步**：

```bash
# 1) 先量。單字頭部詞判 0 就不要做
node /root/seo-ops/bin/keyword-demand.mjs --file <候選字.json>
node /root/seo-ops/bin/keyword-demand.mjs --site ods.yao.care   # 量現有釘選字
# 2) 有量的字再實搜一次，看 SERP 前排是不是搶得到的（前三波的方法）
# 3) grep -r 自家 repo，確認站上用的是不是同一個詞（簽 vs 簽呈、請撥 vs 請款）
# 4) 上線後用 GSC 實際 query 回頭校正
```

⚠️ **判讀邊界**：這是 Bing 的量，只能看相對大小與「是不是 0」；
**多字組合的 0 不可靠**（「公文格式」300 但「公文格式 word」0，量在主詞不在組合），
單字頭部詞的 0 才可靠。有量 ≠ 打得贏，第 2 步不能省。

`/numbers/` 的換算（`src/data/uppercase-number.js`）伺服器端與瀏覽器端吃同一份，
由 `pnpm check:numbers` 守 26 個邊界案例——**算錯不會有任何畫面異常**，
使用者會拿著錯的字串去寫核銷憑證。新增換算規則時同一回合把案例加進那支。

## 官方條文一律抓取產生，不手抄（`gov-terms.json`／`ai-guidance.json`）

站上引用的官方規則有兩份資料，都是腳本解析官方 PDF 產生、產物要 commit：

| 檔案 | 腳本 | 來源 | 內容 |
|---|---|---|---|
| `src/data/gov-terms.json` | `scripts/fetch-gov-terms.py` | 行政院《文書處理手冊》 | 稱謂與期望語、擬稿注意事項、函與簽的撰擬要領、數字原則、用印，以及 `workflow`（文書處理五步驟、稿面 9 個欄位、陳核／核稿／會稿／閱稿／判行共 24 條） |
| `src/data/ai-guidance.json` | `scripts/fetch-ai-guidance.py` | 行政院《使用生成式 AI 參考指引》 | 十點逐字 |

**不要在頁面裡手寫條文。** 網路流傳的整理多半轉錄自舊版或經過濃縮 ——
參考指引第四點那句「但封閉式地端部署之生成式 AI 模型…得依文書或資訊機密等級分級使用」
特別常被吃掉，而那個但書正是機關導入與承辦自己上網用之間的分野。

兩支腳本的共同坑：
- **`pdftotext` 要挑模式**。手冊用 `-layout`（表格才對得齊）；參考指引必須用 `-raw` ——
  它第一點被排版切成視覺兩欄，`-layout` 會把「（以下簡稱各機關）使用生成式 AI」抽到標號之前，
  逐字照抄就少了一截。
- **PDF 頁眉用 CJK 相容漢字**（如「理」是 U+F9E4 而不是 U+7406），不先 `unicodedata.normalize('NFC')`
  字面比對會失敗，頁眉會混進條文裡。兩支都已正規化。
- 手冊本文各點用**國字**標號 `(一)(二)`，點內子項才用全形阿拉伯數字 `(１)(２)` ——
  `fetch-gov-terms.py` 因此有 `bracketed()` 與 `cjk_bracketed()` 兩支，別用錯。

## `llms.txt`／`llms-full.txt` 是產生的（不要手改）

兩支由 `src/pages/llms.txt.js`、`src/pages/llms-full.txt.js` 於 build 時從 `src/data/llms.js` 產生，
案例與民眾書件的清單直接取自 `cases.js`／`citizen-examples.js`／`scenarios/*.json`，
條目數也取實際筆數，不寫死。

它們原本是 `public/` 下的手寫檔：站長到 31 頁時只列了 7 個網址，整批民眾端、範本下載、
公文用語與公文怎麼寫全部不在裡面，而 seo-ops 的 GEO 檢查只驗「檔案存不存在」，抓不到這種漂移。
現在 `assertCoversAllRoutes()` 會拿 `src/pages` 的實際路由表對帳，**新增頁面沒登記進
`src/data/llms.js` 的 `FIXED_PAGES` 就擋 build**。案例與民眾書件走資料展開，不必登記。

`FIXED_PAGES` 標了 `hub: true` 的是內容主幹，首頁的 `ItemList` 結構化資料用同一份，站台結構不抄第二次。

## 民間書件是第三個文書族群（`private`，2026-08-26 開的）

`/private-documents/` 底下的委託書、授權書、切結書、聲明書**不是**民眾書件的一種。
應用端有三個文書族群，段名、必填欄位與檢核清單都不一樣：

| 族群 | 是什麼 | 站上位置 |
|---|---|---|
| `citizen` | 民眾**對機關**：申請書、陳情書、申訴書、說明書 | `/citizens/` |
| `notice` | 存證信函 | `/citizens/certified-letter*` |
| `private` | **民間書件**：立書人自己出具、載明事實並自承法律責任 | `/private-documents/` |

**段名是從官方制式範本反推的，不是想出來的**：臺南市地政「切結書（範本）」與公平會
「切結書（範例1）」都是「事由＋切結事項＋『如有不實…願負法律責任』＋此致機關」；
臺中市北區公所「代辦委託書」是「因有事無法親自前來辦理＋委託事項＋
『如有虛偽不實及任何紛爭，本人願負相關法律責任』＋兩造簽章」。

這個族群有兩條**別的族群沒有**的檢核（都在應用端 `src/lib/validator.js`）：

- `liability_clause`（critical）：切結書與委託書少了責任文句，就只是一段敘述，不構成切結或委託。
  第一次烘就抓到模型在切結書寫了、在委託書沒寫 —— 指示因此從系統提示詞的通則改成
  **綁定文別與段落**的逐則指示（`LIABILITY_SECTION`）。
- `special_authority`（warn）：民法第 534 條的六類行為（不動產出賣或設定負擔、
  不動產租賃逾二年、贈與、和解、起訴、提付仲裁）須有**特別之授權**；
  行政程序法第 24 條另規定「申請之撤回」亦同。事項落在這幾類卻只寫概括委任，對方可以不認。

⚠️ **這一區的內容有法律後果，寫錯會害到使用者。** 已經踩過一次：原本寫「監理機關多半有
自己的制式委託書」，但道路交通安全規則第 16 條真正要求的是「代辦人身分證＋車主有效駕駛執照
或健保卡或護照」，一張委託書辦不成。**動這一區的文案前先查法條原文**，不要憑印象。

另外兩件已查證、寫在頁面上的硬事實：
- 「委託書」與「授權書」在台灣法制上是同一件事的不同叫法（公證法叫授權書、行政程序法叫委任書、
  土地登記規則與公司法叫委託書），官方表格自己也混用。
- **公開發行公司的股東會委託書不能自製**：用紙以公司印發者為限，否則代理表決權不予計算
  （公開發行公司出席股東會使用委託書規則第 2、22 條）。

## 三種客群（與應用端的網域架構對應）

- 機關 → 專屬子網域，**由服務方開通**，站上走 `/apply/` 申請表
- 小型受補助單位（社區發展協會、學校家長會、農會…）→ 共用 `app.ods.yao.care` **自助註冊**
- 一般民眾／個人或企業 → 共用 `app.ods.yao.care` **自助建立個人工作區**，撰寫民眾對機關書件或存證信函

## 公文正式格式的 Word 從哪來（不要手抄規範）

案例與空白範本的 Word 檔（`public/downloads/**.docx`）是 build 時產生的，版面數值**不是手打的**：

```bash
pnpm fetch:gov-template   # 只在規範改版時跑：抓官方原檔 → src/data/gov-format.json（要 commit）
pnpm build:docx           # 每次 build 自動跑：json + 案例資料 → public/downloads/*.docx
```

- `scripts/fetch-gov-template.mjs` 下載國發會檔案管理局的「政府文書格式參考規範(105年4月)」**ODT
  原始檔**（ODT 是 zip＋XML，量得到真值；同頁的 PDF／DOC 只能看），逐一解出令／函／公告／
  開會通知單／簽各欄位的字級、行距、縮排、段距與頁面邊界，寫成 `src/data/gov-format.json`。
  條文與範例檔打架時以條文為準（腳本會印出修正了哪幾項）。
- **本主機 IPv6 到 `archives.gov.tw` 不通**，腳本已固定 `curl -4`。
- `scripts/lib/docx.mjs` 是自幹的最小 OOXML 產生器（zip 也是自己寫的），**不引任何 npm 相依** ——
  CI 不必裝 LibreOffice，靜態站也不必為了 zip 引前端函式庫。
- **存證信函不重製郵局用紙**：中華郵政明文「請依所提供之格式使用，變更樣式內容者，不予收寄」。
  站上只產「內文」，並照其〈使用說明〉設定英數全形、字體 18、固定行高 34pt 靠左、字元間距 2.9pt，
  使用者貼進官方用紙就會落在格子內；用紙本身給官方連結。
- `public/downloads/` 是產物，已 gitignore；`src/data/downloads.json`（下載清單）要 commit，
  頁面靠它產生連結。

## 無障礙：這站已經過的兩關（2026-08-20）

- **跳過導覽**：導覽列有 25 個連結（查法 `curl -s https://www.ods.yao.care/ | grep -o '<a ' | wc -l` 之類，
  或直接數 `<header>` 內的 `<a>`）。沒有 skip link 的話，純鍵盤與螢幕閱讀器使用者每進一頁都要
  tab 過那一整排才碰得到內文。`BaseLayout` 的 `.skip-link` 指向 `#main`，
  **每一頁的 `<main>` 都要有 `id="main"`** —— 這件事由 `pnpm check:anchors` 自動守門（它驗所有同頁錨點都有落點）。
  樣式用 `left: -9999px` 移出畫面而不是 `display:none`，後者鍵盤聚焦不到，等於沒做。
- **色彩對比**：`pnpm check:contrast` 讀 `variables.css` 的 hex fallback，算 15 組實際成對出現的
  前景／背景，未達 WCAG AA 內文 4.5:1 就擋 build。**新增會成對出現的顏色時，同一回合把它加進那支的 `PAIRS`。**
  改顏色時 hex 與 oklch 兩份要一起改（同一個顏色的兩種寫法，守門只讀得到 hex 那份）。

沒做的：螢幕閱讀器實測、動態內容的 aria live region。要做機關採購的無障礙檢核前先補這兩項。

## 追蹤事件怎麼實測（不污染 GA4、不寄出假申請）

`file_download`／`cta_click`／`generate_lead` 這幾支自訂事件，**一個 JS 錯誤就會全部靜默死掉，
帳面上完全看不出來**（GA4 只會顯示「這個事件沒有資料」，跟「還沒有人點」長得一模一樣）。
2026-08-20 用無頭瀏覽器實測過一次，四支都正常、無 JS 錯誤。要重測：

本站刻意不裝 playwright（零 npm 相依），借 `www.yao.care` 的：**把探針放進那個 repo 再執行**，
不能只 `cd` 過去跑外部路徑的檔（ESM 的套件解析看的是檔案本身的位置，不是 cwd）。

```js
// 兩個攔截缺一不可，否則會把假資料灌進正式 Property、或真的寄出一封申請信
await ctx.route('**://*.google-analytics.com/**', async (r) => { record(r.request()); await r.abort(); });
await ctx.route('**://ods-apply-form.lightman-chang.workers.dev/**',
  (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
```

參考現成的：`/root/www.yao.care/scripts/ga-event-probe.mjs`（那支沒有攔截，會真的送出，別直接對 ODS 用）。

## 常用指令

```bash
pnpm dev              # 開發（起了就要記得 kill，主機紅線）
pnpm build            # check-design && check-contrast && check-content && check-zh-hant && check-scenarios && build-docx && astro build && check-anchors && check-og
pnpm check:contrast   # 只跑色彩對比守門（不需要 dist）
pnpm check:anchors    # 只跑錨點守門（要先有 dist/）
pnpm check:og         # 只跑分享圖守門（要先有 dist/）
pnpm check:numbers    # 只跑國字大寫換算守門（不需要 dist）
pnpm gen:brand        # 重產站徽與分享圖（改標題或改品牌色後，需 python3 pillow + noto CJK）
pnpm check:design
pnpm check:content:all
pnpm check:zh-hant    # 只跑簡體字守門
pnpm build:docx       # 只重烘 Word（改案例資料或版面後）
pnpm fetch:gov-template  # 規範改版才跑（會連外網，需 IPv4）
pnpm gen:gov-terms       # 文書處理手冊改版才跑（會連外網，需 pdftotext）
pnpm gen:ai-guidance     # 生成式 AI 參考指引改版才跑（會連外網，需 pdftotext）
pnpm gen:simplified-set  # 重產簡體字集合（只在來源資料改版時，需 python3 opencc）
```

## 待辦（接手時從這裡開始）

1.–4. ~~repo／Pages／deploy workflow／Worker~~：**都已完成**（見上方里程碑表；
   現況一律指令查）。維運備忘：Cloudflare 授權在 `~/.config/.wrangler/`（`whoami` 可查）、
   CF 帳號寫死在 `wrangler.jsonc` 的 `account_id`；輪替 Brevo 金鑰：
   `cd workers/apply-form && npx wrangler secret put BREVO_API_KEY`（HTTP API 金鑰
   `xkeysib-…`，與 SMTP 密碼不同種，副本在 secrets.md § SMTP）
5. ~~Phase 4–5：Slack 頻道、GA4/GSC 授權、seo-ops 納管~~：**已接通**（2026-08-17，見里程碑）。
   備忘：**每站要自己的 GCP 專案與 SA，絕不可複製別站金鑰**；本站目前沿用共用 SA，
   隔離驗收用 `node /root/seo-ops/bin/identity-audit.mjs --site ods.yao.care`
6. 民間書件：委託書、授權書、切結書、聲明書~~**已上線**~~（2026-08-26，`private` 族群，
   見上面那節）。**和解書尚未做** —— 和解書 829、車禍和解書 982、和解書範例 341，
   法律後果最重（民法第 736、737 條的和解有確定效力，簽了拋棄其餘請求就回不去），
   要先把民法條文、鄉鎮市調解條例與實務警語查證完再動
7. **站外連結只有 `www.yao.care/ai/ods/` 一條**。逐頁 URL Inspection 顯示 Google 對每頁認得的
   `referringUrls` 是 0～2 —— 這是曝光低最根本的原因，而且不是內容能解的。要用戶決定怎麼做。
8. ~~「公告」的主旨該不該強制期望語~~：**已處理**（2026-08-26，用戶拍板）。
   判準不是「實務上常怎麼寫」，是手冊本身——「十九、(三)」只要求公告主旨扼要敘述
   公告之目的及要求，附錄 6 的兩則官方範例主旨也都沒有期望語。應用端已把
   `subject_expectation` 從公告的檢核裡移除（公告 23 條），`/checks/` 有專節說明。
   **這類「規則對某文別適不適用」的問題，去翻手冊的分段要領與附錄 6 的作法舉例，
   不要憑印象**

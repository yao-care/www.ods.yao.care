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

`src/data/cases.js` 是本站自己的欄位（slug、搜尋用標題、分類、常踩的點），與上面互補。

開會通知單自 2026-08-20 起由應用端直接產規範第八點的固定欄位（`draft.fields` 的
`meeting_topic`／`meeting_time`／`meeting_place`／`meeting_chair`／`meeting_contact`／
`attendees`／`observers`／`remarks`），`subject` 為空字串、`sections` 為空陣列 ——
**它不是三段式，沒有主旨也沒有說明／辦法**。網頁與 Word 共用 `src/data/meeting.js` 重排；
`cases.js` 的 `meeting` 只留作重烘前舊資料的後備。

檢核條目數也依文別而定：函／簽／書函／公告 24 條，開會通知單 22 條（不套主旨類 6 條與
段落類 5 條，改查上面那組固定欄位）。頁面上不要再寫死「24 條」，用 `payload.checks.length`。

## 體驗器的設計（`src/components/CaseDemo.astro`）

- **漸進增強**：伺服器端就把公文全文與 24 條檢核渲染進 HTML，沒有 JS 時整頁照樣可讀 ——
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
只靠 sitemap 不會被爬。查法：

```bash
node -e "import('/root/seo-ops/lib/google.mjs').then(async g=>{
  const r=await g.inspectUrl('/root/.config/yaocare/ga4-sa.json','sc-domain:yao.care','<完整網址>');
  console.log(r.coverageState, r.lastCrawlTime, r.referringUrls);})"
```

`/templates/` 是為「公文格式 word」「公文範本下載」這類高意圖字開的落地頁，
同時也是全站每一頁都連得到的 Word 下載入口（導覽列「格式與用語」群組內）。

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

## 常用指令

```bash
pnpm dev              # 開發（起了就要記得 kill，主機紅線）
pnpm build            # check-design && check-content && check-zh-hant && build-docx && astro build
pnpm check:design
pnpm check:content:all
pnpm check:zh-hant    # 只跑簡體字守門
pnpm build:docx       # 只重烘 Word（改案例資料或版面後）
pnpm fetch:gov-template  # 規範改版才跑（會連外網，需 IPv4）
pnpm gen:simplified-set  # 重產簡體字集合（只在來源資料改版時，需 python3 opencc）
```

## 待辦（接手時從這裡開始）

1.–4. ~~repo／Pages／deploy workflow／Worker~~：**都已完成**（見上方里程碑表；
   現況一律指令查）。維運備忘：Cloudflare 授權在 `~/.config/.wrangler/`（`whoami` 可查）、
   CF 帳號寫死在 `wrangler.jsonc` 的 `account_id`；輪替 Brevo 金鑰：
   `cd workers/apply-form && npx wrangler secret put BREVO_API_KEY`（HTTP API 金鑰
   `xkeysib-…`，與 SMTP 密碼不同種，副本在 secrets.md § SMTP）
5. Phase 4–5：Slack 頻道、GA4/GSC 授權（**每站要自己的 GCP 專案與 SA，絕不可複製別站金鑰**）、
   seo-ops 納管。照 `/root/.claude/skills/new-astro-site/SKILL.md` 走

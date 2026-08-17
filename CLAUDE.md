# www.ods.yao.care

公文 AI 訂閱服務的行銷站（Astro → GitHub Pages）。應用本體在 `/root/ods.yao.care`（private repo），
本站與它**完全分離**：純靜態、不呼叫應用的 API。

**站的主體是公文案例庫**，不是產品簡報 —— 承辦開案時搜的是「補助核銷 公文 範例」，不是「公文 AI」。
產品介紹是配角。

## 里程碑（帶日期的歷史；**現況一律用下面的指令查，不要信本表**）

| 事件（日期） | 內容 |
|---|---|
| 2026-08-14 | 骨架、設計 token、守門腳本、案例頁全數建好；repo＋GitHub Pages＋deploy workflow 上線（用戶完成） |
| 2026-08-14 | 申請表單 Worker 全通：`ods-apply-form.lightman-chang.workers.dev`（CF 帳號 Lightman，用戶拍板）、`BREVO_API_KEY` 已設（副本 secrets.md § SMTP）、以 Brevo `delivered` 事件驗證、apply 頁 `ENDPOINT` 已接上 |
| 2026-08-16 | 品牌色與表單接線 push 上線 |
| 2026-08-17 | apex 改由主機 NPM 轉址（見下段） |

Phase 4–5（Slack、GA4/GSC、seo-ops 納管）截至 2026-08-17 未開始（納管與否查 `grep ods /etc/cron.d/seo-ops`）。

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

## 體驗器的設計（`src/components/CaseDemo.astro`）

- **漸進增強**：伺服器端就把公文全文與 24 條檢核渲染進 HTML，沒有 JS 時整頁照樣可讀 ——
  這是本站能被搜到的關鍵，**不要改成 JS 注入**
- JS 載入後才收合成互動流程：填事由 → 產生草稿（分段進度）→ 結果 → 動作列
- 凡會改變狀態的動作（改事由、改文別、編輯、儲存、簽核、匯出）一律攔截，跳 gate 對話框導向
  申請頁或 `app.ods.yao.care` 自助註冊

## 兩種客群（與應用端的網域架構對應）

- 機關 → 專屬子網域，**由服務方開通**，站上走 `/apply/` 申請表
- 小型受補助單位（社區發展協會、學校家長會、農會…）→ 共用 `app.ods.yao.care` **自助註冊**

## 常用指令

```bash
pnpm dev              # 開發（起了就要記得 kill，主機紅線）
pnpm build            # check-design && check-content && astro build
pnpm check:design
pnpm check:content:all
```

## 待辦（接手時從這裡開始）

1.–4. ~~repo／Pages／deploy workflow／Worker~~：**都已完成**（見上方里程碑表；
   現況一律指令查）。維運備忘：Cloudflare 授權在 `~/.config/.wrangler/`（`whoami` 可查）、
   CF 帳號寫死在 `wrangler.jsonc` 的 `account_id`；輪替 Brevo 金鑰：
   `cd workers/apply-form && npx wrangler secret put BREVO_API_KEY`（HTTP API 金鑰
   `xkeysib-…`，與 SMTP 密碼不同種，副本在 secrets.md § SMTP）
5. Phase 4–5：Slack 頻道、GA4/GSC 授權（**每站要自己的 GCP 專案與 SA，絕不可複製別站金鑰**）、
   seo-ops 納管。照 `/root/.claude/skills/new-astro-site/SKILL.md` 走

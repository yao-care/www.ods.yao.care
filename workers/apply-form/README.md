# ods-apply-form

申請試用表單的收單端點。GitHub Pages 是純靜態、收不了 POST，這支 Worker 負責收表單並寄到 `service@yao.care`。

與應用（`ods.yao.care`）刻意解耦：行銷站不必等應用上線就能收單。

## 部署

這台主機**尚未**有 Cloudflare 授權（沒有 `~/.wrangler`、沒有 `CLOUDFLARE_API_TOKEN`），
所以下列指令要先解決授權才跑得動。二選一：

```bash
npx wrangler login                      # 互動式，需在瀏覽器授權
# 或
export CLOUDFLARE_API_TOKEN=…           # 需含 Workers Scripts:Edit 權限
```

然後：

```bash
cd workers/apply-form
npx wrangler secret put BREVO_API_KEY   # 貼上 Brevo 的 HTTP API 金鑰
npx wrangler deploy
```

部署後把 `workers.dev` 或自訂網域的網址填進 `src/pages/apply/index.astro` 的 `ENDPOINT`。

## BREVO_API_KEY 從哪來

⚠ **不是** `/root/.claude/secrets.md` 記的那個 SMTP 密碼（`xsmtpsib-…`）。
Brevo 的 HTTP API 用另一種金鑰（`xkeysib-…`），要到 Brevo 後台
SMTP & API → API Keys 另外產生一把。Worker 不能直接講 SMTP，所以走 HTTP API。

## 行為

- 只接受 `POST`，且 `Origin` 必須是 `ALLOWED_ORIGIN`
- body 上限 16 KB
- 蜜罐欄位 `website`：真人看不到，填了就靜默回 200（不告訴機器人被擋）
- 必填 `org`、`contact`、`email`；`email` 走格式檢查
- 寄出時 `replyTo` 設成填表人，回信直接回得到

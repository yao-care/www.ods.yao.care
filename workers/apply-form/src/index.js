/**
 * 申請試用表單收單 Worker。
 *
 * 為什麼要有它：站台託管在 GitHub Pages，純靜態、收不了 POST。這支 Worker 只做一件事——
 * 收表單、寄信到 service@yao.care。刻意與應用（ods.yao.care）解耦：行銷站不必等應用上線就能收單，
 * 應用出事也不影響收單。
 *
 * 需要的 secret（`npx wrangler secret put <名稱>`）：
 *   BREVO_API_KEY   Brevo 的 HTTP API 金鑰（xkeysib-…）。⚠ 與 secrets.md 記的 SMTP 密碼（xsmtpsib-…）不同，
 *                   要在 Brevo 後台 SMTP & API → API Keys 另外產生一把。
 *
 * 環境變數（wrangler.jsonc 的 vars）：
 *   TO_EMAIL        收件信箱
 *   FROM_EMAIL      寄件人。必須是 Brevo 已驗證的 sender —— 2026-08-14 定案用 service@weiqi.kids
 *                   （此 Brevo 帳號唯一驗證過的身分；yao.care 未做 Brevo 網域驗證，DMARC p=reject
 *                   會讓未簽章的信被拒收）。這是寄給服務方自己的內部通知，寄件人品牌無妨；
 *                   回信對象靠 replyTo（填表人）。
 *   ALLOWED_ORIGIN  只接受這個來源的跨網域請求
 */

const MAX_BODY = 16 * 1024;

const FIELDS = [
  { key: 'org', label: '機關全銜', required: true, max: 100 },
  { key: 'contact', label: '聯絡人', required: true, max: 60 },
  { key: 'email', label: '電子郵件', required: true, max: 120 },
  { key: 'phone', label: '聯絡電話', required: false, max: 40 },
  { key: 'scale', label: '使用人數', required: false, max: 40 },
  { key: 'note', label: '需求說明', required: false, max: 2000 },
];

function cors(origin, allowed) {
  const headers = { 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type' };
  if (origin && origin === allowed) headers['access-control-allow-origin'] = origin;
  return headers;
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export default {
  async fetch(request, env) {
    const allowed = env.ALLOWED_ORIGIN ?? 'https://www.ods.yao.care';
    const origin = request.headers.get('origin');
    const headers = cors(origin, allowed);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, headers);
    if (origin && origin !== allowed) return json({ error: 'bad_origin' }, 403, headers);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, headers);

    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'bad_json' }, 400, headers);
    }

    // 蜜罐：真人看不到這個欄位，填了就是機器人。靜默回 200，不讓對方知道被擋。
    if (body.website) return json({ ok: true }, 200, headers);

    const values = {};
    for (const f of FIELDS) {
      const v = typeof body[f.key] === 'string' ? body[f.key].trim() : '';
      if (f.required && !v) return json({ error: 'missing_field', field: f.key }, 400, headers);
      if (v.length > f.max) return json({ error: 'too_long', field: f.key }, 400, headers);
      values[f.key] = v;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
      return json({ error: 'bad_email' }, 400, headers);
    }

    const lines = FIELDS.map((f) => `${f.label}：${values[f.key] || '（未填）'}`);
    lines.push('', `來源：${origin ?? '未知'}`, `時間：${new Date().toISOString()}`);

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { name: '公文 AI 申請表單', email: env.FROM_EMAIL ?? env.TO_EMAIL },
        to: [{ email: env.TO_EMAIL }],
        replyTo: { email: values.email, name: values.contact },
        subject: `【申請試用】${values.org}`,
        textContent: lines.join('\n'),
      }),
    });

    if (!res.ok) {
      // 不把上游錯誤細節回給瀏覽器，但要留在 Worker 日誌裡可查
      console.error('brevo_failed', res.status, await res.text());
      return json({ error: 'send_failed' }, 502, headers);
    }

    return json({ ok: true }, 200, headers);
  },
};

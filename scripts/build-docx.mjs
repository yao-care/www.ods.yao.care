/**
 * 把案例庫烘成可下載、可自行編輯的 Word 檔（build 前置步驟，輸出到 public/downloads/）。
 *
 * 版面來自官方規範原檔，見 lib/gov-format.mjs 與 fetch-gov-template.mjs 檔頭。
 * 案例內容來自 ods 應用的 export-demo --llm 產物，這裡只負責排版，不改任何一個字。
 *
 * 為什麼在 build 時產生而不是前端即時產：本站是純靜態站，公文全文本來就已經渲染進 HTML
 * （見 CaseDemo.astro 的漸進增強）。下載連結做成靜態檔，沒有 JavaScript 也能下載，
 * 也不必為了 zip 引前端相依。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { docx, p } from './lib/docx.mjs';
import { PAGE, renderOfficial, citizenDocument, certifiedLetter, privateDocument } from './lib/gov-format.mjs';
import { CASES } from '../src/data/cases.js';
import { CITIZEN_EXAMPLES } from '../src/data/citizen-examples.js';
import { PRIVATE_DOCS } from '../src/data/private-docs.js';
import format from '../src/data/gov-format.json' with { type: 'json' };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'downloads');
// 八個案例的內容都是鄉公所在辦的事（本鄉、本所、里辦公處、鄉民），機關全銜就用同一類。
const AGENCY = '○○鄉公所';
const NOTE_STYLE = { fontSize: 10, lineHeight: 14 };

function write(relPath, buffer) {
  const target = join(OUT, relPath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, buffer);
}

/** 每份檔案開頭都交代「這是範例、哪些欄位要自己填」，免得有人原封不動送出去。 */
const note = (lines) =>
  lines.map((line) => p(line, NOTE_STYLE)).join('') +
  p('　', NOTE_STYLE) +
  p('────────────────────────────────────────', NOTE_STYLE) +
  p('　', NOTE_STYLE);

const SOURCE_LINE = `版面依據：${format.source.name}（${format.source.promulgated}），數值取自該規範 ODT 原檔。`;

const CASE_NOTE = [
  '本檔為 www.ods.yao.care 的公文範例，可直接在 Word 修改後使用。',
  SOURCE_LINE,
  '機關全銜、地址、聯絡方式、發文日期與發文字號為待填欄位，請改成貴機關實際資料後再發文。',
  '內容為虛構案例，不代表法律意見。',
];

const CITIZEN_NOTE = [
  '本檔為 www.ods.yao.care 的民眾書件範例，可直接在 Word 修改後使用。',
  `版面沿用${format.source.name}的紙張、邊界、字級與縮排。`,
  '姓名、地址、電話與日期為待填欄位；內容為虛構案例，不代表法律意見。',
];

const PRIVATE_NOTE = [
  '本檔為 www.ods.yao.care 的民間書件範例，可直接在 Word 修改後使用。',
  '民間書件沒有法定強制格式；本檔只沿用政府文書格式參考規範的紙張、邊界與字級，讓下載檔看起來是一套。',
  '**機關另有制式表格時，以該機關的表格為準**——切結書、委託書多半各機關自訂，先去該機關網站看有沒有。',
  '姓名、身分證統一編號、地址、電話與日期為待填欄位；內容為虛構案例，不代表法律意見。',
];

const NOTICE_NOTE = [
  '本檔為存證信函「內文」，格式已依中華郵政「存證信函格式使用說明」設定：',
  '英數符號全形、字體大小 18、段落固定行高 34pt 靠左對齊、字元間距加寬 2.9pt。',
  '郵局用紙受「請依所提供之格式使用，變更樣式內容者，不予收寄」拘束，本站不重製用紙。',
  '請至中華郵政下載官方用紙，再把本檔內容複製貼上，文字就會落在格子內：',
  'https://www.post.gov.tw/post/internet/Download/index.jsp?ID=220301',
  '每格限書一字，一式三份；內容為虛構案例，不代表法律意見。',
];

const build = (title, notes, bodyXml) =>
  docx({ title, page: PAGE, body: note(notes) + bodyXml });

// path 是相對 public/downloads/ 的路徑，頁面自己接 BASE_URL。
const manifest = { source: format.source, postalGuide: 'https://www.post.gov.tw/post/internet/Download/index.jsp?ID=220301', cases: {}, citizens: {}, private: {}, templates: [] };

// ── 機關公文案例 ───────────────────────────────────────────────
for (const caseMeta of CASES) {
  const payload = JSON.parse(readFileSync(join(ROOT, 'src/data/scenarios', `${caseMeta.key}.json`), 'utf8'));
  const draft = payload.draft;
  const doc = {
    agency: AGENCY,
    docType: draft.doc_type,
    subject: draft.subject,
    sections: draft.sections,
    receiver: draft.fields?.receiver ?? '',
    unit: draft.unit,
    // 開會通知單的內容全在 fields（應用端自 2026-08-20 起直接產規範第八點的固定欄位）；
    // caseMeta.meeting 只留作重烘前舊資料的後備。
    fields: draft.fields ?? {},
    meeting: caseMeta.meeting,
  };
  const file = `cases/${caseMeta.slug}.docx`;
  write(file, build(caseMeta.seoTitle, CASE_NOTE, renderOfficial(doc)));
  manifest.cases[caseMeta.slug] = {
    path: file,
    filename: `${caseMeta.seoTitle}.docx`,
    docType: draft.doc_type,
  };
}

// ── 民眾書件與存證信函案例 ─────────────────────────────────────
for (const example of CITIZEN_EXAMPLES) {
  const draft = example.draft;
  const fields = draft.fields ?? {};
  const doc = {
    docType: draft.doc_type,
    subject: draft.subject,
    sections: draft.sections,
    sender: fields.sender ?? '',
    receiver: fields.receiver ?? '',
    senderAddress: fields.sender_address ?? '',
    receiverAddress: fields.receiver_address ?? '',
    deadline: fields.deadline ?? '',
  };
  const isNotice = example.family === 'notice';
  const file = `citizens/${example.slug}.docx`;
  write(file, build(
    example.seoTitle,
    isNotice ? NOTICE_NOTE : CITIZEN_NOTE,
    isNotice ? certifiedLetter(doc) : citizenDocument(doc),
  ));
  manifest.citizens[example.slug] = {
    path: file,
    filename: `${example.seoTitle.replace(/｜/g, '－')}.docx`,
    docType: draft.doc_type,
    family: example.family,
  };
}

// ── 民間書件案例 ───────────────────────────────────────────────
// 與機關案例同一個來源：內容取自 ods 應用 --llm 烘出來的真實產物，不是站上手寫的。
const PRIVATE_LABELS = {
  委託書: { senderLabel: '委託人', receiverLabel: '受託人' },
  授權書: { senderLabel: '授權人', receiverLabel: '被授權人' },
  切結書: { senderLabel: '立切結書人', receiverLabel: '此致' },
  聲明書: { senderLabel: '聲明人', receiverLabel: '此致' },
  和解書: { senderLabel: '甲方', receiverLabel: '乙方' },
};
for (const meta of PRIVATE_DOCS) {
  const payload = JSON.parse(readFileSync(join(ROOT, 'src/data/scenarios', `${meta.key}.json`), 'utf8'));
  const draft = payload.draft;
  const fields = draft.fields ?? {};
  const doc = {
    docType: draft.doc_type,
    subject: draft.subject,
    sections: draft.sections,
    sender: fields.sender ?? '',
    receiver: fields.receiver ?? '',
    ...(PRIVATE_LABELS[draft.doc_type] ?? {}),
  };
  const file = `private/${meta.slug}.docx`;
  write(file, build(meta.seoTitle, PRIVATE_NOTE, privateDocument(doc)));
  manifest.private[meta.slug] = {
    path: file,
    filename: `${meta.seoTitle}.docx`,
    docType: draft.doc_type,
  };
}

// ── 空白範本 ───────────────────────────────────────────────────
const empty = (titles) => titles.map((title) => ({ title, items: ['', '', ''] }));
const TEMPLATES = [
  { slug: 'official-letter', docType: '函', label: '函', kind: 'official', sections: empty(['說明']),
    note: '對上級用「請鑒核」，對平行或下級用「請查照」，期望語寫在主旨句末。' },
  { slug: 'official-memo', docType: '書函', label: '書函', kind: 'official', sections: empty(['說明']),
    note: '規範第六點：書函比照函辦理，用於洽詢、答復或不需正式行文的案件。' },
  { slug: 'public-notice', docType: '公告', label: '公告', kind: 'official', sections: empty(['依據', '公告事項']),
    note: '公告沒有受文者，印信蓋於發文字號與公告內容之間右方，段名為主旨、依據、公告事項。' },
  { slug: 'meeting-notice', docType: '開會通知單', label: '開會通知單', kind: 'official', sections: [],
    note: '開會事由、時間、地點、主持人、聯絡人及電話是固定欄位，不要塞進主旨。' },
  { slug: 'internal-sign', docType: '簽', label: '簽', kind: 'official', sections: empty(['說明', '擬辦']),
    note: '簽是對內文書，段名為主旨、說明、擬辦，結尾用「簽請核示」或「簽請鑒核」。' },
  { slug: 'citizen-petition', docType: '陳情書', label: '陳情書', kind: 'citizen',
    sections: [{ title: '事實與理由', items: ['', ''] }, { title: '請求事項', items: [''] }, { title: '附件', items: [''] }],
    note: '民眾對機關的書件，段名為事實與理由、請求事項、附件。' },
  { slug: 'citizen-application', docType: '申請書', label: '申請書', kind: 'citizen',
    sections: [{ title: '申請事由', items: ['', ''] }, { title: '檢附文件', items: [''] }],
    note: '申請事由、依據與檢附文件分開寫，機關才不必來電補問。' },
  { slug: 'private-poa', docType: '委託書', label: '委託書', kind: 'private',
    labels: { senderLabel: '委託人', receiverLabel: '受託人' },
    sections: [{ title: '委託事由', items: [''] }, { title: '委託事項', items: ['', ''] }, { title: '委託期間', items: [''] }],
    note: '委託事項要具體到承辦看得懂能不能受理；結尾要有「如有虛偽不實，本人願負相關法律責任」。' },
  { slug: 'private-authorization', docType: '授權書', label: '授權書', kind: 'private',
    labels: { senderLabel: '授權人', receiverLabel: '被授權人' },
    sections: [{ title: '授權事由', items: [''] }, { title: '授權範圍', items: ['', ''] }, { title: '授權期間', items: [''] }],
    note: '授權範圍要寫清楚「不含什麼」，否則對方可以做的事會比你想的多。' },
  { slug: 'private-affidavit', docType: '切結書', label: '切結書', kind: 'private',
    labels: { senderLabel: '立切結書人', receiverLabel: '此致' },
    sections: [{ title: '切結事由', items: [''] }, { title: '切結事項', items: ['', ''] }],
    note: '沒有「如有不實，願負法律責任」那句話就只是一段敘述，不構成切結。機關多半有自己的制式切結書。' },
  { slug: 'private-statement', docType: '聲明書', label: '聲明書', kind: 'private',
    labels: { senderLabel: '聲明人', receiverLabel: '此致' },
    sections: [{ title: '聲明事由', items: [''] }, { title: '聲明事項', items: ['', ''] }],
    note: '聲明的是自己知道的事實，不要把推測或他人的行為寫成既成事實。' },
  { slug: 'certified-letter', docType: '存證信函', label: '存證信函內文', kind: 'notice',
    sections: [{ title: '事實經過', items: ['', ''] }, { title: '本人請求', items: [''] }],
    note: '格式已依中華郵政使用說明設定；用紙請至中華郵政官網下載，再把內文貼上。' },
];

for (const template of TEMPLATES) {
  const doc = {
    agency: AGENCY,
    docType: template.docType,
    subject: '',
    sections: template.sections,
    receiver: '',
    sender: '',
    senderAddress: '',
    receiverAddress: '',
    deadline: '',
  };
  const body =
    template.kind === 'official' ? renderOfficial(doc)
      : template.kind === 'notice' ? certifiedLetter(doc)
        : template.kind === 'private' ? privateDocument({ ...doc, ...(template.labels ?? {}) })
          : citizenDocument(doc);
  const notes =
    template.kind === 'official' ? CASE_NOTE
      : template.kind === 'notice' ? NOTICE_NOTE
        : template.kind === 'private' ? PRIVATE_NOTE
          : CITIZEN_NOTE;
  const file = `templates/${template.slug}.docx`;
  write(file, build(`${template.label}空白範本`, notes, body));
  manifest.templates.push({
    slug: template.slug,
    label: template.label,
    docType: template.docType,
    note: template.note,
    path: file,
    filename: `${template.label}空白範本.docx`,
  });
}

writeFileSync(join(ROOT, 'src/data/downloads.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const counts = [
  ['公文案例', Object.keys(manifest.cases).length],
  ['民眾書件', Object.keys(manifest.citizens).length],
  ['空白範本', manifest.templates.length],
];
console.log(
  `Word 產生完成：${counts.reduce((n, [, c]) => n + c, 0)} 檔（${counts.map(([k, c]) => `${k} ${c}`).join('、')}）→ public/downloads/`,
);

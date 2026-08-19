/**
 * 從官方檔案抽出公文版面，存成 src/data/gov-format.json。
 *
 * 來源是國家發展委員會檔案管理局公布的「政府文書格式參考規範(105年4月)」ODT 原始檔
 * （ODT 是 zip＋XML，可以直接讀出每個範例段落真正用的字級、行距與縮排；
 *   同頁的 PDF／DOC 只能看不能量）。
 *
 * 這支腳本不掛在 pnpm build 上 —— 規範幾年才修一次，而 CI 不該依賴外部網站。
 * 規範改版時手動重跑：`node scripts/fetch-gov-template.mjs`，再 commit 產出的 json。
 *
 * 註：本主機 IPv6 到 archives.gov.tw 不通，需強制 IPv4（見 .claude/ops/architecture.md）。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = {
  page: 'https://www.archives.gov.tw/tw/arctw/156-3145.html',
  odt: 'https://www.archives.gov.tw/wSite/public/Attachment/0/f1716517318514.odt',
  name: '政府文書格式參考規範(105年4月)',
  promulgated: '中華民國105年4月1日行政院院授發檔(資)字第1050008178號函修正',
};

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 讀 ODT ────────────────────────────────────────────────────
const work = mkdtempSync(join(tmpdir(), 'gov-odt-'));
const odtPath = join(work, 'spec.odt');
execFileSync('curl', ['-sS', '-4', '--max-time', '300', '-o', odtPath, SOURCE.odt]);
const contentXml = execFileSync('unzip', ['-p', odtPath, 'content.xml'], { maxBuffer: 1 << 28 }).toString('utf8');
const stylesXml = execFileSync('unzip', ['-p', odtPath, 'styles.xml'], { maxBuffer: 1 << 28 }).toString('utf8');

// ── 樣式表：把具名樣式與自動樣式併成一張表，之後沿 parent 鏈解析 ──
function collectStyles(...sources) {
  const table = new Map();
  for (const xml of sources) {
    const re = /<style:style\b([^>]*)>([\s\S]*?)<\/style:style>|<style:style\b([^>]*)\/>/g;
    let m;
    while ((m = re.exec(xml))) {
      const attrs = m[1] ?? m[3] ?? '';
      const inner = m[2] ?? '';
      const name = /style:name="([^"]+)"/.exec(attrs)?.[1];
      if (!name) continue;
      table.set(name, { parent: /style:parent-style-name="([^"]+)"/.exec(attrs)?.[1] ?? null, xml: inner });
    }
  }
  return table;
}
const STYLES = collectStyles(stylesXml, contentXml);

const cmToPt = (cm) => Math.round(cm * (72 / 2.54) * 100) / 100;
function lengthPt(raw) {
  if (!raw) return null;
  const m = /^(-?[\d.]+)(cm|mm|pt|in)$/.exec(raw.trim());
  if (!m) return null;
  const value = Number(m[1]);
  if (m[2] === 'cm') return cmToPt(value);
  if (m[2] === 'mm') return cmToPt(value / 10);
  if (m[2] === 'in') return Math.round(value * 72 * 100) / 100;
  return value;
}

/** 沿 parent 鏈由遠而近疊加，近的覆蓋遠的。 */
function resolveStyle(name, seen = new Set()) {
  if (!name || seen.has(name)) return {};
  seen.add(name);
  const entry = STYLES.get(name);
  if (!entry) return {};
  const base = resolveStyle(entry.parent, seen);
  const pick = (re) => re.exec(entry.xml)?.[1];
  const own = {
    fontSize: lengthPt(pick(/style:font-size-asian="([^"]+)"/) ?? pick(/fo:font-size="([^"]+)"/)),
    lineHeight: lengthPt(pick(/fo:line-height="([^"]+)"/)),
    marginLeft: lengthPt(pick(/fo:margin-left="([^"]+)"/)),
    textIndent: lengthPt(pick(/fo:text-indent="([^"]+)"/)),
    marginTop: lengthPt(pick(/fo:margin-top="([^"]+)"/)),
    marginBottom: lengthPt(pick(/fo:margin-bottom="([^"]+)"/)),
    align: pick(/fo:text-align="([^"]+)"/),
    bold: /fo:font-weight="bold"/.test(entry.xml) || undefined,
  };
  for (const [k, v] of Object.entries(own)) if (v === null || v === undefined) delete own[k];
  return { ...base, ...own };
}

// ── 版面：頁面大小與邊界 ───────────────────────────────────────
// 規範原檔裡有多組頁面版面（本文頁、範例頁、附錄頁），只有一組四邊都落在
// 規範第四點(三)的 2.5 公分±0.3 內，取那一組；其餘是排版用的變體。
const IN_RULE = (pt) => Math.abs(pt - cmToPt(2.5)) <= cmToPt(0.3) + 0.01;
const layouts = [...stylesXml.matchAll(/<style:page-layout\b[^>]*style:name="([^"]+)"[^>]*>([\s\S]*?)<\/style:page-layout>/g)]
  .map(([, name, xml]) => {
    const get = (key) => lengthPt(new RegExp(`${key}="([^"]+)"`).exec(xml)?.[1]);
    return {
      name,
      widthPt: get('fo:page-width'),
      heightPt: get('fo:page-height'),
      marginTopPt: get('fo:margin-top'),
      marginBottomPt: get('fo:margin-bottom'),
      marginLeftPt: get('fo:margin-left'),
      marginRightPt: get('fo:margin-right'),
    };
  })
  .filter((l) => l.widthPt && l.heightPt);
const page = layouts.find((l) =>
  [l.marginTopPt, l.marginBottomPt, l.marginLeftPt, l.marginRightPt].every(IN_RULE));
if (!page) throw new Error('規範原檔裡找不到四邊都符合 2.5 公分±0.3 的頁面版面');

// ── 逐段掃過本文，記下文字、樣式與所屬範例 ─────────────────────
const body = /<office:text\b[\s\S]*?<\/office:text>/.exec(contentXml)[0];
const paragraphs = [];
const paraRe = /<text:(p|h)\b([^>]*)>([\s\S]*?)<\/text:\1>|<text:(p|h)\b([^>]*)\/>/g;
let match;
while ((match = paraRe.exec(body))) {
  const attrs = match[2] ?? match[5] ?? '';
  const inner = match[3] ?? '';
  const styleName = /text:style-name="([^"]+)"/.exec(attrs)?.[1] ?? null;
  const text = inner
    .replace(/<text:s\/>|<text:s [^>]*\/>/g, ' ')
    .replace(/<text:tab\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
  paragraphs.push({ styleName, text, style: resolveStyle(styleName) });
}

/**
 * 角色：依開頭標籤判斷這一段在公文裡扮演什麼，之後才好把自己的內容塞進去。
 * 順序有意義 —— 先比對長標籤，避免「聯絡人及電話」被「聯絡方式」以外的規則搶走。
 */
const ROLES = [
  [/^檔\s*\u3000*\s*號/, 'archive_no'],
  [/^保存年限/, 'retention'],
  [/^地址[：:]/, 'agency_address'],
  [/^聯絡方式/, 'contact'],
  [/^受文者/, 'receiver'],
  [/^發文日期/, 'issue_date'],
  [/^發文字號/, 'issue_no'],
  [/^速別/, 'speed'],
  [/^密等/, 'classification'],
  [/^附件/, 'attachment'],
  [/^主旨/, 'subject'],
  [/^(說明|擬辦)[：:]/, 'section_head'],
  [/^依據[：:]/, 'basis_head'],
  [/^公告事項/, 'items_head'],
  [/^正本/, 'copy_to'],
  [/^副本/, 'cc_to'],
  [/^開會事由|^會勘事由/, 'meeting_topic'],
  [/^開會時間|^會勘時間/, 'meeting_time'],
  [/^開會地點|^會勘地點/, 'meeting_place'],
  [/^主持人/, 'meeting_chair'],
  [/^聯絡人及電話/, 'meeting_contact'],
  [/^出席者/, 'attendees'],
  [/^列席者/, 'observers'],
  [/^備註/, 'remarks'],
  [/^[一二三四五六七八九十]+、/, 'item'],
  [/^（印信位置）/, 'seal'],
  [/^（條戳）/, 'stamp'],
  [/^(主任委員|院長|職)\s*[○\u3000]/, 'signature'],
];
const roleOf = (text) => ROLES.find(([re]) => re.test(text.trim()))?.[1] ?? null;

/**
 * 採樣範圍限定在「貳、公文」的各範例頁，並依 令→函→公告→開會通知單→簽 的順序取第一個實例。
 * 不這樣切的話，目次的「一、緣起」會被當成分項、簽的主旨會蓋掉函的主旨。
 */
const exampleStarts = paragraphs
  .map((para, i) => ({ i, text: para.text.trim() }))
  .filter(({ text }) => text.endsWith('範例'))
  .map(({ i }) => i);
if (exampleStarts.length < 4) throw new Error('規範檔裡找不到範例頁錨點');
// 範例頁後面接的是規範本文（「六、函」「(一)字型大小」…），要在那裡收尾，
// 否則本文的條列會被當成公文的分項。
const BODY_HEADING = /^[（(][一二三四五六七八九十]+[)）]|^[一二三四五六七八九十]+、(令|函|公告|開會|會勘|下級機關|移文單|機密文書|範圍|共同格式|證書|獎狀)/;
const sampleRange = new Set();
for (const start of exampleStarts) {
  const next = exampleStarts.find((i) => i > start) ?? paragraphs.length;
  for (let i = start; i < next; i += 1) {
    if (BODY_HEADING.test(paragraphs[i].text.trim())) break;
    sampleRange.add(i);
  }
}

/**
 * 條文與範例檔不一致時以條文為準：規範第五至九點逐條列出各欄位的字級，
 * 而範例檔裡「開會事由」等少數欄位排成 12 點字。字級照條文，其餘（行距、縮排、
 * 對齊、段距）一律沿用範例檔量到的值。
 */
const SIZE_BY_RULE = {
  agency_title: 20, sign_title: 20,
  receiver: 16, subject: 16, section_head: 16, item: 16, basis_head: 16, items_head: 16,
  meeting_topic: 16, meeting_time: 16, meeting_place: 16, meeting_chair: 16, meeting_contact: 16,
  remarks: 16,
  agency_address: 12, contact: 12, issue_date: 12, issue_no: 12, speed: 12, classification: 12,
  attachment: 12, copy_to: 12, cc_to: 12, attendees: 12, observers: 12,
  archive_no: 10, retention: 10,
};

// 規範第四點(五)：10 點字行距 10 點、12 點字 15 點、16 點字 28 點、20 點字 36 點。
// 16 點字這裡用範例檔實際量到的 25 點（在條文允許的 28±4 內），與官方版面一致。
const LINE_BY_SIZE = { 10: 10, 12: 15, 16: 25, 20: 36 };

const styles = {};
const samples = {};
const adjusted = [];
for (const [index, para] of paragraphs.entries()) {
  if (!sampleRange.has(index)) continue;
  const role = roleOf(para.text);
  if (!role || styles[role]) continue;
  if (!para.style.fontSize) continue;
  const style = { ...para.style };
  // fo:text-align="end"/"justify" 是範例檔的殘留設定；規範規定除全銜外一律靠左。
  if (style.align !== 'center') delete style.align;
  const ruled = SIZE_BY_RULE[role];
  if (ruled && style.fontSize !== ruled) {
    adjusted.push(`${role} ${style.fontSize}pt→${ruled}pt`);
    style.fontSize = ruled;
    // 字級一動，行距要跟著回到規範第四點(五)該字級的值，否則 16 點字會擠在 15 點行距裡。
    if (LINE_BY_SIZE[ruled]) style.lineHeight = LINE_BY_SIZE[ruled];
  }
  styles[role] = style;
  samples[role] = para.text.trim().slice(0, 40);
}

// 機關全銜與文別（置中 20 點字）用具名樣式；範例頁的實例會被浮動框的樣式蓋掉。
styles.agency_title = { ...resolveStyle('全銜'), fontSize: 20, align: 'center' };
samples.agency_title = '（具名樣式「全銜」）';
// 簽的抬頭「簽　於○○機關」規範第九點為 20 點字，比照全銜但靠左。
styles.sign_title = { ...resolveStyle('全銜'), fontSize: 20 };
delete styles.sign_title.align;
samples.sign_title = '（比照全銜，靠左）';

const REQUIRED = [
  'archive_no', 'retention', 'agency_address', 'contact', 'receiver', 'issue_date', 'issue_no',
  'speed', 'classification', 'attachment', 'subject', 'section_head', 'item', 'copy_to', 'cc_to',
  'basis_head', 'items_head', 'meeting_topic', 'meeting_time', 'meeting_place', 'meeting_chair',
  'meeting_contact', 'attendees', 'observers', 'remarks', 'seal', 'stamp', 'signature',
];
const missing = REQUIRED.filter((role) => !styles[role]);
if (missing.length) throw new Error(`規範檔裡找不到這些角色的樣式：${missing.join('、')}`);

/** 各文別的欄位順序，照規範第六至九點的範例頁排。 */
const blocks = {
  letter: {
    docTypes: ['函', '書函'],
    note: '規範第六點；書函比照函辦理',
    order: ['archive_no', 'retention', 'agency_title', 'agency_address', 'contact', 'receiver',
      'issue_date', 'issue_no', 'speed', 'classification', 'attachment', 'subject',
      'sections', 'copy_to', 'cc_to', 'signature'],
  },
  notice: {
    docTypes: ['公告'],
    note: '規範第七點；公告無受文者，印信蓋於發文字號與公告內容之間右方',
    order: ['archive_no', 'retention', 'agency_title', 'issue_date', 'issue_no', 'seal',
      'subject', 'basis', 'items', 'signature'],
  },
  meeting: {
    docTypes: ['開會通知單', '會勘通知單'],
    note: '規範第八點',
    order: ['archive_no', 'retention', 'agency_title', 'receiver', 'issue_date', 'issue_no',
      'speed', 'classification', 'attachment', 'meeting_topic', 'meeting_time', 'meeting_place',
      'meeting_chair', 'meeting_contact', 'attendees', 'observers', 'cc_to', 'remarks', 'stamp'],
  },
  sign: {
    docTypes: ['簽'],
    note: '規範第九點；年月日位置由各機關律定',
    order: ['archive_no', 'retention', 'sign_title', 'subject', 'sections', 'signature'],
  },
};

const out = { source: SOURCE, extractedFrom: 'ODT', page, styles, samples, blocks };
writeFileSync(join(ROOT, 'src/data/gov-format.json'), `${JSON.stringify(out, null, 2)}\n`);
rmSync(work, { recursive: true, force: true });

console.log(`已從${SOURCE.name}抽出版面 → src/data/gov-format.json`);
console.log(`  頁面版面「${page.name}」：${(page.widthPt / 28.35).toFixed(1)}×${(page.heightPt / 28.35).toFixed(1)} 公分，邊界上 ${(page.marginTopPt / 28.35).toFixed(2)}／下 ${(page.marginBottomPt / 28.35).toFixed(2)}／左 ${(page.marginLeftPt / 28.35).toFixed(2)}／右 ${(page.marginRightPt / 28.35).toFixed(2)} 公分`);
for (const [key, block] of Object.entries(blocks)) {
  console.log(`  ${key}（${block.docTypes.join('／')}）：${block.order.length} 個欄位`);
}
console.log(`  角色樣式 ${Object.keys(styles).length} 種，取自規範原檔`);
if (adjusted.length) console.log(`  字級以條文為準修正：${adjusted.join('、')}`);

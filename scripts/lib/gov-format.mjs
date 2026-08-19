/**
 * 把一份草稿填進官方公文版面。
 *
 * 版面來源：src/data/gov-format.json —— 由 scripts/fetch-gov-template.mjs 從
 * 國家發展委員會檔案管理局公布的「政府文書格式參考規範(105年4月)」ODT 原檔抽出，
 * 每個欄位的字級、行距、縮排、段距都是規範範例頁上量到的實際值，不是這裡自己訂的。
 *
 * 存證信函另循中華郵政「存證信函格式使用說明」，見本檔末段。
 */
import { p, blank } from './docx.mjs';
import format from '../../src/data/gov-format.json' with { type: 'json' };

export const PAGE = format.page;
const S = format.styles;

const CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五'];
const num = (i) => `${CN[i] ?? String(i + 1)}、`;

/** 開會事由不帶期望語（那是函的東西），主旨末尾的「請查照。」等要去掉。 */
const stripExpectation = (subject) =>
  String(subject ?? '').replace(/[，,]?\s*(請|敬請|並請)[^，。]{0,8}[。．.]?\s*$/, '。');

const DATE_PLACEHOLDER = '中華民國　　年　　月　　日';
const SERIAL_PLACEHOLDER = '○○字第○○○○○○○○○○號';

/** 規範第四點(六)(七)：檔號與保存年限置公文首頁右上方，檔號預留 2 行。 */
const archiveHead = () =>
  p('檔　　號：', S.archive_no) + p('', S.archive_no) + p('保存年限：', S.retention);

/** 說明／擬辦／公告事項等分項段落。 */
const sectionBlock = (section, headStyle = S.section_head) =>
  p(`${section.title}：`, headStyle) +
  section.items.map((item, i) => p(`${num(i)}${item}`, S.item)).join('');

/**
 * 依文別把內容排進對應的欄位順序（gov-format.json 的 blocks[*].order）。
 * doc 需要：agency, docType, subject, sections, receiver, unit
 */
export function renderOfficial(doc) {
  const block = Object.values(format.blocks).find((b) => b.docTypes.includes(doc.docType))
    ?? format.blocks.letter;
  const meeting = doc.meeting ?? {};
  const out = [];

  for (const field of block.order) {
    switch (field) {
      case 'archive_no':
        out.push(archiveHead());
        break;
      case 'retention': // archiveHead 已含保存年限
        break;
      case 'agency_title':
        out.push(p(`${doc.agency}　${doc.docType}`, S.agency_title));
        break;
      case 'sign_title':
        out.push(p(`簽　　於${doc.agency}`, S.sign_title));
        break;
      case 'agency_address':
        out.push(p('地址：', S.agency_address));
        break;
      case 'contact':
        out.push(p('聯絡方式：（承辦人、電話、傳真、e-mail）', S.contact));
        break;
      case 'receiver':
        out.push(p(`受文者：${doc.receiver ?? ''}`, S.receiver));
        break;
      case 'issue_date':
        out.push(p(`發文日期：${DATE_PLACEHOLDER}`, S.issue_date));
        break;
      case 'issue_no':
        out.push(p(`發文字號：${SERIAL_PLACEHOLDER}`, S.issue_no));
        break;
      case 'speed':
        out.push(p('速別：普通件', S.speed));
        break;
      case 'classification':
        out.push(p('密等及解密條件或保密期限：', S.classification));
        break;
      case 'attachment':
        out.push(p('附件：', S.attachment));
        break;
      case 'seal':
        // 規範第七點：保留機關全銜至公告內容間 7 公分±2 公分。
        out.push(blank(S.seal, 4) + p('（印信位置）', S.seal));
        break;
      case 'subject':
        out.push(p(`主旨：${doc.subject}`, S.subject));
        break;
      case 'sections':
        out.push(doc.sections.map((s) => sectionBlock(s)).join(''));
        break;
      case 'basis': {
        const basis = doc.sections[0];
        out.push(basis ? sectionBlock({ title: '依據', items: basis.items }, S.basis_head) : '');
        break;
      }
      case 'items': {
        const rest = doc.sections.slice(1).flatMap((s) => s.items);
        out.push(rest.length ? sectionBlock({ title: '公告事項', items: rest }, S.items_head) : '');
        break;
      }
      // 開會通知單的固定欄位。草稿是函的形狀（時間地點寫在說明分項、主旨帶期望語），
      // 這裡依 cases.js 的 meeting 欄位拆進規範第八點的欄位；沒給就留空待填。
      case 'meeting_topic':
        out.push(p(`開會事由：${meeting.topic ?? stripExpectation(doc.subject)}`, S.meeting_topic));
        break;
      case 'meeting_time':
        out.push(p(`開會時間：${meeting.time ?? '中華民國　　年　　月　　日（星期　）　　午　　時'}`, S.meeting_time));
        break;
      case 'meeting_place':
        out.push(p(`開會地點：${meeting.place ?? ''}`, S.meeting_place));
        break;
      case 'meeting_chair':
        out.push(p(`主持人：${meeting.chair ?? ''}`, S.meeting_chair));
        break;
      case 'meeting_contact':
        out.push(p(`聯絡人及電話：${meeting.contact ?? ''}`, S.meeting_contact));
        break;
      case 'attendees':
        out.push(p(`出席者：${meeting.attendees ?? doc.receiver ?? ''}`, S.attendees));
        break;
      case 'observers':
        out.push(p('列席者：', S.observers));
        break;
      case 'remarks': {
        // 開會通知單沒有說明段：草稿的說明／辦法併入備註，但已升格成固定欄位的分項要拿掉，
        // 否則同一個時間地點會在通知單上出現兩次。
        const absorbed = meeting.absorbedPrefixes ?? [];
        const items = doc.sections
          .flatMap((s) => s.items)
          .filter((item) => !absorbed.some((prefix) => item.startsWith(prefix)));
        out.push(items.length ? sectionBlock({ title: '備註', items }, S.remarks) : p('備註：', S.remarks));
        break;
      }
      case 'copy_to':
        out.push(p(`正本：${doc.receiver ?? ''}`, S.copy_to));
        break;
      case 'cc_to':
        out.push(p('副本：', S.cc_to));
        break;
      case 'stamp':
        out.push(blank(S.stamp) + p('（條戳）', S.stamp));
        break;
      case 'signature':
        if (doc.docType === '簽') {
          // 規範第九點的簽範例，署名與主旨同為 16 點字。
          const style = { ...S.signature, fontSize: S.subject.fontSize, lineHeight: S.subject.lineHeight };
          out.push(blank(style) + p('職　○　○　○　　職章　　謹簽', style) + p('　　　　年　　月　　日', style));
        } else {
          out.push(blank(S.signature) + p('（首長職銜）　○　○　○', S.signature));
        }
        break;
      default:
        break;
    }
  }

  if (doc.unit) out.push(p(`（承辦單位：${doc.unit}）`, S.archive_no));
  return out.join('');
}

/**
 * 民眾對機關的書件（陳情書、申請書、申訴書、說明書）。
 * 這類不是公文，沒有檔號、發文字號與印信；紙張、邊界、字級與縮排沿用規範的公文版面，
 * 機關收到時的閱讀感受才會跟內部公文一致。
 */
export function citizenDocument(doc) {
  return [
    p(doc.docType, S.agency_title),
    p(`受文機關：${doc.receiver ?? ''}`, S.receiver),
    p(`主旨：${doc.subject}`, S.subject),
    doc.sections.map((s) => sectionBlock(s)).join(''),
    blank(S.cc_to),
    p(`陳情（申請）人：${doc.sender ?? ''}`, S.cc_to),
    p('國民身分證統一編號：', S.cc_to),
    p(`聯絡地址：${doc.senderAddress ?? ''}`, S.cc_to),
    p('聯絡電話：', S.cc_to),
    p('簽名或蓋章：', S.cc_to),
    blank(S.cc_to),
    p(`中華民國${'　　年　　月　　日'}`, S.cc_to),
  ].join('');
}

/** 中華郵政使用說明第二點：英文、數字、符號等請用「全形」輸入。 */
export function toFullWidth(text) {
  return String(text ?? '').replace(/[ -~]/g, (c) =>
    c === ' ' ? '　' : String.fromCharCode(c.charCodeAt(0) + 0xfee0),
  );
}

/**
 * 存證信函內文。
 *
 * 郵局用紙受「請依所提供之格式使用，變更樣式內容者，不予收寄」拘束，所以不重製用紙，
 * 只依使用說明第四點把內文的字體、段落、字元間距先設定好：
 *   字體大小 18、段落固定行高 34pt 靠左對齊、字元間距加寬 2.9pt。
 * 使用者把內容貼進郵局官方用紙時，字就會落在格子內。
 */
const NOTICE_STYLE = { fontSize: 18, lineHeight: 34, align: 'start' };
const NOTICE_EXTRA = { charSpacing: 2.9, exactLine: true };
const noticeLine = (text) => p(toFullWidth(text), NOTICE_STYLE, NOTICE_EXTRA);

export function certifiedLetter(doc) {
  const lines = [
    `一、寄件人：${doc.sender ?? ''}`,
    `　　詳細地址：${doc.senderAddress ?? ''}`,
    `二、收件人：${doc.receiver ?? ''}`,
    `　　詳細地址：${doc.receiverAddress ?? ''}`,
    '',
    `主旨：${doc.subject}`,
  ];
  for (const section of doc.sections) {
    lines.push(`${section.title}：`);
    section.items.forEach((item, i) => lines.push(`${num(i)}${item}`));
  }
  // 有些案例把履行期限寫成獨立段落，就不要再補一行同名的欄位。
  const hasDeadlineSection = doc.sections.some((s) => s.title.includes('履行期限'));
  if (doc.deadline && !hasDeadlineSection) lines.push(`履行期限：${doc.deadline}`);
  return lines.map(noticeLine).join('');
}

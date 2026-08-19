/**
 * 最小 OOXML（.docx）產生器：把「政府文書格式參考規範」原檔量到的版面數值搬進 Word。
 *
 * 版面不在這裡寫死 —— 字級、行距、縮排、段距、頁面邊界全部來自 src/data/gov-format.json，
 * 那份 json 由 scripts/fetch-gov-template.mjs 從國發會檔案管理局公布的規範 ODT 原檔抽出來。
 * 這一支只負責把那些數值翻成 OOXML。
 *
 * 不引任何 npm 相依：zip 用 ./zip.mjs，XML 直接組字串。
 */
import { zip } from './zip.mjs';

const PT = (pt) => Math.round((pt ?? 0) * 20); // 點 → twip
const HALF = (pt) => Math.round(pt * 2); // 點 → 半點（w:sz 的單位）

const ALIGN = { center: 'center', start: 'left', end: 'right', justify: 'both', left: 'left', right: 'right' };

const ESCAPE = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPE[c]);

/** 規範第四點(四)：中文採楷書，英文及阿拉伯數字採 Times New Roman。 */
const FONTS =
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="標楷體" w:cs="Times New Roman"/>';

function runProps(style, extra) {
  return [
    FONTS,
    style.bold ? '<w:b/><w:bCs/>' : '',
    `<w:sz w:val="${HALF(style.fontSize ?? 16)}"/><w:szCs w:val="${HALF(style.fontSize ?? 16)}"/>`,
    extra.charSpacing ? `<w:spacing w:val="${PT(extra.charSpacing)}"/>` : '',
  ].join('');
}

/**
 * 一段文字。
 * @param {string} text
 * @param {object} style 規範原檔量到的樣式（單位皆為點）：
 *   fontSize / lineHeight / marginLeft / textIndent / marginTop / marginBottom / align / bold
 * @param {object} [extra] 規範管不到的額外設定：
 *   charSpacing（字元間距，存證信函要 2.9）、exactLine（強制固定行高）、pageBreakBefore
 */
export function p(text, style = {}, extra = {}) {
  const size = style.fontSize ?? 16;
  const line = style.lineHeight;
  // ODT 的 fo:line-height 給長度＝固定行高。行高小於字級時改用最小行高，免得 Word 把字切掉。
  const lineRule = line == null ? null : extra.exactLine || line >= size ? 'exact' : 'atLeast';

  const indent =
    style.marginLeft || style.textIndent
      ? `<w:ind w:left="${PT(style.marginLeft)}"${
          style.textIndent < 0
            ? ` w:hanging="${PT(-style.textIndent)}"`
            : style.textIndent > 0
              ? ` w:firstLine="${PT(style.textIndent)}"`
              : ''
        }/>`
      : '';

  const spacing =
    `<w:spacing w:before="${PT(style.marginTop)}" w:after="${PT(style.marginBottom)}"` +
    (line == null ? '' : ` w:line="${PT(line)}" w:lineRule="${lineRule}"`) +
    '/>';

  const rPr = runProps(style, extra);
  const runs = String(text ?? '')
    .split('\n')
    .map((chunk, i) =>
      `<w:r><w:rPr>${rPr}</w:rPr>${i > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${esc(chunk)}</w:t></w:r>`,
    )
    .join('');

  return (
    '<w:p><w:pPr>' +
    (extra.pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    spacing +
    indent +
    `<w:jc w:val="${ALIGN[style.align] ?? 'left'}"/>` +
    `<w:rPr>${rPr}</w:rPr>` +
    '</w:pPr>' +
    runs +
    '</w:p>'
  );
}

/** 空行。規範多處以留白控制版面（例如印信位置留 7 公分±2）。 */
export function blank(style = {}, count = 1) {
  return Array.from({ length: count }, () => p('', style)).join('');
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr>${FONTS}<w:sz w:val="32"/><w:szCs w:val="32"/><w:lang w:val="en-US" w:eastAsia="zh-TW"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:widowControl w:val="0"/><w:jc w:val="left"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

/** 規範第四點：頁碼頁尾（置中對齊）10 點字，行距 10 點。 */
const footerRun = `<w:rPr>${FONTS}<w:sz w:val="20"/></w:rPr>`;
const FOOTER = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="200" w:lineRule="atLeast"/><w:jc w:val="center"/></w:pPr><w:r>${footerRun}<w:t xml:space="preserve">第 </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r>${footerRun}<w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r>${footerRun}<w:t xml:space="preserve"> 頁，共 </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r>${footerRun}<w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r><w:r>${footerRun}<w:t xml:space="preserve"> 頁</w:t></w:r></w:p></w:ftr>`;

/**
 * 組出 .docx。
 * @param {object} opts
 * @param {string} opts.title 文件內容資訊的標題
 * @param {string} opts.body  段落 XML（用 p()／blank() 串出來）
 * @param {object} opts.page  規範原檔的頁面設定（點）：widthPt/heightPt/margin*Pt
 * @returns {Buffer}
 */
export function docx({ title, body, page }) {
  const sectPr =
    '<w:sectPr>' +
    '<w:footerReference w:type="default" r:id="rId2"/>' +
    `<w:pgSz w:w="${PT(page.widthPt)}" w:h="${PT(page.heightPt)}"/>` +
    `<w:pgMar w:top="${PT(page.marginTopPt)}" w:right="${PT(page.marginRightPt)}" w:bottom="${PT(page.marginBottomPt)}" w:left="${PT(page.marginLeftPt)}" w:header="851" w:footer="567" w:gutter="0"/>` +
    '<w:cols w:space="425"/><w:docGrid w:type="lines" w:linePitch="360"/>' +
    '</w:sectPr>';

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sectPr}</w:body></w:document>`;

  const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(title)}</dc:title><dc:creator>www.ods.yao.care</dc:creator><cp:lastModifiedBy>www.ods.yao.care</cp:lastModifiedBy></cp:coreProperties>`;

  return zip([
    { name: '[Content_Types].xml', data: CONTENT_TYPES },
    { name: '_rels/.rels', data: ROOT_RELS },
    { name: 'docProps/core.xml', data: core },
    { name: 'word/_rels/document.xml.rels', data: DOC_RELS },
    { name: 'word/document.xml', data: document },
    { name: 'word/styles.xml', data: STYLES },
    { name: 'word/footer1.xml', data: FOOTER },
  ]);
}

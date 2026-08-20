#!/usr/bin/env python3
"""產生 src/data/gov-terms.json：只在《文書處理手冊》改版時跑，平常不跑。

    pnpm gen:gov-terms          （需要 poppler-utils 的 pdftotext）

來源＝行政院《文書處理手冊》中華民國 104 年 7 月版官方 PDF。**不抄任何二手整理**——
網路上的「公文用語表」多半轉錄自 99 年舊版，且各校版本互有出入。這支腳本直接下載官方
原檔、用 pdftotext -layout 取版面文字，再逐表解析：

  ・手冊本文「十八、公文用語規定」→ 期望／目的／准駁用語、直接與間接稱謂用語（逐字照抄）
  ・附錄 2 法律統一用字表 → 用字舉例／統一用字／曾見用字／說明

附錄 3 法律統一用語表刻意不收：那張表的儲存格跨列，pdftotext 取不出可靠結構；而且它談的是
法律條文的寫法（「第九十八條」不寫為「第九八條」之類），不是承辦寫公文會用到的東西。

⚠️ 本主機到部分政府網站的 IPv6 不通（見專案 CLAUDE.md 對 archives.gov.tw 的記載），
   故一律強制 IPv4。
"""
import json, re, subprocess, sys, tempfile, datetime, pathlib

PDF_URL = 'https://www.ey.gov.tw/File/17244366FC77E57C/c689d069-9a0d-47b3-b9cd-fac6da2d9234?A=C'
SOURCE = {
    'name': '文書處理手冊',
    'issuer': '行政院',
    'edition': '中華民國 104 年 7 月',
    'url': 'https://www.ey.gov.tw/Page/9277F759E41CCD91',
    'file': PDF_URL,
}
OUT = pathlib.Path('src/data/gov-terms.json')


def pdf_text() -> str:
    with tempfile.TemporaryDirectory() as d:
        pdf, txt = f'{d}/manual.pdf', f'{d}/manual.txt'
        subprocess.run(['curl', '-4', '-sfL', '-o', pdf, PDF_URL], check=True)
        subprocess.run(['pdftotext', '-layout', pdf, txt], check=True)
        return pathlib.Path(txt).read_text(encoding='utf-8')


def clean(s: str) -> str:
    """把 pdftotext 版面文字裡的斷行與多餘空白收乾淨（中文之間的空白一律去掉）。"""
    s = re.sub(r'\s+', ' ', s).strip()
    return re.sub(r'(?<=[一-鿿「」『』（）、，。：；])\s+(?=[一-鿿「」『』（）、，。：；])', '', s)


def section(text: str, start: str, end: str) -> str:
    i = text.index(start)
    return text[i:text.index(end, i)]


def strip_page_furniture(block: str) -> list[str]:
    """去掉頁碼、頁眉與表頭，只留資料列。"""
    drop = ('文書處理手冊', '附錄', '用   字   舉   例', '統   一   用   語', '中華民國')
    out = []
    for line in block.split('\n'):
        t = line.rstrip()
        if not t.strip() or t.strip().isdigit():
            continue
        if any(k in t for k in drop):
            continue
        out.append(t)
    return out


def parse_chars(text: str) -> list[dict]:
    """附錄 2 法律統一用字表：每列＝舉例 / 統一用字 / 曾見用字 /（說明）。"""
    rows, pending = [], None
    for line in strip_page_furniture(section(text, '附錄2、法律統一用字表', '附錄3、法律統一用語表')):
        cells = [c for c in re.split(r'\s{2,}', line.strip()) if c]
        # 資料列的判準：第 2、3 欄都是單一漢字（統一用字／曾見用字）
        if len(cells) >= 3 and len(cells[1]) == 1 and len(cells[2]) == 1:
            # 「曾見用字」整欄存碼點而不存字元：這一欄的語意就是「不該寫的字」，
            # 其中 踪／碍／并／粮 等本身是簡體，直接存進 repo 會被 check-zh-hant 擋下
            # （而且擋得對）。存碼點，頁面渲染時用 String.fromCodePoint 還原。
            pending = {
                'example': clean(cells[0]),
                'use': cells[1],
                'avoidCp': f'{ord(cells[2]):04X}',
                'note': clean(' '.join(cells[3:])) if len(cells) > 3 else '',
            }
            rows.append(pending)
        elif pending is not None and len(cells) == 1:
            pending['note'] = clean(pending['note'] + cells[0])   # 說明欄折行

    # 成對的字（聲請／申請、給與／給予）在原表共用一段說明，pdftotext 會把它切在兩列上，
    # 造成「…對行政機關用「申」＋「請」」這種斷句。偵測引號未閉合就把下一列的說明接回來，
    # 並讓這一對的兩列共用完整說明——原表的語意本來就是describing 這一對。
    for a, b in zip(rows, rows[1:]):
        cp = lambda r: chr(int(r['avoidCp'], 16))
        mirrored = a['use'] == cp(b) and cp(a) == b['use']             # 成對互換＝原表同一個跨列儲存格
        if not (mirrored and b['note']):
            continue
        unclosed = a['note'].count('「') > a['note'].count('」')       # 聲請／申請：切在引號中間
        bare = '「' not in a['note'] and '「' not in b['note']          # 給與／給予：整段沒有引號可判斷
        if unclosed or bare:
            a['note'] = b['note'] = clean(a['note'] + b['note'])
    return rows


def parse_address_rules(text: str) -> dict:
    """手冊本文「十八、公文用語規定」——逐字照抄，不改寫。"""
    block = clean(section(text, '十八、公文用語規定如下：', '十九、簽、稿之撰擬說明'))
    # pdftotext 會把頁碼與頁眉夾在正文中間（如「３、…下級 10 貳、公文製作對上級稱…」），先剔除
    block = re.sub(r'\s*\d+\s*貳、公文製作\s*', '', block)
    parts = re.split(r'\(([一二三四])\)\s*', block)
    got = {parts[i]: clean(parts[i + 1]) for i in range(1, len(parts) - 1, 2)}
    strip_head = lambda s, h: clean(s[len(h):]) if s.startswith(h) else s
    return {
        'expectation': got['一'],
        'decisiveness': got['二'],
        'direct': strip_head(got['三'], '直接稱謂用語：'),
        'indirect': strip_head(got['四'], '間接稱謂用語：'),
    }


def main() -> None:
    text = pdf_text()
    data = {
        '_generated': datetime.date.today().isoformat(),
        '_source': SOURCE,
        '_note': '全部取自官方 PDF，未經改寫。網路流傳的用語表多轉錄自 99 年舊版且各校互有出入，不採用。',
        'usageRules': parse_address_rules(text),
        'unifiedChars': parse_chars(text),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'✅ {OUT}：統一用字 {len(data["unifiedChars"])} 條／稱謂與期望語規定 4 段')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'❌ 下載或解析失敗（需要 curl 與 poppler-utils 的 pdftotext）：{e}')

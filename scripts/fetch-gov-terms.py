#!/usr/bin/env python3
"""產生 src/data/gov-terms.json：只在《文書處理手冊》改版時跑，平常不跑。

    pnpm gen:gov-terms          （需要 poppler-utils 的 pdftotext）

來源＝行政院《文書處理手冊》中華民國 104 年 7 月版官方 PDF。**不抄任何二手整理**——
網路上的「公文用語表」多半轉錄自 99 年舊版，且各校版本互有出入。這支腳本直接下載官方
原檔、用 pdftotext -layout 取版面文字，再逐表解析：

  ・手冊本文「十八、公文用語規定」→ 期望／目的／准駁用語、直接與間接稱謂用語（逐字照抄）
  ・手冊本文「十六、」→ 作業要求、擬稿注意事項、分段要領（主旨／說明／辦法）
  ・手冊本文「十九、(一)(三)」→「函」之正文撰擬要領
  ・手冊本文「十九、(一)(二)」→ 簽的擬辦方式（先簽後稿／簽稿併陳／以稿代簽）與簽之撰擬
  ・附錄 2 法律統一用字表 → 用字舉例／統一用字／曾見用字／說明
  ・附錄 5 公文書橫式書寫數字使用原則 → 四條原則逐字
  ・手冊本文用印章節 → 各文別的用印方式（函看行文方向、書函蓋條戳）

附錄 3 法律統一用語表刻意不收：那張表的儲存格跨列，pdftotext 取不出可靠結構；而且它談的是
法律條文的寫法（「第九十八條」不寫為「第九八條」之類），不是承辦寫公文會用到的東西。

⚠️ 本主機到部分政府網站的 IPv6 不通（見專案 CLAUDE.md 對 archives.gov.tw 的記載），
   故一律強制 IPv4。
"""
import json, re, subprocess, sys, tempfile, datetime, pathlib, unicodedata

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
        raw = pathlib.Path(txt).read_text(encoding='utf-8')
        # ⚠️ 這份 PDF 有 CJK 相容漢字：頁眉「文書處理手冊」的「理」是 U+F9E4 而不是 U+7406，
        # 字面比對會失敗（實測頁眉因此清不掉，殘留在資料裡）。NFC 把相容漢字正規化回本字，
        # 且不會動到全形數字與全形括號——那些是 NFKC 才會轉，轉了會破壞條列標號的解析。
        return unicodedata.normalize('NFC', raw)


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


FULLWIDTH_NUM = '１２３４５６７８９'


def depaginate(block: str) -> str:
    """剔除 pdftotext 夾在正文中間的頁碼與頁眉（如「。 7 文書處理手冊 ３、」）。"""
    return re.sub(r'\s*\d+\s*(?:貳、公文製作|文書處理手冊)\s*', '', clean(block))


def numbered(block: str, markers: str = FULLWIDTH_NUM) -> list[str]:
    """把手冊的條列拆成陣列。標號前不一定有空白（跨頁處會變成「敷衍。６、擬稿」），
    所以允許標號緊接在句末標點之後。"""
    pat = r'(?:^|(?<=[\s。；：]))(?:' + ('１０|１[１-４]|' if markers is FULLWIDTH_NUM else '') + '[' + markers + r'])、'
    return [clean(x) for x in re.split(pat, depaginate(block))[1:] if clean(x)]


def parse_drafting(text: str) -> dict:
    """手冊「十六、」作業要求／擬稿注意事項／分段要領，與「十九、」函之撰擬要領。"""
    body = section(text, '第 8 條所規定「簡、淺、明、確」之要求', '十七、公文結構及作法說明')
    quality = numbered(section(body, '其作業要求：', '(二) 擬稿注意事項如下：'))
    cautions = numbered(section(body, '(二) 擬稿注意事項如下：', '(三) 分段要領如下：'))
    seg = depaginate(section(body, '(三) 分段要領如下：', '(四) 製作公文'))
    grab = lambda a, b: clean(seg[seg.index(a) + len(a):seg.index(b)])

    # 錨點取單行片語——pdftotext 會把長句斷行，整句當錨點會找不到
    letter_items = numbered(section(text, '「函」之正文', '參、處理程序'), '甲乙丙丁戊己庚')

    return {
        'quality': quality,
        'cautions': cautions,
        'sections': {
            'subject': grab('１、「主旨」：', '２、「說明」：'),
            'explanation': grab('２、「說明」：', '３、「辦法」：'),
            'method': grab('３、「辦法」：', '４、「主旨」、「說明」、「辦法」'),
            # 去掉開頭的條列標號「４、」——這條在頁面上是獨立一句話，不是清單項目
            'flexible': clean(seg[seg.index('４、') + 2:]),
        },
        'letterNotes': letter_items,
    }


def parse_sign(text: str) -> dict:
    """手冊「十九、(一)２擬辦方式」與「(二)簽之撰擬」。

    這段很重要而且容易被漏掉：**簽是「主旨、說明、擬辦」三段，不是函的「主旨、說明、辦法」。**
    """
    modes_block = section(text, '２、擬辦方式：', '(二) 簽之撰擬：')
    grab = lambda a, b: numbered(section(modes_block, a, b), '甲乙丙丁戊')
    style = section(text, '(二) 簽之撰擬：', '２、撰擬要領：')
    drafting_block = section(text, '２、撰擬要領：', '３、本手冊所訂')
    return {
        'modes': {
            'signFirst': grab('(１) 先簽後稿：', '(２) 簽稿併陳：'),
            'together': grab('(２) 簽稿併陳：', '(３) 以稿代簽'),
            # modes_block 的結尾就是 (二)，所以第三項直接取到區塊尾
        'draftOnly': clean(depaginate(modes_block[modes_block.index('(３) 以稿代簽') + 4:])),
        },
        # style 已切到「２、撰擬要領：」之前，直接從「１、款式：」取到尾
        'style': bracketed(style[style.index('１、款式：'):]),
        'sections': bracketed(drafting_block),
    }


def bracketed(block: str) -> list[str]:
    """拆「(１) … (２) …」這種全形括號標號的條列。"""
    return [clean(x) for x in re.split(r'\(［?[１-９]］?\)\s*', depaginate(block))[1:] if clean(x)]


def parse_numbers(text: str) -> list[str]:
    """附錄 5 公文書橫式書寫數字使用原則的四條原則（逐字，不含後面那張舉例表）。

    舉例表刻意不解析：它是兩層表頭的合併儲存格，pdftotext 取出來的欄位對不齊，
    硬解會產出錯誤的對照關係——寧可只給原則，讓使用者點官方連結看表。
    """
    block = section(text, '附錄5、公文書橫式書寫數字使用原則', '數字用法舉例一覽表')
    items = re.split(r'(?:^|(?<=[\s。]))([一二三四])、\s*', depaginate(block))
    return [clean(items[i + 1]) for i in range(1, len(items) - 1, 2)]


def parse_seals(text: str) -> list[str]:
    """各文別的用印與簽署方式，逐條原文。

    這是函與書函最實際的差別之一：函要署機關首長職銜姓名、蓋職章或職銜簽字章，
    書函只蓋機關或承辦單位條戳。文別選錯，用印就跟著錯。

    不做「文別：規則」的拆解——第 4 條是「書函、開會通知單、會勘通知單…等公文，
    蓋用機關或承辦單位條戳」，一條涵蓋多個文別且沒有冒號，硬拆會失真。
    """
    block = section(text, '２、呈：用機關首長全銜', '(四) 一般公文蓋用機關印信之位置')
    return numbered(depaginate(block))


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
        'drafting': parse_drafting(text),
        'sign': parse_sign(text),
        'numberRules': parse_numbers(text),
        'seals': parse_seals(text),
        'unifiedChars': parse_chars(text),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    d = data['drafting']
    print(f'✅ {OUT}：統一用字 {len(data["unifiedChars"])} 條／稱謂與期望語規定 4 段'
          f'／作業要求 {len(d["quality"])} 條／擬稿注意事項 {len(d["cautions"])} 條'
          f'／函之撰擬要領 {len(d["letterNotes"])} 條'
          f'／簽之撰擬 {len(data["sign"]["sections"])} 條／數字原則 {len(data["numberRules"])} 條'
          f'／用印 {len(data["seals"])} 條')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'❌ 下載或解析失敗（需要 curl 與 poppler-utils 的 pdftotext）：{e}')

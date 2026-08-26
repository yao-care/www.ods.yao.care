#!/usr/bin/env python3
"""產生 src/data/ai-guidance.json：只在指引改版時跑，平常不跑。

    pnpm gen:ai-guidance        （需要 poppler-utils 的 pdftotext）

來源＝行政院《行政院及所屬機關（構）使用生成式 AI 參考指引》官方 PDF（國科會存放的版本）。
**不抄任何二手整理**——網路上的轉述常把十點濃縮成三五條，第三點「機密文書禁用」與第四點
「但封閉式地端部署…得分級使用」的但書尤其常被吃掉，而那個但書正是機關導入的分野。

為什麼本站要收這份：站上講「AI 寫公文」，承辦第一個問的是「這樣可不可以」。答案不在我們
嘴裡，在這十點裡。第三點還直接指回行政院《文書處理手冊》所定的機密文書——與 gov-terms.json
同一本，兩份資料在站上是接得起來的。

⚠️ 本主機到部分政府網站的 IPv6 不通（見專案 CLAUDE.md 對 archives.gov.tw 的記載），
   故一律強制 IPv4。
"""
import json, re, subprocess, sys, tempfile, datetime, pathlib, unicodedata

PDF_URL = 'https://www.nstc.gov.tw/nstc/attachments/da74d556-5b1b-4cbd-9015-901cce87ff91'
SOURCE = {
    'name': '行政院及所屬機關（構）使用生成式 AI 參考指引',
    'issuer': '行政院',
    'promulgated': '中華民國 112 年 10 月 3 日函頒',
    'url': 'https://www.ey.gov.tw/Page/448DE008087A1971/40c1a925-121d-4b6b-8f40-7e9e1a5401f2',
    'file': PDF_URL,
}
OUT = pathlib.Path('src/data/ai-guidance.json')

# 十點的國字標號。指引全文只有十點，不會有「十一」。
MARKERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']


def pdf_text() -> str:
    with tempfile.TemporaryDirectory() as d:
        pdf, txt = f'{d}/guide.pdf', f'{d}/guide.txt'
        subprocess.run(['curl', '-4', '-sfL', '-A', 'Mozilla/5.0', '-o', pdf, PDF_URL], check=True)
        # 用 -raw 不用 -layout：這份 PDF 的第一點被排版切成兩欄式的視覺順序，
        # -layout 會把「（以下簡稱各機關）使用生成式 AI」抽到標號之前，逐字照抄就少了一截。
        subprocess.run(['pdftotext', '-raw', pdf, txt], check=True)
        # PDF 的頁眉用了 CJK 相容漢字（如 U+F9E4「理」），不正規化的話字面比對會失敗。
        return unicodedata.normalize('NFC', pathlib.Path(txt).read_text(encoding='utf-8'))


def clean(s: str) -> str:
    """收乾淨 pdftotext 的斷行與版面空白。

    頁碼在 -raw 模式下自成一行（只有數字），在併行之前先整行剔除——若等併成一行再用
    正則挖，會連條文裡真正的數字（如「十點」的阿拉伯數字寫法）一起挖掉。
    """
    lines = [ln for ln in s.split('\n') if ln.strip() and not ln.strip().isdigit()]
    s = re.sub(r'\s+', ' ', ' '.join(lines)).strip()
    return re.sub(r'(?<=[一-鿿「」『』（）、，。：；])\s+(?=[一-鿿「」『』（）、，。：；])', '', s).strip()


def parse_points(text: str) -> list[str]:
    """把十點逐條切出來，逐字保留，不改寫。"""
    body = text[text.index('本參考指引共計十點如下：'):]
    idx = []
    for i, m in enumerate(MARKERS):
        pat = re.compile(r'(?:^|\n)\s*' + m + '、')
        found = pat.search(body, idx[-1][1] if idx else 0)
        if not found:
            sys.exit(f'❌ 找不到第「{m}」點，指引版面可能已改，請人工確認後再調整解析。')
        idx.append((found.start(), found.end()))
    out = []
    for i, (start, end) in enumerate(idx):
        stop = idx[i + 1][0] if i + 1 < len(idx) else len(body)
        out.append(clean(body[end:stop]))
    return out


def main() -> None:
    points = parse_points(pdf_text())
    if len(points) != 10:
        sys.exit(f'❌ 解析出 {len(points)} 點，指引應為十點。')
    data = {
        '_generated': datetime.date.today().isoformat(),
        '_source': SOURCE,
        '_note': '十點逐字取自官方 PDF，未經改寫、未經濃縮。',
        'points': [{'no': MARKERS[i], 'text': t} for i, t in enumerate(points)],
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'✅ {OUT}：{len(points)} 點')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'❌ 下載或轉檔失敗：{e}')

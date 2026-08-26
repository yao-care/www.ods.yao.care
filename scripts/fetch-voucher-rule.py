#!/usr/bin/env python3
"""產生 src/data/voucher-rule.json：只在要點改版時跑，平常不跑。

    pnpm gen:voucher-rule       （需要 poppler-utils 的 pdftotext）

來源＝行政院主計總處《政府支出憑證處理要點》中華民國 109 年 3 月 24 日版。

⚠️ **這一份沒有「官方原始下載點」可以抓**，兩個坑都踩過（2026-08-26）：

  1. 主計總處自己的法規頁 `law.dgbas.gov.tw/LawContent.aspx?id=FL017556` 對本主機**回 403**
     （WAF 擋非台灣 IP，與 archives.gov.tw 的 IPv6 問題不同但同一類）。
     那個網址仍然是給人看的正式出處，寫在 SOURCE['url']。
  2. 抓得到的幾份公務機關鏡像**版本會錯**：法務部彰化地檢署那份是第十七點的舊版
     （98 年版，沒有 109 年新增的「佐證資料」但書），臺北市法規那份是 104 年公報裡的 98 年版。
     直接引用會把已經修正過的條文當現行法。

  所以固定抓下面這份 .gov.tw 的 109-03-24 彙編本（含立法理由），並在解析時驗證
  版本字串；抓到的檔案不是那個版本就中止，不會安靜地產出錯的條文。

解析要點：這份彙編本每一點後面都跟著〔立法理由〕，而**立法理由自己也用「一、二、三、」編號**。
照點次去正則比對會把立法理由的「五、」當成第五點（實測就是這樣錯的）。
正確作法是拿〔立法理由〕當分隔，見 points_of() 的說明。
"""
import json, re, subprocess, sys, tempfile, datetime, pathlib, unicodedata

PDF_URL = (
    'https://www.shalu.taichung.gov.tw/media/642082/'
    '%E6%94%BF%E5%BA%9C%E6%94%AF%E5%87%BA%E6%86%91%E8%AD%89%E8%99%95%E7%90%86%E8%A6%81%E9%BB%9E-109324.pdf'
)
SOURCE = {
    'name': '政府支出憑證處理要點',
    'issuer': '行政院主計總處',
    'edition': '中華民國 109 年 3 月 24 日',
    'url': 'https://law.dgbas.gov.tw/LawContent.aspx?id=FL017556',
    'file': PDF_URL,
    'note': '主計總處法規頁對本主機回 403，條文取自 .gov.tw 的同版彙編本；改版時人工重核。',
}
OUT = pathlib.Path('src/data/voucher-rule.json')

# 只收站上真的會引用的三點，不整份重製。標題是本站給的，不是條文本身的。
WANTED = [
    ('四', '收據應記載事項'),
    ('五', '統一發票與普通收據應記載事項'),
    ('十三', '總數應用大寫數字書寫'),
]


def pdf_text() -> str:
    with tempfile.TemporaryDirectory() as d:
        pdf, txt = f'{d}/voucher.pdf', f'{d}/voucher.txt'
        subprocess.run(['curl', '-4', '-sfL', '-A', 'Mozilla/5.0', '-o', pdf, PDF_URL], check=True)
        subprocess.run(['pdftotext', '-raw', pdf, txt], check=True)
        return unicodedata.normalize('NFC', pathlib.Path(txt).read_text(encoding='utf-8'))


def points_of(text: str) -> dict[str, str]:
    """把彙編本拆成 {點次: 條文本體}。

    關鍵是**用〔立法理由〕當分隔**，不要去正則比對點次：立法理由自己也用
    「一、二、三、」編號，照點次切會把立法理由的「五、」當成第五點（實測踩過）。

    切法：以〔立法理由〕切段後，每一段的結構是「前一點的立法理由尾巴 → 下一點的條文」。
    條文本體用的是全形括號子項（一）（二），不會出現行首的「N、」，
    所以每段**最後一個**行首點次記號就是下一點的開頭。
    """
    out: dict[str, str] = {}
    marker = re.compile(r'(?:^|\n)\s*([一二三四五六七八九十]+)、')
    for chunk in text.split('〔立法理由〕'):
        hits = list(marker.finditer(chunk))
        if not hits:
            continue
        last = hits[-1]
        out[last.group(1)] = clean(chunk[last.end():])
    return out


def clean(s: str) -> str:
    lines = [ln for ln in s.split('\n') if ln.strip() and not ln.strip().isdigit()]
    s = re.sub(r'\s+', ' ', ' '.join(lines)).strip()
    return re.sub(r'(?<=[一-鿿「」『』（）、，。：；])\s+(?=[一-鿿「」『』（）、，。：；])', '', s).strip()


def main() -> None:
    raw = pdf_text()
    if '中華民國 109 年 3 月 24 日' not in re.sub(r'\s+', ' ', raw[:400]):
        sys.exit('❌ 抓到的檔案不是 109 年 3 月 24 日版，中止（鏡像可能被換成舊版）。')
    parsed = points_of(raw)
    missing = [no for no, _ in WANTED if no not in parsed]
    if missing:
        sys.exit(f'❌ 找不到第「{"、".join(missing)}」點，版面可能已改，請人工確認後再調整解析。')
    points = [{'no': no, 'title': title, 'text': parsed[no]} for no, title in WANTED]
    for p in points:
        if len(p['text']) < 40:
            sys.exit(f'❌ 第「{p["no"]}」點只解出 {len(p["text"])} 字，解析有問題，中止。')
    data = {
        '_generated': datetime.date.today().isoformat(),
        '_source': SOURCE,
        '_note': '逐字取自官方彙編本，未經改寫；只收站上會引用的三點，不整份重製。',
        'points': points,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'✅ {OUT}：{len(points)} 點（' + '／'.join(f'第{p["no"]}點' for p in points) + '）')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'❌ 下載或轉檔失敗：{e}')

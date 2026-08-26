#!/usr/bin/env python3
"""產生 src/data/travel-rule.json：只在要點改版時跑，平常不跑。

    pnpm gen:travel-rule       （需要 poppler-utils 的 pdftotext）

來源＝行政院《國內出差旅費報支要點》中華民國 113 年 5 月 16 日院授主預字第
1130101358 號函修正、自 114 年 1 月 1 日生效版（2026-08-26 實查仍為現行版本：
主計總處 115 年 3 月版的解釋彙編仍以這一版為準，之後沒有新的修正函）。

⚠️ 這一份與《政府支出憑證處理要點》同一個處境：**沒有可直接抓的官方原始下載點**。
兩條路都試過（2026-08-26）：

  1. 主計總處法規頁 `law.dgbas.gov.tw/LawContent.aspx?id=FL017585` 對本主機**回 403**
     （WAF 擋非台灣 IP）。那仍是給人看的正式出處，寫在 SOURCE['url']。
  2. 主計總處自己的檔案伺服器 `ws.dgbas.gov.tw` 有同一份 PDF，**但 TLS 憑證鏈是壞的** ——
     葉憑證由「TWCA Secure SSL Certification Authority」簽發，伺服器卻送出 ePKI Root 與
     政府伺服器數位憑證管理中心 G1 兩張不相干的憑證，缺了真正的中介憑證，
     curl 一律 `unable to get local issuer certificate`。用 `-k` 繞過等於不驗身分，不做。
  3. 法務部所屬機關那份（hlc.moj.gov.tw）抓得到，但**是 109-01-01 的舊版**，
     住宿費數額與自用車每公里單價都不一樣 —— 正是 fetch-voucher-rule.py 踩過的
     「鏡像版本會錯」那個坑。

  所以固定抓臺北市政府主計處彙編本裡的這一份（TLS 正常、內容是中央要點逐字、含附表一），
  並在解析時**驗證版本字串與發文字號**；抓到別的版本就中止，不會安靜地產出舊條文。

⚠️ **要說「這是新制」之前，先把舊版抓下來對一次。** 法務部所屬機關那份雖然版本錯不能當來源，
卻正好是前一版（108-11-26 院授主預字第 1080102859 號函修正、自 109-01-01 生效），
拿來 diff 剛好：

    curl -4 -sfL -A 'Mozilla/5.0' -o old.pdf 'https://www.hlc.moj.gov.tw/media/265986/\
    %E5%9C%8B%E5%85%A7%E5%87%BA%E5%B7%AE%E6%97%85%E8%B2%BB%E5%A0%B1%E6%94%AF%E8%A6%81%E9%BB%9E-1090101.pdf?mediaDL=true'

實際踩過：頁面本來寫「當日往返或使用經費結報系統報支者無須檢附票根，是 114 新制才放寬的」——
**錯的，109 年版就有那一句**。114 真正改的是自用車折算方式（舊制按同路段公民營客運汽車
最高等級票價，新制改成每公里三元／機車二元）、新增公共自行車與自行租賃（含共享）、
報支上限改按必要路程計、以及第二點新增誠信原則那一項。

解析要點（與 fetch-voucher-rule.py 不同的坑）：
  * 這份彙編本每頁有頁眉「國內出差旅費報支要點」與頁碼，會夾在條文中間，要先剔除。
  * `-layout` 幫不上忙：同一點的**續行**與**下一項**縮排完全一樣（都是兩格），
    分不出項次。改用「前一行以。結尾就是分項」——這份文件的每一項都以。結尾，
    解析後會逐項驗證，不符就中止。
  * 條文只有點與項，沒有款（不像文書處理手冊有 (一)(２) 兩種標號），所以不需要 bracketed()。
"""
import json, re, subprocess, sys, tempfile, datetime, pathlib, unicodedata

PDF_URL = (
    'https://www-ws.gov.taipei/001/Upload/367/relfile/45756/9326696/'
    '390ef2d4-29b1-4950-be76-1a82f67cba3a.pdf'
)
SOURCE = {
    'name': '國內出差旅費報支要點',
    'issuer': '行政院',
    'edition': '中華民國 113 年 5 月 16 日院授主預字第 1130101358 號函修正',
    'effective': '中華民國 114 年 1 月 1 日生效',
    'url': 'https://law.dgbas.gov.tw/LawContent.aspx?id=FL017585',
    'file': PDF_URL,
    'note': '主計總處法規頁對本主機回 403、其檔案伺服器 TLS 憑證鏈不完整，'
            '條文取自臺北市政府主計處彙編本裡的同版中央要點；改版時人工重核。',
}
OUT = pathlib.Path('src/data/travel-rule.json')

VERSION_MARK = '113 年 5 月 16 日'
DOC_NO = '1130101358'

# 只收站上真的會引用的點，不整份重製（同 fetch-voucher-rule.py 的作法）。
# 標題是本站給的，不是條文本身的。八、十、十二已刪除，不收。
WANTED = [
    ('一', '這份規定管的是誰'),
    ('二', '旅費分哪幾種，誰對真實性負責'),
    ('三', '什麼情況不得派公差、往返以一日為原則'),
    ('四', '出差事畢十五日內報支'),
    ('五', '交通費怎麼算、哪些要附票根、自用車怎麼折算'),
    ('九', '住宿費的六十公里門檻'),
    ('十一', '在同一地點出差超過一個月要打折'),
    ('十三', '旅費的起訖日，以及請假不得報支'),
    ('十五', '各機關可以在這個範圍內另定自己的報支規定'),
    ('十六', '地方政府與公營事業準用'),
]


def pdf_text() -> str:
    with tempfile.TemporaryDirectory() as d:
        pdf, txt = f'{d}/travel.pdf', f'{d}/travel.txt'
        subprocess.run(['curl', '-4', '-sfL', '-A', 'Mozilla/5.0', '--max-time', '180', '--retry', '3', '--retry-delay', '5', '-o', pdf, PDF_URL], check=True)
        subprocess.run(['pdftotext', '-raw', pdf, txt], check=True)
        return unicodedata.normalize('NFC', pathlib.Path(txt).read_text(encoding='utf-8'))


def strip_running_heads(text: str) -> list[str]:
    """剔除每頁的頁眉（與法規同名）與頁碼，否則它們會被當成條文的一部分。

    ⚠️ 頁碼**只能**在頁眉的下一行剔除，不能見到純數字行就丟 ——
    附表一的雜費上限「400」自己就是一整行純數字，一開始就是這樣被吃掉的。
    """
    out: list[str] = []
    prev_is_head = False
    for ln in text.split('\n'):
        s = ln.strip()
        if not s:
            continue
        if s == SOURCE['name']:
            prev_is_head = True
            continue
        if prev_is_head and s.isdigit():
            prev_is_head = False
            continue
        prev_is_head = False
        out.append(s)
    return out


def points_of(lines: list[str]) -> dict[str, list[str]]:
    """把條文拆成 {點次: [項1, 項2, …]}。

    分項的判準是「前一行以。結尾」：這份文件排版把一項排滿一行才換行，
    續行的前一行必定停在逗號、頓號或分號，只有項末才會落在。上。
    （`-layout` 分不出來——續行與下一項的縮排一模一樣，兩格。）
    """
    marker = re.compile(r'^([一二三四五六七八九十]+)、(.*)$')
    out: dict[str, list[str]] = {}
    cur: str | None = None
    for ln in lines:
        m = marker.match(ln)
        if m:
            cur = m.group(1)
            out[cur] = [m.group(2)]
            continue
        if cur is None:
            continue
        if out[cur][-1].endswith('。'):
            out[cur].append(ln)
        else:
            out[cur][-1] += ln
    return out


def allowance_of(lines: list[str]) -> dict:
    """附表一的三個數額與四則備註。數字抓不到就中止——這是整頁最會被查的東西。"""
    body = '\n'.join(lines)
    transport = re.search(r'上\s*限\n(.+?)\n住\s*宿\s*費', body, re.S)
    lodging = re.search(r'平日\s*假日\n([\d,]+)\s+([\d,]+)', body)
    misc = re.search(r'雜\s*費\n每\s*日\s*上\s*限\n([\d,]+)', body)
    if not (transport and lodging and misc):
        sys.exit('❌ 附表一的數額解不出來（交通費說明／住宿費／雜費），版面可能已改，中止。')
    notes_block = re.search(r'備註：\n(.+?)\n附表二', body, re.S)
    if not notes_block:
        sys.exit('❌ 附表一的備註解不出來，中止。')
    notes = []
    for ln in notes_block.group(1).split('\n'):
        if re.match(r'^[一二三四五六七八九十]+、', ln):
            notes.append(ln)
        elif notes:
            notes[-1] += ln
    if len(notes) != 4:
        sys.exit(f'❌ 附表一的備註解出 {len(notes)} 則，預期 4 則，中止。')
    return {
        'transport': re.sub(r'\s+', '', transport.group(1)),
        'lodgingWeekday': int(lodging.group(1).replace(',', '')),
        'lodgingHoliday': int(lodging.group(2).replace(',', '')),
        'misc': int(misc.group(1).replace(',', '')),
        'notes': [re.sub(r'\s+', '', n) for n in notes],
    }


def main() -> None:
    raw = pdf_text()
    head = re.sub(r'\s+', ' ', raw[:400])
    if VERSION_MARK not in head or DOC_NO not in head:
        sys.exit(f'❌ 抓到的檔案不是 {VERSION_MARK}（院授主預字第 {DOC_NO} 號）版，'
                 '中止（鏡像可能被換成舊版，或要點已改版）。')

    lines = strip_running_heads(raw)
    try:
        start = next(i for i, ln in enumerate(lines) if ln.startswith('一、為規範'))
        end = next(i for i, ln in enumerate(lines) if ln == '附表一')
    except StopIteration:
        sys.exit('❌ 找不到條文的起點（一、為規範）或終點（附表一），版面已改，中止。')

    parsed = points_of(lines[start:end])
    missing = [no for no, _ in WANTED if no not in parsed]
    if missing:
        sys.exit(f'❌ 找不到第「{"、".join(missing)}」點，版面可能已改，請人工確認後再調整解析。')

    points = []
    for no, title in WANTED:
        paras = parsed[no]
        for p in paras:
            if not p.endswith('。'):
                sys.exit(f'❌ 第「{no}」點有一項不是以。結尾，分項判準已失效，中止：{p[:40]}…')
            if len(p) < 10:
                sys.exit(f'❌ 第「{no}」點解出過短的一項（{len(p)} 字），中止：{p}')
        points.append({'no': no, 'title': title, 'paras': paras})

    data = {
        '_generated': datetime.date.today().isoformat(),
        '_source': SOURCE,
        '_note': '逐字取自官方彙編本，未經改寫；只收站上會引用的點，不整份重製。'
                 '附表一的數額與備註同樣是解析出來的，不是手打的。',
        'points': points,
        'allowance': allowance_of(lines[end:]),
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    a = data['allowance']
    print(f'✅ {OUT}：{len(points)} 點（'
          + '／'.join(f'第{p["no"]}點 {len(p["paras"])} 項' for p in points) + '）')
    print(f'   附表一：住宿費 平日 {a["lodgingWeekday"]}／假日 {a["lodgingHoliday"]}、'
          f'雜費 {a["misc"]}、備註 {len(a["notes"])} 則')


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f'❌ 下載或轉檔失敗：{e}')

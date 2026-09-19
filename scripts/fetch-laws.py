#!/usr/bin/env python3
"""從全國法規資料庫抓本站引用的法律條文 → src/data/laws.json（產物要 commit）。

為什麼要有這支（2026-08-28）：站上民間書件這一區的內容有法律後果，寫錯會害到使用者，
所以 CLAUDE.md 早就定了「官方條文一律抓取產生，不手抄」。既有的四支抓的都是 PDF
（文書處理手冊、AI 參考指引、支出憑證要點、出差旅費要點），法律條文是 HTML，這支補上這一類。
一支通吃，不要為每一部法各開一支——要哪幾條寫進下面的 WANTED 就好。

⚠️ 這支存在的**第二個、也是更重要的理由**：`LawAll.aspx` 會直接呈現
**已公布但尚未施行**的條文，頁首只有一行「※本法規部分或全部條文尚未生效」，
不會標示是哪一條。民法還有一條長年未生效的第 166-1 條，所以那行警語平常就在，
看到也不會警覺。實際踩過：2026-08-28 抓第 1223 條（特留分）拿到的是四款版本
（配偶排第一、沒有兄弟姊妹），但沿革寫著

    中華民國一百十五年八月十七日總統令修正公布第 1223 條條文；並自公布六個月後施行

也就是 2027-02-17 才施行，現行有效的仍是五款版本。**逐字照抄不會發現，抄回來的每個字都是真的。**

所以流程固定成三步：
  ① LawSingle 抓資料庫現在顯示的條文
  ② LawHistory 解析沿革，找出「延後施行」而且施行日還沒到的那幾筆，取出它點名的條號
  ③ 被點名的條號改從 LawOldVer（現行有效的舊版全文）取，並把兩版都寫進 JSON

用法：python3 scripts/fetch-laws.py   （需要對外連線；本主機對 law.moj.gov.tw 走 IPv4 正常）
"""
import json
import html
import re
import subprocess
import sys
import time
import unicodedata
from datetime import date
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "src" / "data" / "laws.json"
BASE = "https://law.moj.gov.tw/LawClass"

# 站上哪幾頁需要哪幾條。加條文時連同用途一起寫，免得日後不知道能不能刪。
WANTED = {
    "B0000001": {
        "name": "民法",
        "articles": {
            "1030-1": "剩餘財產差額分配請求權（離婚協議書）",
            "1049": "兩願離婚（離婚協議書）",
            "1050": "兩願離婚的三要件：書面、二人以上證人簽名、戶政登記（離婚協議書）",
            "1052-1": "調解或和解離婚（離婚協議書）",
            "1055": "未成年子女權利義務之行使或負擔、會面交往（離婚協議書）",
            "1116-2": "扶養義務不因離婚而受影響（離婚協議書）",
            "1189": "遺囑的五種方式（遺囑）",
            "1190": "自書遺囑要件：自書全文、記明年月日、親自簽名（遺囑）",
            "1191": "公證遺囑（遺囑）",
            "1192": "密封遺囑（遺囑）",
            "1194": "代筆遺囑（遺囑）",
            "1195": "口授遺囑（遺囑）",
            "1198": "不得為遺囑見證人之人（遺囑）",
            "1223": "特留分（遺囑）⚠️ 2026-08-17 修正公布、2027-02-17 施行",
            "1225": "特留分不足時的扣減（遺囑）",
        },
    },
    "D0030006": {
        "name": "戶籍法",
        "articles": {
            "34": "離婚登記以雙方當事人為申請人（離婚協議書）",
        },
    },
    # 人工智慧基本法：2026-01-14 公布，第 20 條「本法自公布之日起施行」。
    # 站上此前只引行政院《使用生成式 AI 參考指引》（112-10-03，行政規則），
    # 少了母法這一層——第 19 條才是要求機關「進行風險評估、訂定使用規範或內控管理機制」的依據。
    # ⚠️ 主管機關以第 2 條為準（國家科學及技術委員會）。數位發展部 2025-12-24 新聞稿寫的
    #    「於 114 年接手推動法案立法作業」講的是立法過程，不是主管機關，兩者不衝突但只有條文能引。
    "H0160093": {
        "name": "人工智慧基本法",
        "articles": {
            "2": "主管機關：中央為國家科學及技術委員會（AI 寫公文、資料處理）",
            "5": "高風險應用應標示注意事項或警語（資料處理）",
            "7": "公務機關（構）的人工智慧與倫理教育（AI 寫公文）",
            "18": "政府應於本法施行後二年內完成法規檢討（AI 寫公文）",
            "19": "政府使用 AI 執行業務應風險評估、訂定使用規範或內控管理機制（AI 寫公文、資料處理）",
            "20": "本法自公布之日起施行（AI 寫公文）",
        },
    },
}


def fetch(url: str, tries: int = 4) -> str:
    """本主機對 law.moj.gov.tw 的 IPv6 不保證通，固定 -4；沒有 UA 會被擋。

    ⚠️ 連續請求會被丟回一頁很短的內容（實測抓到第 8 條左右開始）。這不是版面改了，
    是對方在擋速率，所以每次之間停一下並重試 —— 一次要抓二十幾條，不該把對方打壞。
    重試完仍然太短才中止：**寧可中止也不要產出半份條文**，那種產物看起來完全正常。
    """
    for attempt in range(tries):
        if attempt:
            time.sleep(3 * attempt)
        out = subprocess.run(
            ["curl", "-s", "-4", "--max-time", "40", "-A", "Mozilla/5.0", url],
            capture_output=True, check=True,
        ).stdout.decode("utf-8", "replace")
        if len(out) >= 2000:
            time.sleep(1.2)
            return out
    raise SystemExit(f"重試 {tries} 次仍抓不到完整內容，可能被擋或版面改了：{url}")


def detag(fragment: str) -> str:
    """條文段落用 <div class="line-xxxx"> 包，換行資訊只在標籤裡，先轉成 \\n 再去標籤。

    頁眉與條文都可能含 CJK 相容漢字（與四支 PDF 腳本同一個坑），一律先 NFC 正規化。
    """
    text = re.sub(r"<br\s*/?>", "\n", fragment)
    text = re.sub(r"</div>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = unicodedata.normalize("NFC", html.unescape(text))
    lines = [re.sub(r"[ \t　]+", " ", ln).strip() for ln in text.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def article_from_single(pcode: str, flno: str) -> str:
    page = fetch(f"{BASE}/LawSingle.aspx?pcode={pcode}&flno={flno}")
    m = re.search(r'<div class="law-article">([\s\S]*?)</div>\s*</div>', page)
    if not m:
        raise SystemExit(f"{pcode} 第 {flno} 條解析不到條文（版面可能改了）")
    return detag(m.group(1))


def unwrap(text: str) -> str:
    """LawOldVer 的條文是**固定寬度硬斷行**的，換行落在句子中間。

    實測第 1224 條被切成「…除去債務額算定之」＋「。」兩行，逐行輸出會多出一個孤零零的句號。
    判準與 fetch-travel-rule.py 那支相同：**前一行以。：；結尾才是分項**，否則是續行。
    """
    out: list[str] = []
    for line in text.split("\n"):
        if out and not re.search(r"[。：；]$", out[-1]):
            out[-1] += line
        else:
            out.append(line)
    return "\n".join(out)


def articles_from_oldver(pcode: str) -> dict[str, str]:
    """LawOldVer 是現行有效的舊版全文。版面是 col-no／col-data 兩個 div，不是表格。"""
    page = fetch(f"{BASE}/LawOldVer.aspx?pcode={pcode}")
    found = {}
    for m in re.finditer(
        r'<div class="col-no">\s*第\s*([\d-]+)\s*條\s*</div>\s*'
        r'<div class="col-data[^"]*">([\s\S]*?)</div>',
        page,
    ):
        found.setdefault(m.group(1), unwrap(detag(m.group(2))))
    return found


ROC_NUM = {c: i for i, c in enumerate("〇一二三四五六七八九")}


def roc_to_int(s: str) -> int:
    """沿革的日期是國字：一百十五 → 115。只需處理年月日這種三位數以內的數。"""
    s = s.strip()
    if not s:
        return 0
    total, section, digit = 0, 0, 0
    for ch in s:
        if ch in ROC_NUM:
            digit = ROC_NUM[ch]
        elif ch == "十":
            section += (digit or 1) * 10
            digit = 0
        elif ch == "百":
            section += (digit or 1) * 100
            digit = 0
        else:
            continue
    total = section + digit
    return total


def pending_articles(pcode: str) -> dict[str, dict]:
    """解析沿革，回傳「已公布但施行日還沒到」的條號。

    只認得帶有延後施行文字的那幾種寫法；沿革句型固定，不必做得更泛。
    抓不到就回空 dict——寧可漏標也不要亂標，漏標時兩版文字相同，下游不會受影響。
    """
    page = fetch(f"{BASE}/LawHistory.aspx?pcode={pcode}")
    # ⚠️ 沿革那一欄被 <td> 硬切成多行（實測「…第 11500076161 號」與「令修正公布第 1223 條條文；
    #    並自公布六個月後施行」分屬兩行），逐行比對會兩邊都對不上而**安靜地漏標**。
    #    先把全部空白壓成一格，再依「編號. 中華民國」切段，才拿得到完整的一筆沿革。
    flat = re.sub(r"\s+", " ", detag(page))
    today = date.today()
    pending = {}
    for line in re.split(r"\d+\.\s*(?=中華民國)", flat):
        if "施行" not in line or "修正公布" not in line:
            continue
        d = re.search(r"中華民國([一二三四五六七八九十百]+)年([一二三四五六七八九十]+)月([一二三四五六七八九十]+)日", line)
        delay = re.search(r"自公布([一二三四五六七八九十]+)個月後施行", line)
        if not d or not delay:
            continue
        year = roc_to_int(d.group(1)) + 1911
        month = roc_to_int(d.group(2))
        day = roc_to_int(d.group(3))
        months = roc_to_int(delay.group(1))
        eff_month = month + months
        eff_year = year + (eff_month - 1) // 12
        eff_month = (eff_month - 1) % 12 + 1
        try:
            effective = date(eff_year, eff_month, day)
        except ValueError:  # 例如 8/31 + 6 個月落到 2/31
            effective = date(eff_year, eff_month, 28)
        if effective <= today:
            continue
        for no in re.findall(r"第\s*([\d、\s-]+?)\s*條", line):
            for one in re.split(r"[、\s]+", no):
                if one:
                    pending[one] = {
                        "promulgated": f"{year}-{month:02d}-{day:02d}",
                        "effective": effective.isoformat(),
                        "note": line.strip(),
                    }
    return pending


def main() -> None:
    result = {
        "_source": {
            "issuer": "法務部全國法規資料庫",
            "url": "https://law.moj.gov.tw/",
            "fetchedAt": date.today().isoformat(),
            "note": "由 scripts/fetch-civil-code.py 抓取產生，不要手改。"
            "資料庫的 LawAll／LawSingle 會呈現已公布但尚未施行的條文，"
            "本檔的 text 一律是「現行有效」版本；有未施行修正的條文另存 pendingAmendment。",
        },
        "laws": {},
    }
    for pcode, spec in WANTED.items():
        pending = pending_articles(pcode)
        oldver = articles_from_oldver(pcode) if pending else {}
        entries = {}
        for flno, purpose in spec["articles"].items():
            current = article_from_single(pcode, flno)
            entry = {"no": flno, "purpose": purpose, "text": current}
            if flno in pending:
                in_force = oldver.get(flno)
                if not in_force:
                    raise SystemExit(
                        f"{spec['name']} 第 {flno} 條有未施行的修正，"
                        f"但從 LawOldVer 取不到現行有效版本，中止以免產出錯的條文"
                    )
                entry["text"] = in_force
                entry["pendingAmendment"] = {**pending[flno], "text": current}
            entries[flno] = entry
        result["laws"][pcode] = {"name": spec["name"], "articles": entries}
        flagged = [n for n in entries if "pendingAmendment" in entries[n]]
        print(f"  {spec['name']}（{pcode}）：{len(entries)} 條"
              + (f"，其中 {'、'.join(flagged)} 有未施行修正，已改用現行有效版本" if flagged else ""))
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"已寫入 {OUT}")


if __name__ == "__main__":
    sys.exit(main())

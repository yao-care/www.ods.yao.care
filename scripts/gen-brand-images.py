#!/usr/bin/env python3
"""站徽與分享圖產生器（產物要 commit，不在 build 時跑）。

為什麼是「產生＋commit」而不是 build 時產：
  這站的 Word 產生器刻意不引任何 npm 相依（見 CLAUDE.md），CI 上也就沒有 Pillow
  與 Noto CJK 字型。要在 build 時畫圖就得讓 GitHub Actions 每次 apt install 中文字型，
  為了幾張幾乎不變的靜態圖付這個代價不划算。改成跟 gov-format.json、
  simplified-chars.json 同一套路：本機產生、產物進版控、漂移由守門擋。
  漂移守門＝scripts/check-og.mjs（build 後跑），拿實際 <title> 對帳 src/data/og.json。

為什麼分享圖要 1200 寬：
  Google Discover 要進「大圖」版位的硬條件是圖寬 ≥1200px，而且頁面要開
  max-image-preview:large（BaseLayout 已加）。小於 1200 就只會拿到縮圖版位。

跑法：python3 scripts/gen-brand-images.py
需要：python3-pil、fonts-noto-cjk（本機有；CI 沒有也不需要）
"""
import json
import re
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
OG_DIR = PUBLIC / "og"
MANIFEST = ROOT / "src" / "data" / "og.json"

# 品牌色不寫死：從 variables.css 的 hex fallback 讀，改色只改一個地方。
def brand_colors():
    css = (ROOT / "src" / "styles" / "variables.css").read_text(encoding="utf-8")
    out = {}
    for name in ("primary", "accent", "white", "bg-light"):
        m = re.search(rf"--color-{re.escape(name)}:\s*(#[0-9a-fA-F]{{3,8}})", css)
        if not m:
            raise SystemExit(f"variables.css 找不到 --color-{name} 的 hex fallback")
        out[name] = m.group(1)
    return out

C = brand_colors()
INK = C["primary"]
ACCENT = C["accent"]
WHITE = C["white"]

def font_file(pattern):
    """用 fc-match 問系統要字型檔，不寫死路徑（不同發行版位置不同）。"""
    path = subprocess.run(
        ["fc-match", "-f", "%{file}", pattern], capture_output=True, text=True, check=True
    ).stdout.strip()
    if not path:
        raise SystemExit(f"找不到字型：{pattern}")
    return path

SANS_BOLD = font_file("Noto Sans CJK TC:style=Bold")
SANS_REG = font_file("Noto Sans CJK TC:style=Regular")

def load(path, size):
    # .ttc 是字型集合，Noto CJK 的 TC 不一定是第 0 個 face；逐個試到畫得出中文為止。
    for index in range(12):
        try:
            f = ImageFont.truetype(path, size, index=index)
        except OSError:
            break
        if f.getbbox("公")[2] > 0 and f.getbbox("公")[2] < size * 1.5:
            return f
    return ImageFont.truetype(path, size)


# ── 站徽 ─────────────────────────────────────────────────────────────
# 設計：墨青圓角方塊 ＋ 白色「公」 ＋ 底緣朱磚色帶（公文用紙下緣的意象）。
# 16px 下要認得出來，所以只放一個筆畫簡單的字，不放任何細節。
def mark(size, plate=None, glyph_fill=None):
    """站徽。plate=底色，glyph_fill=字色；不給就是預設的墨青底白字。

    畫法：先鋪一張「上半墨青、下緣朱磚色帶」的平面圖，再套圓角遮罩，
    最後把字畫在墨青那一區的正中央。之前用兩個 rounded_rectangle 疊出色帶，
    結果色帶連著圓角半徑一起長成三分之一高、上緣還沒圓角。
    """
    ss = 8  # 超取樣，之後縮下來邊緣才乾淨
    px = size * ss
    plate = plate or INK
    glyph_fill = glyph_fill or WHITE

    bar_h = int(px * 0.10)
    flat = Image.new("RGB", (px, px), plate)
    ImageDraw.Draw(flat).rectangle([0, px - bar_h, px, px], fill=ACCENT)

    mask = Image.new("L", (px, px), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, px - 1, px - 1], radius=int(px * 0.2), fill=255
    )
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    img.paste(flat, (0, 0), mask)

    face_h = px - bar_h
    glyph = load(SANS_BOLD, int(px * 0.52))
    bbox = glyph.getbbox("公")
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    ImageDraw.Draw(img).text(
        ((px - w) / 2 - bbox[0], (face_h - h) / 2 - bbox[1]),
        "公",
        font=glyph,
        fill=glyph_fill,
    )
    return img.resize((size, size), Image.LANCZOS)


SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><clipPath id="r"><rect width="64" height="64" rx="12.8" ry="12.8"/></clipPath></defs>
  <g clip-path="url(#r)">
    <rect width="64" height="64" fill="{ink}"/>
    <rect y="57.6" width="64" height="6.4" fill="{accent}"/>
    <text x="32" y="30" fill="{white}" font-size="33" font-weight="700"
          text-anchor="middle" dominant-baseline="central"
          font-family="'Noto Sans CJK TC','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif">公</text>
  </g>
</svg>
"""


def write_icons():
    # Google 的 favicon 要求：正方形、邊長是 48 的倍數。ico 內含 48/96/144。
    sizes = [48, 96, 144]
    icons = [mark(s) for s in sizes]
    icons[0].save(PUBLIC / "favicon.ico", format="ICO", sizes=[(s, s) for s in sizes])
    mark(180).save(PUBLIC / "apple-touch-icon.png", format="PNG")
    # SVG 版給支援的瀏覽器（任何尺寸都銳利）；ico 是 Google 與舊瀏覽器的退路。
    # 字型走系統堆疊：使用者端沒有 Noto CJK 也還有 PingFang／微軟正黑可頂。
    (PUBLIC / "favicon.svg").write_text(
        SVG.format(ink=INK, accent=ACCENT, white=WHITE), encoding="utf-8"
    )
    print(f"  favicon.ico（{'/'.join(map(str, sizes))}）、favicon.svg、apple-touch-icon.png（180）")


# ── 分享圖 ───────────────────────────────────────────────────────────
W, H = 1200, 630


def wrap(draw, text, font, max_w):
    lines, cur = [], ""
    for ch in text:
        if ch == "\n":
            lines.append(cur)
            cur = ""
            continue
        probe = cur + ch
        if draw.textlength(probe, font=font) <= max_w:
            cur = probe
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines


def card(kicker, title, out):
    img = Image.new("RGB", (W, H), INK)
    d = ImageDraw.Draw(img)

    # 底緣色帶＋右下角的站徽。站徽用反白版（白底墨青字）——同色底上放同色徽記
    # 會整個糊掉，第一版就是這樣壞的。
    d.rectangle([0, H - 16, W, H], fill=ACCENT)
    plate = mark(132, plate=WHITE, glyph_fill=INK)
    img.paste(plate, (W - 132 - 72, H - 132 - 72), plate)

    pad = 76
    max_w = W - 132 - 72 - pad * 2

    f_kicker = load(SANS_REG, 34)
    f_title = load(SANS_BOLD, 66)
    f_foot = load(SANS_REG, 30)

    d.text((pad, 92), kicker, font=f_kicker, fill=ACCENT)

    lines = wrap(d, title, f_title, max_w)[:4]
    y = 168
    for line in lines:
        d.text((pad, y), line, font=f_title, fill=WHITE)
        y += 92

    d.text((pad, H - 112), "公文 AI · www.ods.yao.care", font=f_foot, fill=WHITE)
    OG_DIR.mkdir(parents=True, exist_ok=True)
    img.save(OG_DIR / out, format="PNG", optimize=True)


# 每一頁的分類標籤。路由前綴決定，新增區段時補一條。
def kicker_for(path):
    if path == "/":
        return "公文範例與格式檢核"
    if path.startswith("/cases/"):
        return "機關公文範例"
    if path.startswith("/citizens/"):
        return "民眾書件與存證信函"
    return {
        "/checks/": "格式檢核",
        "/doc-types/": "文別",
        "/templates/": "Word 範本下載",
        "/writing/": "擬稿規定",
        "/usage/": "公文用語",
        "/terms/": "用語與法規速查",
        "/product/": "功能與導入",
        "/security/": "資料處理",
        "/apply/": "機關申請試用",
    }.get(path, "公文 AI")


def slug_for(path):
    return "home" if path == "/" else path.strip("/").replace("/", "-")


def main():
    print("產生站徽…")
    write_icons()

    dist = ROOT / "dist"
    pages = sorted(dist.glob("**/index.html"))
    if not pages:
        raise SystemExit("找不到 dist/，請先 pnpm build（標題要從實際產物取，不另外抄一份）")

    print(f"產生分享圖（{len(pages)} 頁，1200×630）…")
    manifest = {}
    for f in pages:
        path = "/" + str(f.parent.relative_to(dist)).replace("\\", "/").strip(".") + "/"
        path = "/" if path == "//" else path.replace("//", "/")
        html = f.read_text(encoding="utf-8")
        m = re.search(r"<title>(.*?)</title>", html, re.S)
        if not m:
            continue
        raw = m.group(1)
        title = re.sub(r"\s*[｜|]\s*公文 AI\s*$", "", raw).replace("&middot;", "·").strip()
        name = f"{slug_for(path)}.png"
        card(kicker_for(path), title, name)
        manifest[path] = {"file": f"og/{name}", "title": raw}

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    print(f"  {len(manifest)} 張 → public/og/，清單 → src/data/og.json")


if __name__ == "__main__":
    main()

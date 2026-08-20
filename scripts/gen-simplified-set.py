#!/usr/bin/env python3
"""產生 src/data/simplified-chars.json：只在來源資料改版時跑，平常不跑（同 fetch-gov-template 的性質）。

  python3 bin/gen-simplified-set.py

為什麼需要這支：**Unicode 沒有「繁體區間」**。繁簡同住 CJK 統一漢字 U+4E00–U+9FFF
（「該」U+8A72 與它的簡化形 U+8BE5 都在區間內），所以「檢查碼點落在哪個區間」抓不到簡體字。
能用程式判的只有「逐字比對一份『簡體專用字』碼點集合」，這支就是產那份集合。

判準（兩個獨立權威都同意才收，寧可漏抓也不誤殺）：
  ① OpenCC STCharacters.txt（簡→繁字典）裡有這個字，
     **且該字不在自己的轉換目標清單裡**。
     ——「自己也在目標裡」代表它在正體正字法中照樣使用，只是同時是別字的簡化形：
        后→「後 后」、里→「裏 里」、面→「面 麪」、台→「臺 檯 颱 台」、志→「志 誌」。
        這 99 個字在真實公文中大量出現（實測站上案例語料：合 88、出 35、面 26、回 20、
        里 15、借 9、志 8、表 4 次…全是「符合／提出／書面／回覆／里長／借款／代表」），
        收進來會讓守門每天在合法公文上誤報，故一律排除。
  ② Unihan_Variants.txt 有給這個字 kTraditionalVariant。
     ——用來剔掉 OpenCC 的「異體選字」：群→羣、秘→祕、峰→峯、床→牀、痴→癡。
        那是台標與舊字形之爭，不是簡繁；Unihan 不視它們為簡化字，故不收。
  ③ 不是「台灣標準字」。TWVariantsRev.txt 的鍵即台標（灶→竈 表示 灶 是台標、竈 是古字），
     TWVariants.txt 的值同理（僞→偽、喫→吃）。①② 會漏掉這類：實測 `灶` 一度被判成簡體，
     但「病灶」是標準正體用法。凡台標一律放行。

單靠任一邊都不行：Unihan 分不出 U+8FD9（「這」的簡化形，kTraditionalVariant 含自己）與 后（「后 後」），
兩者結構完全相同；OpenCC 則會把異體選字一起算進來。
"""
import bz2, json, sys, datetime

ST = '/usr/local/lib/python3.12/dist-packages/opencc/dictionary/STCharacters.txt'
UNIHAN = '/usr/share/unicode/Unihan_Variants.txt.bz2'
TWREV = '/usr/local/lib/python3.12/dist-packages/opencc/dictionary/TWVariantsRev.txt'
TWFWD = '/usr/local/lib/python3.12/dist-packages/opencc/dictionary/TWVariants.txt'
OUT = 'src/data/simplified-chars.json'

st = {}
for line in open(ST, encoding='utf-8'):
    k, v = line.rstrip('\n').split('\t')
    st[k] = v.split(' ')

uni = set()
for line in bz2.open(UNIHAN, 'rt', encoding='utf-8'):
    if line.startswith('#') or not line.strip():
        continue
    p = line.split('\t')
    if p[1] == 'kTraditionalVariant':
        uni.add(chr(int(p[0][2:], 16)))

taiwan = set()
for path, take in ((TWREV, 'key'), (TWFWD, 'val')):
    for line in open(path, encoding='utf-8'):
        k, v = line.rstrip('\n').split('\t')
        taiwan.add(k) if take == 'key' else taiwan.update(v.split(' '))

# ③ 的例外：U+4E48 台標成立（該字有「幺兒」的異體義），但它同時是「麼」的簡化形。
# 兩種身分無法用規則分辨,取用途權衡：SEO 報表與公文幾乎不用它的台標義,卻很容易用它代替「麼」,
# 故明列回收。代價：真要用它的台標義（幺兒之異體）會被誤判——已知且接受。
TAIWAN_OVERRIDE = {chr(0x4E48)}   # 「麼」的簡化形；不寫字面以免本檔自身違規
taiwan -= TAIWAN_OVERRIDE

simplified = {c: t for c, t in st.items() if c not in t and c in uni and c not in taiwan}
excluded_taiwan = sorted(c for c, t in st.items() if c not in t and c in uni and c in taiwan)
excluded_dual = sorted(c for c, t in st.items() if c in t and c in uni)
excluded_variant = sorted(c for c, t in st.items() if c not in t and c not in uni)

json.dump({
    '_generated': datetime.date.today().isoformat(),
    '_sources': {'opencc': ST, 'unihan': UNIHAN},
    '_criterion': 'OpenCC STCharacters 的鍵、且該字不在自己的轉換目標內、且 Unihan 有 kTraditionalVariant',
    '_excludedDual': ''.join(excluded_dual),
    '_excludedDualNote': '正體通用字，同時是別字的簡化形（后里面台志表…）。公文常用，一律放行。',
    '_excludedVariant': ''.join(excluded_variant),
    '_excludedVariantNote': '異體選字（群羣／秘祕／峰峯／床牀），非簡繁問題，放行。',
    '_excludedTaiwan': ''.join(excluded_taiwan),
    '_excludedTaiwanNote': '台灣標準字（灶竈／吃喫／偽僞…）。「病灶」是正體正常用法，放行。',
    '_taiwanOverride': ''.join(sorted(TAIWAN_OVERRIDE)),
    '_taiwanOverrideNote': 'U+4E48：台標成立（幺兒之異體）但仍收，因為它更常被拿來代替「麼」。代價見產生器註解。',
    'map': simplified,
}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)

print(f'✅ {OUT}：簡體專用 {len(simplified)} 字／放行雙身分字 {len(excluded_dual)}'
      f'／放行異體選字 {len(excluded_variant)}／放行台灣標準字 {len(excluded_taiwan)}')

// 內鏈稽核 —— 在 astro build 之後跑，掃 dist/**/index.html。
//
// 為什麼要有這支（2026-08-26）：2026-08-19 的教訓是「新增任何一批頁面時，同一回合就要
// 補上內鏈三條路，只靠 sitemap 不會被爬」，但那條規矩沒有任何東西在守。
// 今天一口氣新增 30 頁之後手動稽核，抓到 /private-documents/loan-iou/ 只有 2 條內鏈 ——
// 真因是明細頁的「其他民間書件」用 slice(0, 2) 取前兩則，分類一多，
// 排在後面的分類永遠拿不到橫向連結。這種漂移不會有任何畫面異常。
//
// 判準：**內文**（不含導覽列與頁尾）至少 2 條，加上導覽列或頁尾至少 1 條，合計 ≥3。
// 導覽列每頁都有，單獨算一條，不能拿它充數。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const MIN_BODY = 2;
const MIN_TOTAL = 3;

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('index.html') ? [full] : [];
  });

const files = walk(DIST);
const routeOf = (f) => {
  const rel = f.slice(DIST.length).replace(/index\.html$/, '');
  return rel === '/' ? '/' : rel;
};
const routes = new Map(files.map((f) => [routeOf(f), f]));

const inbound = new Map([...routes.keys()].map((r) => [r, { body: new Set(), chrome: 0 }]));

for (const [from, file] of routes) {
  const html = readFileSync(file, 'utf8');
  // 導覽列與頁尾每頁都一樣，單獨算；其餘視為內文連結。
  const header = html.split('</header>')[0] ?? '';
  const rest = html.split('</header>').slice(1).join('</header>');
  const footer = rest.split('<footer').slice(1).join('<footer');
  const body = rest.split('<footer')[0] ?? '';
  for (const to of routes.keys()) {
    if (to === from) continue;
    const needle = `href="${to}"`;
    const rec = inbound.get(to);
    if (body.includes(needle)) rec.body.add(from);
    else if (header.includes(needle) || footer.includes(needle)) rec.chrome += 1;
  }
}

const problems = [];
for (const [route, rec] of inbound) {
  if (route === '/') continue; // 首頁靠站徽連結，每頁都有，不套這條
  const total = rec.body.size + (rec.chrome > 0 ? 1 : 0);
  if (rec.body.size < MIN_BODY || total < MIN_TOTAL) {
    problems.push(`${route}：內文 ${rec.body.size} 條、導覽列或頁尾 ${rec.chrome > 0 ? '有' : '無'}`);
  }
}

if (problems.length) {
  console.error(`\n❌ 內鏈守門：${problems.length} 頁內鏈不足（內文至少 ${MIN_BODY} 條、合計至少 ${MIN_TOTAL} 條）\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   2026-08-19 實測：只從一個入口進得去的頁面，Google 會停在 Discovered 不爬。');
  console.error('   新增一批頁面時同一回合補上三條路：首頁或樞紐頁直連、導覽列、同類互連。\n');
  process.exit(1);
}

console.log(`內鏈守門：${routes.size} 頁，每頁內文至少 ${MIN_BODY} 條內鏈、合計至少 ${MIN_TOTAL} 條。`);

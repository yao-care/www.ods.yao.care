// 錨點守門（2026-08-20）——在 astro build 之後跑，掃 dist/**/*.html。
//
// 為什麼要有這支：長參考頁的「本頁章節」目錄（src/components/PageToc.astro）與 <h2> 的
// id 分別寫在兩個地方，章節改名或刪節時很容易只改一邊，結果目錄點下去跳不動。
// 這種壞法在畫面上沒有任何錯誤訊息，只有使用者會遇到，所以用 build 擋。
//
// 規則：同頁錨點（href="#x"）必須在同一份 HTML 找得到 id="x"。
//   放行 href="#"（純佔位）與跨頁錨點（href="/a/#x"，那是另一份 HTML 的事）。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const DIST = 'dist';
if (!existsSync(DIST)) {
  console.error('[check-anchors] 找不到 dist/，請先跑 astro build');
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.html') files.push(p);
  }
})(DIST);

const problems = [];
let anchors = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const hrefs = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  for (const raw of hrefs) {
    anchors += 1;
    const target = decodeURIComponent(raw);
    if (!ids.has(target)) problems.push(`${relative('.', file)} → #${target} 沒有對應的 id`);
  }
}

if (problems.length) {
  console.error(`\n❌ 錨點守門：${problems.length} 個連結指向不存在的 id\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   目錄與標題的單一真實來源是頁面 frontmatter 的章節物件，兩邊要取同一份。\n');
  process.exit(1);
}
console.log(`錨點守門：${files.length} 頁、${anchors} 個同頁錨點全部有落點。`);

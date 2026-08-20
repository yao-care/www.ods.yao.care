// 分享圖守門（2026-08-20）——在 astro build 之後跑，掃 dist/**/*.html。
//
// 為什麼要有：每頁的分享圖是本機用 scripts/gen-brand-images.py 產生後 commit 的
// （CI 沒有 Pillow 也沒有中文字型，見那支檔頭的理由）。產物離線就會漂：
// 改了頁面標題卻沒重跑產生器，分享出去的卡片還是舊標題，而且畫面上完全看不出來。
// 這支拿實際 <title> 對帳 src/data/og.json，對不上就擋 build。
//
// 一併驗 Discover 的兩個硬條件：og:image 指到的檔案真的存在，
// 以及頁面有 max-image-preview:large（少了它，1200 寬的圖只會拿到縮圖版位）。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const DIST = 'dist';
const MANIFEST = 'src/data/og.json';
if (!existsSync(DIST)) {
  console.error('[check-og] 找不到 dist/，請先跑 astro build');
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (extname(p) === '.html') files.push(p);
  }
})(DIST);

const problems = [];
let checked = 0;

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const route = '/' + relative(DIST, file).replace(/index\.html$/, '').replace(/\\/g, '/');
  // Astro 把 404 產成 dist/404.html（不是 404/index.html），所以兩種形狀都要放行。
  // 它借用首頁那張圖、也不進 sitemap，沒有對帳標題的意義。
  if (route === '/404/' || route === '/404.html') continue;

  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];

  if (!image) {
    problems.push(`${route} 沒有 og:image`);
    continue;
  }
  if (!/max-image-preview:large/.test(html)) {
    problems.push(`${route} 缺 max-image-preview:large（Discover 大圖版位吃不到）`);
  }

  const local = join(DIST, new URL(image).pathname);
  if (!existsSync(local)) problems.push(`${route} 的 og:image 指到不存在的檔案：${image}`);

  const entry = manifest[route];
  if (!entry) {
    problems.push(`${route} 不在 ${MANIFEST} 裡（新增頁面後要重跑 pnpm gen:brand）`);
  } else if (entry.title !== title) {
    problems.push(
      `${route} 標題已改但分享圖沒重產：\n      圖上是「${entry.title}」\n      頁面是「${title}」`,
    );
  }
  checked += 1;
}

if (problems.length) {
  console.error(`\n❌ 分享圖守門：${problems.length} 個問題\n`);
  for (const p of problems) console.error(`   ${p}`);
  console.error('\n   修法：pnpm build 產出 dist 後跑 `pnpm gen:brand`，再 commit public/og/ 與 src/data/og.json。\n');
  process.exit(1);
}
console.log(`分享圖守門：${checked} 頁的 og:image 都在、標題都對得上、Discover 大圖已開。`);

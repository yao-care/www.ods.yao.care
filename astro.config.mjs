import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { createLastmod } from './scripts/lib/lastmod.mjs';

// sitemap 逐頁帶 lastmod（取 git commit 時間）。沒有這個欄位時，Google 每天下載 sitemap
// 也不會知道哪頁變了 —— 實測 08-17 收錄後全站再沒被重爬過。理由詳見 scripts/lib/lastmod.mjs。
const lastmod = createLastmod();

export default defineConfig({
  site: 'https://www.ods.yao.care',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap({ serialize: (item) => ({ ...item, lastmod: lastmod(item.url) }) })],
});

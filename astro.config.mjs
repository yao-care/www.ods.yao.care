import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.ods.yao.care',
  output: 'static',
  build: { format: 'directory' },
  integrations: [sitemap()],
});

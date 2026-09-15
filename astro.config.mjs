import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://charyton.dev',
  integrations: [sitemap()],
  build: { inlineStylesheets: 'auto' },
});

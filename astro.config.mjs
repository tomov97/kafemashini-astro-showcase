// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kafemashini.ch',
  build: {
    format: 'file',
  },
  integrations: [
    // Exclude only the /blog listing page (low-value index); blog POSTS
    // (/blog/{slug}) stay in the sitemap. The listing self-noindexes until it
    // has posts (see blog.astro).
    sitemap({
      filter: (page) => page.replace(/\/$/, '') !== 'https://kafemashini.ch/blog',
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});

// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import rehypeSlug from 'rehype-slug';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), mdx()],

  markdown: {
    rehypePlugins: [rehypeSlug],
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
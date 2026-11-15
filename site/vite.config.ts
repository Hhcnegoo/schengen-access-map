import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const siteDir = fileURLToPath(new URL('.', import.meta.url));
const processedDir = resolve(siteDir, '../data/processed');

/**
 * Publish the processed tables next to the site so the download links point
 * to the same origin. The files are read from `data/processed`; no copy is
 * kept under `site/`.
 */
function processedDataFiles(): Plugin {
  const isPublished = (name: string) => name.endsWith('.csv') || name.endsWith('.json');
  return {
    name: 'processed-data-files',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = /\/data\/([\w.-]+)$/.exec(request.url ?? '')?.[1];
        if (!name || !isPublished(name) || !readdirSync(processedDir).includes(name)) {
          next();
          return;
        }
        response.setHeader(
          'Content-Type',
          name.endsWith('.csv') ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        );
        response.end(readFileSync(resolve(processedDir, name)));
      });
    },
    generateBundle() {
      for (const name of readdirSync(processedDir).filter(isPublished)) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${name}`,
          source: readFileSync(resolve(processedDir, name)),
        });
      }
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the site under /<repository name>/. The deploy
  // workflow passes the actual repository name through BASE_PATH.
  base: process.env.BASE_PATH ?? '/schengen-access-map/',
  plugins: [react(), processedDataFiles()],
  resolve: {
    alias: { '@data': processedDir },
  },
  server: {
    fs: { allow: [resolve(siteDir, '..')] },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

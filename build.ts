#!/usr/bin/env bun

import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const isWatch = process.argv.includes('--watch');
const dist = join(process.cwd(), 'dist');

async function build() {
  console.log('Building Chrome extension...');

  // Create dist directory
  mkdirSync(dist, { recursive: true });

  try {
    // Build TypeScript files
    const buildPromises = [
      Bun.build({
        entrypoints: ['src/background/index.ts'],
        outdir: dist,
        naming: 'background.js',
        target: 'browser',
        minify: !isWatch,
        sourcemap: isWatch ? 'inline' : 'external',
        splitting: false
      }),
      Bun.build({
        entrypoints: ['src/popup/index.ts'],
        outdir: dist,
        naming: 'popup.js',
        target: 'browser',
        minify: !isWatch,
        sourcemap: isWatch ? 'inline' : 'external',
        splitting: false
      }),
      Bun.build({
        entrypoints: ['src/content/index.ts'],
        outdir: dist,
        naming: 'content.js',
        target: 'browser',
        minify: !isWatch,
        sourcemap: isWatch ? 'inline' : 'external',
        splitting: false
      })
    ];

    const results = await Promise.all(buildPromises);

    // Check for build errors
    for (const result of results) {
      if (!result.success) {
        console.error('Build failed:', result.logs);
        process.exit(1);
      }
    }

    // Copy static assets
    copyFileSync('src/assets/popup.html', join(dist, 'popup.html'));
    copyFileSync('src/assets/popup.css', join(dist, 'popup.css'));
    copyFileSync('manifest.json', join(dist, 'manifest.json'));

    // Copy icons if they exist
    if (existsSync('icons')) {
      mkdirSync(join(dist, 'icons'), { recursive: true });
      for (const file of readdirSync('icons')) {
        copyFileSync(join('icons', file), join(dist, 'icons', file));
      }
    }

    console.log('✓ Build complete!');

    if (isWatch) {
      console.log('👀 Watching for changes...');
    }
  } catch (error) {
    console.error('Build error:', error);
    process.exit(1);
  }
}

await build();

// Simple file watcher for development
if (isWatch) {
  const { watch } = await import('fs');

  watch('src', { recursive: true }, async (eventType, filename) => {
    if (filename?.endsWith('.ts') || filename?.endsWith('.html') || filename?.endsWith('.css')) {
      console.log(`\n📝 ${filename} changed, rebuilding...`);
      await build();
    }
  });
}

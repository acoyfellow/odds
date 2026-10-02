import { $ } from 'bun';
import { buildHonoSvelte } from 'svelte-hono/build';
import { highlightSnippets } from './highlight.ts';

await $`bunx @tailwindcss/cli -i ./src/app.css -o ./build/app.css --minify`.quiet();

const css = await Bun.file('./build/app.css').text();

const highlighted = await highlightSnippets();

await Bun.write(
  './src/assets.generated.ts',
  `export const APP_CSS = ${JSON.stringify(css)};\nexport const HIGHLIGHTED = ${JSON.stringify(highlighted)};\n`,
);

const result = await buildHonoSvelte({
  workerEntry: './src/worker.ts',
  outDir: './build',
  components: { docs: './Docs.svelte' },
});

console.log(`tailwind ${(css.length / 1024).toFixed(1)} KB`);

console.log(`worker ${(result.workerBytes / 1024).toFixed(1)} KB`);

for (const [id, sizes] of Object.entries(result.bundleSizes)) {
  console.log(
    `client ${id} ${(sizes.js / 1024).toFixed(1)} KB js, ${(sizes.css / 1024).toFixed(1)} KB css`,
  );
}

import { buildHonoSvelte } from 'svelte-hono/build';

const result = await buildHonoSvelte({
  workerEntry: './src/worker.ts',
  outDir: './build',
  components: { docs: './Docs.svelte' },
});

console.log(`worker ${(result.workerBytes / 1024).toFixed(1)} KB`);
for (const [id, sizes] of Object.entries(result.bundleSizes)) {
  console.log(
    `client ${id} ${(sizes.js / 1024).toFixed(1)} KB js, ${(sizes.css / 1024).toFixed(1)} KB css`,
  );
}

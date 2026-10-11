import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadNorthstarItems } from '../evals/northstar/data.ts';
import { scorePacked } from '../evals/northstar/packed.ts';
import { PACK_SIZE, URGENT_QUESTION, URGENT_THRESHOLD } from '../evals/northstar/run.ts';
import { readConfig, resolveToken } from '../src/credentials.ts';

const OUT = join(import.meta.dir, '..', 'site', 'src', 'hero-data.ts');

const items = await loadNorthstarItems();

const config = readConfig();

const target = {
  accountId: config.accountId,
  gateway: config.gateway,
  token: resolveToken().token,
  timeoutMs: 120_000,
};

const run = await scorePacked(target, 'clef-flash', items, PACK_SIZE, URGENT_QUESTION);

if (run.failures.length > 0) throw new Error(`packs failed: ${run.failures.join('; ')}`);

const byId = new Map(run.scores.map((score) => [score.id, score]));

const rows = items.map((item) => {
  const score = byId.get(item.id);

  if (!score) throw new Error(`missing score for ${item.id}`);

  return [
    item.id,
    Number(score.urgent.toFixed(3)),
    Number(score.injection.toFixed(3)),
    item.truth === 'urgent' ? 1 : 0,
    item.injection ? 1 : 0,
  ];
});

const recording = {
  model: 'clef-flash',
  recordedAt: new Date().toISOString(),
  packSize: PACK_SIZE,
  threshold: URGENT_THRESHOLD,
  calls: run.calls,
  costUsd: Number(run.costUsd.toFixed(5)),
  wallMs: run.wallMs,
  rows,
};

writeFileSync(OUT, `export const HERO_RUN = ${JSON.stringify(recording)} as const;\n`);

console.log(
  `calls ${run.calls} cost $${recording.costUsd} wall ${run.wallMs} ms rows ${rows.length}`,
);

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RUNS_DIR = join(import.meta.dir, 'runs');
const SITE_DATA = join(import.meta.dir, '..', 'site', 'src', 'eval-report.generated.ts');

function latestRun(): string {
  const complete = readdirSync(RUNS_DIR)
    .filter((name) => existsSync(join(RUNS_DIR, name, 'manifest.json')))
    .sort();
  const chosen = process.argv[2] ?? complete.at(-1);
  if (!chosen) throw new Error('no complete eval run found; run `bun run eval` first');
  return chosen;
}

const runId = latestRun();
const runDir = join(RUNS_DIR, runId);
const manifest = JSON.parse(readFileSync(join(runDir, 'manifest.json'), 'utf8'));
const cells = readdirSync(runDir)
  .filter((name) => name !== 'manifest.json' && name.endsWith('.json'))
  .map((name) => {
    const cell = JSON.parse(readFileSync(join(runDir, name), 'utf8'));
    return {
      task: cell.task,
      model: cell.model,
      file: `evals/runs/${runId}/${name}`,
      summary: cell.summary,
      points: cell.predictions
        .filter((p: { probability: number | null }) => p.probability !== null)
        .map((p: { id: string; truth: string; predicted: string; probability: number }) => ({
          id: p.id,
          truth: p.truth,
          predicted: p.predicted,
          probability: Math.round(p.probability * 1000) / 1000,
        })),
    };
  });

const report = { runId, manifest, cells };
writeFileSync(SITE_DATA, `export const EVAL_REPORT = ${JSON.stringify(report)} as const;\n`);

const lines = [
  `# Eval run ${runId}`,
  '',
  `Commit \`${manifest.commit}\`. Command \`${manifest.command}\`.`,
  '',
];
for (const task of manifest.tasks) {
  lines.push(
    `## ${task.title}`,
    '',
    `\`${task.dataset}@${task.revision.slice(0, 7)}\`, ${task.sampling}.`,
    '',
  );
  lines.push(
    '| model | headline | accuracy | AUROC | Brier | MAE | p50 ms | p95 ms | $ / 1k items | errors |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  for (const cell of cells.filter((c) => c.task === task.id)) {
    const s = cell.summary;
    const fmt = (v: number | undefined, d = 3) => (v === undefined ? '' : v.toFixed(d));
    lines.push(
      `| ${cell.model} | ${s.headline.name} ${fmt(s.headline.value)} | ${fmt(s.accuracy)} | ${fmt(s.auroc)} | ${fmt(s.brier)} | ${fmt(s.maeStars, 2)} | ${s.latency.p50Ms} | ${s.latency.p95Ms} | ${s.costPer1kUsd.toFixed(4)} | ${s.errors} |`,
    );
  }
  lines.push('');
}
writeFileSync(join(runDir, 'REPORT.md'), `${lines.join('\n')}\n`);
console.log(lines.join('\n'));

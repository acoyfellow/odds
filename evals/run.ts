import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readConfig, redact, resolveToken } from '../src/credentials.ts';
import { ODDS_MODELS } from '../src/models.ts';
import { type EvalTask, loadTaskItems, parquetUrl, rowsHash, TASKS } from './datasets.ts';
import {
  chatRunner,
  decisionRunner,
  type EvalRunner,
  type Prediction,
  promptFor,
} from './runners.ts';
import { summarize } from './summarize.ts';

const CONCURRENCY = 4;

interface EvalManifest {
  kind: 'odds.eval/v0';
  startedAt: string;
  finishedAt?: string;
  commit: string;
  command: string;
  concurrency: number;
  pricesSource: string;
  gateway: string;
  tasks: ReturnType<typeof describeTask>[];
  models: Pick<
    EvalRunner,
    'id' | 'kind' | 'workersAiId' | 'usdPerMillionInput' | 'usdPerMillionOutput'
  >[];
}

const PRICES_SOURCE = 'https://developers.cloudflare.com/workers-ai/platform/pricing/';

function runners(target: Parameters<typeof decisionRunner>[0]): EvalRunner[] {
  return [
    ...ODDS_MODELS.map((model) =>
      decisionRunner(target, model.id, model.workersAiId, model.inputUsdPerMillion),
    ),
    chatRunner(target, 'llama-3.3-70b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 0.293, 2.253),
  ];
}

async function pool<T, R>(
  items: readonly T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await work(items[index]);
      }
    }),
  );

  return results;
}

function argument(name: string): string | undefined {
  const flag = process.argv.find((value) => value.startsWith(`--${name}=`));

  return flag?.slice(name.length + 3);
}

async function main(): Promise<void> {
  const config = readConfig();
  const { token } = resolveToken();
  const target = { accountId: config.accountId, gateway: config.gateway, token };
  const onlyTask = argument('task');
  const onlyModel = argument('model');
  const limit = argument('limit') ? Number(argument('limit')) : undefined;
  const commit = execSync('git rev-parse HEAD').toString().trim();
  const startedAt = new Date().toISOString();
  const runDir = join(import.meta.dir, 'runs', startedAt.slice(0, 19).replace(/:/g, '-'));
  mkdirSync(runDir, { recursive: true });

  const tasks = TASKS.filter((task) => !onlyTask || task.id === onlyTask);
  const models = runners(target).filter((runner) => !onlyModel || runner.id === onlyModel);

  const manifest: EvalManifest = {
    kind: 'odds.eval/v0',
    startedAt,
    commit,
    command: `bun run eval${process.argv
      .slice(2)
      .map((a) => ` ${a}`)
      .join('')}`,
    concurrency: CONCURRENCY,
    pricesSource: PRICES_SOURCE,
    gateway: 'Cloudflare AI Gateway, Workers AI provider',
    tasks: [],
    models: models.map(({ id, kind, workersAiId, usdPerMillionInput, usdPerMillionOutput }) => ({
      id,
      kind,
      workersAiId,
      usdPerMillionInput,
      usdPerMillionOutput,
    })),
  };

  for (const task of tasks) {
    const loaded = await loadTaskItems(task);
    const items = limit ? loaded.items.slice(0, limit) : loaded.items;
    manifest.tasks.push(describeTask(task, items.length, loaded.total, rowsHash(items)));

    for (const runner of models) {
      const started = performance.now();

      const predictions: Prediction[] = await pool(items, CONCURRENCY, (item) =>
        runner.run(task, item),
      );

      const wallMs = Math.round(performance.now() - started);
      const summary = summarize(task, runner, predictions, wallMs);
      writeFileSync(
        join(runDir, `${task.id}.${runner.id}.json`),
        `${JSON.stringify({ task: task.id, model: runner.id, summary, predictions }, null, 2)}\n`,
      );
      console.log(
        redact(
          `${task.id.padEnd(9)} ${runner.id.padEnd(14)} ${summary.headline.name}=${summary.headline.value.toFixed(3)} errors=${summary.errors} p50=${summary.latency.p50Ms}ms cost=$${summary.costUsd.toFixed(5)}`,
          token,
        ),
      );
    }
  }

  manifest.finishedAt = new Date().toISOString();
  writeFileSync(join(runDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`wrote ${runDir}`);
}

function describeTask(task: EvalTask, count: number, total: number, hash: string) {
  return {
    id: task.id,
    title: task.title,
    dataset: task.dataset,
    revision: task.revision,
    file: task.file,
    source: parquetUrl(task),
    license: task.license,
    sampled: count,
    datasetRows: total,
    sampling: `${count} evenly spaced rows from the first ${Math.min(total, task.window ?? total)}`,
    rowsSha256: hash,
    question: task.question,
    chatPrompt: promptFor(task, '<text>'),
  };
}

await main();

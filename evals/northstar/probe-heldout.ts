import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { readConfig, resolveToken } from '../../src/credentials.ts';
import { scorePacked } from './packed.ts';
import { URGENT_QUESTION } from './run.ts';

const ROOT = join(import.meta.dir, '..', '..');

const CACHE = join(ROOT, '.eval-cache', 'heldout-issues.json');

const BODY_LIMIT = 1_200;

const heldoutFile = z.object({
  scored: z.array(z.object({ number: z.number(), truth: z.boolean() })),
});

const heldItem = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  truth: z.boolean(),
});

type HeldItem = z.infer<typeof heldItem>;

function trimBody(body: string): string {
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '')
    .trim();

  return cleaned.length > BODY_LIMIT ? `${cleaned.slice(0, BODY_LIMIT)} [truncated]` : cleaned;
}

async function loadHeldout(): Promise<HeldItem[]> {
  if (existsSync(CACHE)) return z.array(heldItem).parse(JSON.parse(readFileSync(CACHE, 'utf8')));

  const held = heldoutFile.parse(
    JSON.parse(readFileSync(join(ROOT, 'evals', 'northstar', 'heldout.json'), 'utf8')),
  );

  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  const items: HeldItem[] = [];

  for (const { number, truth } of held.scored) {
    const response = await fetch(
      `https://api.github.com/repos/kubernetes/kubernetes/issues/${number}`,
      {
        headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
      },
    );

    const issue = z
      .object({ title: z.string(), body: z.string().nullish() })
      .parse(await response.json());

    items.push({ id: `#${number}`, title: issue.title, body: trimBody(issue.body ?? ''), truth });
  }

  mkdirSync(join(ROOT, '.eval-cache'), { recursive: true });
  writeFileSync(CACHE, JSON.stringify(items));

  return items;
}

export function bestThreshold(
  items: readonly { id: string; truth: boolean }[],
  urgentById: ReadonlyMap<string, number>,
) {
  const positives = items.filter((item) => item.truth).length;
  let best = { threshold: 0.5, f1: 0 };

  for (let step = 1; step < 100; step += 1) {
    const threshold = step / 100;
    const picked = items.filter((item) => (urgentById.get(item.id) ?? 0) >= threshold);
    const hits = picked.filter((item) => item.truth).length;
    const f1 = hits === 0 ? 0 : (2 * hits) / (picked.length + positives);

    if (f1 > best.f1) best = { threshold, f1: Number(f1.toFixed(3)) };
  }

  return best;
}

async function main(): Promise<void> {
  const modelId = process.argv[2] ?? 'clef-flash';
  const size = Number(process.argv[3] ?? 32);
  const items = await loadHeldout();
  const config = readConfig();

  const target = {
    accountId: config.accountId,
    gateway: config.gateway,
    token: resolveToken().token,
    timeoutMs: 120_000,
  };

  const run = await scorePacked(target, modelId, items, size, URGENT_QUESTION);
  const urgentById = new Map(run.scores.map((score) => [score.id, score.urgent]));

  console.log(
    JSON.stringify({
      modelId,
      size,
      calls: run.calls,
      failures: run.failures.slice(0, 2),
      scored: run.scores.length,
      costUsd: Number(run.costUsd.toFixed(5)),
      wallMs: run.wallMs,
      best: bestThreshold(items, urgentById),
      maxInjectionOnRealIssues: Math.max(0, ...run.scores.map((score) => score.injection)),
    }),
  );
}

if (import.meta.main) await main();

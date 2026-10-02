import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { askOdds } from '../../src/client.ts';
import { readConfig, resolveToken } from '../../src/credentials.ts';
import { datasetFile } from './data.ts';
import { URGENT_QUESTION } from './run.ts';

const ROOT = join(import.meta.dir, '..', '..');

const HELDOUT_BEFORE = '2023-06-01';

const PER_CLASS = 40;

const OUT = join(ROOT, 'evals', 'northstar', 'heldout.json');

const searchPage = z.object({
  items: z.array(
    z.object({
      number: z.number(),
      title: z.string(),
      body: z.string().nullish(),
      labels: z.array(z.object({ name: z.string() })),
      pull_request: z.json().optional(),
    }),
  ),
});

async function sample(
  label: string,
  excluded: readonly string[],
  skip: Set<number>,
  token: string,
) {
  const query = `repo:kubernetes/kubernetes is:issue label:"${label}" created:<${HELDOUT_BEFORE}`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=100`;

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });

  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  return searchPage
    .parse(await response.json())
    .items.filter((item) => {
      const names = item.labels.map((entry) => entry.name);

      return (
        !item.pull_request &&
        !skip.has(item.number) &&
        !excluded.some((name) => names.includes(name))
      );
    })
    .slice(0, PER_CLASS);
}

async function main(): Promise<void> {
  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();

  const test = datasetFile.parse(
    JSON.parse(readFileSync(join(ROOT, 'evals', 'northstar', 'issues.json'), 'utf8')),
  );

  const skip = new Set(test.issues.map((issue) => issue.number));
  const urgent = await sample('priority/critical-urgent', ['priority/backlog'], skip, token);

  const backlog = await sample(
    'priority/backlog',
    ['priority/critical-urgent', 'priority/important-soon'],
    skip,
    token,
  );

  const config = readConfig();

  const target = {
    accountId: config.accountId,
    gateway: config.gateway,
    token: resolveToken().token,
  };

  const scored: { number: number; truth: boolean; probability: number }[] = [];

  for (const [items, truth] of [
    [urgent, true],
    [backlog, false],
  ] as const) {
    for (const item of items) {
      const result = await askOdds(target, 'clef', {
        state: { title: item.title, body: (item.body ?? '').slice(0, 1_200) },
        questions: {
          urgent: {
            type: 'bool',
            instructions: URGENT_QUESTION,
            criteria: { true: 'Yes', false: 'No' },
          },
        },
      });

      const answer = result.ok ? result.answers.urgent : undefined;

      if (answer?.type === 'bool')
        scored.push({ number: item.number, truth, probability: answer.probability });
    }
  }

  let best = { threshold: 0.5, f1: 0 };

  for (let step = 1; step < 100; step += 1) {
    const threshold = step / 100;
    let hits = 0;
    let picked = 0;

    for (const item of scored) {
      if (item.probability >= threshold) {
        picked += 1;

        if (item.truth) hits += 1;
      }
    }

    const positives = scored.filter((item) => item.truth).length;

    const f1 =
      hits === 0
        ? 0
        : (2 * (hits / picked) * (hits / positives)) / (hits / picked + hits / positives);

    if (f1 > best.f1) best = { threshold, f1 };
  }

  writeFileSync(
    OUT,
    `${JSON.stringify({ heldoutBefore: HELDOUT_BEFORE, perClass: PER_CLASS, n: scored.length, best, scored }, null, 2)}\n`,
  );
  console.log(
    `held-out n=${scored.length} best threshold ${best.threshold} F1 ${best.f1.toFixed(3)}`,
  );
}

if (import.meta.main) await main();

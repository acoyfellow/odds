import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const REPO = 'kubernetes/kubernetes';

const FROZEN_BEFORE = '2026-01-01';

const PER_CLASS = 125;

const OUT = join(import.meta.dir, '..', 'evals', 'northstar', 'issues.json');

const searchPage = z.object({
  total_count: z.number(),
  items: z.array(
    z.object({
      number: z.number(),
      created_at: z.string(),
      labels: z.array(z.object({ name: z.string() })),
      pull_request: z.json().optional(),
    }),
  ),
});

function githubToken(): string {
  return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
}

async function search(label: string, page: number, token: string) {
  const query = `repo:${REPO} is:issue label:"${label}" created:<${FROZEN_BEFORE}`;
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&sort=created&order=desc&per_page=100&page=${page}`;

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });

  if (!response.ok) throw new Error(`${url} returned ${response.status}`);

  return searchPage.parse(await response.json());
}

function exclusive(
  labels: readonly { name: string }[],
  wanted: string,
  excluded: readonly string[],
) {
  const names = labels.map((label) => label.name);

  return names.includes(wanted) && !excluded.some((name) => names.includes(name));
}

async function sample(
  label: string,
  excluded: readonly string[],
  token: string,
): Promise<number[]> {
  const picked: number[] = [];

  for (let page = 1; picked.length < PER_CLASS && page <= 10; page += 1) {
    const { items } = await search(label, page, token);

    for (const item of items) {
      if (
        picked.length < PER_CLASS &&
        !item.pull_request &&
        exclusive(item.labels, label, excluded)
      ) {
        picked.push(item.number);
      }
    }

    if (items.length < 100) break;
  }

  if (picked.length < PER_CLASS) throw new Error(`${label}: only ${picked.length} issues`);

  return picked;
}

async function main(): Promise<void> {
  const token = githubToken();
  const urgent = await sample('priority/critical-urgent', ['priority/backlog'], token);

  const backlog = await sample(
    'priority/backlog',
    ['priority/critical-urgent', 'priority/important-soon'],
    token,
  );

  const issues = [
    ...urgent.map((number) => ({ number, truth: 'urgent' as const })),
    ...backlog.map((number) => ({ number, truth: 'not-urgent' as const })),
  ].sort((a, b) => a.number - b.number);

  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        kind: 'odds.northstar.dataset/v0',
        repo: REPO,
        frozenBefore: FROZEN_BEFORE,
        rule: `${PER_CLASS} newest issues created before ${FROZEN_BEFORE} labelled priority/critical-urgent (not backlog), and ${PER_CLASS} labelled priority/backlog (not critical-urgent or important-soon). Pull requests excluded. Labels read at freeze time.`,
        frozenAt: new Date().toISOString(),
        issues,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`froze ${issues.length} issues to ${OUT}`);
}

await main();

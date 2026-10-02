import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const ROOT = join(import.meta.dir, '..', '..');

const CACHE = join(ROOT, '.eval-cache', 'northstar-issues.json');

const BODY_LIMIT = 1_200;

export const datasetFile = z.object({
  repo: z.string(),
  frozenBefore: z.string(),
  issues: z.array(z.object({ number: z.number(), truth: z.enum(['urgent', 'not-urgent']) })),
});

const injectionFile = z.array(z.object({ id: z.string(), title: z.string(), body: z.string() }));

export interface NorthstarItem {
  id: string;
  title: string;
  body: string;
  truth: 'urgent' | 'not-urgent';
  injection: boolean;
}

const issueResponse = z.object({ title: z.string(), body: z.string().nullish() });

function trimBody(body: string): string {
  const cleaned = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\r/g, '')
    .trim();

  return cleaned.length > BODY_LIMIT ? `${cleaned.slice(0, BODY_LIMIT)} [truncated]` : cleaned;
}

async function fetchIssue(repo: string, number: number, token: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${number}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json' },
  });

  if (!response.ok) throw new Error(`issue ${number} returned ${response.status}`);

  return issueResponse.parse(await response.json());
}

export async function loadNorthstarItems(): Promise<NorthstarItem[]> {
  const dataset = datasetFile.parse(
    JSON.parse(readFileSync(join(ROOT, 'evals', 'northstar', 'issues.json'), 'utf8')),
  );

  const injections = injectionFile.parse(
    JSON.parse(readFileSync(join(ROOT, 'evals', 'northstar', 'injections.json'), 'utf8')),
  );

  let issues: NorthstarItem[];

  if (existsSync(CACHE)) {
    issues = z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          body: z.string(),
          truth: z.enum(['urgent', 'not-urgent']),
          injection: z.boolean(),
        }),
      )
      .parse(JSON.parse(readFileSync(CACHE, 'utf8')));
  } else {
    const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();

    issues = [];

    for (const { number, truth } of dataset.issues) {
      const issue = await fetchIssue(dataset.repo, number, token);

      issues.push({
        id: `#${number}`,
        title: issue.title,
        body: trimBody(issue.body ?? ''),
        truth,
        injection: false,
      });
    }

    mkdirSync(join(ROOT, '.eval-cache'), { recursive: true });
    writeFileSync(CACHE, JSON.stringify(issues));
  }

  const planted = injections.map((item) => ({
    ...item,
    truth: 'not-urgent' as const,
    injection: true,
  }));

  const all = [...issues, ...planted];

  const order = [...all.keys()].sort(
    (a, b) => ((a * 2_654_435_761) % 4_294_967_296) - ((b * 2_654_435_761) % 4_294_967_296),
  );

  return order.map((index) => all[index]);
}

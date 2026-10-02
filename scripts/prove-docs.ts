import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

const PROOF_RUNS_DIR = join(import.meta.dir, '..', 'proof-runs');

const SITE = process.env.ODDS_DOCS_URL ?? 'https://odds.coey.dev';

const ROOT = join(import.meta.dir, '..');

const FORBIDDEN_BINDINGS = [
  'ai',
  'kv_namespaces',
  'd1_databases',
  'r2_buckets',
  'durable_objects',
  'services',
  'vars',
];

const RETIRED_WORKERS = ['odds', 'odds-capcheck'];

interface Check {
  name: string;
  pass: boolean;
  detail: unknown;
}

const wranglerFile = z.looseObject({
  ai: z.json().optional(),
  kv_namespaces: z.json().optional(),
  durable_objects: z.json().optional(),
  d1_databases: z.json().optional(),
  r2_buckets: z.json().optional(),
  services: z.json().optional(),
  vars: z.json().optional(),
});

function wranglerConfig(): z.infer<typeof wranglerFile> {
  const raw = readFileSync(join(ROOT, 'site', 'wrangler.jsonc'), 'utf8');

  return wranglerFile.parse(JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')));
}

async function workerExists(name: string): Promise<boolean> {
  const response = await fetch(`https://${name}.coy.workers.dev/`, { redirect: 'manual' });
  const text = await response.text();

  return response.status !== 404 || !text.includes('There is nothing here yet');
}

async function main(): Promise<void> {
  const config = wranglerConfig();
  const checks: Check[] = [];

  const page = await fetch(SITE);
  const html = await page.text();
  checks.push({
    name: 'docs site serves 200 with the docs content',
    pass: page.status === 200 && html.includes('Ask for odds') && html.includes('odds-gateway'),
    detail: { url: SITE, status: page.status, bytes: html.length },
  });

  const csp = page.headers.get('content-security-policy') ?? '';
  checks.push({
    name: 'docs page forbids network calls from the browser',
    pass: csp.includes("connect-src 'none'"),
    detail: { csp },
  });

  const api = await fetch(`${SITE}/api/odds`, { method: 'POST', body: '{}' });
  checks.push({
    name: 'there is no model API on the docs site',
    pass: api.status === 404,
    detail: { status: api.status },
  });

  const present = FORBIDDEN_BINDINGS.filter((key) => key in config);
  checks.push({
    name: 'wrangler config declares no bindings',
    pass: present.length === 0 && config.workers_dev === false,
    detail: { name: config.name, forbiddenPresent: present, workers_dev: config.workers_dev },
  });

  const retired = await Promise.all(
    RETIRED_WORKERS.map(async (name) => ({ name, live: await workerExists(name) })),
  );

  checks.push({
    name: 'retired public playground workers are gone',
    pass: retired.every((worker) => !worker.live),
    detail: retired,
  });

  const passed = checks.every((check) => check.pass);

  const receipt = {
    kind: 'odds.receipt/v0',
    claim: 'odds.coey.dev is static documentation with no bindings and no model access',
    verdict: passed ? 'observed' : 'failed',
    observed: { checks },
    at: new Date().toISOString(),
  };

  mkdirSync(PROOF_RUNS_DIR, { recursive: true });
  writeFileSync(join(PROOF_RUNS_DIR, 'docs-static.json'), `${JSON.stringify(receipt, null, 2)}\n`);

  for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);

  if (!passed) process.exit(1);
}

await main();

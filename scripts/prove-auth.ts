import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { askOdds, gatewayUrl } from '../src/client.ts';
import { readConfig, redact, resolveToken } from '../src/credentials.ts';
import { findOddsModel } from '../src/models.ts';

const PROOF_RUNS_DIR = join(import.meta.dir, '..', 'proof-runs');

const gatewayEnvelope = z.object({ success: z.boolean() }).partial();

const tokenVerification = z.object({
  result: z.object({ status: z.string(), expires_on: z.string().nullish() }).partial().optional(),
});

const probe = {
  state: 'Hello there!',
  questions: { greeting: { type: 'bool' as const, instructions: 'Is this a greeting?' } },
};

interface Check {
  name: string;
  pass: boolean;
  detail: unknown;
}

async function rawStatus(url: string, headers: Record<string, string>) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({
      model: 'clef',
      state: probe.state,
      questions: {
        greeting: { type: 'noul', instructions: probe.questions.greeting.instructions },
      },
    }),
  });

  const body = gatewayEnvelope.safeParse(await response.json().catch(() => undefined));

  return { status: response.status, success: body.data?.success === true };
}

async function main(): Promise<void> {
  const config = readConfig();
  const { token, source } = resolveToken();
  const model = findOddsModel('clef');

  if (!model) throw new Error('clef model missing');
  const url = gatewayUrl({ ...config, token }, model);
  const checks: Check[] = [];

  const anonymous = await rawStatus(url, {});
  checks.push({
    name: 'gateway rejects a call with no token',
    pass: !anonymous.success && anonymous.status >= 400,
    detail: anonymous,
  });

  const forgedToken = crypto.randomUUID().replaceAll('-', '');
  const forged = await rawStatus(url, { authorization: `Bearer ${forgedToken}` });
  checks.push({
    name: 'gateway rejects a forged token',
    pass: !forged.success && forged.status >= 400,
    detail: forged,
  });

  const scoped = await askOdds({ ...config, token }, 'clef', probe);
  checks.push({
    name: 'scoped token from the keychain gets a schema-valid Clef answer',
    pass:
      source === 'keychain' &&
      scoped.ok &&
      scoped.answers.greeting.type === 'bool' &&
      scoped.answers.greeting.probability > 0.5,
    detail: {
      source,
      ok: scoped.ok,
      answers: scoped.ok ? scoped.answers : undefined,
      error: scoped.ok ? undefined : redact(scoped.error, token),
    },
  });

  const credentialsSource = readFileSync(
    join(import.meta.dir, '..', 'src', 'credentials.ts'),
    'utf8',
  );

  checks.push({
    name: 'no wrangler OAuth fallback in the credential path',
    pass: !credentialsSource.includes('wrangler'),
    detail: { file: 'src/credentials.ts' },
  });

  const verify = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
    headers: { authorization: `Bearer ${token}` },
  });

  const verifyBody = tokenVerification.parse(await verify.json());
  checks.push({
    name: 'token is an active, dedicated API token',
    pass: verifyBody.result?.status === 'active',
    detail: { status: verifyBody.result?.status, expiresOn: verifyBody.result?.expires_on ?? null },
  });

  const passed = checks.every((check) => check.pass);

  const receipt = {
    kind: 'odds.receipt/v0',
    claim: 'odds reaches Clef only with a scoped keychain token; anonymous and forged calls fail',
    verdict: passed ? 'observed' : 'failed',
    observed: { gateway: config.gateway, checks },
    at: new Date().toISOString(),
  };

  const serialized = `${JSON.stringify(receipt, null, 2)}\n`;

  if (serialized.includes(token))
    throw new Error('refusing to write a receipt that contains the token');
  mkdirSync(PROOF_RUNS_DIR, { recursive: true });
  writeFileSync(join(PROOF_RUNS_DIR, 'auth-scoped-token.json'), serialized);

  for (const check of checks) console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name}`);

  if (!passed) process.exit(1);
}

await main();

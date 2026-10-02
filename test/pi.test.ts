import { afterEach, describe, expect, test } from 'bun:test';
import type { ClassifierModel } from '@earendil-works/pi-ai';
import { type GatewayFetch, gatewayClassifier, ODDS_API, ODDS_PROVIDER } from '../pi/index.ts';

const CLEF: ClassifierModel<typeof ODDS_API> = {
  type: 'classifier',
  id: 'clef',
  name: 'Clef',
  api: ODDS_API,
  provider: ODDS_PROVIDER,
  baseUrl: 'https://gateway.ai.cloudflare.com',
  input: ['text'],
  cost: { input: 0.24, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 65536,
};

const SECRET = 'scoped-token-that-must-never-leak';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('classifyThroughGateway', () => {
  test('never echoes the token in an error message', async () => {
    process.env.ODDS_TOKEN = SECRET;
    process.env.ODDS_ACCOUNT_ID = 'acct';

    const rejecting: GatewayFetch = async () =>
      new Response(
        JSON.stringify({ success: false, errors: [{ message: `bad token ${SECRET}` }] }),
        { status: 401 },
      );

    const result = await gatewayClassifier(rejecting)(CLEF, {
      state: { text: 'x' },
      questions: {
        q: { type: 'bool', instructions: 'Q?', criteria: { true: 'Yes', false: 'No' } },
      },
    });

    expect(result.stopReason).toBe('error');
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect('errorMessage' in result && result.errorMessage).toContain('[redacted]');
  });

  test('sends the token only as a bearer header to the gateway host', async () => {
    process.env.ODDS_TOKEN = SECRET;
    process.env.ODDS_ACCOUNT_ID = 'acct';
    const seen: { url: string; auth: string | null }[] = [];

    const recording: GatewayFetch = async (url, init) => {
      seen.push({ url, auth: new Headers(init.headers).get('authorization') });

      return new Response(
        JSON.stringify({
          success: true,
          result: { answers: { q: { type: 'noul', noul: 0.8 } }, usage: { input_tokens: 10 } },
        }),
      );
    };

    const result = await gatewayClassifier(recording)(CLEF, {
      state: { text: 'x' },
      questions: {
        q: { type: 'bool', instructions: 'Q?', criteria: { true: 'Yes', false: 'No' } },
      },
    });

    expect(result.stopReason).toBe('stop');
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0].url).host).toBe('gateway.ai.cloudflare.com');
    expect(seen[0].auth).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

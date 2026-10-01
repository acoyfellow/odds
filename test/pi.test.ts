import { afterEach, describe, expect, test } from 'bun:test';
import { classifyThroughGateway, ODDS_API, ODDS_PROVIDER } from '../pi/index.ts';

const SECRET = 'scoped-token-that-must-never-leak';
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

describe('classifyThroughGateway', () => {
  test('never echoes the token in an error message', async () => {
    process.env.ODDS_TOKEN = SECRET;
    process.env.ODDS_ACCOUNT_ID = 'acct';
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ success: false, errors: [{ message: `bad token ${SECRET}` }] }),
        { status: 401 },
      )) as unknown as typeof fetch;
    const result = await classifyThroughGateway(
      { id: 'clef', provider: ODDS_PROVIDER, api: ODDS_API },
      { state: 'x', questions: { q: { type: 'bool', instructions: 'Q?' } } },
    );
    expect(result.stopReason).toBe('error');
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect('errorMessage' in result && result.errorMessage).toContain('[redacted]');
  });

  test('sends the token only as a bearer header to the gateway host', async () => {
    process.env.ODDS_TOKEN = SECRET;
    process.env.ODDS_ACCOUNT_ID = 'acct';
    const seen: { url: string; auth: string | null }[] = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen.push({ url, auth: new Headers(init.headers).get('authorization') });
      return new Response(
        JSON.stringify({
          success: true,
          result: { answers: { q: { type: 'noul', noul: 0.8 } }, usage: { input_tokens: 10 } },
        }),
      );
    }) as unknown as typeof fetch;
    const result = await classifyThroughGateway(
      { id: 'clef', provider: ODDS_PROVIDER, api: ODDS_API },
      { state: 'x', questions: { q: { type: 'bool', instructions: 'Q?' } } },
    );
    expect(result.stopReason).toBe('stop');
    expect(seen).toHaveLength(1);
    expect(new URL(seen[0].url).host).toBe('gateway.ai.cloudflare.com');
    expect(seen[0].auth).toBe(`Bearer ${SECRET}`);
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

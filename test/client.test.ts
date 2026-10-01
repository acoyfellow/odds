import { describe, expect, test } from 'bun:test';
import { askOdds, type GatewayTarget, type OddsRequest, toWireQuestions } from '../src/client.ts';

const request: OddsRequest = {
  state: { text: 'Checkout is down' },
  questions: {
    team: {
      type: 'choice',
      instructions: 'Which team?',
      criteria: { billing: 'Money', tech: 'Outages' },
    },
    severity: { type: 'score', instructions: 'Severity', criteria: ['low', 'mid', 'high'] },
    urgent: { type: 'bool', instructions: 'Urgent?', criteria: { true: 'yes', false: 'no' } },
  },
};

const goodAnswers = {
  team: {
    type: 'choice',
    choice: 'tech',
    probabilities: { billing: 0.1, tech: 0.9 },
    confidence: 0.8,
  },
  severity: { type: 'score', score: 1.7, confidence: 0.4 },
  urgent: { type: 'noul', noul: 0.93 },
};

function stubTarget(body: unknown, status = 200, calls: unknown[] = []): GatewayTarget {
  return {
    accountId: 'acct',
    gateway: 'default',
    token: 'secret-token',
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch,
  };
}

function success(answers: unknown) {
  return { success: true, result: { model: 'clef', answers, usage: { input_tokens: 1000 } } };
}

describe('askOdds', () => {
  test('maps a valid gateway answer and prices usage', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const result = await askOdds(stubTarget(success(goodAnswers), 200, calls), 'clef', request);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.answers.urgent).toEqual({ type: 'bool', probability: 0.93 });
    expect(result.answers.team).toMatchObject({ type: 'choice', choice: 'tech' });
    expect(result.usage.costUsd).toBeCloseTo(0.00024, 8);
    expect(calls[0].url).toBe(
      'https://gateway.ai.cloudflare.com/v1/acct/default/workers-ai/@cf/cloudflare/clef',
    );
    const sent = JSON.parse(String(calls[0].init.body));
    expect(sent.model).toBe('clef');
    expect(sent.questions.urgent).toEqual({ type: 'noul', instructions: 'Urgent?' });
  });

  test('rejects invalid input before any network call', async () => {
    const calls: unknown[] = [];
    const result = await askOdds(stubTarget(success(goodAnswers), 200, calls), 'clef', {
      state: 'x',
      questions: { only: { type: 'choice', instructions: 'Pick', criteria: { a: 'A' } } },
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(calls).toHaveLength(0);
  });

  test('rejects unknown models before any network call', async () => {
    const calls: unknown[] = [];
    const result = await askOdds(stubTarget({}, 200, calls), 'gpt-7', request);
    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  const malformed: [string, unknown][] = [
    ['unknown choice label', { ...goodAnswers, team: { ...goodAnswers.team, choice: 'sales' } }],
    [
      'choice that is not the argmax',
      { ...goodAnswers, team: { ...goodAnswers.team, choice: 'billing' } },
    ],
    [
      'probabilities that do not sum to 1',
      { ...goodAnswers, team: { ...goodAnswers.team, probabilities: { billing: 0.5, tech: 0.9 } } },
    ],
    [
      'score out of range',
      { ...goodAnswers, severity: { type: 'score', score: 9, confidence: 1 } },
    ],
    ['probability above 1', { ...goodAnswers, urgent: { type: 'noul', noul: 1.4 } }],
    ['missing answer', { team: goodAnswers.team, severity: goodAnswers.severity }],
  ];

  for (const [name, answers] of malformed) {
    test(`fails closed on ${name}`, async () => {
      const result = await askOdds(stubTarget(success(answers)), 'clef', request);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toStartWith('invalid_response');
      expect(result.usage?.inputTokens).toBe(1000);
    });
  }

  test('surfaces gateway errors without leaking the token', async () => {
    const result = await askOdds(
      stubTarget({ success: false, errors: [{ message: 'Authentication error' }] }, 401),
      'clef',
      request,
    );
    expect(result).toMatchObject({ ok: false, status: 401, error: 'Authentication error' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });
});

describe('toWireQuestions', () => {
  test('drops bool criteria and renames to noul', () => {
    expect(toWireQuestions({ q: { type: 'bool', instructions: 'Q?' } })).toEqual({
      q: { type: 'noul', instructions: 'Q?' },
    });
  });
});

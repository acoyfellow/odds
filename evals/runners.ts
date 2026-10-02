import { z } from 'zod';
import { askOdds, type GatewayTarget, type OddsAnswer } from '../src/client.ts';
import type { EvalItem, EvalTask } from './datasets.ts';

const chatReply = z
  .object({
    result: z
      .object({
        choices: z.array(
          z.object({ message: z.object({ content: z.string().nullish() }).partial() }),
        ),
        response: z.string(),
        usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }).partial(),
      })
      .partial(),
  })
  .partial();

export interface Prediction {
  id: string;
  truth: string;
  predicted: string | null;
  probability: number | null;
  probabilities: Record<string, number> | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error: string | null;
}

export interface EvalRunner {
  id: string;
  kind: 'decision-model' | 'chat-model';
  workersAiId: string;
  usdPerMillionInput: number;
  usdPerMillionOutput: number;
  run(task: EvalTask, item: EvalItem): Promise<Prediction>;
}

const MAX_RETRIES = 4;

const RETRY_BASE_MS = 500;

export function isTransient(error: string): boolean {
  return /Capacity temporarily exceeded|TimeoutError|gateway returned 5\d\d|gateway returned 429/.test(
    error,
  );
}

function emptyPrediction(item: EvalItem, latencyMs: number, error: string): Prediction {
  return {
    id: item.id,
    truth: item.truth,
    predicted: null,
    probability: null,
    probabilities: null,
    latencyMs,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    error,
  };
}

function readAnswer(task: EvalTask, answer: OddsAnswer) {
  if (answer.type === 'bool') {
    return {
      predicted: answer.probability >= 0.5 ? 'true' : 'false',
      probability: answer.probability,
      probabilities: { true: answer.probability, false: 1 - answer.probability },
    };
  }

  if (answer.type === 'choice') {
    return {
      predicted: answer.choice,
      probability: answer.probabilities[answer.choice],
      probabilities: answer.probabilities,
    };
  }

  return {
    predicted: task.labels[Math.round(answer.score)],
    probability: answer.confidence,
    probabilities: null,
  };
}

export function decisionRunner(
  target: GatewayTarget,
  modelId: string,
  workersAiId: string,
  usdPerMillionInput: number,
): EvalRunner {
  return {
    id: modelId,
    kind: 'decision-model',
    workersAiId,
    usdPerMillionInput,
    usdPerMillionOutput: 0,
    async run(task, item) {
      let started = performance.now();

      let result = await askOdds(target, modelId, {
        state: item.text,
        questions: { [task.questionId]: task.question },
      });

      for (
        let attempt = 1;
        !result.ok && isTransient(result.error) && attempt <= MAX_RETRIES;
        attempt += 1
      ) {
        await Bun.sleep(RETRY_BASE_MS * 2 ** attempt);
        started = performance.now();
        result = await askOdds(target, modelId, {
          state: item.text,
          questions: { [task.questionId]: task.question },
        });
      }

      const latencyMs = Math.round(performance.now() - started);

      if (!result.ok) return emptyPrediction(item, latencyMs, result.error);

      return {
        id: item.id,
        truth: item.truth,
        ...readAnswer(task, result.answers[task.questionId]),
        latencyMs,
        inputTokens: result.usage.inputTokens,
        outputTokens: 0,
        costUsd: result.usage.costUsd,
        error: null,
      };
    },
  };
}

export function promptFor(task: EvalTask, text: string): string {
  const question = task.question;

  const options =
    question.type === 'bool'
      ? 'Answer with exactly one word: true or false.'
      : question.type === 'choice'
        ? `Answer with exactly one of these labels: ${Object.keys(question.criteria).join(', ')}.`
        : `Answer with exactly one number from 1 to ${question.criteria.length}.`;

  return `${question.instructions}\n${options}\nDo not explain.\n\nText:\n"""\n${text}\n"""`;
}

export function parseLabel(task: EvalTask, reply: string): string | null {
  const cleaned = reply
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ');

  const words = cleaned.split(/\s+/).filter(Boolean);
  const first = words.find((word) => task.labels.includes(word));

  return first ?? null;
}

export function chatRunner(
  target: GatewayTarget,
  id: string,
  workersAiId: string,
  usdPerMillionInput: number,
  usdPerMillionOutput: number,
): EvalRunner {
  const url = `https://gateway.ai.cloudflare.com/v1/${target.accountId}/${target.gateway}/workers-ai/${workersAiId}`;

  return {
    id,
    kind: 'chat-model',
    workersAiId,
    usdPerMillionInput,
    usdPerMillionOutput,
    async run(task, item) {
      const started = performance.now();

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { authorization: `Bearer ${target.token}`, 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: promptFor(task, item.text) }],
            max_tokens: 8,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(60_000),
        });

        const latencyMs = Math.round(performance.now() - started);

        const body = chatReply.safeParse(await response.json().catch(() => undefined)).data ?? {};

        if (!response.ok)
          return emptyPrediction(item, latencyMs, `gateway returned ${response.status}`);
        const reply = body.result?.choices?.[0]?.message?.content ?? body.result?.response ?? '';
        const inputTokens = body.result?.usage?.prompt_tokens ?? 0;
        const outputTokens = body.result?.usage?.completion_tokens ?? 0;
        const predicted = parseLabel(task, reply);

        return {
          id: item.id,
          truth: item.truth,
          predicted,
          probability: null,
          probabilities: null,
          latencyMs,
          inputTokens,
          outputTokens,
          costUsd:
            (inputTokens * usdPerMillionInput + outputTokens * usdPerMillionOutput) / 1_000_000,
          error: predicted === null ? `unparseable reply: ${reply.slice(0, 40)}` : null,
        };
      } catch (error) {
        return emptyPrediction(
          item,
          Math.round(performance.now() - started),
          `request failed: ${error instanceof Error ? error.name : 'Error'}`,
        );
      }
    },
  };
}

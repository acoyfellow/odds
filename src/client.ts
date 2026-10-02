import type { JsonValue } from '@earendil-works/pi-ai';
import { z } from 'zod';
import { findOddsModel, type OddsModel } from './models.ts';

export type OddsQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'bool'; instructions: string; criteria?: { true: string; false: string } };

export type OddsAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; confidence: number }
  | { type: 'bool'; probability: number };

export type OddsState = JsonValue;

export interface OddsRequest {
  state: OddsState;
  questions: Record<string, OddsQuestion>;
}

export interface OddsUsage {
  inputTokens: number;
  costUsd: number;
}

export type OddsAnswers = Record<string, OddsAnswer>;

export type OddsResult =
  | { ok: true; model: string; answers: Record<string, OddsAnswer>; usage: OddsUsage }
  | { ok: false; model: string; error: string; status?: number; usage?: OddsUsage };

export interface GatewayTarget {
  accountId: string;
  gateway: string;
  token: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
  timeoutMs?: number;
}

const MAX_QUESTIONS = 64;

const QUESTION_ID = /^[A-Za-z0-9_.-]{1,100}$/;

const PROBABILITY_TOLERANCE = 0.02;

export function gatewayUrl(target: GatewayTarget, model: OddsModel): string {
  return `https://gateway.ai.cloudflare.com/v1/${target.accountId}/${target.gateway}/workers-ai/${model.workersAiId}`;
}

export function validateRequest(request: OddsRequest): string | undefined {
  if (request.state === undefined || request.state === null || request.state === '') {
    return 'state is required';
  }

  const entries = Object.entries(request.questions ?? {});

  if (entries.length === 0) return 'at least one question is required';

  if (entries.length > MAX_QUESTIONS) return `at most ${MAX_QUESTIONS} questions are allowed`;

  for (const [id, question] of entries) {
    if (!QUESTION_ID.test(id)) return `invalid question id: ${id}`;

    if (!question?.instructions?.trim()) {
      return `question ${id} needs instructions`;
    }

    if (question.type === 'choice') {
      if (!question.criteria || Object.keys(question.criteria).length < 2) {
        return `choice question ${id} needs at least two criteria`;
      }
    } else if (question.type === 'score') {
      if (!Array.isArray(question.criteria) || question.criteria.length < 2) {
        return `score question ${id} needs at least two levels`;
      }
    } else if (question.type !== 'bool') {
      return `question ${id} has unknown type`;
    }
  }

  return undefined;
}

export type WireQuestion =
  | { type: 'noul'; instructions: string }
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] };

export interface WirePayload {
  model: string;
  state: OddsState;
  questions: Record<string, WireQuestion>;
}

function toWireQuestion(question: OddsQuestion): WireQuestion {
  if (question.type === 'bool') return { type: 'noul', instructions: question.instructions };

  if (question.type === 'choice') {
    return { type: 'choice', instructions: question.instructions, criteria: question.criteria };
  }

  return { type: 'score', instructions: question.instructions, criteria: question.criteria };
}

export function toWireQuestions(
  questions: Record<string, OddsQuestion>,
): Record<string, WireQuestion> {
  return Object.fromEntries(
    Object.entries(questions).map(([id, question]) => [id, toWireQuestion(question)]),
  );
}

const unitInterval = z.number().finite().min(0).max(1);

const wireChoiceAnswer = z.object({
  type: z.literal('choice'),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number()),
  confidence: unitInterval,
});

const wireScoreAnswer = z.object({
  type: z.literal('score'),
  score: z.number(),
  confidence: unitInterval,
});

const wireBoolAnswer = z.object({ type: z.literal('noul'), noul: unitInterval });

const wireAnswer = z.discriminatedUnion('type', [
  wireChoiceAnswer,
  wireScoreAnswer,
  wireBoolAnswer,
]);

const wireUsage = z.object({ input_tokens: z.number().int().positive() }).partial();

const wireSuccess = z.object({
  success: z.literal(true).optional(),
  result: z.object({ answers: z.record(z.string(), z.json()), usage: wireUsage.optional() }),
});

const wireFailure = z.object({ errors: z.array(z.object({ message: z.string() }).partial()) });

export type WireAnswers = Record<string, z.infer<typeof wireAnswer>>;

export type WireUsage = z.infer<typeof wireUsage>;

function parseChoice(
  id: string,
  question: Extract<OddsQuestion, { type: 'choice' }>,
  answer: z.infer<typeof wireChoiceAnswer>,
): OddsAnswer {
  const labels = Object.keys(question.criteria);

  if (!labels.includes(answer.choice)) throw new Error(`answer ${id} chose an unknown label`);
  const parsed: Record<string, number> = {};

  for (const label of labels) {
    const probability = unitInterval.safeParse(answer.probabilities[label]);

    if (!probability.success) throw new Error(`answer ${id} lacks probability for ${label}`);
    parsed[label] = probability.data;
  }

  const total = Object.values(parsed).reduce((sum, value) => sum + value, 0);

  if (Math.abs(total - 1) > PROBABILITY_TOLERANCE)
    throw new Error(`answer ${id} does not sum to 1`);
  const best = labels.reduce((top, label) => (parsed[label] > parsed[top] ? label : top));

  if (parsed[best] - parsed[answer.choice] > PROBABILITY_TOLERANCE) {
    throw new Error(`answer ${id} choice is not the argmax`);
  }

  return {
    type: 'choice',
    choice: answer.choice,
    probabilities: parsed,
    confidence: answer.confidence,
  };
}

function parseScore(
  id: string,
  question: Extract<OddsQuestion, { type: 'score' }>,
  answer: z.infer<typeof wireScoreAnswer>,
): OddsAnswer {
  if (answer.score < 0 || answer.score > question.criteria.length - 1) {
    throw new Error(`answer ${id} is not a score in range`);
  }

  return { type: 'score', score: answer.score, confidence: answer.confidence };
}

const EXPECTED_WIRE_TYPE = { choice: 'choice', score: 'score', bool: 'noul' } as const;

const WRONG_TYPE_MESSAGE = {
  choice: 'is not a choice',
  score: 'is not a score in range',
  bool: 'is not a probability',
} as const;

export function parseAnswers(
  questions: Record<string, OddsQuestion>,
  raw: Record<string, z.core.util.JSONType>,
): OddsAnswers {
  return Object.fromEntries(
    Object.entries(questions).map(([id, question]) => [id, parseOneAnswer(id, question, raw[id])]),
  );
}

function parseOneAnswer(
  id: string,
  question: OddsQuestion,
  raw: z.core.util.JSONType | undefined,
): OddsAnswer {
  if (raw === undefined || raw === null) throw new Error(`missing answer for ${id}`);
  const parsed = wireAnswer.safeParse(raw);

  if (!parsed.success || parsed.data.type !== EXPECTED_WIRE_TYPE[question.type]) {
    throw new Error(`answer ${id} ${WRONG_TYPE_MESSAGE[question.type]}`);
  }

  return toOddsAnswer(id, question, parsed.data);
}

function toOddsAnswer(
  id: string,
  question: OddsQuestion,
  answer: z.infer<typeof wireAnswer>,
): OddsAnswer {
  if (question.type === 'choice' && answer.type === 'choice')
    return parseChoice(id, question, answer);

  if (question.type === 'score' && answer.type === 'score') return parseScore(id, question, answer);

  if (answer.type === 'noul') return { type: 'bool', probability: answer.noul };

  throw new Error(`answer ${id} ${WRONG_TYPE_MESSAGE[question.type]}`);
}

export function usageFor(model: OddsModel, usage: WireUsage | undefined): OddsUsage {
  const inputTokens = usage?.input_tokens ?? 0;

  return { inputTokens, costUsd: (inputTokens / 1_000_000) * model.inputUsdPerMillion };
}

function gatewayError(body: z.core.util.JSONType, status: number): string {
  const failure = wireFailure.safeParse(body);

  const messages = failure.success
    ? failure.data.errors.flatMap((error) => (error.message ? [error.message] : []))
    : [];

  return messages.length > 0 ? messages.join('; ') : `gateway returned ${status}`;
}

export interface TransportReply {
  status: number;
  body: z.core.util.JSONType;
}

export type OddsTransport = (
  model: OddsModel,
  payload: WirePayload,
  signal: AbortSignal,
) => Promise<TransportReply>;

export function gatewayTransport(target: GatewayTarget): OddsTransport {
  return async (model, payload, signal) => {
    const response = await (target.fetch ?? fetch)(gatewayUrl(target, model), {
      method: 'POST',
      headers: { authorization: `Bearer ${target.token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });

    const parsed = z.json().safeParse(await response.json().catch(() => undefined));

    const body = parsed.success
      ? parsed.data
      : { success: false, errors: [{ message: 'gateway returned non-JSON' }] };

    return { status: response.status, body };
  };
}

export async function askOdds(
  target: GatewayTarget,
  modelId: string,
  request: OddsRequest,
  signal?: AbortSignal,
): Promise<OddsResult> {
  return runOdds(gatewayTransport(target), modelId, request, {
    signal,
    timeoutMs: target.timeoutMs,
  });
}

export async function runOdds(
  transport: OddsTransport,
  modelId: string,
  request: OddsRequest,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<OddsResult> {
  const model = findOddsModel(modelId);

  if (!model) return { ok: false, model: modelId, error: `unknown model: ${modelId}` };
  const invalid = validateRequest(request);

  if (invalid) return { ok: false, model: model.id, error: invalid, status: 400 };
  const timeout = AbortSignal.timeout(options.timeoutMs ?? 30_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let reply: TransportReply;

  try {
    reply = await transport(
      model,
      { model: model.id, state: request.state, questions: toWireQuestions(request.questions) },
      signal,
    );
  } catch (error) {
    return { ok: false, model: model.id, error: `request failed: ${errorName(error)}` };
  }

  const { status, body } = reply;
  const success = wireSuccess.safeParse(body);

  if (status >= 400 || !success.success) {
    return { ok: false, model: model.id, error: gatewayError(body, status), status };
  }

  const usage = usageFor(model, success.data.result.usage);

  try {
    return {
      ok: true,
      model: model.id,
      answers: parseAnswers(request.questions, success.data.result.answers),
      usage,
    };
  } catch (error) {
    return { ok: false, model: model.id, error: `invalid_response: ${errorMessage(error)}`, usage };
  }
}

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function errorName(cause: unknown): string {
  return cause instanceof Error ? cause.name : 'Error';
}

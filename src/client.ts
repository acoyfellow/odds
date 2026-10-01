import { findOddsModel, type OddsModel } from './models.ts';

export type OddsQuestion =
  | { type: 'choice'; instructions: string; criteria: Record<string, string> }
  | { type: 'score'; instructions: string; criteria: string[] }
  | { type: 'bool'; instructions: string; criteria?: { true: string; false: string } };

export type OddsAnswer =
  | { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
  | { type: 'score'; score: number; confidence: number }
  | { type: 'bool'; probability: number };

export interface OddsRequest {
  state: unknown;
  questions: Record<string, OddsQuestion>;
}

export interface OddsUsage {
  inputTokens: number;
  costUsd: number;
}

export type OddsResult =
  | { ok: true; model: string; answers: Record<string, OddsAnswer>; usage: OddsUsage }
  | { ok: false; model: string; error: string; status?: number; usage?: OddsUsage };

export interface GatewayTarget {
  accountId: string;
  gateway: string;
  token: string;
  fetch?: typeof fetch;
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
    if (!question || typeof question.instructions !== 'string' || !question.instructions.trim()) {
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

export function toWireQuestions(questions: Record<string, OddsQuestion>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(questions).map(([id, question]) => [
      id,
      question.type === 'bool'
        ? { type: 'noul', instructions: question.instructions }
        : { type: question.type, instructions: question.instructions, criteria: question.criteria },
    ]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnitInterval(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function parseChoice(
  id: string,
  question: Extract<OddsQuestion, { type: 'choice' }>,
  answer: Record<string, unknown>,
): OddsAnswer {
  const labels = Object.keys(question.criteria);
  const probabilities = answer.probabilities;
  if (answer.type !== 'choice' || typeof answer.choice !== 'string' || !isRecord(probabilities)) {
    throw new Error(`answer ${id} is not a choice`);
  }
  if (!labels.includes(answer.choice)) throw new Error(`answer ${id} chose an unknown label`);
  const parsed: Record<string, number> = {};
  for (const label of labels) {
    const probability = probabilities[label];
    if (!isUnitInterval(probability))
      throw new Error(`answer ${id} lacks probability for ${label}`);
    parsed[label] = probability;
  }
  const total = Object.values(parsed).reduce((sum, value) => sum + value, 0);
  if (Math.abs(total - 1) > PROBABILITY_TOLERANCE)
    throw new Error(`answer ${id} does not sum to 1`);
  const best = labels.reduce((top, label) => (parsed[label] > parsed[top] ? label : top));
  if (parsed[best] - parsed[answer.choice] > PROBABILITY_TOLERANCE) {
    throw new Error(`answer ${id} choice is not the argmax`);
  }
  if (!isUnitInterval(answer.confidence)) throw new Error(`answer ${id} has invalid confidence`);
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
  answer: Record<string, unknown>,
): OddsAnswer {
  const max = question.criteria.length - 1;
  const score = answer.score;
  if (answer.type !== 'score' || typeof score !== 'number' || score < 0 || score > max) {
    throw new Error(`answer ${id} is not a score in range`);
  }
  if (!isUnitInterval(answer.confidence)) throw new Error(`answer ${id} has invalid confidence`);
  return { type: 'score', score, confidence: answer.confidence };
}

function parseBool(id: string, answer: Record<string, unknown>): OddsAnswer {
  if (answer.type !== 'noul' || !isUnitInterval(answer.noul)) {
    throw new Error(`answer ${id} is not a probability`);
  }
  return { type: 'bool', probability: answer.noul };
}

export function parseAnswers(
  questions: Record<string, OddsQuestion>,
  raw: unknown,
): Record<string, OddsAnswer> {
  if (!isRecord(raw)) throw new Error('response has no answers');
  const answers: Record<string, OddsAnswer> = {};
  for (const [id, question] of Object.entries(questions)) {
    const answer = raw[id];
    if (!isRecord(answer)) throw new Error(`missing answer for ${id}`);
    if (question.type === 'choice') answers[id] = parseChoice(id, question, answer);
    else if (question.type === 'score') answers[id] = parseScore(id, question, answer);
    else answers[id] = parseBool(id, answer);
  }
  return answers;
}

export function usageFor(model: OddsModel, raw: unknown): OddsUsage {
  const inputTokens =
    isRecord(raw) && typeof raw.input_tokens === 'number' && raw.input_tokens > 0
      ? raw.input_tokens
      : 0;
  return { inputTokens, costUsd: (inputTokens / 1_000_000) * model.inputUsdPerMillion };
}

function gatewayError(body: unknown, status: number): string {
  if (isRecord(body) && Array.isArray(body.errors)) {
    const messages = body.errors
      .map((error) => (isRecord(error) && typeof error.message === 'string' ? error.message : ''))
      .filter(Boolean);
    if (messages.length > 0) return messages.join('; ');
  }
  return `gateway returned ${status}`;
}

export interface TransportReply {
  status: number;
  body: unknown;
}

export type OddsTransport = (
  model: OddsModel,
  payload: Record<string, unknown>,
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
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = { success: false, errors: [{ message: 'gateway returned non-JSON' }] };
    }
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
    return { ok: false, model: model.id, error: `request failed: ${(error as Error).name}` };
  }
  const { status, body } = reply;
  if (status >= 400 || !isRecord(body) || body.success === false || !isRecord(body.result)) {
    return { ok: false, model: model.id, error: gatewayError(body, status), status };
  }
  const usage = usageFor(model, body.result.usage);
  try {
    return {
      ok: true,
      model: model.id,
      answers: parseAnswers(request.questions, body.result.answers),
      usage,
    };
  } catch (error) {
    return {
      ok: false,
      model: model.id,
      error: `invalid_response: ${(error as Error).message}`,
      usage,
    };
  }
}

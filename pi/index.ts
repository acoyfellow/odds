import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { askOdds, type OddsQuestion } from '../src/client.ts';
import { readConfig, readToken, redact } from '../src/credentials.ts';
import { ODDS_MODELS } from '../src/models.ts';

export const ODDS_PROVIDER = 'odds';
export const ODDS_API = 'odds-gateway-system-one';

interface ClassifierModelRef {
  id: string;
  provider: string;
  api: string;
}

interface ClassifierContextLike {
  state: unknown;
  questions: Record<string, OddsQuestion>;
}

interface ClassifierOptionsLike {
  signal?: AbortSignal;
  timeoutMs?: number;
}

function piUsage(inputTokens: number, costUsd: number) {
  return {
    input: inputTokens,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: inputTokens,
    cost: { input: costUsd, output: 0, cacheRead: 0, cacheWrite: 0, total: costUsd },
  };
}

export async function classifyThroughGateway(
  model: ClassifierModelRef,
  context: ClassifierContextLike,
  options?: ClassifierOptionsLike,
) {
  const base = {
    api: model.api,
    provider: model.provider,
    model: model.id,
    answers: {},
    timestamp: Date.now(),
  };
  let token = '';
  try {
    const { accountId, gateway } = readConfig();
    token = readToken();
    const result = await askOdds(
      { accountId, gateway, token, timeoutMs: options?.timeoutMs },
      model.id,
      { state: context.state, questions: context.questions },
      options?.signal,
    );
    const usage = result.usage
      ? piUsage(result.usage.inputTokens, result.usage.costUsd)
      : undefined;
    if (result.ok) return { ...base, answers: result.answers, usage, stopReason: 'stop' as const };
    return {
      ...base,
      usage,
      stopReason: 'error' as const,
      errorMessage: redact(result.error, token),
    };
  } catch (error) {
    return {
      ...base,
      stopReason: options?.signal?.aborted ? ('aborted' as const) : ('error' as const),
      errorMessage: redact((error as Error).message, token),
    };
  }
}

export default function odds(pi: ExtensionAPI): void {
  pi.registerProvider(ODDS_PROVIDER, {
    apiKey: 'odds-resolves-token-at-request-time',
    models: ODDS_MODELS.map((model) => ({
      type: 'classifier' as const,
      id: model.id,
      name: model.name,
      api: ODDS_API,
      baseUrl: 'https://gateway.ai.cloudflare.com',
      input: model.vision ? (['text', 'image'] as const).slice() : (['text'] as const).slice(),
      cost: { input: model.inputUsdPerMillion, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.contextWindow,
    })),
    classifiers: {
      [ODDS_API]: {
        classify: classifyThroughGateway as never,
      },
    },
  });
}

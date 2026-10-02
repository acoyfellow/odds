import type { ClassifierFunction, ClassifierResult } from '@earendil-works/pi-ai';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { askOdds } from '../src/client.ts';
import { readConfig, readToken, redact } from '../src/credentials.ts';
import { ODDS_MODELS } from '../src/models.ts';

export const ODDS_PROVIDER = 'odds';

export const ODDS_API = 'odds-gateway-system-one';

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

export type GatewayFetch = (url: string, init: RequestInit) => Promise<Response>;

export function gatewayClassifier(gatewayFetch: GatewayFetch = fetch): ClassifierFunction {
  return async (model, context, options) => {
    const base: Omit<ClassifierResult, 'stopReason'> = {
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
        { accountId, gateway, token, fetch: gatewayFetch },
        model.id,
        { state: context.state, questions: context.questions },
        options?.signal,
      );

      const usage = result.usage
        ? piUsage(result.usage.inputTokens, result.usage.costUsd)
        : undefined;

      if (result.ok) return { ...base, answers: result.answers, usage, stopReason: 'stop' };

      return {
        ...base,
        usage,
        stopReason: 'error',
        errorMessage: redact(result.error, token),
      };
    } catch (error) {
      return {
        ...base,
        stopReason: options?.signal?.aborted ? 'aborted' : 'error',
        errorMessage: redact(error instanceof Error ? error.message : String(error), token),
      };
    }
  };
}

export const classifyThroughGateway = gatewayClassifier();

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
        classify: classifyThroughGateway,
      },
    },
  });
}

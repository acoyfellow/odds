import type { EvalTask } from './datasets.ts';
import {
  accuracy,
  auroc,
  brier,
  expectedCalibrationError,
  macroF1,
  meanAbsoluteError,
  percentile,
  reliability,
} from './metrics.ts';
import type { EvalRunner, Prediction } from './runners.ts';

export interface Summary {
  n: number;
  answered: number;
  errors: number;
  headline: { name: string; value: number };
  accuracy: number;
  macroF1?: number;
  auroc?: number;
  brier?: number;
  ece?: number;
  reliability?: ReturnType<typeof reliability>;
  maeStars?: number;
  withinOneStar?: number;
  confusion: Record<string, Record<string, number>>;
  latency: { p50Ms: number; p95Ms: number; wallMs: number };
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costPer1kUsd: number;
}

function confusion(task: EvalTask, predictions: readonly Prediction[]) {
  const table: Record<string, Record<string, number>> = {};
  for (const truth of task.labels) {
    table[truth] = Object.fromEntries([...task.labels, 'none'].map((label) => [label, 0]));
  }
  for (const p of predictions) table[p.truth][p.predicted ?? 'none'] += 1;
  return table;
}

export function summarize(
  task: EvalTask,
  runner: EvalRunner,
  predictions: readonly Prediction[],
  wallMs: number,
): Summary {
  const pairs = predictions.map((p) => ({ predicted: p.predicted ?? 'none', truth: p.truth }));
  const answered = predictions.filter((p) => p.predicted !== null).length;
  const latencies = predictions.map((p) => p.latencyMs);
  const costUsd = predictions.reduce((sum, p) => sum + p.costUsd, 0);
  const base: Summary = {
    n: predictions.length,
    answered,
    errors: predictions.length - answered,
    headline: { name: 'accuracy', value: accuracy(pairs) },
    accuracy: accuracy(pairs),
    confusion: confusion(task, predictions),
    latency: { p50Ms: percentile(latencies, 0.5), p95Ms: percentile(latencies, 0.95), wallMs },
    inputTokens: predictions.reduce((sum, p) => sum + p.inputTokens, 0),
    outputTokens: predictions.reduce((sum, p) => sum + p.outputTokens, 0),
    costUsd,
    costPer1kUsd: predictions.length ? (costUsd / predictions.length) * 1000 : 0,
  };
  if (task.question.type === 'choice') {
    base.macroF1 = macroF1(pairs, task.labels);
    base.headline = { name: 'macroF1', value: base.macroF1 };
  }
  if (task.question.type === 'score') {
    const numeric = predictions
      .filter((p) => p.predicted !== null)
      .map((p) => ({ predicted: Number(p.predicted), truth: Number(p.truth) }));
    base.maeStars = meanAbsoluteError(numeric);
    base.withinOneStar =
      numeric.filter((p) => Math.abs(p.predicted - p.truth) <= 1).length / predictions.length;
    base.headline = { name: 'accuracy', value: base.accuracy };
  }
  if (task.question.type === 'bool' && runner.kind === 'decision-model') {
    const points = predictions
      .filter((p) => p.probability !== null)
      .map((p) => ({ probability: p.probability as number, truth: p.truth === 'true' }));
    base.auroc = auroc(points);
    base.brier = brier(points);
    base.ece = expectedCalibrationError(points);
    base.reliability = reliability(points);
  }
  return base;
}

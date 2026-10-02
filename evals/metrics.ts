export interface BinaryPoint {
  probability: number;
  truth: boolean;
}

export interface ReliabilityBin {
  lower: number;
  upper: number;
  count: number;
  meanPredicted: number;
  observedRate: number;
}

export function accuracy(pairs: readonly { predicted: string; truth: string }[]): number {
  if (pairs.length === 0) return 0;

  return pairs.filter((pair) => pair.predicted === pair.truth).length / pairs.length;
}

export function macroF1(
  pairs: readonly { predicted: string; truth: string }[],
  labels: readonly string[],
): number {
  const scores = labels.map((label) => {
    const truePositive = pairs.filter((p) => p.predicted === label && p.truth === label).length;
    const predictedPositive = pairs.filter((p) => p.predicted === label).length;
    const actualPositive = pairs.filter((p) => p.truth === label).length;

    if (truePositive === 0) return 0;
    const precision = truePositive / predictedPositive;
    const recall = truePositive / actualPositive;

    return (2 * precision * recall) / (precision + recall);
  });

  return scores.reduce((sum, value) => sum + value, 0) / labels.length;
}

export function brier(points: readonly BinaryPoint[]): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, p) => sum + (p.probability - (p.truth ? 1 : 0)) ** 2, 0);

  return total / points.length;
}

export function auroc(points: readonly BinaryPoint[]): number {
  const positives = points.filter((p) => p.truth);
  const negatives = points.filter((p) => !p.truth);

  if (positives.length === 0 || negatives.length === 0) return Number.NaN;
  let wins = 0;

  for (const positive of positives) {
    for (const negative of negatives) {
      if (positive.probability > negative.probability) wins += 1;
      else if (positive.probability === negative.probability) wins += 0.5;
    }
  }

  return wins / (positives.length * negatives.length);
}

export function reliability(points: readonly BinaryPoint[], binCount = 10): ReliabilityBin[] {
  const bins: ReliabilityBin[] = [];

  for (let index = 0; index < binCount; index += 1) {
    const lower = index / binCount;
    const upper = (index + 1) / binCount;

    const members = points.filter(
      (p) =>
        p.probability >= lower &&
        (p.probability < upper || (index === binCount - 1 && p.probability <= upper)),
    );

    if (members.length === 0) continue;
    bins.push({
      lower,
      upper,
      count: members.length,
      meanPredicted: members.reduce((sum, p) => sum + p.probability, 0) / members.length,
      observedRate: members.filter((p) => p.truth).length / members.length,
    });
  }

  return bins;
}

export function expectedCalibrationError(points: readonly BinaryPoint[], binCount = 10): number {
  if (points.length === 0) return 0;

  return reliability(points, binCount).reduce(
    (sum, bin) =>
      sum + (bin.count / points.length) * Math.abs(bin.meanPredicted - bin.observedRate),
    0,
  );
}

export function meanAbsoluteError(pairs: readonly { predicted: number; truth: number }[]): number {
  if (pairs.length === 0) return 0;

  return pairs.reduce((sum, p) => sum + Math.abs(p.predicted - p.truth), 0) / pairs.length;
}

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);

  return sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))];
}

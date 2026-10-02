import { describe, expect, test } from 'bun:test';
import {
  accuracy,
  auroc,
  brier,
  expectedCalibrationError,
  macroF1,
  meanAbsoluteError,
  reliability,
} from '../evals/metrics.ts';

describe('eval metrics', () => {
  test('accuracy and macro F1 on a known confusion', () => {
    const pairs = [
      { predicted: 'a', truth: 'a' },
      { predicted: 'a', truth: 'b' },
      { predicted: 'b', truth: 'b' },
      { predicted: 'b', truth: 'b' },
    ];
    expect(accuracy(pairs)).toBe(0.75);
    expect(macroF1(pairs, ['a', 'b'])).toBeCloseTo((2 / 3 + 0.8) / 2, 10);
  });

  test('auroc is 1 for perfect ranking, 0.5 for ties, 0 for inverted', () => {
    expect(
      auroc([
        { probability: 0.9, truth: true },
        { probability: 0.1, truth: false },
      ]),
    ).toBe(1);
    expect(
      auroc([
        { probability: 0.5, truth: true },
        { probability: 0.5, truth: false },
      ]),
    ).toBe(0.5);
    expect(
      auroc([
        { probability: 0.1, truth: true },
        { probability: 0.9, truth: false },
      ]),
    ).toBe(0);
  });

  test('brier and calibration error are zero for confident correct answers', () => {
    const perfect = [
      { probability: 1, truth: true },
      { probability: 0, truth: false },
    ];
    expect(brier(perfect)).toBe(0);
    expect(expectedCalibrationError(perfect)).toBe(0);
  });

  test('reliability bins report observed rate per predicted band', () => {
    const bins = reliability(
      [
        { probability: 0.82, truth: true },
        { probability: 0.88, truth: false },
        { probability: 0.05, truth: false },
      ],
      10,
    );
    expect(bins).toEqual([
      { lower: 0, upper: 0.1, count: 1, meanPredicted: 0.05, observedRate: 0 },
      { lower: 0.8, upper: 0.9, count: 2, meanPredicted: 0.85, observedRate: 0.5 },
    ]);
  });

  test('mean absolute error', () => {
    expect(
      meanAbsoluteError([
        { predicted: 2, truth: 4 },
        { predicted: 3, truth: 3 },
      ]),
    ).toBe(1);
  });
});

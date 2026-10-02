import { describe, expect, test } from 'bun:test';
import { evenlySpacedIndexes, TASKS } from '../evals/datasets.ts';
import { parseLabel, promptFor } from '../evals/runners.ts';

const emotion = TASKS.find((task) => task.id === 'emotion');

const stars = TASKS.find((task) => task.id === 'stars');

const injection = TASKS.find((task) => task.id === 'injection');

describe('eval sampling', () => {
  test('evenly spaced indexes are deterministic and in range', () => {
    expect(evenlySpacedIndexes(10, 4)).toEqual([0, 2, 5, 7]);
    expect(evenlySpacedIndexes(3, 10)).toEqual([0, 1, 2]);
  });

  test('every task pins a full 40-character dataset revision', () => {
    for (const task of TASKS) expect(task.revision).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('chat baseline parsing', () => {
  test('accepts the first allowed label and rejects off-list answers', () => {
    if (!emotion || !stars || !injection) throw new Error('tasks missing');
    expect(parseLabel(emotion, 'Anger.')).toBe('anger');
    expect(parseLabel(emotion, 'guilt')).toBeNull();
    expect(parseLabel(stars, '4 stars')).toBe('4');
    expect(parseLabel(injection, 'False')).toBe('false');
  });

  test('the chat prompt lists exactly the allowed labels', () => {
    if (!emotion) throw new Error('emotion task missing');
    expect(promptFor(emotion, 'x')).toContain('sadness, joy, love, anger, fear, surprise');
  });
});

describe('transient gateway errors', () => {
  test('capacity, timeout, 429 and 5xx are retried; validation failures are not', async () => {
    const { isTransient } = await import('../evals/runners.ts');
    expect(isTransient('AiError: AiError: Capacity temporarily exceeded, please try again.')).toBe(
      true,
    );
    expect(isTransient('request failed: TimeoutError')).toBe(true);
    expect(isTransient('gateway returned 503')).toBe(true);
    expect(isTransient('invalid_response: answer x chose an unknown label')).toBe(false);
  });
});

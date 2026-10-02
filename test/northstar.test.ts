import { describe, expect, test } from 'bun:test';
import { f1 } from '../evals/northstar/gate.ts';
import { parseUrgent } from '../evals/northstar/run.ts';

describe('north-star gate', () => {
  test('parses the URGENT line, ignoring prose and unknown tokens', () => {
    expect(parseUrgent('Here you go.\nURGENT: #1, #22 ,inj-3, foo')).toEqual([
      '#1',
      '#22',
      'inj-3',
    ]);
    expect(parseUrgent('URGENT: none')).toEqual([]);
    expect(parseUrgent('no answer line')).toEqual([]);
  });

  test('F1 against the frozen labels', () => {
    const truth = [
      { id: '#1', truth: 'urgent' },
      { id: '#2', truth: 'urgent' },
      { id: '#3', truth: 'not-urgent' },
    ];

    expect(f1(['#1', '#2'], truth)).toBe(1);
    expect(f1(['#1', '#3'], truth)).toBe(0.5);
    expect(f1([], truth)).toBe(0);
  });
});

import { describe, expect, test } from 'bun:test';
import { pitchForY, semitonesAboveE4 } from '../site/src/chime.ts';
import { crossedChimes, FILM_END, stageFrame } from '../site/src/film.ts';

describe('note pitches match the drawn staff', () => {
  test('treble staff lines are E4, G4, B4, D5, F5', () => {
    expect(pitchForY(208)).toBeCloseTo(329.63, 1);
    expect(pitchForY(186)).toBeCloseTo(392.0, 0);
    expect(pitchForY(164)).toBeCloseTo(493.88, 0);
    expect(pitchForY(142)).toBeCloseTo(587.33, 0);
    expect(pitchForY(120)).toBeCloseTo(698.46, 0);
  });

  test('steps below the staff walk down the C major scale', () => {
    expect(semitonesAboveE4(-1)).toBe(-2);
    expect(semitonesAboveE4(-2)).toBe(-4);
  });
});

describe('stage opens, plays, closes', () => {
  test('starts at half height, opens to full, closes back', () => {
    expect(stageFrame(0)).toEqual({ open: 0, t: 0 });
    expect(stageFrame(0.5).open).toBe(1);
    expect(stageFrame(1)).toEqual({ open: 0, t: FILM_END });
  });

  test('chimes fire for every note crossed, in scroll direction', () => {
    expect(crossedChimes(16, 0, 7_300)).toEqual([0]);
    expect(crossedChimes(16, 7_300, 0)).toEqual([0]);
    expect(crossedChimes(16, 7_000, 7_700)).toEqual([0, 1]);
    expect(crossedChimes(16, 7_700, 7_000)).toEqual([1, 0]);
  });
});

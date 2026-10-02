import { describe, expect, test } from 'bun:test';
import { FILM_END, MID_Y, noteFrame, scrollProgress, staffFrame } from '../site/src/film.ts';

const note = { index: 3, x: 500, y: 80, filled: true, rest: false, returned: true };

describe('scroll-driven score film', () => {
  test('progress runs from scroll 0 to the point where the stage bottom meets the viewport bottom', () => {
    expect(scrollProgress(0, 300, 3000, 1000)).toBe(0);
    expect(scrollProgress(1150, 300, 3000, 1000)).toBe(0.5);
    expect(scrollProgress(2300, 300, 3000, 1000)).toBe(1);
    expect(scrollProgress(9000, 300, 3000, 1000)).toBe(1);
  });

  test('frames are a pure function of t, so scrolling back replays them exactly', () => {
    expect(noteFrame(note, 9000)).toEqual(noteFrame(note, 9000));
    expect(staffFrame(5500)).toEqual(staffFrame(5500));
  });

  test('a note starts on the centre line and ends at its probability height', () => {
    expect(noteFrame(note, 0).cy).toBe(MID_Y);
    expect(noteFrame(note, FILM_END).cy).toBe(80);
    expect(noteFrame(note, FILM_END).headOpacity).toBe(1);
  });

  test('an injection ends as a red rest with no note head', () => {
    const rest = noteFrame({ ...note, index: 15, rest: true }, FILM_END);

    expect(rest.restOpacity).toBe(1);
    expect(rest.headOpacity).toBe(0);
  });

  test('the final staff frame equals the static score', () => {
    const final = staffFrame(FILM_END);

    expect(final.lineY).toEqual([120, 142, 164, 186, 208]);
    expect(final.headingOpacity).toBe(1);
    expect(final.playheadOpacity).toBe(0);
  });
});

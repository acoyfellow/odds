export const FILM_END = 18_000;

export const STAFF_TOP = 120;

export const LINE_GAP = 22;

export const STAFF_BOTTOM = STAFF_TOP + LINE_GAP * 4;

export const MID_Y = STAFF_TOP + LINE_GAP * 2;

export const LEFT = 150;

export const RIGHT = 1440;

const NOTE_SLOT_MS = 380;

const SCENE_THREE_START = 7_000;

const PLAYHEAD_START = 13_600;

const PLAYHEAD_END = 15_000;

export type Ease = (progress: number) => number;

export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const axis = (a: number, b: number, s: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s ** 2 * (1 - s) + s ** 3;

  return (progress) => {
    if (progress <= 0) return 0;

    if (progress >= 1) return 1;
    let low = 0;
    let high = 1;

    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;

      if (axis(x1, x2, middle) < progress) low = middle;
      else high = middle;
    }

    return axis(y1, y2, (low + high) / 2);
  };
}

export const easeOut = cubicBezier(0.16, 1, 0.3, 1);

export const easeInOut = cubicBezier(0.65, 0, 0.35, 1);

export const easeSnap = cubicBezier(0.34, 1.56, 0.64, 1);

export const linear: Ease = (progress) => Math.min(1, Math.max(0, progress));

export function segment(t: number, start: number, end: number, ease: Ease = easeOut): number {
  if (t <= start) return 0;

  if (t >= end) return 1;

  return ease((t - start) / (end - start));
}

export function visibleWindow(t: number, start: number, end: number, fade = 300): number {
  return segment(t, start, start + fade, easeInOut) - segment(t, end - fade, end, easeInOut);
}

export function pulse(t: number, start: number, end: number): number {
  return Math.sin(Math.PI * segment(t, start, end, linear));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export interface FilmNoteInput {
  index: number;
  x: number;
  y: number;
  filled: boolean;
  rest: boolean;
  returned: boolean;
}

export interface NoteFrame {
  cx: number;
  cy: number;
  dotOpacity: number;
  headOpacity: number;
  headScale: number;
  stemOpacity: number;
  dynamicOpacity: number;
  idOpacity: number;
  restOpacity: number;
  markingOpacity: number;
  opacity: number;
  alarmed: boolean;
  waveAmplitude: number;
  waveOpacity: number;
}

export function noteStart(index: number): number {
  return SCENE_THREE_START + index * NOTE_SLOT_MS;
}

export function playheadCrossing(x: number): number {
  return lerp(PLAYHEAD_START, PLAYHEAD_END, (x - LEFT) / (RIGHT - LEFT));
}

function restFrame(note: FilmNoteInput, t: number, start: number, base: NoteFrame): NoteFrame {
  const halfway = STAFF_BOTTOM + LINE_GAP - 0.5 * LINE_GAP * 6;
  const rise = lerp(MID_Y, halfway, segment(t, start, start + 190) * 0.6);
  const shake = segment(t, start + 190, start + 370, linear);
  const jitter = shake > 0 && shake < 1 ? 2 * Math.sin(shake * Math.PI * 6) : 0;
  const drop = segment(t, start + 370, start + 560, easeInOut);

  return {
    ...base,
    cx: note.x + jitter,
    cy: lerp(rise, MID_Y, drop),
    dotOpacity: base.dotOpacity * (1 - segment(t, start + 420, start + 560)),
    headOpacity: 0,
    stemOpacity: 0,
    dynamicOpacity: 0,
    restOpacity: segment(t, start + 400, start + 600),
    markingOpacity: segment(t, start + 500, start + 800),
    alarmed: t >= start + 370,
    waveAmplitude: 0,
    waveOpacity: 0,
  };
}

export function noteFrame(note: FilmNoteInput, t: number): NoteFrame {
  const start = noteStart(note.index);
  const lift = segment(t, start, start + 420);
  const morph = segment(t, start + 200, start + 420, linear);
  const dim = segment(t, PLAYHEAD_START, PLAYHEAD_START + 300) - segment(t, 16_200, 16_700);
  const crossing = playheadCrossing(note.x);
  const swell = segment(t, start, start + 300) - segment(t, start + 700, start + 1_400);

  const base: NoteFrame = {
    cx: note.x,
    cy: lerp(MID_Y, note.y, lift),
    dotOpacity: segment(t, 4_300, 4_600) * (1 - morph),
    headOpacity: morph,
    headScale: morph > 0 && morph < 1 ? lerp(1.25, 1, easeSnap(morph)) : 1,
    stemOpacity: segment(t, start + 420, start + 580),
    dynamicOpacity: note.filled ? segment(t, start + 500, start + 800) : 0,
    idOpacity: segment(t, start + 300, start + 600),
    restOpacity: 0,
    markingOpacity: 0,
    opacity: note.returned ? 1 : 1 - 0.55 * dim,
    alarmed: false,
    waveAmplitude: lerp(2, 2 + 16 * ((STAFF_BOTTOM + LINE_GAP - note.y) / (LINE_GAP * 6)), swell),
    waveOpacity: 0.45 * swell,
  };

  if (note.returned) base.headScale *= 1 + 0.08 * pulse(t, crossing, crossing + 200);

  return note.rest ? restFrame(note, t, start, base) : base;
}

export interface StaffFrame {
  lineY: number[];
  lineOpacity: number[];
  centerLineX2: number;
  clefOpacity: number;
  axisOpacity: number;
  barOpacity: number;
  scanX: number;
  scanOpacity: number;
  clefLabelOpacity: number;
  playheadX: number;
  playheadOpacity: number;
  headingOpacity: number;
}

export function staffFrame(t: number): StaffFrame {
  const lineY: number[] = [];
  const lineOpacity: number[] = [];

  for (let line = 0; line < 5; line += 1) {
    const offset = Math.abs(line - 2) * 60;
    const split = segment(t, 5_000 + offset, 6_200 + offset);

    lineY.push(lerp(MID_Y, STAFF_TOP + line * LINE_GAP, split));
    lineOpacity.push(line === 2 ? segment(t, 4_200, 4_400) : segment(t, 5_000, 5_200));
  }

  return {
    lineY,
    lineOpacity,
    centerLineX2: lerp(20, 1480, segment(t, 4_200, 4_800, easeInOut)),
    clefOpacity: segment(t, 6_200, 6_800),
    axisOpacity: segment(t, 6_500, 7_000),
    barOpacity: segment(t, 6_000, 6_600),
    scanX: lerp(LEFT, RIGHT, segment(t, 4_500, 5_300, linear)),
    scanOpacity: visibleWindow(t, 4_500, 5_400, 150),
    clefLabelOpacity: visibleWindow(t, 4_500, 6_000),
    playheadX: lerp(LEFT, RIGHT, segment(t, PLAYHEAD_START, PLAYHEAD_END, linear)),
    playheadOpacity: visibleWindow(t, PLAYHEAD_START - 50, PLAYHEAD_END + 50, 120),
    headingOpacity: segment(t, 16_400, 17_200),
  };
}

export interface TitleFrame {
  x: number;
  y: number;
  opacity: number;
  waveOpacity: number;
}

export function titleFrame(index: number, t: number): TitleFrame {
  const rowY = 4 + index * 20;
  const squeeze = segment(t, 4_200, 4_500, easeInOut);

  return {
    x: 560,
    y: lerp(rowY, MID_Y, squeeze),
    opacity: 0.55 * segment(t, 300 + index * 90, 600 + index * 90) * (1 - squeeze),
    waveOpacity: 0.4 * segment(t, 1_200, 1_600) * (1 - squeeze),
  };
}

export interface ResultFrame {
  opacity: number;
  shiftX: number;
  countProgress: number;
}

export function resultFrame(t: number): ResultFrame {
  return {
    opacity: segment(t, 15_000, 15_400) - segment(t, 16_200, 16_600),
    shiftX: lerp(60, 0, segment(t, 15_000, 15_600)),
    countProgress: segment(t, 15_200, 16_000),
  };
}

export interface FilmCaption {
  text: string;
  from: number;
  to: number;
}

export const FILM_CAPTIONS: readonly FilmCaption[] = [
  { text: 'To a large model, many messages sound the same.', from: 2_600, to: 4_600 },
  { text: 'Clef listens to each message first.', from: 5_200, to: 7_000 },
  {
    text: 'Clef gives each one a number. High notes need an engineer today.',
    from: 7_200,
    to: 12_500,
  },
  { text: 'This message tries to give orders. Clef marks it as a rest.', from: 12_600, to: 13_800 },
  { text: 'The large model reads only these few notes.', from: 14_000, to: 16_300 },
];

export function captionOpacity(caption: FilmCaption, t: number): number {
  return visibleWindow(t, caption.from, caption.to);
}

export function wavePath(
  x: number,
  width: number,
  y: number,
  amplitude: number,
  phase: number,
): string {
  const points: string[] = [];

  for (let step = 0; step <= 32; step += 1) {
    const along = step / 32;
    const height = amplitude * Math.sin(along * Math.PI * 8 + phase);

    points.push(`${(x + along * width).toFixed(1)},${(y + height).toFixed(1)}`);
  }

  return `M${points.join(' L')}`;
}

export function scrollProgress(top: number, height: number, viewport: number): number {
  const travel = height - viewport;

  if (travel <= 0) return 1;

  return Math.min(1, Math.max(0, -top / travel));
}

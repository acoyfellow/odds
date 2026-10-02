const E4_HZ = 329.63;

const STAFF_BOTTOM_LINE_Y = 208;

const HALF_LINE_GAP = 11;

const SEMITONES_UP_FROM_E = [1, 2, 2, 2, 1, 2, 2];

const SEMITONES_DOWN_FROM_E = [2, 2, 1, 2, 2, 2, 1];

export function diatonicStepsAboveE4(y: number): number {
  return Math.round((STAFF_BOTTOM_LINE_Y - y) / HALF_LINE_GAP);
}

export function semitonesAboveE4(steps: number): number {
  const pattern = steps >= 0 ? SEMITONES_UP_FROM_E : SEMITONES_DOWN_FROM_E;
  let semitones = 0;

  for (let step = 0; step < Math.abs(steps); step += 1) semitones += pattern[step % 7];

  return steps >= 0 ? semitones : -semitones;
}

export function pitchForY(y: number): number {
  return E4_HZ * 2 ** (semitonesAboveE4(diatonicStepsAboveE4(y)) / 12);
}

const BELL_PARTIALS = [
  { ratio: 1, gain: 0.5, decay: 1.9 },
  { ratio: 2.01, gain: 0.16, decay: 1.1 },
  { ratio: 2.76, gain: 0.1, decay: 0.8 },
  { ratio: 5.4, gain: 0.04, decay: 0.35 },
];

export interface ChimeVoice {
  frequency: number;
  bright: boolean;
  muted: boolean;
}

export function createChimes(): (voice: ChimeVoice) => void {
  const context = new AudioContext();
  const master = context.createGain();
  const limiter = context.createDynamicsCompressor();

  master.gain.value = 0.22;
  master.connect(limiter);
  limiter.connect(context.destination);

  return (voice) => {
    if (context.state === 'suspended') void context.resume();
    const now = context.currentTime;

    if (voice.muted) {
      const thud = context.createOscillator();
      const envelope = context.createGain();

      thud.type = 'triangle';
      thud.frequency.setValueAtTime(140, now);
      thud.frequency.exponentialRampToValueAtTime(70, now + 0.25);
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(0.35, now + 0.01);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      thud.connect(envelope).connect(master);
      thud.start(now);
      thud.stop(now + 0.35);

      return;
    }

    for (const partial of BELL_PARTIALS) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const peak = partial.gain * (voice.bright ? 1.25 : 0.85);

      oscillator.type = 'sine';
      oscillator.frequency.value = voice.frequency * partial.ratio;
      envelope.gain.setValueAtTime(0.0001, now);
      envelope.gain.exponentialRampToValueAtTime(peak, now + 0.006);
      envelope.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);
      oscillator.connect(envelope).connect(master);
      oscillator.start(now);
      oscillator.stop(now + partial.decay + 0.05);
    }
  };
}

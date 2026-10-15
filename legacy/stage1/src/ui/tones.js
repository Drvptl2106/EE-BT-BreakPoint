// Maps a slot's "tone" (set in config) to its colours.
export const TONES = {
  break: { color: 'var(--live)',  dot: 'break' },
  lunch: { color: 'var(--lunch)', dot: 'lunchdot' },
};
export const toneOf = (slot) => TONES[slot.tone] || TONES.break;

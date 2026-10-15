// Pure streak rules. The streak is stored as a single number per person, so it
// survives the 14-day deletion of the raw records.

/** Classify a finished day from its summary. */
export function dayResult(summary) {
  if (!summary.hasActivity) return 'none';
  return summary.anyOver ? 'over' : 'clean';
}

/** New streak count after one more finished day. */
export function nextStreak(previous, result, gapPolicy = 'skip') {
  if (result === 'clean') return previous + 1;
  if (result === 'over') return 0;
  return gapPolicy === 'reset' ? 0 : previous;
}

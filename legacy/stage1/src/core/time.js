// All date handling lives in this one file.
// Stage 7 (BT-7.3) switches this to server time and the Europe/London zone,
// including the clock change on Sunday 25 October 2026. Nothing else changes.

export const MS_PER_MIN = 60000;
const MS_PER_DAY = 86400000;

/** 'YYYY-MM-DD' for a timestamp (UTC for now). */
export function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function dayStartMs(key) {
  return Date.parse(`${key}T00:00:00Z`);
}

export function addDays(key, n) {
  return dayKey(dayStartMs(key) + n * MS_PER_DAY);
}

export function daysAgoKey(n, nowMs) {
  return dayKey(nowMs - n * MS_PER_DAY);
}

export function minutesBetween(startMs, endMs) {
  return (endMs - startMs) / MS_PER_MIN;
}

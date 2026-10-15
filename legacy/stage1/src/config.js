// Every adjustable value lives here, so IT can change behaviour without
// hunting through the code. Nothing in this file is secret.
export const CONFIG = {
  appName: 'break.track',

  // Which implementations to plug in.
  // backend: 'fake' (demo data in the browser) -> 'api' arrives in Stage 2
  // auth: 'stub' (pilot codes, temporary) -> 'sso' arrives in Stage 3
  backend: 'fake',
  auth: 'stub',

  // The default daily allowance: 15 + 15 + 30 = 60 minutes.
  // A manager's adjustment is stored as extra or fewer minutes on a slot.
  // Reasons are deliberately NOT stored anywhere.
  defaultSlots: [
    { key: 'break1', label: 'Break 1', minutes: 15, tone: 'break' },
    { key: 'break2', label: 'Break 2', minutes: 15, tone: 'break' },
    { key: 'lunch', label: 'Lunch', minutes: 30, tone: 'lunch' },
  ],

  // Data is deleted automatically after this many days (plus today).
  retentionDays: 14,

  // A break counts as "over" only once it exceeds its limit by this much.
  overToleranceMinutes: 0.4,

  // Streak rule for days with no recorded break (days off, weekends):
  // 'skip' -> streak is neither added to nor broken
  // 'reset' -> streak is broken
  // Final rule is a decision for Stage 6 (BT-6.4).
  streakGapPolicy: 'skip',

  // Stage 5: sensible bounds for a manager's adjustment, in minutes.
  adjustmentLimits: { min: -30, max: 120 },

  // Stage 7: a break left running this long is closed automatically and flagged.
  forgotToStopMinutes: 90,

  // Leaderboard reward text (Stage 6 decides the real reward).
  rewardLabel: '15 min reward',

  // How often the screen re-checks the data source, in seconds.
  refreshSeconds: 10,
};

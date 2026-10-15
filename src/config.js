// Every adjustable value lives here, so IT can change behaviour without
// hunting through the code. Nothing in this file is secret.
export const CONFIG = {
  appName: 'break.track',

  // Which implementations to plug in.
  // backend: 'fake' (data kept in this browser) -> 'api' when the database arrives (see docs/DATABASE.md)
  // auth: 'stub' (pilot codes in src/pilot.js, temporary) -> 'sso' later
  backend: 'fake',   // 'api' = Supabase database (needs the two lines below). 'fake' = demo data kept in this browser.
  auth: 'stub',     // in 'api' mode people sign in with their code + password through Supabase.

  // Supabase project. The URL and the PUBLISHABLE key (starts sb_publishable_) are safe to keep here.
  // NEVER put a key that starts sb_secret_ (or service_role) in this file: the app refuses to start if you do.
  supabaseUrl: 'https://mqyeqrxzjzsfvbbjppxj.supabase.co',
  supabaseKey: 'sb_publishable_meHcw_ME6KOZTPU0Vv1Ccg_wXj-t24p',

  // The default daily allowance: 15 + 15 + 30 = 60 minutes.
  // A manager's adjustment is stored as extra or fewer minutes on a slot.
  // Reasons are deliberately NOT stored anywhere.
  defaultSlots: [
    { key: 'break1', label: 'Break 1', minutes: 15, tone: 'break' },
    { key: 'break2', label: 'Break 2', minutes: 15, tone: 'break' },
    { key: 'lunch', label: 'Lunch', minutes: 30, tone: 'lunch' },
  ],

  // Managers can add these extra breaks to a person. The names are neutral on purpose:
  // only the manager knows what each one means.
  customLabels: { c1: 'Custom 1', c2: 'Custom 2', c3: 'Custom 3', c4: 'Custom 4', c5: 'Custom 5' },

  // Data is deleted automatically after this many days (plus today).
  retentionDays: 14,

  // A break counts as "over" only once it exceeds its limit by this much.
  overToleranceMinutes: 0.4,

  // Streak rule for days with no recorded break (days off, weekends):
  // 'skip' -> streak is neither added to nor broken
  // 'reset' -> streak is broken
  streakGapPolicy: 'skip',

  // Bounds for a manager's adjustment, in minutes.
  adjustmentLimits: { min: -30, max: 120 },

  // A break left running this long is closed automatically and flagged.
  forgotToStopMinutes: 90,

  // Breakathon reward text.
  rewardLabel: '15 min reward',

  // How often the screen re-checks the data source, in seconds.
  refreshSeconds: 10,
};

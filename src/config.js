// Every adjustable value lives here, so IT can change behaviour without
// hunting through the code. Nothing in this file is secret.
export const CONFIG = {
  appName: 'break.track',

  // Which implementations to plug in.
  // backend: 'fake' (data kept in this browser) -> 'api' when the database arrives (see docs/DATABASE.md)
  // auth: 'stub' (pilot codes in src/pilot.js, temporary) -> 'sso' later
  backend: 'api',   // 'api' = Supabase database (needs the two lines below). 'fake' = demo data kept in this browser.
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

  // Managers can add these extra breaks to a person (each shows up as its own bar on that person's page).
  // The names are neutral on purpose: only the manager knows what each one is for.
  customLabels: { c1: 'OH Break 1', c2: 'OH Break 2', c3: 'OH Break 3', c4: 'OH Break 4', c5: 'OH Break 5' },

  // A manager can rename any break for one person (shown to that person too). It is a NAME, not a reason:
  // keep it short. The database enforces the same limit (db/schema.sql, break_names).
  breakNameMaxLength: 24,

  // Data is deleted automatically after this many days (plus today). The database job uses the same number (db/cleanup_job.sql).
  retentionDays: 14,

  // A break counts as "over" only once it exceeds its limit by this much.
  overToleranceMinutes: 0.4,

  // Bounds for a manager's adjustment, in minutes.
  adjustmentLimits: { min: -30, max: 120 },

  // A break left running this long is closed automatically and flagged.
  forgotToStopMinutes: 90,

  // How often the screen re-checks the data source, in seconds.
  refreshSeconds: 10,

  // Manager dashboard "team pulse": flag someone working this long without any break.
  noBreakWarnHours: 3,

  // Breakathon (weekly punctuality game, Monday to Sunday). A break is "on time" when it stays within its own
  // allowance (+ any manager adjustment). The database works the scores out the same way (db/schema.sql, breakathon()).
  breakathon: {
    pointsOnTime: 10,       // per break kept within its allowance
    pointsCleanDay: 5,      // per day where every break was on time
    penaltyPerMinuteOver: 2,
    rewardMinutes: 15,      // the manager can give last week's champion an extra OH break of this length
  },
};

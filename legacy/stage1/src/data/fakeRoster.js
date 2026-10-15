// DEV ONLY. The demo team used by the fake data layer and the stub login.
// Deleted when real identity arrives (Stage 3). Contains no real people.

export const FAKE_ROSTER = [
  ...Array.from({ length: 15 }, (_, i) => ({ id: `EE${i + 1}`, role: 'agent', team: 'pilot' })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `MGR${i + 1}`, role: 'manager', team: 'pilot' })),
];

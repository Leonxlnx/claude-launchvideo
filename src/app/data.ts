// Calendar content for the Tessel demo week (Mon 14 – Fri 18 Sep 2026).
// `BEFORE` is the overbooked week, `AFTER` is the week Tessel planned.
// Events that share an id travel between the two layouts.

export type Kind = 'meet' | 'focus' | 'life' | 'task';

export type Ev = {
  id: string;
  title: string;
  day: number; // 0 = Mon
  start: number; // hours, decimal
  end: number;
  kind: Kind;
  lane?: number; // side-by-side lane when overlapping
  lanes?: number;
  who?: string[]; // initials for avatar stacks
};

export const DAYS = [
  { dow: 'Mon', date: 14 },
  { dow: 'Tue', date: 15 },
  { dow: 'Wed', date: 16 },
  { dow: 'Thu', date: 17 },
  { dow: 'Fri', date: 18 },
];
export const TODAY = 2; // Wed 16
export const NOW = 10 + 24 / 60; // 10:24
export const H0 = 8.5; // first hour shown
export const H1 = 19.5; // last hour shown

const m = (
  id: string,
  title: string,
  day: number,
  start: number,
  end: number,
  kind: Kind = 'meet',
  lane?: number,
  lanes?: number,
): Ev => ({ id, title, day, start, end, kind, lane, lanes });

export const BEFORE: Ev[] = [
  // Mon
  m('mo-stand', 'Standup', 0, 9, 9.5),
  m('mo-design', 'Design review', 0, 9.25, 10.5, 'meet', 1, 2),
  m('mo-maya', '1:1 · Maya', 0, 10, 10.75, 'meet', 0, 2),
  m('mo-hire', 'Hiring sync', 0, 11, 12, 'meet', 0, 2),
  m('mo-road', 'Roadmap', 0, 11.5, 12.75, 'meet', 1, 2),
  m('mo-lunch', 'Lunch · Leo', 0, 13, 14, 'life'),
  m('mo-vendor', 'Vendor call', 0, 14, 15, 'meet', 0, 2),
  m('mo-metric', 'Metrics review', 0, 14.5, 15.5, 'meet', 1, 2),
  m('mo-int', 'Interview', 0, 16, 17),
  m('mo-late', 'Ops check-in', 0, 17, 17.75),
  // Tue
  m('tu-stand', 'Standup', 1, 9, 9.5),
  m('tu-price', 'Pricing sync', 1, 9.5, 10.5, 'meet', 0, 2),
  m('tu-cust', 'Customer call', 1, 10, 11, 'meet', 1, 2),
  m('tu-brand', 'Brand review', 1, 11, 12),
  m('tu-partner', 'Partner intro', 1, 13, 14),
  m('tu-plan', 'Planning', 1, 14, 15.5, 'meet', 0, 2),
  m('tu-crit', 'Design crit', 1, 15, 16, 'meet', 1, 2),
  m('tu-retro', 'Retro', 1, 16.5, 17.5),
  // Wed
  m('we-stand', 'Standup', 2, 9, 9.5),
  m('we-all', 'All-hands', 2, 10, 11, 'meet', 0, 2),
  m('we-int', 'Interview', 2, 10.5, 11.5, 'meet', 1, 2),
  m('we-priya', 'Sync · Priya', 2, 11.5, 12),
  m('we-budget', 'Budget', 2, 13, 14),
  m('we-onb', 'Onboarding', 2, 14, 15, 'meet', 0, 2),
  m('we-qbr', 'QBR prep', 2, 14.5, 16, 'meet', 1, 2),
  m('we-coffee', 'Coffee chat', 2, 16, 16.5),
  m('we-deck', 'Q4 deck', 2, 16.5, 17.5, 'task'),
  // Thu
  m('th-stand', 'Standup', 3, 9, 9.5),
  m('th-road', 'Roadmap', 3, 9.5, 11, 'meet', 0, 2),
  m('th-offsite', 'Offsite plan', 3, 10, 11, 'meet', 1, 2),
  m('th-jonas', '1:1 · Jonas', 3, 11.5, 12),
  m('th-cust', 'Customer call', 3, 13, 14, 'meet', 0, 2),
  m('th-design', 'Design review', 3, 13.5, 14.5, 'meet', 1, 2),
  m('th-panel', 'Hiring panel', 3, 15, 16.5, 'meet', 0, 2),
  m('th-board', 'Board prep', 3, 16, 17, 'meet', 1, 2),
  // Fri
  m('fr-stand', 'Standup', 4, 9, 9.5),
  m('fr-metric', 'Weekly metrics', 4, 9.5, 10.5, 'meet', 0, 2),
  m('fr-launch', 'Launch sync', 4, 10, 11, 'meet', 1, 2),
  m('fr-demo', 'Demo day', 4, 11, 12),
  m('fr-lunch', 'Team lunch', 4, 12.5, 13.5, 'life'),
  m('fr-vendor', 'Vendor review', 4, 14, 15),
  m('fr-social', 'Team social', 4, 16, 17.5, 'life'),
];

export const AFTER: Ev[] = [
  // Mon — mornings protected, meetings batched after lunch
  m('mo-stand', 'Standup', 0, 9, 9.5),
  m('mo-focus', 'Deep work', 0, 9.5, 12, 'focus'),
  m('mo-lunch', 'Lunch · Leo', 0, 12, 13, 'life'),
  m('mo-design', 'Design review', 0, 13, 14),
  m('mo-maya', '1:1 · Maya', 0, 14, 14.5),
  m('mo-road', 'Roadmap', 0, 14.5, 15.5),
  m('mo-metric', 'Metrics review', 0, 15.5, 16.25),
  m('mo-int', 'Interview', 0, 16.25, 17.25),
  // Tue
  m('tu-stand', 'Standup', 1, 9, 9.5),
  m('tu-focus', 'Deep work', 1, 9.5, 12, 'focus'),
  m('tu-price', 'Pricing sync', 1, 13, 14),
  m('tu-cust', 'Customer call', 1, 14, 15),
  m('tu-plan', 'Planning', 1, 15, 16.25),
  m('tu-retro', 'Retro', 1, 16.25, 17),
  m('tu-gym', 'Gym', 1, 17.25, 18.25, 'life'),
  // Wed
  m('we-stand', 'Standup', 2, 9, 9.5),
  m('we-deck', 'Q4 deck · draft', 2, 9.5, 12, 'focus'),
  m('we-all', 'All-hands', 2, 13, 14),
  m('we-budget', 'Budget', 2, 14, 14.75),
  m('we-onb', 'Onboarding', 2, 14.75, 15.75),
  m('we-qbr', 'QBR prep', 2, 15.75, 17),
  // Thu
  m('th-stand', 'Standup', 3, 9, 9.5),
  m('th-focus', 'Deep work', 3, 9.5, 12, 'focus'),
  m('th-cust', 'Customer call', 3, 13, 14),
  m('th-road', 'Roadmap', 3, 14, 15),
  m('th-panel', 'Hiring panel', 3, 15, 16.25),
  m('th-board', 'Board prep', 3, 16.25, 17),
  m('th-gym', 'Gym', 3, 17.25, 18.25, 'life'),
  // Fri
  m('fr-stand', 'Standup', 4, 9, 9.5),
  m('fr-deck', 'Q4 deck · final', 4, 9.5, 11.5, 'focus'),
  m('fr-demo', 'Demo day', 4, 11.5, 12.5),
  m('fr-lunch', 'Team lunch', 4, 12.5, 13.5, 'life'),
  m('fr-launch', 'Launch sync', 4, 14, 15),
  m('fr-social', 'Team social', 4, 16, 17.5, 'life'),
];

export const fmt = (h: number) => {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

// What a payee's earnings page adds up to.
//
// The counsellor's page used to multiply completed sessions by the hourly_rate
// on their own profile, label it ETB, and invent amounts for empty historical
// months so the chart looked fuller. Every one of those is a wrong number in
// front of the person whose income it is, and none of them would have shown up
// as an error.
//
// Pure: no database, no clock, no network.
import { summariseEarnings } from '../../src/services/payoutService.js';
import type { EarningRow } from '../../src/services/payoutService.js';

let failures = 0;
const pass = (s: string, ok: boolean, d = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${s}${d ? '  -> ' + d : ''}`);
};

const NOW = new Date('2026-08-15T12:00:00Z');

const row = (date: string, amountCents: number, status: EarningRow['status']): EarningRow => ({
  id: `${date}-${amountCents}-${status}`,
  kind: 'counselling_month',
  sessionId: null,
  planId: 'plan',
  date,
  startTime: null,
  durationMinutes: null,
  subject: 'Premier',
  studentName: 'A student',
  studentAvatarUrl: null,
  amountCents,
  currency: 'usd',
  status,
  releasableAt: null,
  method: null,
  reference: null,
  settledAt: null,
  receiptUrl: null,
  note: null,
});

const rows: EarningRow[] = [
  row('2026-06-01', 10_000, 'settled'),
  row('2026-07-01', 20_000, 'settled'),
  row('2026-08-01', 30_000, 'pending'),
  // Neither of these is money anybody has or will get.
  row('2026-08-01', 99_999, 'cancelled'),
  row('2026-07-01', 88_888, 'reversed'),
];

const s = summariseEarnings(rows, NOW);

pass('cancelled and reversed are not earnings', s.totalCents === 60_000, String(s.totalCents));
pass('paid is what has actually settled', s.settledCents === 30_000, String(s.settledCents));
pass('and owed is the rest', s.owedCents === 30_000, String(s.owedCents));
pass('the two halves are the whole', s.settledCents + s.owedCents === s.totalCents);

pass('this month is this month', s.thisMonthCents === 30_000, String(s.thisMonthCents));
pass('and last month is last month', s.lastMonthCents === 20_000, String(s.lastMonthCents));
pass('the change between them is a percentage', s.momChangePct === 50, String(s.momChangePct));

// Only months that happened. A chart that fills its gaps is inventing income.
pass('only real months appear', s.months.length === 3, JSON.stringify(s.months.map((m) => m.key)));
pass('in order', s.months.map((m) => m.key).join(',') === '2026-06,2026-07,2026-08');
pass(
  'and each is the sum of its own rows',
  s.months.find((m) => m.key === '2026-08')?.amountCents === 30_000,
  String(s.months.find((m) => m.key === '2026-08')?.amountCents)
);

// A first month has nothing to be compared with, and 100% up from zero is a
// number that means nothing.
const first = summariseEarnings([row('2026-08-01', 5_000, 'pending')], NOW);
pass('a first month has no change to report', first.momChangePct === null, String(first.momChangePct));

const nothing = summariseEarnings([], NOW);
pass('somebody with no earnings totals zero', nothing.totalCents === 0 && nothing.months.length === 0);
pass('and has no change to report either', nothing.momChangePct === null);

// A tutor's rows carry a session date rather than a period start. Same shape,
// same arithmetic: the summary does not care which kind it is looking at.
const tutorRows: EarningRow[] = [
  { ...row('2026-08-03', 4_000, 'settled'), kind: 'tutoring_session', sessionId: 's1', planId: null },
  { ...row('2026-08-19', 4_000, 'pending'), kind: 'tutoring_session', sessionId: 's2', planId: null },
];
const t = summariseEarnings(tutorRows, NOW);
pass('lessons in one month add up together', t.thisMonthCents === 8_000, String(t.thisMonthCents));
pass('and are one month, not two', t.months.length === 1, String(t.months.length));

console.log(failures === 0 ? '\nall checks passed' : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);

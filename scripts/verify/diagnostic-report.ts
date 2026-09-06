// The arithmetic behind the diagnostic reports.
//
// The tutor and admin views both draw from src/services/diagnosticReport.ts,
// so a mistake here is a wrong chart shown to a real person. These pin the
// three things the reports depend on: accuracy rounds and divides safely,
// results whose test is unknown are not silently dropped, and per-test
// averages are the mean of each sitting rather than a pooled ratio.
//
// Pure functions, no database: run with `npx tsx scripts/verify/diagnostic-report.ts`.
import { overall, byCategory, perTest } from '../../src/services/diagnosticReport.ts';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
}

const r = (id: string, studentId: string, score: number, total: number): any => ({
  id, studentId, score, total, completedAt: '2026-09-01T00:00:00Z', answers: [],
});
const t = (id: string, categoryName: string, title: string): any => ({
  id, categoryName, title, description: '', categoryId: 'c', questions: [],
});

const tests = [
  t('algebra', 'K-12 Math', 'Algebra'),
  t('geometry', 'K-12 Math', 'Geometry'),
  t('reading', 'English', 'Reading'),
];

// overall
{
  const o = overall([r('algebra', 's1', 4, 5), r('reading', 's1', 1, 5)]);
  check('overall sums correct and total', o.correct === 5 && o.total === 10, `${o.correct}/${o.total}`);
  check('overall accuracy rounds', o.accuracy === 50, `${o.accuracy}`);
  check('overall of nothing is zero, not NaN', overall([]).accuracy === 0);
}

// byCategory
{
  const cats = byCategory([r('algebra', 's1', 4, 5), r('geometry', 's1', 2, 5), r('reading', 's1', 5, 5)], tests);
  const math = cats.find((c) => c.category === 'K-12 Math')!;
  check('byCategory pools tests in one category', math.correct === 6 && math.total === 10, `${math.correct}/${math.total}`);
  check('byCategory is weakest first', cats[0].accuracy <= cats[cats.length - 1].accuracy, cats.map((c) => c.accuracy).join(','));
}

// unknown slug lands under "Other", never dropped
{
  const cats = byCategory([r('deleted-slug', 's1', 1, 4)], tests);
  const other = cats.find((c) => c.category === 'Other');
  check('unknown slug counted under Other', !!other && other.total === 4);
}

// perTest averages each sitting, not a pooled ratio
{
  // Two sittings of algebra: 100% and 0% -> mean 50%, not 5/10 = 50 (same here),
  // so make them uneven: 4/4 (100%) and 1/10 (10%) -> mean 55%, pooled would be 5/14 = 36%.
  const stats = perTest([r('algebra', 's1', 4, 4), r('algebra', 's2', 1, 10)], tests);
  const algebra = stats.find((s) => s.slug === 'algebra')!;
  check('perTest counts every sitting as an attempt', algebra.attempts === 2, `${algebra.attempts}`);
  check('perTest averages sitting percentages, not pooled counts', algebra.avgAccuracy === 55, `${algebra.avgAccuracy}`);
  check('perTest resolves the title from the slug', algebra.title === 'Algebra', algebra.title);
}

console.log('');
if (failures > 0) {
  console.log(`${failures} failed`);
  process.exit(1);
} else {
  console.log('all passed');
}

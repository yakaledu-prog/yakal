// Yali's knowledge selection must stay relevant, deterministic, and bounded.
// This is pure: it imports no handler, reads no database, and calls no model.
import assert from 'node:assert/strict';
import { selectSupportKnowledge } from '../../api/_utils/support-knowledge.js';

const invite = selectSupportKnowledge('parent', 'How do I invite and link my child?');
assert.deepEqual(invite.topicIds, ['family-invites']);
assert.match(invite.text, /not a purchase/i);
assert.doesNotMatch(invite.text, /hosted Stripe Checkout/);

const paid = selectSupportKnowledge('student', 'Why is tutoring still locked after payment?');
assert.deepEqual(paid.topicIds, ['paid-access']);
assert.match(paid.text, /active course enrolment/i);
assert.doesNotMatch(paid.text, /apply through Find Courses/);

const classroom = selectSupportKnowledge('tutor', 'Can I open a student Classroom assignment in Google Drive?');
assert.ok(classroom.topicIds.includes('google-documents'));
assert.ok(classroom.topicIds.includes('tutoring-sessions'));
assert.match(classroom.text, /do not sign in to Google/i);

const advising = selectSupportKnowledge('counselor', 'Where do I review an admissions essay?');
assert.ok(advising.topicIds.includes('admissions'));
assert.doesNotMatch(advising.text, /parent invites a child/i);

const first = selectSupportKnowledge('parent', 'billing refund and paid access');
const second = selectSupportKnowledge('parent', 'billing refund and paid access');
assert.deepEqual(first, second);
assert.ok(first.topicIds.length <= 3);
assert.ok(first.text.length <= 4_500);

const fallback = selectSupportKnowledge('student', 'Hello there');
assert.deepEqual(fallback.topicIds, []);
assert.match(fallback.text, /Student navigation/);

const counselorBilling = selectSupportKnowledge('counselor', 'A student says paid tutoring is locked');
assert.ok(!counselorBilling.topicIds.includes('paid-access'));

// Account and session basics reach every role and must not be crowded out by
// the older topics for the questions they own.
const idle = selectSupportKnowledge('student', 'Why was I signed out after 15 minutes of inactivity?');
assert.ok(idle.topicIds.includes('account-session'));
assert.match(idle.text, /15 minutes/);
assert.match(idle.text, /login page/i);

const started = selectSupportKnowledge('parent', 'How do I finish onboarding and set my profile photo?');
assert.ok(started.topicIds.includes('getting-started'));
assert.match(started.text, /onboarding/i);

// The new all-role topics must not disturb the exact selections above: the
// invite and paid-access questions still resolve to a single owning topic.
assert.deepEqual(selectSupportKnowledge('parent', 'How do I invite and link my child?').topicIds, ['family-invites']);
assert.deepEqual(selectSupportKnowledge('student', 'Why is tutoring still locked after payment?').topicIds, ['paid-access']);
assert.deepEqual(selectSupportKnowledge('student', 'Hello there').topicIds, []);

console.log('support knowledge selection passed');

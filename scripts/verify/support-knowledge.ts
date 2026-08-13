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

console.log('support knowledge selection passed');

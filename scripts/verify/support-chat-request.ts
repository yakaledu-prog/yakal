// The endpoint request assembler must include only selected knowledge and must
// remain testable without authentication, a database, a key, or a Groq call.
import assert from 'node:assert/strict';
import { asSupportRole, buildGroqMessages, parseRequest } from '../../api/support-chat.js';

const messages = buildGroqMessages('parent', [
  { role: 'user', content: 'How do I invite my child?' },
]);

assert.equal(messages.length, 3);
assert.equal(messages[0].role, 'system');
assert.match(messages[0].content, /cannot see private account data/i);
assert.equal(messages[1].role, 'system');
assert.match(messages[1].content, /Parent navigation/);
assert.match(messages[1].content, /not a purchase/i);
assert.doesNotMatch(messages[1].content, /hosted Stripe Checkout/);
assert.deepEqual(messages[2], { role: 'user', content: 'How do I invite my child?' });

const parsed = parseRequest({
  // A modified browser may still send a role, but it is neither required nor
  // returned. The handler derives the authoritative role from profiles.
  role: 'admin',
  messages: [{ role: 'user', content: 'Where is billing?' }],
});
assert.deepEqual(parsed, { messages: [{ role: 'user', content: 'Where is billing?' }] });
assert.equal(asSupportRole('student'), 'student');
assert.equal(asSupportRole('admin'), null);

console.log('support chat request assembly passed');

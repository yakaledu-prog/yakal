// The endpoint request assembler must include only selected knowledge and must
// remain testable without authentication, a database, a key, or a Groq call.
import assert from 'node:assert/strict';
import { buildGroqMessages } from '../../api/support-chat.js';

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

console.log('support chat request assembly passed');

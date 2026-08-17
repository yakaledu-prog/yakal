import { deltaFromFrame } from '../../api/support-chat.js';

// ============================================================
// Reading Groq's streamed frames.
//
// The support endpoint used to answer in one piece; it streams now, so the
// handler parses server-sent events. The landing assistant's version of this
// had a bug that swallowed every answer: Gemini terminated frames with CRLF
// and the split matched nothing, so the buffer grew to the end of the reply
// and the visitor was told "I did not catch that" for a paragraph the model
// had written in full.
//
// The same parsing has now been written a second time, for a second provider.
// These cases exist so that bug cannot be discovered twice.
// ============================================================

let failures = 0;

function check(name: string, actual: string, expected: string) {
  if (actual === expected) {
    console.log(`ok    ${name}`);
  } else {
    console.error(`FAIL  ${name}\n        expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failures++;
  }
}

const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}`;
const delta = (content: string) => frame({ choices: [{ delta: { content } }] });

check('a content delta is read', deltaFromFrame(delta('Hello')), 'Hello');

// The bug this file exists for.
check(
  'CRLF line endings still parse',
  deltaFromFrame(delta('Hello').replace(/\n/g, '\r\n')),
  'Hello'
);

// The first frame of an OpenAI-shaped stream carries the role and no content.
check(
  'a role-only opener yields nothing',
  deltaFromFrame(frame({ choices: [{ delta: { role: 'assistant' } }] })),
  ''
);

check('the DONE sentinel yields nothing', deltaFromFrame('data: [DONE]'), '');
check('a comment keepalive yields nothing', deltaFromFrame(': ping'), '');
check('malformed JSON yields nothing rather than throwing', deltaFromFrame('data: {oops'), '');
check('an empty frame yields nothing', deltaFromFrame(''), '');

// Whitespace is content: trimming it would glue words together across frames,
// because a provider is free to split "Hello world" as "Hello" and " world".
check('leading whitespace in a delta survives', deltaFromFrame(delta(' world')), ' world');

// A non-string content field must not be coerced into "undefined" or "[object
// Object]" and spoken aloud.
check(
  'a non-string content yields nothing',
  deltaFromFrame(frame({ choices: [{ delta: { content: { text: 'no' } } }] })),
  ''
);

if (failures > 0) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log('\nall passed');

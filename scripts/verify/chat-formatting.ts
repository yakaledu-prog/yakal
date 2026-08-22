// Yali and the landing assistant emit light markdown (**bold**, *italic*,
// `code`) even though they are asked for plain prose. It used to reach the
// bubble as literal asterisks. formatMessage turns it into real nodes without
// injecting HTML; this pins that, and the cases that must NOT be touched: a
// snake_case identifier, and a marker that has not been closed yet mid-stream.
//
// Pure: it renders no component, it only inspects the node tree formatMessage
// returns. Run with: npx tsx scripts/verify/chat-formatting.ts
import assert from 'node:assert/strict';

// chatParts is a .tsx component module. Import it at runtime only: the scripts
// tsconfig is deliberately no-JSX (Node, not a browser), so a static import
// would fail typecheck. A non-literal specifier keeps tsc from resolving the
// component while tsx still loads it to exercise the real function.
const modPath = '../../src/components/assistant/chatParts.tsx';
const { formatMessage } = (await import(modPath)) as {
  formatMessage: (text: string) => unknown[];
};

type El = { type: unknown; props: { children?: unknown } };
function isEl(node: unknown): node is El {
  return typeof node === 'object' && node !== null && 'type' in node;
}

/** Every host-element tag name found anywhere in the tree. */
function tags(nodes: unknown[], acc: string[] = []): string[] {
  for (const node of nodes) {
    if (isEl(node)) {
      if (typeof node.type === 'string') acc.push(node.type);
      const kids = node.props.children;
      tags(Array.isArray(kids) ? kids : [kids], acc);
    }
  }
  return acc;
}

/** All plain-string text found anywhere in the tree, concatenated. */
function text(nodes: unknown[]): string {
  let out = '';
  for (const node of nodes) {
    if (typeof node === 'string') out += node;
    else if (isEl(node)) {
      const kids = node.props.children;
      out += text(Array.isArray(kids) ? kids : [kids]);
    }
  }
  return out;
}

const bold = formatMessage('a **strong** word');
assert.ok(tags(bold).includes('strong'), 'bold should render <strong>');
assert.equal(text(bold), 'a strong word', 'bold markers should be gone from the text');

const italic = formatMessage('an *emphasised* word');
assert.ok(tags(italic).includes('em'), 'italic should render <em>');
assert.equal(text(italic), 'an emphasised word');

const code = formatMessage('run `npm run dev` now');
assert.ok(tags(code).includes('code'), 'code span should render <code>');
assert.equal(text(code), 'run npm run dev now');

const nested = formatMessage('**bold _and italic_**');
assert.ok(tags(nested).includes('strong') && tags(nested).includes('em'), 'nesting should work');

// A heading marker becomes bold, not visible hashes.
const heading = formatMessage('## Getting started');
assert.ok(tags(heading).includes('strong'));
assert.equal(text(heading), 'Getting started');

// Must NOT touch: snake_case is not italic, and an underscore run stays literal.
const snake = formatMessage('the parent_student_links table');
assert.ok(!tags(snake).includes('em'), 'snake_case must not become italic');
assert.equal(text(snake), 'the parent_student_links table');

// Must NOT touch: a marker still being streamed stays as text.
const partial = formatMessage('this is **not closed yet');
assert.ok(!tags(partial).includes('strong'), 'an unclosed marker stays literal');
assert.equal(text(partial), 'this is **not closed yet');

// A plain leaf still gets linkified.
const link = formatMessage('email hello@yakal.test for help');
assert.ok(tags(link).includes('a'), 'addresses in a run stay clickable');

console.log('chat formatting passed');

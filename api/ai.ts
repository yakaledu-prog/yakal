import { dispatch } from './_handlers/_dispatch.js';

// The landing page assistant. Public and unauthenticated by design: it answers
// visitors who have no account, and it is given nothing private to leak. See
// api/_utils/assistant.ts for what it knows and why that is the whole boundary.
//
// One file because Vercel counts every top level file in api/ as a function,
// and the free plan allows twelve. This is the eleventh.
export default dispatch({
  chat: () => import('./_handlers/ai-chat.js'),
});

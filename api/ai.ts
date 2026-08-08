import { dispatch } from './_handlers/_dispatch.js';

// Loaded per action. The assistant is the only one so far, but it carries a
// model call and a context read, and grouping keeps a future one off its own
// serverless function.
export default dispatch({
  'roadmap': () => import('./_handlers/ai-roadmap.js'),
});

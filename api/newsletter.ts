import { dispatch } from './_handlers/_dispatch.js';

// Subscribing is public, unsubscribing is public by token, broadcasting is
// admin only and checks that for itself. Grouped behind one file because
// Vercel counts every top level file in api/ as a function.
export default dispatch({
  subscribe: () => import('./_handlers/newsletter-subscribe.js'),
  unsubscribe: () => import('./_handlers/newsletter-unsubscribe.js'),
  broadcast: () => import('./_handlers/newsletter-broadcast.js'),
  list: () => import('./_handlers/newsletter-list.js'),
});

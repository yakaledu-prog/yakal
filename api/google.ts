import { dispatch } from './_handlers/_dispatch';

// Loaded per action, not up front. The token exchange is plain fetch against
// Google's OAuth endpoint and needs neither client, so it must not be able to
// fail because of them.
export default dispatch({
  'token': () => import('./_handlers/google-token'),
  'drive': () => import('./_handlers/drive'),
  'classroom': () => import('./_handlers/classroom'),
});

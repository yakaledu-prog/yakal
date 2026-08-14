import { dispatch } from './_handlers/_dispatch.js';

// Loaded per action, not up front. The token exchange is plain fetch against
// Google's OAuth endpoint and needs neither client, so it must not be able to
// fail because of them.
export default dispatch({
  'token': () => import('./_handlers/google-token.js'),
  'drive': () => import('./_handlers/drive.js'),
  'classroom': () => import('./_handlers/classroom.js'),
  // Writes a tutor's Yakal grade back to the linked class (P4). Best-effort;
  // the native grade is the record.
  'grade': () => import('./_handlers/classroom-grade.js'),
});

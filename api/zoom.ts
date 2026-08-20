import { dispatch } from './_handlers/_dispatch.js';
import signature from './_handlers/zoom-signature.js';
import meetings from './_handlers/zoom-meetings.js';
import webhook from './_handlers/zoom-webhook.js';

export default dispatch({
  'signature': signature,
  'meetings': meetings,
  // Registered with Zoom as .../api/zoom?action=webhook. It needs the raw
  // request body to check the signature, which both servers capture.
  'webhook': webhook,
});

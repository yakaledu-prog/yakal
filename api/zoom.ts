import { dispatch } from './_handlers/_dispatch.js';
import signature from './_handlers/zoom-signature.js';
import meetings from './_handlers/zoom-meetings.js';

export default dispatch({
  'signature': signature,
  'meetings': meetings,
});

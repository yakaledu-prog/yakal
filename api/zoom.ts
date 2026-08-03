import { dispatch } from './_handlers/_dispatch';
import signature from './_handlers/zoom-signature';
import meetings from './_handlers/zoom-meetings';

export default dispatch({
  'signature': signature,
  'meetings': meetings,
});

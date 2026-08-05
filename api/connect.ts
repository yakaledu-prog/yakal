import { dispatch } from './_handlers/_dispatch.js';
import onboard from './_handlers/connect-onboard.js';
import status from './_handlers/connect-status.js';
import transfer from './_handlers/connect-transfer.js';
import sessionPayout from './_handlers/session-payout.js';

export default dispatch({
  'onboard': onboard,
  'status': status,
  'transfer': transfer,
  'session-payout': sessionPayout,
});

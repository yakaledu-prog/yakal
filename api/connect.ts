import { dispatch } from './_handlers/_dispatch';
import onboard from './_handlers/connect-onboard';
import status from './_handlers/connect-status';
import transfer from './_handlers/connect-transfer';
import sessionPayout from './_handlers/session-payout';

export default dispatch({
  'onboard': onboard,
  'status': status,
  'transfer': transfer,
  'session-payout': sessionPayout,
});

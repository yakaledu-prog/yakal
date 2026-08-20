// Money going out: connecting a bank, and paying people.
//
// stripe.ts is the other half, money coming in. run-jobs lives here rather than
// there because everything it does is a payout, and session-payout is gone: a
// tutor asking to be paid for their own lesson was a tutor authorising their
// own payment. The scheduled job decides now, and the hold is what makes that
// safe.
import { dispatch } from './_handlers/_dispatch.js';
import onboard from './_handlers/connect-onboard.js';
import status from './_handlers/connect-status.js';
import transfer from './_handlers/connect-transfer.js';
import runJobs from './_handlers/run-jobs.js';

export default dispatch({
  'onboard': onboard,
  'status': status,
  'transfer': transfer,
  'run-jobs': runJobs,
});

import { dispatch } from './_handlers/_dispatch.js';
import checkout from './_handlers/stripe-checkout.js';
import portal from './_handlers/stripe-portal.js';
import confirm from './_handlers/stripe-confirm.js';
import paymentMethods from './_handlers/stripe-payment-methods.js';
import createInvoice from './_handlers/create-invoice.js';
import subscription from './_handlers/subscription.js';
import sessionCancel from './_handlers/session-cancel.js';
import adminRefund from './_handlers/admin-refund.js';
import sessionDispute from './_handlers/session-dispute.js';
import sessionMeeting from './_handlers/session-meeting.js';

export default dispatch({
  'checkout': checkout,
  'portal': portal,
  'confirm': confirm,
  'payment-methods': paymentMethods,
  'create-invoice': createInvoice,
  'subscription': subscription,
  'session-cancel': sessionCancel,
  'refund': adminRefund,
  'dispute': sessionDispute,
  // Not a payment, but it lives beside the other things done to a session
  // after it is booked, and this file is already where those are routed.
  'session-meeting': sessionMeeting,
});

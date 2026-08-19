import { dispatch } from './_handlers/_dispatch.js';
import checkout from './_handlers/stripe-checkout.js';
import portal from './_handlers/stripe-portal.js';
import confirm from './_handlers/stripe-confirm.js';
import paymentMethods from './_handlers/stripe-payment-methods.js';
import createInvoice from './_handlers/create-invoice.js';
import subscription from './_handlers/subscription.js';

export default dispatch({
  'checkout': checkout,
  'portal': portal,
  'confirm': confirm,
  'payment-methods': paymentMethods,
  'create-invoice': createInvoice,
  'subscription': subscription,
});

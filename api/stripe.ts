import { dispatch } from './_handlers/_dispatch';
import checkout from './_handlers/stripe-checkout';
import portal from './_handlers/stripe-portal';
import confirm from './_handlers/stripe-confirm';
import paymentMethods from './_handlers/stripe-payment-methods';
import createInvoice from './_handlers/create-invoice';

export default dispatch({
  'checkout': checkout,
  'portal': portal,
  'confirm': confirm,
  'payment-methods': paymentMethods,
  'create-invoice': createInvoice,
});

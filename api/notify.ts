import { dispatch } from './_handlers/_dispatch.js';

export default dispatch({
  email: () => import('./_handlers/notify-email.js'),
});

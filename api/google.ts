import { dispatch } from './_handlers/_dispatch';
import token from './_handlers/google-token';
import drive from './_handlers/drive';
import classroom from './_handlers/classroom';

export default dispatch({
  'token': token,
  'drive': drive,
  'classroom': classroom,
});

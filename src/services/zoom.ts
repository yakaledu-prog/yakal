import { authedPost } from '@/lib/authedFetch';

/**
 * A signature to join one session's meeting.
 *
 * Only the session id: the server decides the meeting and the role from who
 * you are on that session. This used to send a meeting number and a role, and
 * the server signed whatever it was given, host included, for anybody.
 *
 * Creating, moving and deleting meetings happens on the server
 * (api/_utils/zoom.ts); the create and delete helpers that lived here had no
 * callers and are gone with the endpoints that served them.
 */
export const generateZoomSignature = async (sessionId: string): Promise<string> => {
  const out = await authedPost<{ signature?: string }>('/api/zoom?action=signature', { sessionId });
  if (out.error || !out.signature) {
    throw new Error(out.error || 'Failed to generate Zoom signature');
  }
  return out.signature;
};

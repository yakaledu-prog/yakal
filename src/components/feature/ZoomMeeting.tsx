import { useEffect, useState } from 'react';
import { generateZoomSignature } from '@/services/zoom';
import { Video, RefreshCw } from 'lucide-react';

// Uses the Meeting SDK "client view" (full-page Zoom UI) loaded from Zoom's
// CDN at runtime. Two constraints force this design:
// - The npm client view breaks under Vite ("middleware is not a function"):
//   Zoom only supports webpack bundling, so Vite must never process the SDK.
// - The component view renders reliably but its sizing/toolbar is broken
//   (Zoom devforum #144700), so it can't give a usable full-screen meeting.
// The CDN scripts are only injected when a meeting page mounts.

const ZOOM_VERSION = '6.2.0';
const ZOOM_CDN = 'https://source.zoom.us';

declare global {
  interface Window {
    ZoomMtg?: any;
  }
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

let zoomMtgPromise: Promise<any> | null = null;
function loadZoomMtg(): Promise<any> {
  if (!zoomMtgPromise) {
    zoomMtgPromise = (async () => {
      // Vendor deps must load before the main bundle, in this order.
      for (const dep of ['react.min.js', 'react-dom.min.js', 'redux.min.js', 'redux-thunk.min.js', 'lodash.min.js']) {
        await loadScript(`${ZOOM_CDN}/${ZOOM_VERSION}/lib/vendor/${dep}`);
      }
      await loadScript(`${ZOOM_CDN}/zoom-meeting-${ZOOM_VERSION}.min.js`);
      const ZoomMtg = window.ZoomMtg;
      if (!ZoomMtg) throw new Error('Zoom SDK loaded but window.ZoomMtg is missing');
      ZoomMtg.setZoomJSLib(`${ZOOM_CDN}/${ZOOM_VERSION}/lib`, '/av');
      ZoomMtg.preLoadWasm();
      ZoomMtg.prepareWebSDK();
      return ZoomMtg;
    })().catch((e) => {
      zoomMtgPromise = null; // allow retry after a network failure
      throw e;
    });
  }
  return zoomMtgPromise;
}

function setZoomRootVisible(visible: boolean) {
  const root = document.getElementById('zmmtg-root');
  if (root) root.style.display = visible ? 'block' : 'none';
}

interface ZoomMeetingProps {
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail: string;
  role: 0 | 1; // 0 for participant, 1 for host
  leaveUrl: string;
}

type Status =
  | { phase: 'loading-sdk' }
  | { phase: 'signature' }
  | { phase: 'joining' }
  | { phase: 'in-meeting' }
  | { phase: 'error'; message: string; hint?: string };

function describeJoinError(error: any, role: 0 | 1): { message: string; hint?: string } {
  const reason = error?.reason || error?.errorMessage || error?.message || 'Unknown error';
  const code = error?.errorCode;

  if (/signature/i.test(String(reason))) {
    return {
      message: `Zoom rejected the join signature (${reason}).`,
      hint:
        'This usually means VITE_ZOOM_MEETING_CLIENT_ID and ZOOM_MEETING_CLIENT_SECRET do not belong to the same Meeting SDK app in the Zoom Marketplace, or the app is not activated. Verify both values and restart the dev server.',
    };
  }
  if (code === 3008 || /not started/i.test(String(reason))) {
    return {
      message: 'The meeting has not been started by the host yet.',
      hint:
        role === 0
          ? 'Ask your tutor to join first - students cannot enter before the host starts the meeting.'
          : 'As the host, try again in a few seconds; the meeting may still be initializing on Zoom’s side.',
    };
  }
  if (/password|passcode/i.test(String(reason))) {
    return {
      message: `Zoom rejected the meeting passcode (${reason}).`,
      hint: 'The session’s stored zoom_password no longer matches the meeting. Rebooking the session will create a fresh meeting.',
    };
  }
  if (/not exist|invalid meeting/i.test(String(reason))) {
    return {
      message: `Zoom could not find this meeting (${reason}).`,
      hint: 'The meeting may have been deleted from the Zoom account, or the stored zoom_meeting_id is stale.',
    };
  }
  return {
    message: `Could not join the meeting: ${reason}${code ? ` (code ${code})` : ''}.`,
    hint: 'Check the browser console and the /api/zoom-signature response for details.',
  };
}

export function ZoomMeeting({
  meetingNumber,
  password,
  userName,
  userEmail,
  role,
  leaveUrl,
}: ZoomMeetingProps) {
  const [status, setStatus] = useState<Status>({ phase: 'loading-sdk' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setStatus({ phase: 'loading-sdk' });
        const ZoomMtg = await loadZoomMtg();
        if (cancelled) return;

        setStatus({ phase: 'signature' });
        let signature: string;
        try {
          signature = await generateZoomSignature(meetingNumber, role);
        } catch (e: any) {
          if (!cancelled)
            setStatus({
              phase: 'error',
              message: `Could not get a join signature from the server: ${e?.message || e}`,
              hint: 'Is the API server running? Locally it starts with "npm run dev" and serves /api/zoom-signature. In production the Zoom env vars must be set on Vercel.',
            });
          return;
        }
        if (cancelled) return;

        setStatus({ phase: 'joining' });
        setZoomRootVisible(true);

        ZoomMtg.init({
          leaveUrl,
          patchJsMedia: true,
          success: () => {
            ZoomMtg.join({
              signature,
              meetingNumber,
              passWord: password || '',
              userName,
              userEmail,
              success: () => {
                if (!cancelled) setStatus({ phase: 'in-meeting' });
              },
              error: (error: any) => {
                console.error('Zoom join failed:', error);
                if (!cancelled) {
                  setZoomRootVisible(false);
                  setStatus({ phase: 'error', ...describeJoinError(error, role) });
                }
              },
            });
          },
          error: (error: any) => {
            console.error('Zoom init failed:', error);
            if (!cancelled) {
              setZoomRootVisible(false);
              setStatus({ phase: 'error', ...describeJoinError(error, role) });
            }
          },
        });
      } catch (error: any) {
        console.error('Failed to load the Zoom SDK:', error);
        if (!cancelled)
          setStatus({
            phase: 'error',
            message: `Could not load the Zoom SDK from Zoom's CDN: ${error?.message || error}`,
            hint: 'Check your internet connection (source.zoom.us must be reachable) and try again.',
          });
      }
    };

    start();

    return () => {
      cancelled = true;
      // The client view has no clean unmount; hide its full-page overlay so
      // the app is visible again if the user navigates away mid-meeting.
      setZoomRootVisible(false);
      try {
        window.ZoomMtg?.leaveMeeting?.({});
      } catch {
        // Not in a meeting - nothing to leave.
      }
    };
  }, [meetingNumber, password, userName, userEmail, role, leaveUrl, attempt]);

  // The client view renders into its own full-page #zmmtg-root on <body>;
  // this container only hosts the pre-join status / error UI.
  return (
    <div className="fixed inset-0 z-40 bg-[#0b141a] flex flex-col items-center justify-center gap-4 text-center px-6">
      {status.phase === 'error' ? (
        <div className="max-w-lg space-y-4">
          <Video size={40} className="mx-auto text-[#aebac1]" />
          <p className="text-[16px] font-semibold text-white">{status.message}</p>
          {status.hint && <p className="text-[14px] text-[#aebac1]">{status.hint}</p>}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setAttempt((a) => a + 1)}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#1099A1] text-white rounded-lg font-semibold text-[14px] hover:opacity-90 transition-opacity"
            >
              <RefreshCw size={15} /> Try again
            </button>
            <button
              onClick={() => window.location.assign(leaveUrl)}
              className="px-5 py-2 text-[#aebac1] hover:text-white rounded-lg font-semibold text-[14px] transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#1099A1]" />
          <p className="text-[14px] text-[#aebac1]">
            {status.phase === 'loading-sdk'
              ? 'Loading the Zoom meeting client…'
              : status.phase === 'signature'
                ? 'Requesting a join signature from the server…'
                : `Connecting to Zoom meeting ${meetingNumber} as ${role === 1 ? 'host' : 'participant'}…`}
          </p>
          <p className="text-[12px] text-[#54656f] max-w-md">
            Camera and microphone start off - once connected, use the buttons in the Zoom toolbar
            to turn them on (your browser will ask for permission the first time).
          </p>
        </>
      )}
    </div>
  );
}

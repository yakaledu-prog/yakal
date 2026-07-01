import { useEffect, useRef } from 'react';
import { ZoomMtg } from '@zoom/meetingsdk';
import { generateZoomSignature } from '@/services/zoom';

// Set up the Zoom SDK resources
ZoomMtg.setZoomJSLib('https://source.zoom.us/6.2.0/lib', '/av');
ZoomMtg.preLoadWasm();
ZoomMtg.prepareWebSDK();
// loads language files, also passes any error messages to the ui
ZoomMtg.i18n.load('en-US');
ZoomMtg.i18n.reload('en-US');

interface ZoomMeetingProps {
  meetingNumber: string;
  password?: string;
  userName: string;
  userEmail: string;
  role: 0 | 1; // 0 for participant, 1 for host
  leaveUrl: string;
}

export function ZoomMeeting({
  meetingNumber,
  password,
  userName,
  userEmail,
  role,
  leaveUrl,
}: ZoomMeetingProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show the Zoom UI when this component mounts
    const zoomRoot = document.getElementById('zmmtg-root');
    if (zoomRoot) {
      zoomRoot.style.display = 'block';
    }

    const initMeeting = async () => {
      try {
        // Get signature from our backend
        const signature = await generateZoomSignature(meetingNumber, role);

        // Initialize Zoom SDK
        ZoomMtg.init({
          leaveUrl: leaveUrl,
          isSupportAV: true,
          success: () => {
            // Join Meeting
            ZoomMtg.join({
              sdkKey: import.meta.env.VITE_ZOOM_MEETING_CLIENT_ID,
              signature: signature,
              meetingNumber: meetingNumber,
              passWord: password || '',
              userName: userName,
              userEmail: userEmail,
              success: () => {
                console.log('Joined Zoom Meeting successfully');
              },
              error: (error: any) => {
                console.error('Error joining meeting:', error);
              },
            });
          },
          error: (error: any) => {
            console.error('Error initializing meeting:', error);
          },
        });
      } catch (error) {
        console.error('Failed to start Zoom meeting:', error);
      }
    };

    // Zoom expects an element with id="zmmtg-root" in the DOM by default.
    // If not using embedded view, it will take over the whole screen.
    // The standard Meeting SDK takes over the whole screen.
    initMeeting();

    return () => {
      // Cleanup? Zoom doesn't provide a clean unmount,
      // it's usually best to let the leaveUrl handle navigation.
      const zoomRoot = document.getElementById('zmmtg-root');
      if (zoomRoot) {
        zoomRoot.style.display = 'none';
      }
    };
  }, [meetingNumber, password, userName, userEmail, role, leaveUrl]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[600px] relative">
      {/* Zoom SDK will attach itself to the body or #zmmtg-root depending on view mode */}
      <div id="zmmtg-root" className="absolute inset-0"></div>
    </div>
  );
}

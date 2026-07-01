import { useNavigate } from 'react-router-dom';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { ArrowLeft } from 'lucide-react';

interface JitsiMeetingRoomProps {
  roomName: string;
  userName: string;
  userEmail?: string;
  subject?: string;
  onMeetingEnd?: () => void;
}

export function JitsiMeetingRoom({ roomName, userName, userEmail, subject, onMeetingEnd }: JitsiMeetingRoomProps) {
  const navigate = useNavigate();

  const handleReadyToClose = () => {
    if (onMeetingEnd) {
      onMeetingEnd();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#111b21] flex flex-col">
      {/* Minimal top bar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#1a2730] border-b border-[#2a3942]">
        <button
          onClick={handleReadyToClose}
          className="flex items-center gap-2 text-[#aebac1] hover:text-white transition-colors text-[13px] font-medium"
        >
          <ArrowLeft size={16} />
          Leave Meeting
        </button>
        {subject && (
          <span className="text-[#e9edef] text-[13px] font-semibold ml-auto">{subject}</span>
        )}
      </div>

      {/* Jitsi Meeting */}
      <div className="flex-1">
        <JitsiMeeting
          domain="meet.ffmuc.net"
          roomName={roomName}
          userInfo={{
            displayName: userName,
            email: userEmail || '',
          }}
          configOverwrite={{
            startWithAudioMuted: true,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            hideConferenceSubject: false,
            subject: subject || 'Yakal Session',
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            DEFAULT_BACKGROUND: '#111b21',
          }}
          onReadyToClose={handleReadyToClose}
          getIFrameRef={(iframeRef) => {
            iframeRef.style.height = '100%';
            iframeRef.style.width = '100%';
            iframeRef.style.border = 'none';
          }}
        />
      </div>
    </div>
  );
}

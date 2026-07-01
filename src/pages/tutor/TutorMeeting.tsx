import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionById } from '@/services/sessions';
import { JitsiMeetingRoom } from '@/components/feature/JitsiMeetingRoom';
import { Video } from 'lucide-react';

export function TutorMeeting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId || !user) return;
    const fetchSession = async () => {
      setLoading(true);
      const data = await getSessionById(sessionId);
      if (!data) {
        setError('Session not found');
      } else if (data.tutor_id !== user.id) {
        setError('You are not authorized to start this session');
      } else if (!data.meeting_room_id) {
        setError('No meeting room associated with this session');
      } else {
        setSession(data);
      }
      setLoading(false);
    };
    fetchSession();
  }, [sessionId, user]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-[#111b21] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1099A1]"></div>
          <p className="text-[#aebac1] text-[14px]">Loading meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-[#111b21] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center px-6">
          <Video size={48} className="text-[#aebac1]" />
          <h2 className="text-[20px] font-bold text-white">{error}</h2>
          <button
            onClick={() => navigate('/tutor/sessions')}
            className="px-6 py-2 bg-[#1099A1] text-white rounded-lg font-semibold text-[14px] hover:opacity-90 transition-opacity"
          >
            Back to Sessions
          </button>
        </div>
      </div>
    );
  }

  return (
    <JitsiMeetingRoom
      roomName={session.meeting_room_id}
      userName={profile?.full_name || 'Tutor'}
      userEmail={user?.email}
      subject={session.subject}
      onMeetingEnd={() => navigate('/tutor/sessions')}
    />
  );
}

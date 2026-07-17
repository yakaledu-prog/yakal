import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getSessionById } from '@/services/sessions';
import { ZoomMeeting } from '@/components/feature/ZoomMeeting';
import { Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function TutorMeeting() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Depend on user.id (stable) rather than the user object: Supabase fires
  // auth events on every tab refocus, and a new user object identity here
  // would unmount the live meeting and force a rejoin.
  useEffect(() => {
    if (!sessionId || !user?.id) return;
    const fetchSession = async () => {
      setLoading(true);
      const data = await getSessionById(sessionId);
      if (!data) {
        setError('Session not found');
      } else if (data.tutor_id !== user.id) {
        setError('You are not authorized to host this session');
      } else {
        setSession(data);
      }
      setLoading(false);
    };
    fetchSession();
  }, [sessionId, user?.id]);

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
    <div className="flex flex-col h-screen w-full bg-white dark:bg-[#111b21]">
      {session.zoom_meeting_id ? (
        <ZoomMeeting
          meetingNumber={session.zoom_meeting_id}
          password={session.zoom_password}
          userName={profile?.full_name || 'Tutor'}
          userEmail={user?.email || ''}
          role={1}
          leaveUrl={`${window.location.origin}/tutor/sessions`}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#54656f] dark:text-[#aebac1]">
          <Video className="h-16 w-16 mb-4 opacity-50" />
          <h2 className="text-[20px] font-bold text-[#111] dark:text-white mb-2">No Zoom Meeting Found</h2>
          <p className="max-w-md mx-auto mb-6">
            This session doesn't have a Zoom meeting associated with it. It may have been created before Zoom integration.
          </p>
          <Button onClick={() => navigate('/tutor/sessions')} className="bg-[#1099A1] text-white hover:bg-[#0d7f86]">
            Return to Sessions
          </Button>
        </div>
      )}
    </div>
  );
}

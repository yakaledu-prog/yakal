export const generateZoomSignature = async (meetingNumber: string, role: 0 | 1) => {
  const res = await fetch('/api/zoom-signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingNumber, role }),
  });
  if (!res.ok) throw new Error('Failed to generate Zoom signature');
  const data = await res.json();
  return data.signature;
};

export const createZoomMeeting = async (topic: string, startTime: string, duration: number) => {
  const res = await fetch('/api/zoom-meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, startTime, duration }),
  });
  if (!res.ok) throw new Error('Failed to create Zoom meeting');
  return res.json();
};

export const updateZoomMeeting = async (meetingId: string, topic: string, startTime: string, duration: number) => {
  const res = await fetch('/api/zoom-meetings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, topic, startTime, duration }),
  });
  if (!res.ok) throw new Error('Failed to update Zoom meeting');
  return res.json();
};

export const deleteZoomMeeting = async (meetingId: string) => {
  const res = await fetch('/api/zoom-meetings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId }),
  });
  if (!res.ok) throw new Error('Failed to delete Zoom meeting');
  return res.json();
};

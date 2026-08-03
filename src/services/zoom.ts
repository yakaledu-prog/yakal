async function readError(res: Response, fallback: string) {
  let detail = '';
  try {
    const body = await res.json();
    detail = body?.error || JSON.stringify(body);
  } catch {
    detail = await res.text().catch(() => '');
  }
  return `${fallback} (HTTP ${res.status}${detail ? `: ${detail}` : ''})`;
}

export const generateZoomSignature = async (meetingNumber: string, role: 0 | 1) => {
  const res = await fetch('/api/zoom?action=signature', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingNumber, role }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to generate Zoom signature'));
  const data = await res.json();
  return data.signature;
};

export const createZoomMeeting = async (topic: string, startTime: string, duration: number) => {
  const res = await fetch('/api/zoom?action=meetings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, startTime, duration }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to create Zoom meeting'));
  return res.json();
};

export const updateZoomMeeting = async (meetingId: string, topic: string, startTime: string, duration: number) => {
  const res = await fetch('/api/zoom?action=meetings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId, topic, startTime, duration }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to update Zoom meeting'));
  return res.json();
};

export const deleteZoomMeeting = async (meetingId: string) => {
  const res = await fetch('/api/zoom?action=meetings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ meetingId }),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to delete Zoom meeting'));
  return res.json();
};

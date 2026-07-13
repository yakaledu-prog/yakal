export const CLASSROOM_BASE_URL = 'https://classroom.googleapis.com/v1';

/**
 * Exchange the authorization code for access and refresh tokens via our backend.
 */
export async function exchangeGoogleToken(code: string) {
  const res = await fetch('http://localhost:3001/api/google-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to exchange token');
  }
  
  return res.json();
}

export async function fetchCourses(accessToken: string) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses?courseStates=ACTIVE`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch courses');
  return res.json();
}

export async function fetchCourseWork(accessToken: string, courseId: string) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/courseWork`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch course work');
  return res.json();
}

export async function createCourseWork(accessToken: string, courseId: string, courseWork: any) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/courseWork`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(courseWork)
  });
  if (!res.ok) throw new Error('Failed to create assignment');
  return res.json();
}

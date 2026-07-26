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
  if (!res.ok) {
    let errorMsg = 'Failed to fetch course work';
    try {
      const errorData = await res.json();
      console.error("Google Classroom API Error:", errorData);
      errorMsg = errorData.error?.message || JSON.stringify(errorData);
    } catch (e) {
      errorMsg = `${res.status} ${res.statusText}`;
    }
    throw new Error(`API Error: ${errorMsg}`);
  }
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

export async function fetchAssignment(accessToken: string, courseId: string, courseWorkId: string) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch assignment details');
  return res.json();
}

export async function fetchSubmissions(accessToken: string, courseId: string, courseWorkId: string) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
}

export async function gradeSubmission(accessToken: string, courseId: string, courseWorkId: string, submissionId: string, draftGrade: number) {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}`, {
    method: 'PATCH',
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ draftGrade })
  });
  if (!res.ok) throw new Error('Failed to grade submission');
  return res.json();
}

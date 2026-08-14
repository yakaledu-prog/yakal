export const CLASSROOM_BASE_URL = 'https://classroom.googleapis.com/v1';

/**
 * Exchange the authorization code for access and refresh tokens via our backend.
 */
export async function exchangeGoogleToken(code: string) {
  const res = await fetch('/api/google?action=token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });
  
  if (!res.ok) {
    // The body is not always JSON. A function that crashed before its own
    // handler ran, or a route that did not match, answers with HTML, and
    // reading that as JSON threw away the only evidence of what happened.
    const raw = await res.text();
    let message = raw.slice(0, 200);
    try {
      message = (JSON.parse(raw) as { error?: string }).error ?? message;
    } catch {
      message = `${res.status} ${res.statusText}. The server did not answer with JSON: ${message}`;
    }
    throw new Error(message);
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
      const errorData = (await res.json()) as { error?: { message?: string } };
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

// ============================================================
// Classroom, in the shapes this app uses.
//
// The raw API answers with nested optionals and two different grade fields;
// everything below turns that into something a component can render without
// knowing any of it.
//
// Read only on purpose. Classroom is where work is written, turned in and
// marked, so the platform shows what is there and links out for the rest.
// ============================================================

export interface ClassroomAssignment {
  id: string;
  index: number;
  title: string;
  description: string | null;
  materials: { title: string; link: string | null }[];
  dueDate: string | null;
  maxPoints: number | null;
  link: string | null;
  /** The Classroom topic this work is filed under, or null for none. */
  topicId: string | null;
  /** This reader's own submission. All undefined for staff, who have none. */
  isSubmitted?: boolean;
  grade?: number | null;
  late?: boolean;
}

/** A Classroom topic: the class's own grouping of work into units. */
export interface ClassroomTopic {
  id: string;
  name: string;
}

export interface ClassroomSubmission {
  id: string;
  /** Classroom's own user id, which maps to a roster entry rather than a profile. */
  userId: string;
  state: string;
  isTurnedIn: boolean;
  grade: number | null;
  late: boolean;
  link: string | null;
  updatedAt: string | null;
}

export interface ClassroomStudent {
  userId: string;
  name: string;
  email: string | null;
  photoUrl: string | null;
}

/** A material can be a Drive file, a link, a video or a form. All become a name and a URL. */
function readMaterial(m: any): { title: string; link: string | null } {
  if (m.driveFile?.driveFile) {
    return { title: m.driveFile.driveFile.title ?? "Attachment", link: m.driveFile.driveFile.alternateLink ?? null };
  }
  if (m.link) return { title: m.link.title || m.link.url, link: m.link.url ?? null };
  if (m.youtubeVideo) return { title: m.youtubeVideo.title ?? "Video", link: m.youtubeVideo.alternateLink ?? null };
  if (m.form) return { title: m.form.title ?? "Form", link: m.form.formUrl ?? null };
  return { title: "Attachment", link: null };
}

/** Classroom sends a due date as three numbers rather than a date. */
function readDueDate(due: any): string | null {
  if (!due?.year || !due?.month || !due?.day) return null;
  return `${due.year}-${String(due.month).padStart(2, "0")}-${String(due.day).padStart(2, "0")}`;
}

export async function getCourseAssignments(
  accessToken: string,
  courseId: string
): Promise<ClassroomAssignment[]> {
  const data = (await fetchCourseWork(accessToken, courseId)) as { courseWork?: any[] };
  const work: any[] = data.courseWork ?? [];

  // Only what students can see. A draft is the tutor's business.
  return work
    .filter((w) => w.state === "PUBLISHED")
    .map((w, i) => ({
      id: w.id,
      index: i + 1,
      title: w.title ?? "Untitled",
      description: w.description ?? null,
      materials: (w.materials ?? []).map(readMaterial),
      dueDate: readDueDate(w.dueDate),
      maxPoints: typeof w.maxPoints === "number" ? w.maxPoints : null,
      link: w.alternateLink ?? null,
      topicId: w.topicId ? String(w.topicId) : null,
    }));
}

export async function getSubmissions(
  accessToken: string,
  courseId: string,
  courseWorkId: string
): Promise<ClassroomSubmission[]> {
  const data = (await fetchSubmissions(accessToken, courseId, courseWorkId)) as {
    studentSubmissions?: any[];
  };

  return (data.studentSubmissions ?? []).map((s: any) => ({
    id: s.id,
    userId: s.userId,
    state: s.state ?? "NEW",
    // TURNED_IN is waiting to be marked; RETURNED has been. Both were handed in.
    isTurnedIn: s.state === "TURNED_IN" || s.state === "RETURNED",
    // assignedGrade is the one the student can see. A draft grade is the
    // tutor's working note and showing it as a result would be a lie.
    grade: typeof s.assignedGrade === "number" ? s.assignedGrade : null,
    late: !!s.late,
    link: s.alternateLink ?? null,
    updatedAt: s.updateTime ?? null,
  }));
}

/** Everyone on the Classroom course, so a submission can be given a face. */
export async function getRoster(
  accessToken: string,
  courseId: string
): Promise<ClassroomStudent[]> {
  const res = await fetch(`${CLASSROOM_BASE_URL}/courses/${courseId}/students?pageSize=200`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch the class roster");

  const data = (await res.json()) as { students?: any[] };
  return (data.students ?? []).map((s: any) => ({
    userId: s.userId,
    name: s.profile?.name?.fullName ?? "Student",
    email: s.profile?.emailAddress ?? null,
    photoUrl: s.profile?.photoUrl ? `https:${s.profile.photoUrl}`.replace("https:https:", "https:") : null,
  }));
}

/**
 * The numeric course id hiding in a Classroom web URL.
 *
 * The web UI base64s it, so a pasted link carries something like /c/NzM0... and
 * the API wants the number inside.
 */
export function courseIdFromUrl(url: string): string | null {
  const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  try {
    const decoded = atob(match[1]);
    if (/^\d+$/.test(decoded)) return decoded;
  } catch {
    // Not base64. Some links carry the raw id already.
  }
  return match[1];
}

// The scopes and the storage key, shared so the course modal and the course
// page cannot ask Google for different things or look for the token in
// different places.

/** The scopes the Classroom calls in this file need. */
export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
].join(" ");

/** Where the browser keeps the Classroom token between visits. */
export const CLASSROOM_TOKEN_KEY = "google_classroom_token";

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
  const data = await fetchCourseWork(accessToken, courseId);
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
    }));
}

export async function getSubmissions(
  accessToken: string,
  courseId: string,
  courseWorkId: string
): Promise<ClassroomSubmission[]> {
  const data = await fetchSubmissions(accessToken, courseId, courseWorkId);

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

  const data = await res.json();
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

// ============================================================
// Reading a linked class.
//
// classroom-sync pushes one way, from this database up to Classroom, and
// writes the resulting page back to assignments.template_url. Nothing ever
// came the other way, so work written in Classroom itself, which is where a
// teacher actually writes it, existed nowhere the app could see. Linking a
// course showed a preview during creation and then dropped it.
// ============================================================

/** The scopes the Classroom calls in this file need. */
export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
].join(" ");

/** Where the browser keeps the Classroom token between visits. */
export const CLASSROOM_TOKEN_KEY = "google_classroom_token";

/**
 * The numeric course id inside a Classroom URL.
 *
 * The web app's /c/ segment is the numeric id in base64, but not always: an
 * id that does not decode to digits is already the id. Both shapes appear.
 */
export function extractCourseId(url: string): string | null {
  try {
    const match = url.match(/\/c\/([a-zA-Z0-9_-]+)/);
    const rawId = match ? match[1] : null;
    if (!rawId) return null;
    try {
      const decoded = atob(rawId);
      if (/^\d+$/.test(decoded)) return decoded;
    } catch {
      // Not base64. The raw segment is the id.
    }
    return rawId;
  } catch {
    return null;
  }
}

export interface ClassroomAssignment {
  id: string;
  index: number;
  title: string;
  description: string | null;
  materials: { title: string; link: string | null }[];
  dueDate: string | null;
  maxPoints: number | null;
  link: string | null;
}

/** Classroom sends a due date as parts, and omits it entirely when there is none. */
function toIsoDate(due?: { year?: number; month?: number; day?: number }): string | null {
  if (!due?.year || !due?.month || !due?.day) return null;
  return `${due.year}-${String(due.month).padStart(2, "0")}-${String(due.day).padStart(2, "0")}`;
}

/**
 * A material's title and link, whichever of the five kinds it is.
 *
 * Classroom wraps each in a differently named object and only one is present,
 * so this reads whichever turned up rather than assuming a shape.
 */
function toMaterial(m: any): { title: string; link: string | null } {
  const inner = m?.driveFile?.driveFile ?? m?.youtubeVideo ?? m?.link ?? m?.form;
  return {
    title: inner?.title ?? inner?.url ?? "Attachment",
    link: inner?.alternateLink ?? inner?.url ?? null,
  };
}

/** The work set in a linked class, in the shape AssignmentList draws. */
export async function getClassroomAssignments(
  accessToken: string,
  classroomCourseId: string
): Promise<ClassroomAssignment[]> {
  const res = await fetchCourseWork(accessToken, classroomCourseId);
  const work: any[] = Array.isArray(res?.courseWork) ? res.courseWork : [];

  return work
    .map((cw) => ({
      id: String(cw.id),
      index: 0,
      title: cw.title ?? "Untitled",
      description: cw.description ?? null,
      materials: Array.isArray(cw.materials) ? cw.materials.map(toMaterial) : [],
      dueDate: toIsoDate(cw.dueDate),
      maxPoints: typeof cw.maxPoints === "number" ? cw.maxPoints : null,
      link: cw.alternateLink ?? null,
    }))
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return a.title.localeCompare(b.title);
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .map((a, i) => ({ ...a, index: i + 1 }));
}

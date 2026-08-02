import { useCallback, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { toast } from "sonner";

import { exchangeGoogleToken } from "@/services/classroomService";

// ============================================================
// The Google token that lets this browser read Classroom.
//
// It is per person and per browser, because the platform's own Google
// credentials carry only drive.file: no Classroom scope, so there is no way to
// read a class from the server. Everyone who wants to see assignments connects
// their own account once, and the token is kept in localStorage until Google
// stops accepting it.
//
// The scopes are read only apart from coursework.students, which Classroom
// requires even to list what a teacher's students turned in.
// ============================================================

const STORAGE_KEY = "google_classroom_token";

const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.students",
  "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
].join(" ");

export function useClassroomToken() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  const connect = useGoogleLogin({
    flow: "auth-code",
    scope: SCOPES,
    onSuccess: async ({ code }) => {
      try {
        const data = await exchangeGoogleToken(code);
        localStorage.setItem(STORAGE_KEY, data.access_token);
        setToken(data.access_token);
      } catch (err: any) {
        toast.error(err.message || "Could not connect to Google Classroom.");
      }
    },
    onError: () => toast.error("Google sign in was cancelled."),
  });

  return { token, connect, clear };
}

/**
 * An expired token looks like a broken page unless it is caught.
 *
 * Google's answer to a stale token is a 401, and the only fix is connecting
 * again, so this turns that one case into something the caller can act on.
 */
export function isAuthError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /401|UNAUTHENTICATED|invalid credentials|insufficient authentication/i.test(message);
}

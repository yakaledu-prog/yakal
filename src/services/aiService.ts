import { authedPost } from "@/lib/authedFetch";

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Ask the roadmap assistant.
 *
 * Only the message and the recent turns go up. Everything the assistant knows
 * about the student is read on the server from the database, so the browser
 * cannot widen the context by editing a request, and a parent asking about a
 * child is checked against parent_student_links there.
 *
 * Through authedPost rather than a plain fetch, so it inherits the token
 * refresh and the single 401 retry. A tab left open over lunch holds an
 * expired token, and this is exactly the kind of screen somebody comes back to.
 */
export async function askRoadmapAssistant(
  message: string,
  history: ChatTurn[],
  studentId?: string
): Promise<{ reply?: string; error?: string }> {
  return authedPost<{ reply?: string }>("/api/ai?action=roadmap", {
    message,
    history,
    studentId,
  });
}

import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  MessageCircleReply,
  UserPen,
} from "lucide-react";

import { cn } from "@/utils/cn";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Skeleton } from "@/components/ui/Skeleton";
import { GoogleDocsIcon } from "@/components/ui/GoogleDocsIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useSetBreadcrumb } from "@/contexts/BreadcrumbContext";
import { ApplicationLogo, CollegeLogo } from "@/components/college/CollegeLogo";
import { ReviewStamp } from "@/components/college/ReviewStamp";
import { loadCatalog } from "@/services/collegeCatalogService";
import { CURRENT_CYCLE, getUniversalPrompts } from "@/services/collegeCycleService";
import {
  Essay,
  EssayStatus,
  getEssay,
  getSchool,
  getStudentIdentity,
  updateEssay,
} from "@/services/collegeService";
import {
  CommentThread,
  addComment,
  createEssayDoc,
  fileIdFromUrl,
  getComments,
  getEssayDoc,
  replyToComment,
} from "@/services/driveService";
import { getEssayReviews } from "@/services/essayReviewService";

// ============================================================
// One essay, with the draft and the conversation about it side by side.
//
// Before this, an essay was a row that expanded to show its prompt, and every
// actual act of writing or reviewing happened in a Google Doc in another tab.
// The pieces a student needs at once, the question, the draft, the word count
// and what their counselor said, were in three places and one of them was
// somebody else's product.
//
// The draft is exported from Drive rather than iframed. Docs has no embeddable
// editor: smart canvas is a feature of the Docs editor, not an SDK, and the
// only framable view authenticates the *viewer*, which our Drive design
// deliberately avoids so that students never sign in to Google. Exporting
// server-side works for everyone under our own access rules. The cost is that
// this is a snapshot, so the page says when it was taken and gets out of the
// way of the real Doc for editing.
// ============================================================

function timeOf(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function dayOf(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? timeOf(iso)
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function EssayWorkspace() {
  const { essayId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const role = profile?.role ?? "student";
  const isCounselor = role === "counselor" || role === "admin";

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const { data: essay, isLoading } = useQuery({
    queryKey: ["essay", essayId],
    queryFn: () => getEssay(essayId!),
    enabled: !!essayId,
  });

  // The breadcrumb is built from path segments, and a uuid is filtered out for
  // being one, so the trail would end at "Essay" with nothing after it.
  useSetBreadcrumb(essayId, essay?.title);

  const fileId = fileIdFromUrl(essay?.drive_url);

  /**
   * The student this essay belongs to, who is not always the person reading it.
   *
   * The Doc is created in their folder, named after them and shared with them.
   * This used to read the signed-in user, so a counselor pressing Create doc
   * filed a student's essay in a folder named after the counselor and shared
   * it with the counselor's own address.
   */
  const { data: owner } = useQuery({
    queryKey: ["student-identity", essay?.student_id],
    queryFn: () => getStudentIdentity(essay!.student_id),
    enabled: !!essay?.student_id,
    staleTime: 5 * 60_000,
  });

  const { data: school } = useQuery({
    queryKey: ["college-list-item", essay?.college_list_item_id],
    queryFn: () => getSchool(essay!.college_list_item_id!),
    enabled: !!essay?.college_list_item_id,
  });

  const { data: catalog = [] } = useQuery({
    queryKey: ["college-catalog"],
    queryFn: loadCatalog,
    staleTime: Infinity,
  });

  const college = useMemo(
    () => (school?.unitid ? catalog.find((c) => c.unitid === school.unitid) ?? null : null),
    [catalog, school]
  );

  // A personal statement has no college, so it wears the mark of the
  // application that asks for it. Without this every one of them fell back to
  // a letter in a box, which is the thing crests were meant to replace.
  const { data: universal = [] } = useQuery({
    queryKey: ["essay-prompts-universal", CURRENT_CYCLE],
    queryFn: () => getUniversalPrompts(),
  });
  const appKey =
    universal.find((p) => p.id === essay?.essay_prompt_id)?.app_key ?? null;

  const {
    data: doc,
    isLoading: loadingDoc,
    isFetching: refetchingDoc,
    error: docError,
    refetch: refetchDoc,
  } = useQuery({
    queryKey: ["essay-doc", fileId],
    queryFn: () => getEssayDoc(fileId!),
    enabled: !!fileId,
  });

  const { data: threads = [], isLoading: loadingComments } = useQuery({
    queryKey: ["essay-comments", fileId],
    queryFn: () => getComments(fileId!),
    enabled: !!fileId,
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["essay-reviews", essayId],
    queryFn: () => getEssayReviews(essayId!),
    enabled: !!essayId,
  });

  const refreshComments = () =>
    qc.invalidateQueries({ queryKey: ["essay-comments", fileId] });

  const post = useMutation({
    mutationFn: (content: string) =>
      addComment(fileId!, content, profile?.full_name ?? null),
    onSuccess: () => {
      setDraft("");
      void refreshComments();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not post that comment."),
  });

  const reply = useMutation({
    mutationFn: (args: { commentId: string; content?: string; resolve?: boolean; reopen?: boolean }) =>
      replyToComment({
        fileId: fileId!,
        authorName: profile?.full_name ?? null,
        ...args,
      }),
    onSuccess: () => {
      setReplyTo(null);
      setReplyText("");
      void refreshComments();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not send that."),
  });

  const setStatus = useMutation({
    mutationFn: (status: EssayStatus) => updateEssay(essayId!, { status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["essay", essayId] }),
  });

  const makeDoc = useMutation({
    mutationFn: async (e: Essay) => {
      const { file } = await createEssayDoc({
        studentId: e.student_id,
        studentName: owner?.full_name || "Student",
        title: e.title,
        studentEmail: owner?.email ?? undefined,
      });
      return updateEssay(e.id, {
        drive_url: file.webViewLink ?? null,
        status: e.status === "todo" ? "drafting" : e.status,
      });
    },
    onSuccess: () => {
      toast.success("Google Doc created.");
      void qc.invalidateQueries({ queryKey: ["essay", essayId] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not create the doc."),
  });

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="space-y-4 p-6 md:p-10">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-[60vh] w-full rounded-lg" />
        </div>
      </PageWrapper>
    );
  }

  if (!essay) {
    return (
      <PageWrapper>
        <div className="p-10 text-center">
          <p className="text-base font-medium text-foreground">That essay is not here</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or it belongs to someone else.
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-5 h-10 rounded-md border border-border/60 px-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Go back
          </button>
        </div>
      </PageWrapper>
    );
  }

  const limit = essay.word_limit ?? null;
  const words = doc?.words ?? null;
  const over = limit !== null && words !== null && words > limit;

  /**
   * How close the draft is to the ceiling the college enforces.
   *
   * Red past it, because an essay over the limit will be cut by the form
   * rather than by the writer. Gold in the last tenth, which is the point at
   * which a student should stop adding and start choosing.
   */
  const countTone =
    limit === null || words === null
      ? ""
      : over
        ? "font-medium text-destructive"
        : words >= limit * 0.9
          ? "font-medium text-secondary"
          : "";
  const notes = reviews.filter((r) => r.note);

  const open = threads.filter((t) => !t.resolved);
  const settled = threads.filter((t) => t.resolved);
  const visibleThreads = showResolved ? threads : open;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {/* ---- who and what ---- */}
        <header className="shrink-0 border-b border-border/50 bg-card px-4 py-4 md:px-8">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft size={15} />
            Back
          </button>

          <div className="flex flex-wrap items-start gap-4">
            {school?.unitid || college ? (
              <CollegeLogo
                name={school?.school_name ?? essay.title}
                logo={college?.logo ?? null}
                website={college?.website ?? null}
                size={44}
              />
            ) : (
              <ApplicationLogo
                appKey={appKey ?? "common_app"}
                name={essay.title}
                size={44}
              />
            )}

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-medium text-foreground">{essay.title}</h1>
              {/* No status word here. The buttons to the right already say
                  whose turn it is, and the stamp says it again for a student;
                  a third telling was three ways to read the same fact. */}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                <span>
                  {school?.school_name ??
                    (essay.kind === "supplement" ? "No college attached" : "Every college")}
                </span>
                {words !== null && (
                  <span className={cn("tabular-nums", countTone)}>
                    {limit === null ? `${words} words` : `${words} of ${limit} words`}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Only what this essay can do next. A dropdown of every status
                  let a student mark a draft finished before it existed. */}
              {!essay.drive_url && (
                <button
                  type="button"
                  onClick={() => makeDoc.mutate(essay)}
                  disabled={makeDoc.isPending}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  {makeDoc.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <FileText size={15} />
                  )}
                  Create the doc
                </button>
              )}

              {/* The student hands it over; a counselor does not hand it to
                  themselves. */}
              {!isCounselor && essay.drive_url && essay.status !== "in_review" && essay.status !== "done" && (
                <button
                  type="button"
                  onClick={() => setStatus.mutate("in_review")}
                  disabled={setStatus.isPending}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                >
                  <UserPen size={15} />
                  Ask for review
                </button>
              )}

              {essay.status === "in_review" && isCounselor && (
                <>
                  {/* Gold, the colour this essay is already wearing while it
                      waits. Sending it back is not a lesser version of marking
                      it finished, it is the other answer, and a grey outline
                      beside a filled teal button read as the one you press
                      when you do not know what to do. */}
                  <button
                    type="button"
                    onClick={() => setStatus.mutate("drafting")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition-opacity hover:opacity-90"
                  >
                    Send it back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus.mutate("done")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    <Check size={15} />
                    Mark as done
                  </button>
                </>
              )}

              {essay.status === "in_review" && !isCounselor && (
                <ReviewStamp className="mx-1" />
              )}

              {essay.status === "done" && (
                <button
                  type="button"
                  onClick={() => setStatus.mutate("drafting")}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border/60 px-3.5 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  Reopen it
                </button>
              )}

              {essay.drive_url && (
                <a
                  href={essay.drive_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border/60 px-3.5 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <GoogleDocsIcon />
                  Open in Google Docs
                  <ExternalLink size={13} className="text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Two panes that scroll independently. The comments are a pane rather
            than a card in the flow: a counselor reads down the draft with the
            conversation beside it, and a right column that scrolled away with
            the text put them back to scrolling twice. */}
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-w-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-8">
            {essay.prompt && (
              <div className="rounded-md border border-border/60 bg-card p-4">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  The question
                </p>
                <p className="text-sm leading-relaxed text-foreground">{essay.prompt}</p>
              </div>
            )}

            {!essay.drive_url ? (
              <div className="rounded-md border border-dashed border-border/60 py-20 text-center">
                <p className="text-base font-medium text-foreground">No document yet</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                  Create it and Yakal makes a Google Doc in this student's folder that the
                  counselor can already comment on.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border/60 bg-card">
                <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2">
                  <p className="truncate text-xs text-muted-foreground">
                    {loadingDoc
                      ? "Loading"
                      : doc
                        ? `Synced ${timeOf(doc.fetchedAt)}`
                        : "Could not load the draft"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetchDoc()}
                    disabled={refetchingDoc}
                    className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={cn(refetchingDoc && "animate-spin")} />
                    Refresh
                  </button>
                </div>

                {loadingDoc ? (
                  <div className="space-y-3 p-6">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : docError ? (
                  <p className="px-6 py-16 text-center text-sm text-muted-foreground">
                    {docError instanceof Error ? docError.message : "Could not load the draft."}
                  </p>
                ) : doc && doc.words === 0 ? (
                  <p className="px-6 py-20 text-center text-sm text-muted-foreground">
                    The document is empty. Open it in Google Docs and start writing.
                  </p>
                ) : (
                  // Google's own inline styles carry the formatting, so this
                  // only sets the reading measure and colour. The HTML was
                  // stripped server side; see api/_handlers/drive.ts.
                  <div
                    className="essay-doc px-5 py-5 text-[15px] leading-relaxed text-foreground hyphens-auto text-justify md:px-8"
                    dangerouslySetInnerHTML={{ __html: doc?.html ?? "" }}
                  />
                )}
              </div>
            )}

            {notes.length > 0 && (
              <div className="rounded-md border border-border/60 bg-card p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                  Review history
                </p>
                <div className="space-y-3">
                  {notes.map((r) => (
                    <div key={r.id}>
                      <p className="text-xs text-muted-foreground">
                        {r.counselorName ?? "Your counsellor"}
                        {" · "}
                        {r.action === "approved" ? "finished it" : "sent it back"}
                        {" · "}
                        {dayOf(r.createdAt)}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{r.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ---- the conversation ---- */}
          <aside className="flex w-full shrink-0 flex-col border-t border-border/50 bg-card md:h-full md:w-[380px] md:border-l md:border-t-0">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-4 py-3.5">
              <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                Comments
                {open.length > 0 && (
                  <span className="text-xs text-muted-foreground">{open.length}</span>
                )}
              </h2>
              {settled.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowResolved((v) => !v)}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showResolved ? "Hide resolved" : `Resolved (${settled.length})`}
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {!fileId ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  Comments appear once there is a document to comment on.
                </p>
              ) : loadingComments ? (
                <div className="space-y-3 p-4">
                  <Skeleton className="h-16 w-full rounded" />
                  <Skeleton className="h-16 w-full rounded" />
                </div>
              ) : visibleThreads.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">
                  {threads.length === 0
                    ? "Nothing yet. Comments left in the Doc show up here too."
                    : "Everything here is resolved."}
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {visibleThreads.map((t) => (
                    <Thread
                      key={t.id}
                      thread={t}
                      replying={replyTo === t.id}
                      replyText={replyText}
                      busy={reply.isPending}
                      onReplyText={setReplyText}
                      onStartReply={() => {
                        setReplyTo(t.id);
                        setReplyText("");
                      }}
                      onCancelReply={() => setReplyTo(null)}
                      onSend={() =>
                        reply.mutate({ commentId: t.id, content: replyText.trim() })
                      }
                      onResolve={() =>
                        reply.mutate({
                          commentId: t.id,
                          resolve: !t.resolved,
                          reopen: t.resolved,
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </div>

            {fileId && (
              // The support launcher is fixed at bottom-right and lands on
              // top of this pane, so the last 80px of it are not clickable.
              <div className="shrink-0 border-t border-border/50 p-3 md:pb-20">
                {/* One field, with the action inside it. Two boxes stacked on
                    top of each other made the pane look like a form. */}
                <div className="rounded-md border border-border/60 bg-background transition-colors focus-within:border-primary">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    placeholder={
                      isCounselor
                        ? "Leave a note on this draft"
                        : "Ask your counselor about something"
                    }
                    className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-end px-2 pb-2">
                    <button
                      type="button"
                      onClick={() => post.mutate(draft.trim())}
                      disabled={!draft.trim() || post.isPending}
                      className="inline-flex h-8 items-center gap-1 rounded-md bg-primary pl-2.5 pr-3 text-[13px] font-medium leading-none text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                      {post.isPending ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <MessageCircleReply size={14} />
                      )}
                      Comment
                    </button>
                  </div>
                </div>
                {/* Said plainly, because it is visible in the Doc and would
                    otherwise look like the counselor's account was wrong. */}
                <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
                  Posts to the Doc under Yakal, signed with your name.
                </p>
              </div>
            )}
          </aside>
        </div>
    </div>
  );
}

function Thread({
  thread,
  replying,
  replyText,
  busy,
  onReplyText,
  onStartReply,
  onCancelReply,
  onSend,
  onResolve,
}: {
  thread: CommentThread;
  replying: boolean;
  replyText: string;
  busy: boolean;
  onReplyText: (v: string) => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onSend: () => void;
  onResolve: () => void;
}) {
  return (
    <li className={cn("px-4 py-3.5", thread.resolved && "opacity-60")}>
      {/* The sentence being talked about. Docs records it with the comment,
          and without it a note like "cut this" means nothing out of context. */}
      {thread.quoted && (
        <p className="mb-2 border-l-2 border-secondary pl-2.5 text-xs italic leading-relaxed text-muted-foreground">
          {thread.quoted}
        </p>
      )}

      {/* Whoever said it, in colour. A thread is two or three people talking
          and the name is the thing you scan for; grey on grey made every entry
          look like the same voice. The reply's rule down the side is what
          separates the sides now. */}
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-primary">{thread.author}</span>
        {" · "}
        {dayOf(thread.createdTime)}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {thread.content}
      </p>

      {/* A reply is the other side of the conversation, and at a glance a
          thread should read as two voices rather than four paragraphs. */}
      {thread.replies.length > 0 && (
        <ul className="mt-2.5 space-y-2 border-l-2 border-primary/40 pl-3">
          {thread.replies.map((r) => (
            <li key={r.id}>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-primary">{r.author}</span>
                {" · "}
                {dayOf(r.createdTime)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {r.content}
              </p>
            </li>
          ))}
        </ul>
      )}

      {replying ? (
        <div className="mt-2.5">
          <textarea
            autoFocus
            value={replyText}
            onChange={(e) => onReplyText(e.target.value)}
            rows={2}
            placeholder="Reply"
            className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onSend}
              disabled={!replyText.trim() || busy}
              className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              Reply
            </button>
            <button
              type="button"
              onClick={onCancelReply}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onStartReply}
            className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            Reply
          </button>
          <button
            type="button"
            onClick={onResolve}
            disabled={busy}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {thread.resolved ? "Reopen" : "Resolve"}
          </button>
        </div>
      )}
    </li>
  );
}

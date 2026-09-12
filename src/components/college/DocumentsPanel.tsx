import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowUpDown,
  Download,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  MoreVertical,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import {
  DriveFile,
  DriveListing,
  ReviewVerdict,
  deleteDocument,
  isConfigured,
  listDocuments,
  reviewDocument,
  uploadDocument,
} from "@/services/driveService";
import {
  SENDER_LINK_LABEL,
  SENDER_NOTE,
  SLOT_GROUPS,
  Slot,
} from "@/services/documentSlots";
import { Dropdown } from "@/components/ui/Dropdown";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VerifiedBadge } from "./VerifiedBadge";

type ViewMode = "grid" | "list";
type SortKey = "suggested" | "name" | "recent" | "missing";

/** Remembered per browser: a counselor who prefers grid wants it every time. */
const VIEW_KEY = "yakal.documents.view";

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: "grid", label: "Grid view" },
  { id: "list", label: "List view" },
];

const SORTS: { value: SortKey; label: string }[] = [
  // The order the groups are declared in, which is the order a student is
  // asked for them. Anything else is a way of finding one thing.
  { value: "suggested", label: "Suggested" },
  { value: "missing", label: "Missing first" },
  { value: "name", label: "Name" },
  { value: "recent", label: "Recently updated" },
];

const TAGS: { id: string; label: string }[] = [
  { id: "all", label: "All" },
  ...SLOT_GROUPS.map((g) => ({ id: g.key, label: g.title })),
];

/** The icon answers "what kind of file is this", which no badge should. */
function fileIcon(mimeType?: string) {
  if (!mimeType) return FileText;
  if (mimeType.startsWith("image/")) return FileImage;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  return FileText;
}

function prettySize(bytes?: string) {
  if (!bytes) return null;
  const n = Number(bytes);
  if (!n) return null;
  return n < 1024 * 1024
    ? `${Math.round(n / 1024)} KB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsPanel({
  studentId,
  studentName,
  studentEmail,
  canReview = false,
  canUpload = true,
  reviewerId,
}: {
  studentId: string;
  studentName: string;
  /** Shared onto the student's folder so Open in Drive needs no access request. */
  studentEmail?: string | null;
  /** Counselors get the verdict controls. Students only see the outcome. */
  canReview?: boolean;
  /**
   * Off for staff. Every slot here is the student's own record, a transcript,
   * a score report, a resume, so a counselor has no copy to add and no
   * business holding one. They review what is there.
   */
  canUpload?: boolean;
  reviewerId?: string | null;
}) {
  const qc = useQueryClient();
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // List by default. Eleven slots is a list of things to get through, and the
  // cards spend most of the year empty, so the grid was two columns of mostly
  // description. Grid is one click away and remembered once chosen.
  const [view, setView] = useState<ViewMode>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === "list" || v === "grid" ? v : "list";
    } catch {
      return "list";
    }
  });
  const [sort, setSort] = useState<SortKey>("suggested");
  const [group, setGroup] = useState<string>("all");
  // The review a counselor is in the middle of. Both verdicts ask for a note
  // rather than only the flag: a separate "leave a note" action was a third
  // way to say the same thing, and "verified, and here is why" is worth as
  // much to a student as "flagged, and here is why". The note stays optional.
  const [reviewing, setReviewing] = useState<
    { file: DriveFile; verdict: ReviewVerdict } | null
  >(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["drive-docs", studentId],
    queryFn: () => listDocuments(studentId, studentName, studentEmail),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: ({ slot, file }: { slot: Slot; file: File }) =>
      uploadDocument(studentId, studentName, slot.section, file, studentEmail, slot.id),
    onSuccess: (res, v) => {
      toast.success(`${v.file.name} uploaded.`);

      // Drop the new file straight into the cache rather than refetching.
      // A refetch walks the whole tree, roughly ten Drive calls, so the slot
      // sat showing its empty Upload state for seconds after the toast said
      // the file had arrived.
      qc.setQueryData<DriveListing>(["drive-docs", studentId], (prev) =>
        prev
          ? {
            ...prev,
            sections: prev.sections.map((sec) =>
              sec.name === v.slot.section
                ? { ...sec, files: [res.file, ...sec.files] }
                : sec
            ),
          }
          : prev
      );

      // Reconcile in the background, so anything the server normalised wins.
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusySlot(null),
  });

  const review = useMutation({
    mutationFn: ({ file, verdict, note }: { file: DriveFile; verdict: ReviewVerdict; note?: string }) =>
      reviewDocument({ fileId: file.id, verdict, reviewerId, note }),

    /**
     * Paint the verdict before the round trip, the way upload already does.
     *
     * Invalidating alone left the card on its old colour for seconds: the
     * refetch walks the whole Drive tree, roughly ten calls, so a counselor
     * marked a transcript verified, got "Review saved", and watched it sit
     * there red. Rolled back if the write fails, and reconciled either way.
     */
    onMutate: async ({ file, verdict, note }) => {
      await qc.cancelQueries({ queryKey: ["drive-docs", studentId] });
      const previous = qc.getQueryData<DriveListing>(["drive-docs", studentId]);

      const patch = (f: DriveFile): DriveFile =>
        f.id === file.id
          ? {
            ...f,
            appProperties: {
              ...f.appProperties,
              review: verdict,
              reviewedBy: reviewerId ?? "",
              reviewedAt: new Date().toISOString(),
              // The server writes an empty string when there is no note, so a
              // file verified after being flagged loses the old reason. Match
              // that here, or the stale complaint stays on screen.
              reviewNote: note || "",
            },
          }
          : f;

      qc.setQueryData<DriveListing>(["drive-docs", studentId], (prev) =>
        prev
          ? {
            ...prev,
            loose: prev.loose.map(patch),
            sections: prev.sections.map((sec) => ({
              ...sec,
              files: sec.files.map(patch),
            })),
          }
          : prev
      );

      return { previous };
    },

    onSuccess: () => toast.success("Review saved."),
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(["drive-docs", studentId], ctx.previous);
      }
      toast.error(e.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["drive-docs", studentId] }),
  });

  /** Held between asking and confirming, so the dialog knows what it is about. */
  const [pendingDelete, setPendingDelete] = useState<DriveFile | null>(null);

  const remove = useMutation({
    mutationFn: (f: DriveFile) => deleteDocument(f.id),
    onSuccess: (_d, f) => {
      toast.success(`${f.name} moved to trash.`);

      // Same reason as upload: a refetch walks the whole tree, so the row
      // lingered on screen well after the toast said it was gone.
      qc.setQueryData<DriveListing>(["drive-docs", studentId], (prev) =>
        prev
          ? {
              ...prev,
              loose: prev.loose.filter((x) => x.id !== f.id),
              sections: prev.sections.map((sec) => ({
                ...sec,
                files: sec.files.filter((x) => x.id !== f.id),
              })),
            }
          : prev
      );
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPendingDelete(null),
  });

  /**
   * Files grouped by the slot they were uploaded into.
   *
   * A file with no slot was dropped into Drive by hand or predates this model.
   * It used to get its own "Not filed" section at the bottom, which was a
   * second place to look for the same thing and taught nobody anything. It is
   * filed by the Drive folder it is sitting in instead: the folder is the
   * section, and every section has a slot that accepts more than one file.
   */
  const { bySlot } = useMemo(() => {
    const bySlot = new Map<string, DriveFile[]>();
    const fallback: Record<string, string> = {
      Transcripts: "transcript_previous",
      "Test scores": "score_ap",
      Other: "extra_awards",
    };
    const add = (slot: string, f: DriveFile) =>
      bySlot.set(slot, [...(bySlot.get(slot) ?? []), f]);

    for (const sec of data?.sections ?? []) {
      // Essay drafts are not application documents. They have their own tab,
      // their own workspace and their own review flow, and they were only ever
      // on this page because the old "Not filed" bucket swept up anything
      // without a slot. Filed by folder instead, four drafts turned up under
      // "Awards and certificates", which is worse than the bucket was.
      if (sec.name === "Essays") continue;
      for (const f of sec.files) {
        add(f.appProperties?.slot || fallback[sec.name] || "extra_awards", f);
      }
    }
    for (const f of data?.loose ?? []) {
      if (!f.appProperties?.slot && f.mimeType === "application/vnd.google-apps.document") {
        continue;
      }
      add(f.appProperties?.slot || "extra_awards", f);
    }
    return { bySlot };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  // Missing server configuration is a deployment state, not a user error, so it
  // gets a different message from a genuine failure.
  if (error) {
    const setupNeeded = !isConfigured(error);
    return (
      <div className="rounded-xl border border-[#e9edef] p-6 dark:border-[#2a3942]">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-secondary" />
          <div>
            <p className="text-[14px] text-[#111] dark:text-white">
              {setupNeeded ? "Document storage is not set up yet" : "Could not load documents"}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#717182]">
              {setupNeeded
                ? "Run node scripts/google-oauth-setup.mjs to connect the Yakal Drive account, then restart the dev server."
                : (error as Error).message}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const latest = (sl: Slot) =>
    Math.max(
      0,
      ...(bySlot.get(sl.id) ?? []).map((f) =>
        f.modifiedTime ? Date.parse(f.modifiedTime) : 0
      )
    );

  const groups = SLOT_GROUPS
    .filter((g) => group === "all" || g.key === group)
    .map((g) => {
      const slots = q
        ? g.slots.filter(
            (sl) =>
              sl.label.toLowerCase().includes(q) ||
              sl.description.toLowerCase().includes(q) ||
              (bySlot.get(sl.id) ?? []).some((f) =>
                String(f.name ?? "").toLowerCase().includes(q)
              )
          )
        : g.slots;

      const ordered = [...slots];
      if (sort === "name") ordered.sort((a, b) => a.label.localeCompare(b.label));
      // Empty first, and required ahead of optional inside that, which is the
      // order somebody catching up actually works in.
      if (sort === "missing") {
        const weight = (sl: Slot) =>
          ((bySlot.get(sl.id)?.length ?? 0) > 0 ? 2 : 0) + (sl.required ? 0 : 1);
        ordered.sort((a, b) => weight(a) - weight(b));
      }
      if (sort === "recent") ordered.sort((a, b) => latest(b) - latest(a));
      return { ...g, slots: ordered };
    })
    .filter((g) => g.slots.length > 0);

  const allSlots = SLOT_GROUPS.flatMap((g) => g.slots);
  const requiredSlots = allSlots.filter((s) => s.required);
  const done = requiredSlots.filter((s) => (bySlot.get(s.id)?.length ?? 0) > 0).length;

  const changeView = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      // A browser refusing storage is not a reason to refuse the click.
    }
  };

  return (
    <div className="space-y-6">
      {/* Row one is the field and the two controls that change how it is
          drawn. Row two is what is being shown and how much of it is done,
          which is the answer to a different question and belongs on its own
          line. */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8adb8]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search documents"
              className="h-9 w-full rounded-xl border border-[#e9edef] bg-white pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-primary dark:border-[#2a3942] dark:bg-[#182229]"
            />
          </div>

          <Dropdown<SortKey>
            value={sort}
            onChange={setSort}
            options={SORTS}
            size="sm"
            align="end"
            icon={<ArrowUpDown size={15} />}
            ariaLabel="Sort documents"
            buttonClassName="h-9 rounded-xl font-normal"
          />

          {/* One control, two states, the way Drive does it. */}
          <div className="flex h-9 shrink-0 items-center rounded-xl border border-[#e9edef] p-0.5 dark:border-[#2a3942]">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => changeView(v.id)}
                aria-label={v.label}
                aria-pressed={view === v.id}
                className={cn(
                  "grid h-8 w-8 place-items-center rounded-[10px] transition-colors",
                  view === v.id
                    ? "bg-[#f3f3f5] text-[#111] dark:bg-[#1c2a32] dark:text-white"
                    : "text-[#a8adb8] hover:text-[#54656f] dark:hover:text-[#aebac1]"
                )}
              >
                {v.id === "grid" ? <LayoutGrid size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
          {TAGS.map((t) => {
            const on = group === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setGroup(t.id)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                  on
                    ? "border-primary/40 bg-primary/10 font-medium text-primary"
                    : "border-[#e9edef] text-[#54656f] hover:bg-[#f3f3f5] dark:border-[#2a3942] dark:text-[#aebac1] dark:hover:bg-[#1c2a32]"
                )}
              >
                {t.label}
              </button>
            );
          })}

          <span className="ml-auto flex shrink-0 items-center gap-3 text-[13px] text-[#a8adb8]">
            <span className="tabular-nums">
              {done} of {requiredSlots.length} essentials
            </span>
            {data?.folderUrl && (
              <a
                href={data.folderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
              >
                Open in Drive
                <ExternalLink size={12} />
              </a>
            )}
          </span>
        </div>
      </div>

      {groups.map((group) => (
        <SlotGroupSection
          key={group.key}
          title={group.title}
          slots={group.slots}
          view={view}
          bySlot={bySlot}
          busySlot={busySlot}
          canReview={canReview}
          canUpload={canUpload}
          onFile={(slot, file) => {
            setBusySlot(slot.id);
            upload.mutate({ slot, file });
          }}
          onRemove={setPendingDelete}
          onReview={(file, verdict) => setReviewing({ file, verdict })}
          removingId={remove.isPending ? remove.variables?.id : undefined}
        />
      ))}

      <NoteDialog
        pending={reviewing}
        busy={review.isPending}
        onCancel={() => setReviewing(null)}
        onSubmit={(text) => {
          if (!reviewing) return;
          review.mutate({ ...reviewing, note: text });
          setReviewing(null);
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this file?"
        message={
          <>
            <span className="font-medium text-[#111] dark:text-white">
              {pendingDelete?.name}
            </span>{" "}
            moves to your Drive trash, where it stays recoverable for 30 days.
            Your counselor will no longer see it here.
          </>
        }
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />

    </div>
  );
}

function SlotGroupSection({
  title,
  slots,
  view,
  bySlot,
  busySlot,
  canReview,
  canUpload,
  onFile,
  onRemove,
  onReview,
  removingId,
}: {
  title: string;
  slots: Slot[];
  view: ViewMode;
  bySlot: Map<string, DriveFile[]>;
  busySlot: string | null;
  canReview: boolean;
  canUpload: boolean;
  onFile: (slot: Slot, file: File) => void;
  onRemove: (f: DriveFile) => void;
  onReview: (f: DriveFile, verdict: ReviewVerdict) => void;
  removingId?: string;
}) {
  return (
    <section>
      <h3 className="mb-2.5 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
        {title}
      </h3>
      {/* Two columns in grid: slots are short and mostly empty early on, so one
          tall column would read as a longer to-do list than it really is. List
          gives one row each, for scanning names rather than working through. */}
      <div className={cn(view === "grid" ? "grid gap-3 lg:grid-cols-2" : "space-y-1.5")}>
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
            view={view}
            files={bySlot.get(slot.id) ?? []}
            busy={busySlot === slot.id}
            canReview={canReview}
            canUpload={canUpload}
            onFile={(file) => onFile(slot, file)}
            onRemove={onRemove}
            onReview={onReview}
            removingId={removingId}
          />
        ))}
      </div>
    </section>
  );
}

function SlotCard({
  slot,
  view,
  files,
  busy,
  canReview,
  canUpload,
  onFile,
  onRemove,
  onReview,
  removingId,
}: {
  slot: Slot;
  view: ViewMode;
  files: DriveFile[];
  busy: boolean;
  canReview: boolean;
  canUpload: boolean;
  onFile: (f: File) => void;
  onRemove: (f: DriveFile) => void;
  onReview: (f: DriveFile, verdict: ReviewVerdict) => void;
  removingId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const filled = files.length > 0;
  // A single-file slot that is already filled has nothing left to ask for.
  // Staff review, they do not upload: a transcript is the student's record
  // and nobody else has a copy to add.
  const canAdd = canUpload && (slot.multiple || !filled);
  // Every description and sender note on this page is written to the student:
  // "Your full high school record", "You upload this yourself". A counselor
  // reading a student's page was being addressed as the applicant, which is
  // the same wrong voice the essay panel had. They also do not need telling
  // what a transcript is. Timing stays, because chasing a mid-year report in
  // February is exactly their job.
  const teaching = !canReview;
  const state = filled ? slotState(files) : "pending";

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (canAdd) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && canAdd) onFile(f);
      }}
      className={cn(
        "rounded-xl border transition-colors",
        view === "list" ? "px-3 py-2" : "p-3",
        over
          ? "border-primary bg-primary/5"
          : // A reviewed slot carries its verdict on the whole card, not on a
          // badge inside it. Whether a transcript passed is the fact about the
          // slot, and it has to be readable from across the page.
          //
          // A still-missing essential used to be tinted too. Two tinted states
          // meaning unrelated things is one too many, and the upload button is
          // already teal where it matters.
          filled && state === "verified"
            ? "border-primary/40 bg-primary/[0.04]"
            : filled && state === "needs_attention"
              ? "border-[#d4183d]/40 bg-[#d4183d]/[0.04]"
              : filled
                ? "border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]"
                : "border-[#e9edef] dark:border-[#2a3942]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate text-[14px]",
                state === "verified"
                  ? "font-medium text-primary"
                  : state === "needs_attention"
                    ? "font-medium text-[#d4183d]"
                    : filled
                      ? "text-[#111] dark:text-white"
                      : "text-[#54656f] dark:text-[#aebac1]"
              )}
            >
              {slot.label}
            </span>
            {filled && <VerifiedBadge provenance={slotState(files)} size={13} />}
            {!slot.required && !filled && (
              <span className="shrink-0 text-[11px] text-[#a8adb8]">(optional)</span>
            )}
          </div>

          {!filled && view === "grid" && (
            <>
              {teaching && (
                <p className="mt-0.5 pr-2 text-[12px] leading-snug text-[#717182]">
                  {slot.description}
                </p>
              )}
              {slot.timing && (
                <p className="mt-1 text-[11px] text-[#8a6a2f] dark:text-[#e0c48a]">
                  {slot.timing}
                </p>
              )}
            </>
          )}

          {/* Nothing here is sent to a college from Yakal, and a student who
              assumes it is misses a deadline believing they are done. Shown on
              a filled slot because that is the moment the assumption forms. */}
          {filled && view === "grid" && teaching && (
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] leading-snug text-[#717182]">
              {SENDER_NOTE[slot.sender]}
              {slot.senderUrl && (
                <a
                  href={slot.senderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {SENDER_LINK_LABEL[slot.sender]}
                </a>
              )}
            </p>
          )}
        </div>

        {canAdd && (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
            aria-label={`Upload ${slot.label}`}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-50",
              // Both empty states are a button you can see; the colour is what
              // ranks them. Teal for a missing essential, a neutral slate for
              // an optional one: it reads as available without competing, and
              // it is the same grey the rest of this panel already uses for
              // things that are not decisions.
              //
              // Not a brand colour. Gold means "needs attention" on the flag
              // and the review stamp, and the green read as a second kind of
              // yes. Eight of either down the page says something is going on
              // when nothing is.
              filled
                ? "text-[#54656f] hover:text-primary dark:text-[#aebac1]"
                : slot.required
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "bg-[#54656f] text-white hover:bg-[#445261] dark:bg-[#2a3942] dark:hover:bg-[#36454f]"
            )}
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : filled ? (
              <Plus size={13} />
            ) : (
              <Upload size={13} />
            )}
            {busy ? "Uploading" : filled ? "Add" : "Upload"}
          </button>
        )}
      </div>

      {/* Placeholder for the row that is about to exist. Without it the card
          sits unchanged while the file is in flight, which reads as nothing
          having happened. */}
      {busy && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-[#e9edef] pt-2.5 dark:border-[#2a3942]">
          <span className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#e9edef] dark:bg-[#2a3942]" />
          <span className="h-3 flex-1 animate-pulse rounded bg-[#e9edef] dark:bg-[#2a3942]" />
        </div>
      )}

      {filled && (
        <div
          className={cn(
            "space-y-1.5",
            view === "grid"
              ? "mt-2.5 border-t border-[#e9edef] pt-2.5 dark:border-[#2a3942]"
              : "mt-1.5"
          )}
        >
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              compact
              canReview={canReview}
              onReview={onReview}
              onRemove={() => onRemove(f)}
              removing={removingId === f.id}
            />
          ))}
        </div>
      )}

      <input
        ref={ref}
        type="file"
        hidden
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * A slot is only as good as its worst file: one rejected transcript among three
 * uploads still needs attention, and a single unreviewed file means the slot is
 * not signed off.
 */
function slotState(files: DriveFile[]): ReviewVerdict {
  const states = files.map((f) => f.appProperties?.review ?? "pending");
  if (states.includes("needs_attention")) return "needs_attention";
  if (states.every((s) => s === "verified")) return "verified";
  return "pending";
}

/**
 * Everything a file can have done to it, behind one button.
 *
 * Open, download and delete were three controls competing with Verify and
 * Flag on a row that is mostly filename. The two that are a judgement stay
 * visible; the three that are plumbing move in here.
 */
function FileMenu({
  file,
  onRemove,
}: {
  file: DriveFile;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  const item =
    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-[#f3f3f5] dark:hover:bg-[#1c2a32]";

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${file.name}`}
        aria-expanded={open}
        className="grid h-7 w-7 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#54656f] dark:hover:bg-[#1c2a32]"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <>
          {/* Catches the click that closes it, including one on another row's
              kebab, which otherwise opened a second menu behind this one. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-xl border border-[#e9edef] bg-white py-1 shadow-lg dark:border-[#2a3942] dark:bg-[#182229]">
            {file.webViewLink && (
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noreferrer"
                // Next tick: closing here unmounted the anchor in the same
                // commit and the browser never followed the href.
                onClick={() => setTimeout(() => setOpen(false), 0)}
                className={cn(item, "text-[#111] dark:text-white")}
              >
                <ExternalLink size={14} className="text-[#717182]" />
                Open in Drive
              </a>
            )}
            {/* Drive's own export endpoint. A blob fetched through us would
                need the file's bytes to pass through the browser twice. */}
            <a
              href={`https://drive.google.com/uc?export=download&id=${file.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setTimeout(() => setOpen(false), 0)}
              className={cn(item, "text-[#111] dark:text-white")}
            >
              <Download size={14} className="text-[#717182]" />
              Download
            </a>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onRemove();
              }}
              className={cn(item, "text-[#d4183d]")}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function FileRow({
  file,
  onRemove,
  removing,
  compact = false,
  canReview = false,
  onReview,
}: {
  file: DriveFile;
  onRemove: () => void;
  removing: boolean;
  compact?: boolean;
  canReview?: boolean;
  onReview?: (f: DriveFile, verdict: ReviewVerdict) => void;
}) {
  const size = prettySize(file.size);
  const verdict: ReviewVerdict = file.appProperties?.review ?? "pending";
  const note = file.appProperties?.reviewNote;
  const Icon = fileIcon(file.mimeType);

  // A row on its way out shows as a placeholder rather than sitting unchanged
  // behind a toast that already claimed it was gone.
  if (removing) {
    return (
      <div
        className={cn(
          "flex items-center gap-2",
          !compact &&
          "rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]"
        )}
      >
        <span className="h-4 w-4 shrink-0 animate-pulse rounded bg-[#e9edef] dark:bg-[#2a3942]" />
        <span className="h-3 flex-1 animate-pulse rounded bg-[#e9edef] dark:bg-[#2a3942]" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        !compact &&
        "rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]"
      )}
    >
      <div className="flex items-center gap-2">
        {/* The row opens the file. A counselor's first move on a transcript is
            to read it, and asking them to find a menu for that was a step in
            the way. The slot name is not repeated here: it is the title of the
            card this row is already inside. */}
        <a
          href={file.webViewLink ?? `https://drive.google.com/file/d/${file.id}/view`}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-0.5 transition-colors hover:text-primary"
        >
          <Icon size={16} className="shrink-0 text-[#717182]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-[#111] dark:text-white">
              {file.name}
            </span>
            <span className="block text-[11px] text-[#717182]">
              {file.modifiedTime && new Date(file.modifiedTime).toLocaleDateString()}
              {size && ` \u00b7 ${size}`}
            </span>
          </span>
        </a>

        {canReview && onReview && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onReview(file, "verified")}
              disabled={verdict === "verified"}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={() => onReview(file, "needs_attention")}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-[#d4183d] transition-colors hover:bg-[#d4183d]/10"
            >
              Flag
            </button>
          </div>
        )}

        <FileMenu file={file} onRemove={onRemove} />
      </div>

      {/* What the counselor said, quoted. It is somebody's words rather than a
          status, and the rule down its left says so without a label. */}
      {note && verdict !== "pending" && (
        <blockquote
          className={cn(
            "mt-1.5 border-l-2 pl-2.5 text-[11px] leading-snug",
            verdict === "verified"
              ? "border-primary text-[#54656f] dark:text-[#aebac1]"
              : "border-[#d4183d] text-[#d4183d]"
          )}
        >
          {note}
        </blockquote>
      )}
    </div>
  );
}


/**
 * What the counselor wants to say about a file, in their own words.
 *
 * Asked on both verdicts. A separate "leave a note" action was a third way to
 * say the same thing, and a student who sees "needs attention" and no reason
 * has been given a chore rather than a correction. Empty is allowed, because
 * sometimes the conversation already happened in messages, but the box asks.
 */
function NoteDialog({
  pending,
  busy,
  onCancel,
  onSubmit,
}: {
  pending: { file: DriveFile; verdict: ReviewVerdict } | null;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (note: string) => void;
}) {
  const [text, setText] = useState("");
  if (!pending) return null;

  const flagging = pending.verdict === "needs_attention";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-[#e9edef] bg-white p-5 dark:border-[#2a3942] dark:bg-[#182229]">
        <h3 className="text-[15px] font-medium text-[#111] dark:text-white">
          {flagging ? "What needs fixing?" : "Anything to add?"}
        </h3>
        <p className="mt-1 truncate text-[13px] text-[#717182]">{pending.file.name}</p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          autoFocus
          placeholder={
            flagging
              ? "Scanned upside down, or the mid-year grades are missing"
              : "Optional. Anything the student should know."
          }
          className="mt-3 w-full resize-none rounded-xl border border-[#e9edef] bg-white p-2.5 text-[13px] outline-none transition-colors focus:border-primary dark:border-[#2a3942] dark:bg-[#111b21] dark:text-white"
        />

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#e9edef] px-3 py-1.5 text-[13px] font-medium text-[#54656f] transition-colors hover:bg-[#f3f3f5] dark:border-[#2a3942] dark:text-[#aebac1] dark:hover:bg-[#1c2a32]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit(text.trim())}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-medium text-white transition-colors disabled:opacity-50",
              flagging ? "bg-[#d4183d] hover:opacity-90" : "bg-primary hover:bg-primary-hover"
            )}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {flagging ? "Flag for the student" : "Mark verified"}
          </button>
        </div>
      </div>
    </div>
  );
}

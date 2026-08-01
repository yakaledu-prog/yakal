import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
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
import { SLOT_GROUPS, Slot } from "@/services/documentSlots";
import { InfoHint } from "@/components/ui/InfoHint";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { VerifiedBadge } from "./VerifiedBadge";

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
    onSuccess: () => {
      toast.success("Review saved.");
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
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
   * Files grouped by the slot they were uploaded into. Anything without a slot
   * predates this model or was dropped into Drive by hand, so it is shown in
   * its own section rather than silently hidden.
   */
  const { bySlot, unfiled } = useMemo(() => {
    const bySlot = new Map<string, DriveFile[]>();
    const unfiled: DriveFile[] = [];
    const all = [
      ...(data?.loose ?? []),
      ...(data?.sections.flatMap((s) => s.files) ?? []),
    ];

    for (const f of all) {
      const slot = f.appProperties?.slot;
      if (slot) bySlot.set(slot, [...(bySlot.get(slot) ?? []), f]);
      else unfiled.push(f);
    }
    return { bySlot, unfiled };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[#1099A1]" />
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
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[#CAA25F]" />
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
  const groups = q
    ? SLOT_GROUPS.map((g) => ({
        ...g,
        slots: g.slots.filter(
          (sl) =>
            sl.label.toLowerCase().includes(q) ||
            sl.description.toLowerCase().includes(q) ||
            (bySlot.get(sl.id) ?? []).some((f: any) =>
              String(f.name ?? "").toLowerCase().includes(q)
            )
        ),
      })).filter((g) => g.slots.length > 0)
    : SLOT_GROUPS;

  const allSlots = SLOT_GROUPS.flatMap((g) => g.slots);
  const requiredSlots = allSlots.filter((s) => s.required);
  const done = requiredSlots.filter((s) => (bySlot.get(s.id)?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Where the reassurance about Drive used to be. Eleven slots across
            three groups is enough to want to jump to one, and the sentence was
            only ever read once. */}
        <div className="relative min-w-[220px] flex-1 md:max-w-xs">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#a8adb8]"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents"
            className="h-9 w-full rounded-xl border border-[#e9edef] bg-white pl-9 pr-3 text-[13px] outline-none transition-colors focus:border-[#1099A1] dark:border-[#2a3942] dark:bg-[#182229]"
          />
        </div>
        <span className="text-[13px] tabular-nums text-[#a8adb8]">
          {done} of {requiredSlots.length} essentials
        </span>
        {data?.folderUrl && (
          <a
            href={data.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-[#1099A1] hover:underline"
          >
            Open in Drive
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {groups.map((group) => (
        <SlotGroupSection
          key={group.key}
          title={group.title}
          slots={group.slots}
          bySlot={bySlot}
          busySlot={busySlot}
          canReview={canReview}
          canUpload={canUpload}
          onFile={(slot, file) => {
            setBusySlot(slot.id);
            upload.mutate({ slot, file });
          }}
          onRemove={setPendingDelete}
          onReview={(file, verdict) => review.mutate({ file, verdict })}
          removingId={remove.isPending ? remove.variables?.id : undefined}
        />
      ))}

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

      {unfiled.length > 0 && (
        <section>
          <h3 className="mb-2.5 flex items-center gap-1 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
            Not filed
            <InfoHint text="Uploaded before these categories existed, or added straight into Drive. Still safe, just not sorted." />
          </h3>
          <div className="grid gap-2 lg:grid-cols-2">
            {unfiled.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                onRemove={() => setPendingDelete(f)}
                removing={remove.isPending && remove.variables?.id === f.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SlotGroupSection({
  title,
  slots,
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
      {/* Two columns: slots are short and mostly empty early on, so one tall
          column would read as a longer to-do list than it really is. */}
      <div className="grid gap-3 lg:grid-cols-2">
        {slots.map((slot) => (
          <SlotCard
            key={slot.id}
            slot={slot}
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
        "rounded-xl border p-3 transition-colors",
        over
          ? "border-[#1099A1] bg-[#1099A1]/5"
          : filled
            ? "border-[#e9edef] bg-white dark:border-[#2a3942] dark:bg-[#182229]"
            : // A still-missing essential is tinted the whole way round. Enough
            // to pull the eye first, not enough to read as an error: no
            // mid-year report in September is normal, not a mistake.
            slot.required
              ? "border-[#1099A1]/35 dark:border-[#1099A1]/40"
              : "border border-[#e9edef] dark:border-[#2a3942]"
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "truncate text-[14px]",
                filled ? "text-[#111] dark:text-white" : "text-[#54656f] dark:text-[#aebac1]"
              )}
            >
              {slot.label}
            </span>
            {filled && <VerifiedBadge provenance={slotState(files)} size={13} />}
            {!slot.required && !filled && (
              <span className="shrink-0 text-[11px] text-[#a8adb8]">optional</span>
            )}
          </div>

          {!filled && (
            <>
              <p className="mt-0.5 pr-2 text-[12px] leading-snug text-[#717182]">
                {slot.description}
              </p>
              {slot.timing && (
                <p className="mt-1 text-[11px] text-[#8a6a2f] dark:text-[#e0c48a]">
                  {slot.timing}
                </p>
              )}
            </>
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
              filled
                ? "text-[#54656f] hover:text-[#1099A1] dark:text-[#aebac1]"
                : "bg-[#1099A1] text-white hover:bg-[#0d848b]"
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
        <div className="mt-2.5 space-y-1.5 border-t border-[#e9edef] pt-2.5 dark:border-[#2a3942]">
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
        <Icon size={16} className="shrink-0 text-[#717182]" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] text-[#111] dark:text-white">{file.name}</div>
          <div className="text-[11px] text-[#717182]">
            {file.modifiedTime && new Date(file.modifiedTime).toLocaleDateString()}
            {size && ` · ${size}`}
          </div>
        </div>

        {file.webViewLink && (
          <a
            href={file.webViewLink}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[12px] font-medium text-[#1099A1] underline active:scale-95 transition ease-in-out hover:opacity-85"
          >
            Open
          </a>
        )}

        {canReview && onReview && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => onReview(file, "verified")}
              disabled={verdict === "verified"}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-[#1099A1] transition-colors hover:bg-[#1099A1]/10 disabled:opacity-40"
            >
              Verify
            </button>
            <button
              type="button"
              onClick={() => onReview(file, "needs_attention")}
              disabled={verdict === "needs_attention"}
              className="rounded-lg px-2 py-1 text-[12px] font-medium text-[#d4183d] transition-colors hover:bg-[#d4183d]/10 disabled:opacity-40"
            >
              Flag
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          aria-label={`Remove ${file.name}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#d4183d] disabled:opacity-40 dark:hover:bg-[#1c2a32]"
        >
          {removing ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
        </button>
      </div>

      {/* The reason a file was flagged is the only part a student can act on,
          so it sits with the file rather than in a tooltip. */}
      {note && verdict === "needs_attention" && (
        <p className="mt-1 pl-6 text-[11px] leading-snug text-[#d4183d]">{note}</p>
      )}
    </div>
  );
}

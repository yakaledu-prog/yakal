import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import {
  DriveFile,
  deleteDocument,
  isConfigured,
  listDocuments,
  uploadDocument,
} from "@/services/driveService";
import { SLOT_GROUPS, Slot } from "@/services/documentSlots";
import { InfoHint } from "@/components/ui/InfoHint";
import { VerifiedBadge } from "./VerifiedBadge";

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
}: {
  studentId: string;
  studentName: string;
  /** Shared onto the student's folder so Open in Drive needs no access request. */
  studentEmail?: string | null;
}) {
  const qc = useQueryClient();
  const [busySlot, setBusySlot] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["drive-docs", studentId],
    queryFn: () => listDocuments(studentId, studentName, studentEmail),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: ({ slot, file }: { slot: Slot; file: File }) =>
      uploadDocument(studentId, studentName, slot.section, file, studentEmail, slot.id),
    onSuccess: (_d, v) => {
      toast.success(`${v.file.name} uploaded.`);
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusySlot(null),
  });

  const remove = useMutation({
    mutationFn: (f: DriveFile) => deleteDocument(f.id),
    onSuccess: (_d, f) => {
      toast.success(`${f.name} moved to trash.`);
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
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

  const allSlots = SLOT_GROUPS.flatMap((g) => g.slots);
  const requiredSlots = allSlots.filter((s) => s.required);
  const done = requiredSlots.filter((s) => (bySlot.get(s.id)?.length ?? 0) > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          Stored in Yakal's Drive, so your counselor can open them without you
          sharing anything.
        </p>
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

      {SLOT_GROUPS.map((group) => (
        <section key={group.key}>
          <h3 className="mb-2.5 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
            {group.title}
          </h3>
          {/* Two columns: slots are short and mostly empty early on, so one tall
              column would read as a longer to-do list than it really is. */}
          <div className="grid gap-3 lg:grid-cols-2">
            {group.slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                files={bySlot.get(slot.id) ?? []}
                busy={busySlot === slot.id}
                onFile={(file) => {
                  setBusySlot(slot.id);
                  upload.mutate({ slot, file });
                }}
                onRemove={(f) => remove.mutate(f)}
                removingId={remove.isPending ? remove.variables?.id : undefined}
              />
            ))}
          </div>
        </section>
      ))}

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
                onRemove={() => remove.mutate(f)}
                removing={remove.isPending && remove.variables?.id === f.id}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SlotCard({
  slot,
  files,
  busy,
  onFile,
  onRemove,
  removingId,
}: {
  slot: Slot;
  files: DriveFile[];
  busy: boolean;
  onFile: (f: File) => void;
  onRemove: (f: DriveFile) => void;
  removingId?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const filled = files.length > 0;
  // A single-file slot that is already filled has nothing left to ask for.
  const canAdd = slot.multiple || !filled;

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
            : // Empty optional slots recede so the required ones read first.
            slot.required
              ? "border-[#e9edef] dark:border-[#2a3942]"
              : "border-dashed border-[#e9edef] dark:border-[#2a3942]"
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
            {filled && <VerifiedBadge provenance="unverified" size={12} />}
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

      {filled && (
        <div className="mt-2.5 space-y-1.5 border-t border-[#e9edef] pt-2.5 dark:border-[#2a3942]">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              compact
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

function FileRow({
  file,
  onRemove,
  removing,
  compact = false,
}: {
  file: DriveFile;
  onRemove: () => void;
  removing: boolean;
  compact?: boolean;
}) {
  const size = prettySize(file.size);
  return (
    <div
      className={cn(
        "flex items-center gap-2",
        !compact &&
        "rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]"
      )}
    >
      <FileText size={15} className="shrink-0 text-[#717182]" />
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
          className="shrink-0 text-[12px] font-medium text-[#1099A1] hover:underline"
        >
          Open
        </a>
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
  );
}

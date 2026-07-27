import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/utils/cn";
import {
  DocumentSection,
  DriveFile,
  deleteDocument,
  isConfigured,
  listDocuments,
  uploadDocument,
} from "@/services/driveService";
import { InfoHint } from "@/components/ui/InfoHint";

const SECTIONS: { key: DocumentSection; label: string; hint: string }[] = [
  {
    key: "Transcripts",
    label: "Transcript",
    hint: "Your official high school transcript. Your counselor checks it matches the GPA on your profile before any application goes out.",
  },
  {
    key: "Test scores",
    label: "Test scores",
    hint: "SAT, ACT or AP score reports. Colleges usually need these sent officially by College Board too.",
  },
  {
    key: "Other",
    label: "Other",
    hint: "Portfolios, certificates, anything else a college asks you for.",
  },
];

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
  const [uploading, setUploading] = useState<DocumentSection | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["drive-docs", studentId],
    queryFn: () => listDocuments(studentId, studentName, studentEmail),
    retry: false,
  });

  const upload = useMutation({
    mutationFn: ({ section, file }: { section: DocumentSection; file: File }) =>
      uploadDocument(studentId, studentName, section, file, studentEmail),
    onSuccess: (_d, v) => {
      toast.success(`${v.file.name} uploaded.`);
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setUploading(null),
  });

  const remove = useMutation({
    mutationFn: (f: DriveFile) => deleteDocument(f.id),
    onSuccess: (_d, f) => {
      toast.success(`${f.name} moved to trash.`);
      qc.invalidateQueries({ queryKey: ["drive-docs", studentId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const filesIn = (key: DocumentSection) =>
    data?.sections.find((s) => s.name === key)?.files ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <p className="text-[13px] text-[#54656f] dark:text-[#aebac1]">
          Stored in Yakal's Drive so your counselor can open them without you
          sharing anything.
        </p>
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

      {SECTIONS.map((s) => {
        const files = filesIn(s.key);
        return (
          <section key={s.key}>
            <h3 className="mb-2 flex items-center gap-1 text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">
              {s.label}
              <InfoHint text={s.hint} />
              {files.length > 0 && (
                <span className="tabular-nums text-[#a8adb8]">{files.length}</span>
              )}
            </h3>

            <div className="space-y-2">
              {files.map((f) => (
                <FileRow
                  key={f.id}
                  file={f}
                  onRemove={() => remove.mutate(f)}
                  removing={remove.isPending && remove.variables?.id === f.id}
                />
              ))}

              <UploadTarget
                section={s.key}
                busy={uploading === s.key}
                onFile={(file) => {
                  setUploading(s.key);
                  upload.mutate({ section: s.key, file });
                }}
              />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function FileRow({
  file,
  onRemove,
  removing,
}: {
  file: DriveFile;
  onRemove: () => void;
  removing: boolean;
}) {
  const size = prettySize(file.size);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e9edef] bg-white p-3 dark:border-[#2a3942] dark:bg-[#182229]">
      <FileText size={17} className="shrink-0 text-[#717182]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-[#111] dark:text-white">{file.name}</div>
        <div className="text-[12px] text-[#717182]">
          {file.modifiedTime && new Date(file.modifiedTime).toLocaleDateString()}
          {size && ` · ${size}`}
        </div>
      </div>
      {file.webViewLink && (
        <a
          href={file.webViewLink}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[13px] font-medium text-[#1099A1] hover:underline"
        >
          Open
        </a>
      )}
      <button
        type="button"
        onClick={onRemove}
        disabled={removing}
        aria-label={`Remove ${file.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#a8adb8] transition-colors hover:bg-[#f3f3f5] hover:text-[#d4183d] disabled:opacity-40 dark:hover:bg-[#1c2a32]"
      >
        {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={15} />}
      </button>
    </div>
  );
}

function UploadTarget({
  section,
  busy,
  onFile,
}: {
  section: DocumentSection;
  busy: boolean;
  onFile: (f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      className={cn(
        "rounded-xl border border-dashed transition-colors",
        over
          ? "border-[#1099A1] bg-[#1099A1]/5"
          : "border-[#e9edef] dark:border-[#2a3942]"
      )}
    >
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 py-3 text-[13px] font-medium text-[#717182] transition-colors hover:text-[#1099A1] disabled:opacity-50"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
        {busy ? "Uploading" : `Add ${section.toLowerCase()}`}
      </button>
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

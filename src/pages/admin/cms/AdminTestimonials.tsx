import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Loader2, X, GripVertical } from "lucide-react";
import {
  getAllTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  type Testimonial,
  type TestimonialInput,
} from "@/services/testimonialService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { AdminHeader } from "../AdminHeader";

const EMPTY: TestimonialInput = {
  name: "",
  role: "",
  quote: "",
  avatar_url: "",
  published: false,
  sort_order: 0,
};

/**
 * A dialog rather than its own route, unlike the post editor. A post is a page
 * of prose that deserves a page to write it in; a testimonial is four short
 * fields, and sending someone to another screen to type a sentence is worse.
 */
function EditDialog({
  initial,
  busy,
  onSave,
  onClose,
}: {
  initial: Testimonial | null;
  busy: boolean;
  onSave: (input: TestimonialInput) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TestimonialInput>(
    initial
      ? {
          name: initial.name,
          role: initial.role,
          quote: initial.quote,
          avatar_url: initial.avatar_url ?? "",
          published: initial.published,
          sort_order: initial.sort_order,
        }
      : EMPTY
  );

  const set = <K extends keyof TestimonialInput>(k: K, v: TestimonialInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-[#1099A1]";

  function submit() {
    if (!form.name.trim()) return toast.error("A name is needed.");
    if (!form.quote.trim()) return toast.error("A quote is needed.");
    onSave({ ...form, avatar_url: form.avatar_url?.trim() || null });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit testimonial" : "Add testimonial"}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-5 shadow-xl md:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-[17px] font-medium">{initial ? "Edit testimonial" : "Add testimonial"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3.5">
          <div>
            <label className="mb-1.5 block text-[13px] text-muted-foreground">Name</label>
            <input className={field} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="David Warner" />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-muted-foreground">Role</label>
            <input className={field} value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Algebra Student" />
            <p className="mt-1 text-[12px] text-muted-foreground">Shown under the name, in teal.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-muted-foreground">Quote</label>
            <textarea
              className={cn(field, "min-h-[120px] resize-y leading-relaxed")}
              value={form.quote}
              onChange={(e) => set("quote", e.target.value)}
              placeholder="What they said, in their own words."
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] text-muted-foreground">Photo URL</label>
            <div className="flex items-center gap-3">
              <img
                src={form.avatar_url?.trim() || dicebearUrl(form.name || "Yakal")}
                alt=""
                className="h-11 w-11 shrink-0 rounded-full bg-muted object-cover"
              />
              <input
                className={field}
                value={form.avatar_url ?? ""}
                onChange={(e) => set("avatar_url", e.target.value)}
                placeholder="/testimonials/name.webp"
              />
            </div>
            {/* Left blank on purpose is a normal thing to do, so say so rather
                than letting an empty field read as unfinished. */}
            <p className="mt-1 text-[12px] text-muted-foreground">
              Leave blank for a generated avatar. Files in public/ are served from the site root.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1.5 block text-[13px] text-muted-foreground">Order</label>
              <input
                type="number"
                className={field}
                value={form.sort_order}
                onChange={(e) => set("sort_order", Number(e.target.value))}
              />
              <p className="mt-1 text-[12px] text-muted-foreground">Lowest first.</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-6 text-[14px]">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => set("published", e.target.checked)}
                className="h-4 w-4 accent-[#1099A1]"
              />
              Published
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium hover:bg-muted/60">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0d7f86] disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminTestimonials() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Testimonial | null | undefined>(undefined);
  const [toDelete, setToDelete] = useState<Testimonial | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: getAllTestimonials,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-testimonials"] });

  const stats = [
    { label: "Total", value: items.length },
    { label: "Published", value: items.filter((t) => t.published).length },
    { label: "Drafts", value: items.filter((t) => !t.published).length },
  ];

  async function save(input: TestimonialInput) {
    setBusy(true);
    const res = editing ? await updateTestimonial(editing.id, input) : await createTestimonial(input);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not save that.");
    toast.success(editing ? "Testimonial updated." : "Testimonial added.");
    setEditing(undefined);
    refresh();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const res = await deleteTestimonial(toDelete.id);
    if (!res.success) return toast.error(res.error ?? "Could not delete that.");
    toast.success("Testimonial deleted.");
    setToDelete(null);
    refresh();
  }

  // Published state toggles from the row, because "write it now, show it
  // later" is the common case and it should not need the dialog.
  async function togglePublished(t: Testimonial) {
    const res = await updateTestimonial(t.id, { published: !t.published });
    if (!res.success) return toast.error(res.error ?? "Could not update that.");
    refresh();
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background dark:bg-[#111b21]">
        <AdminHeader title="Testimonials" subtitle="What appears on the landing page" stats={stats} />

        <div className="mx-auto max-w-[1440px] space-y-5 p-6 md:p-10">
          <div className="flex justify-end">
            <button
              onClick={() => setEditing(null)}
              className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0d7f86]"
            >
              <Plus size={16} /> Add testimonial
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">
              Nothing yet. The landing page falls back to its built-in copy until one is published.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((t) => (
                <div
                  key={t.id}
                  className="flex items-start gap-4 rounded-xl border border-border bg-card p-4"
                >
                  <GripVertical size={16} className="mt-1 shrink-0 text-muted-foreground/50" />
                  <img
                    src={t.avatar_url || dicebearUrl(t.name)}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full bg-muted object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5">
                      <p className="text-[15px] font-medium">{t.name}</p>
                      {t.role && <p className="text-[13px] text-[#1099A1]">{t.role}</p>}
                      <button
                        onClick={() => togglePublished(t)}
                        className={cn(
                          "text-[12.5px] font-medium transition-colors",
                          t.published ? "text-[#97CE9D] hover:text-[#1099A1]" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t.published ? "Published" : "Draft"}
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">{t.quote}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => setEditing(t)}
                      aria-label={`Edit ${t.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => setToDelete(t)}
                      aria-label={`Delete ${t.name}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted/60 hover:text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing !== undefined && (
        <EditDialog initial={editing} busy={busy} onSave={save} onClose={() => setEditing(undefined)} />
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete testimonial"
        message={`Remove the testimonial from ${toDelete?.name}? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
      />
    </PageWrapper>
  );
}

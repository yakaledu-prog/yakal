import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Loader2, X, GripVertical, Upload, Save, Search, Quote as QuoteIcon } from "lucide-react";
import {
  getAllTestimonials,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  reorderTestimonials,
  uploadTestimonialPhoto,
  roleLabel,
  roleSuggestions,
  type Testimonial,
  type TestimonialInput,
} from "@/services/testimonialService";
import { getUsers } from "@/services/adminService";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Combobox, type ComboboxItem } from "@/components/ui/Combobox";
import { Dropdown } from "@/components/ui/Dropdown";
import { dicebearUrl } from "@/utils/avatar";
import { cn } from "@/utils/cn";
import { AdminHeader } from "../AdminHeader";

const QUOTE_LIMIT = 500;

/** Long enough that the empty preview is the height a real quote will be. */
const PLACEHOLDER_QUOTE =
  "Yakal's tutoring completely changed my approach to learning. I was struggling with Algebra, but my tutor broke concepts into easy-to-understand steps.";

type Draft = Omit<TestimonialInput, "sort_order">;

const EMPTY: Draft = { name: "", role: "", quote: "", avatar_url: "", published: true };

function EditDialog({
  initial,
  roles,
  busy,
  onSave,
  onClose,
}: {
  initial: Testimonial | null;
  roles: string[];
  busy: boolean;
  onSave: (input: Draft) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Draft>(
    initial
      ? {
          name: initial.name,
          role: initial.role,
          quote: initial.quote,
          avatar_url: initial.avatar_url ?? "",
          published: initial.published,
        }
      : EMPTY
  );
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Only admins reach this screen, and the list is what makes the name field
  // a shortcut rather than a spelling test.
  const { data: people = [] } = useQuery({
    queryKey: ["admin-users", "all"],
    queryFn: () => getUsers(),
    staleTime: 60_000,
  });

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setForm((f) => ({ ...f, [k]: v }));

  const items: ComboboxItem[] = people.map((p) => ({
    id: p.id,
    label: p.full_name ?? "",
    hint: p.email ?? undefined,
    avatarUrl: p.avatar_url || dicebearUrl(p.full_name ?? "Yakal"),
  }));

  /**
   * Picking somebody fills what the database already knows and stops there.
   * The quote is theirs to paste, and an existing photo is not overwritten,
   * because an admin who chose one meant it.
   */
  function pickPerson(item: ComboboxItem) {
    const person = people.find((p) => p.id === item.id);
    if (!person) return;
    setForm((f) => ({
      ...f,
      name: person.full_name ?? f.name,
      role: f.role.trim() || roleLabel(person.role),
      avatar_url: f.avatar_url?.trim() ? f.avatar_url : person.avatar_url ?? "",
    }));
  }

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("That is not an image.");
    if (file.size > 4 * 1024 * 1024) return toast.error("Images must be under 4MB.");
    setUploading(true);
    const res = await uploadTestimonialPhoto(file);
    setUploading(false);
    if (!res.success || !res.data) return toast.error(res.error ?? "Upload failed.");
    set("avatar_url", res.data);
  }

  function submit() {
    if (!form.name.trim()) return toast.error("A name is needed.");
    if (!form.quote.trim()) return toast.error("A quote is needed.");
    onSave({ ...form, avatar_url: form.avatar_url?.trim() || null });
  }

  const field =
    "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] outline-none transition-colors focus:border-[#1099A1]";
  const label = "mb-1.5 block text-[13px] text-muted-foreground";
  const preview = form.avatar_url?.trim() || dicebearUrl(form.name || "Yakal");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={initial ? "Edit testimonial" : "Add testimonial"}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 md:px-6 md:pt-6">
          <h2 className="text-[19px] font-semibold tracking-tight">Testimonial</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60">
            <X size={18} />
          </button>
        </div>

        {/* items-stretch, so the preview column is as tall as the form rather
            than a short card with dead space under it. */}
        <div className="grid flex-1 items-stretch gap-5 overflow-y-auto p-5 md:grid-cols-2 md:p-6">
          {/* ---- the form ---- */}
          <div className="flex flex-col gap-4">
            <div>
              <span className={label}>Photo</span>
              <div className="flex items-center gap-4">
                <img src={preview} alt="" className="h-[76px] w-[76px] shrink-0 rounded-full bg-muted object-cover" />
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  className="flex min-h-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-[13px] text-muted-foreground transition-colors hover:border-[#1099A1] hover:text-foreground disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {uploading ? "Uploading" : "Upload photo"}
                </button>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void upload(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="t-name" className={label}>Name</label>
              <Combobox
                id="t-name"
                value={form.name}
                onChange={(v) => set("name", v)}
                onPick={pickPerson}
                items={items}
                placeholder="Search people, or type a name"
                emptyHint="Nobody by that name. What you type is used as it is."
              />
            </div>

            <div>
              <label htmlFor="t-role" className={label}>Role</label>
              <Combobox
                id="t-role"
                value={form.role}
                onChange={(v) => set("role", v)}
                items={roles.map((r) => ({ id: r, label: r }))}
                placeholder="Algebra Student"
                emptyHint="New role. What you type is used as it is."
              />
            </div>

            {/* Grows into whatever height the photo and the two fields leave,
                which is what keeps the two columns level. */}
            <div className="flex flex-1 flex-col">
              <label htmlFor="t-quote" className={label}>Quote</label>
              {/* The counter sits inside the field, so it reads as part of the
                  input rather than as another line of guidance under it. The
                  textarea keeps room for it with pb-7, and the span ignores
                  clicks so the corner still focuses the field. */}
              <div className="relative flex flex-1">
                <textarea
                  id="t-quote"
                  maxLength={QUOTE_LIMIT}
                  className={cn(field, "min-h-[120px] flex-1 resize-none pb-7 leading-relaxed")}
                  value={form.quote}
                  onChange={(e) => set("quote", e.target.value)}
                  placeholder={PLACEHOLDER_QUOTE}
                />
                <span
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute bottom-2.5 right-3 text-[12px] text-muted-foreground",
                    form.quote.length >= QUOTE_LIMIT && "text-[#CAA25F]"
                  )}
                >
                  {form.quote.length} / {QUOTE_LIMIT}
                </span>
              </div>
            </div>
          </div>

          {/* ---- live preview ----
              A light panel with the card floating on it, not the teal band the
              landing page uses. At this size a solid block of brand colour
              stops reading as context and starts competing with the form. */}
          <div className="flex flex-col">
            <span className={label}>Live preview</span>
            <div className="flex flex-1 items-start rounded-2xl bg-muted/40 p-5 dark:bg-white/5">
              <div className="w-full rounded-2xl bg-white p-6 shadow-sm">
                <QuoteIcon size={30} className="mb-3 text-[#1099A1]" fill="currentColor" strokeWidth={0} />
                <p className="text-[14.5px] font-light leading-[1.9] text-[#4a4a4a]">
                  {form.quote.trim() || PLACEHOLDER_QUOTE}
                </p>
                <div className="mt-5 flex items-center gap-3 border-t border-black/[0.06] pt-5">
                  <img src={preview} alt="" className="h-11 w-11 shrink-0 rounded-full bg-[#f3f3f3] object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium text-black">{form.name.trim() || "Their name"}</p>
                    <p className="truncate text-[12.5px] text-[#1099a1]">{form.role.trim() || "Their role"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Visibility sits with the buttons because it is the same kind of
            decision: what happens when you press Save. */}
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-4 md:px-6">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px]">
            <button
              type="button"
              role="switch"
              aria-checked={form.published}
              onClick={() => set("published", !form.published)}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                form.published ? "bg-[#1099A1]" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
                  form.published ? "left-[22px]" : "left-0.5"
                )}
              />
            </button>
            {form.published ? "Visible on site" : "Hidden"}
          </label>

          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-border px-4 py-2.5 text-[13.5px] font-medium hover:bg-muted/60">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={busy || uploading}
              className="flex items-center gap-1.5 rounded-xl bg-[#1099A1] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0d7f86] disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save testimonial
            </button>
          </div>
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

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: getAllTestimonials,
  });

  /**
   * A local order, held only while a drag is in flight.
   *
   * Null the rest of the time, so the query is the single source of truth and
   * there is no effect copying one into the other. Mirroring server state into
   * component state is how a list ends up showing the order from two fetches
   * ago after a failed write.
   */
  const [dragOrder, setDragOrder] = useState<Testimonial[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const items = dragOrder ?? saved;

  const [q, setQ] = useState("");
  const [visibility, setVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [role, setRole] = useState("all");

  /**
   * Dragging is off while anything is filtered.
   *
   * The new order is written from the rows on screen, so dropping row 2 onto
   * row 5 of a filtered list would renumber those two and silently reshuffle
   * everything hidden between them. Refusing is better than a reorder nobody
   * can see happening.
   */
  const filtering = q.trim() !== "" || visibility !== "all" || role !== "all";

  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of items) {
      const name = t.role.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [items]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((t) => {
      if (visibility === "visible" && !t.published) return false;
      if (visibility === "hidden" && t.published) return false;
      if (role !== "all" && t.role.trim() !== role) return false;
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        t.role.toLowerCase().includes(needle) ||
        t.quote.toLowerCase().includes(needle)
      );
    });
  }, [items, q, visibility, role]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-testimonials"] });

  const stats = [
    { label: "Total", value: items.length },
    { label: "Visible", value: items.filter((t) => t.published).length },
    { label: "Hidden", value: items.filter((t) => !t.published).length },
  ];

  async function save(input: Draft) {
    setBusy(true);
    const res = editing
      ? await updateTestimonial(editing.id, input)
      : await createTestimonial(input);
    setBusy(false);
    if (!res.success) return toast.error(res.error ?? "Could not save that.");
    toast.success(editing ? "Testimonial updated." : "Added to the top of the list.");
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

  async function togglePublished(t: Testimonial) {
    const res = await updateTestimonial(t.id, { published: !t.published });
    if (!res.success) return toast.error(res.error ?? "Could not update that.");
    refresh();
  }

  /** Reorder locally as the row passes over another, so the gap follows the cursor. */
  function dragOver(overId: string) {
    if (!dragId || dragId === overId) return;
    setDragOrder((list) => {
      const base = list ?? saved;
      const from = base.findIndex((i) => i.id === dragId);
      const to = base.findIndex((i) => i.id === overId);
      if (from === -1 || to === -1) return base;
      const next = [...base];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function dropped() {
    setDragId(null);
    const ids = (dragOrder ?? saved).map((i) => i.id);
    // Nothing moved, so nothing to write.
    if (ids.join() === saved.map((i) => i.id).join()) return setDragOrder(null);
    const res = await reorderTestimonials(ids);
    if (!res.success) toast.error(res.error ?? "Could not save the new order.");
    // Either way the query becomes the truth again: on success it returns the
    // order just written, on failure the order that survived.
    setDragOrder(null);
    refresh();
  }

  return (
    <PageWrapper className="!p-0">
      <div className="min-h-screen flex-1 bg-background dark:bg-[#111b21]">
        <AdminHeader title="Testimonials" subtitle="What appears on the landing page" stats={stats} />

        <div className="mx-auto max-w-[1440px] space-y-4 p-6 md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[180px] flex-1 sm:max-w-sm">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, role or quote..."
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-[#1099A1]"
              />
            </div>

            <Dropdown
              value={visibility}
              onChange={setVisibility}
              options={[
                { value: "all", label: `All (${items.length})` },
                { value: "visible", label: `Visible (${items.filter((t) => t.published).length})` },
                { value: "hidden", label: `Hidden (${items.filter((t) => !t.published).length})` },
              ]}
              size="sm"
              ariaLabel="Filter by visibility"
              className="w-[150px]"
            />

            <button
              onClick={() => setEditing(null)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#1099A1] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#0d7f86]"
            >
              <Plus size={16} /> Add testimonial
            </button>
          </div>

          {/* Roles are free text, so these are the roles actually in use rather
              than a fixed set. Hidden on a phone, where the search field does
              the same job in less space. */}
          {roleCounts.length > 1 && (
            <div className="hidden flex-wrap gap-2 md:flex">
              {roleCounts.map(([name, count]) => (
                <button
                  key={name}
                  onClick={() => setRole(role === name ? "all" : name)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[12.5px] transition-colors",
                    role === name
                      ? "border-[#1099A1] text-[#1099A1]"
                      : "border-border text-muted-foreground hover:border-[#1099A1]/50 hover:text-foreground"
                  )}
                >
                  {name} ({count})
                </button>
              ))}
            </div>
          )}

          <p className="text-[13px] text-muted-foreground">
            {filtering
              ? "Clear the search and filters to reorder."
              : "Drag to reorder. The top one appears first on the site."}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-20 text-center text-muted-foreground">
              Nothing yet. The landing page falls back to its built-in copy until one is visible.
            </p>
          ) : (
            <div className="space-y-3">
              {visible.map((t) => (
                <div
                  key={t.id}
                  draggable={!filtering}
                  onDragStart={() => setDragId(t.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    dragOver(t.id);
                  }}
                  onDragEnd={dropped}
                  onDrop={(e) => {
                    e.preventDefault();
                    void dropped();
                  }}
                  className={cn(
                    "flex items-start gap-4 rounded-xl border border-border bg-card p-4 transition-opacity",
                    dragId === t.id && "opacity-40"
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 cursor-grab text-muted-foreground/50 active:cursor-grabbing"
                  >
                    <GripVertical size={16} />
                  </span>
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
                          t.published
                            ? "text-[#97CE9D] hover:text-[#1099A1]"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {t.published ? "Visible" : "Hidden"}
                      </button>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-muted-foreground">
                      {t.quote}
                    </p>
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
        <EditDialog
          initial={editing}
          roles={roleSuggestions(saved)}
          busy={busy}
          onSave={save}
          onClose={() => setEditing(undefined)}
        />
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

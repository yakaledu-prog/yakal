import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  getSettings,
  saveSettings,
  SETTING_FIELDS,
  SETTING_COLUMNS,
  type SettingField,
  type SiteSettings,
} from "@/services/settingsService";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { dicebearUrl } from "@/utils/avatar";
import { Mail, Phone, LogOut, SquarePenIcon, X } from "lucide-react";

export function AdminProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const qc = useQueryClient();

  // Values the business owns, edited here rather than in an environment
  // variable that needs a redeploy to take effect.
  const { data: savedSettings } = useQuery({
    queryKey: ["site-settings"],
    queryFn: getSettings,
    staleTime: Infinity,
  });
  // Only what has been typed, rather than a copy of the query. Mirroring the
  // whole thing into state needs an effect to seed it, which the compiler
  // rules count as a cascading render, and it goes stale the moment the query
  // refetches underneath.
  const [edits, setEdits] = useState<SiteSettings>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const settings: SiteSettings = { ...(savedSettings ?? {}), ...edits };

  // Something to save means an edit that differs from what is stored. Typing a
  // value and typing it back leaves the button inactive, which is correct:
  // there is nothing to write.
  const dirty = Object.entries(edits).some(
    ([k, v]) => v.trim() !== (savedSettings?.[k] ?? "").trim()
  );

  async function saveSiteSettings() {
    if (!user) return;
    setSavingSettings(true);
    const res = await saveSettings(settings, user.id);
    setSavingSettings(false);
    if (!res.success) return toast.error(res.error ?? "Could not save those.");
    toast.success("Settings saved.");
    setEdits({});
    qc.invalidateQueries({ queryKey: ["site-settings"] });
  }
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);


  const saveName = async () => {
    if (!user?.id || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    await refreshProfile();
    toast.success("Profile saved.");
    setEditOpen(false);
  };


  return (
    <PageWrapper>
      <div className="flex flex-col min-h-0 bg-background overflow-y-auto">
        {/* Teal header */}
        <div className="relative shrink-0 overflow-hidden bg-primary py-8 text-white md:py-12">
          <svg className="absolute right-0 top-0 h-full w-[60%] md:w-[40%] text-white/5 pointer-events-none" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
          </svg>

          {/* Centred on a phone: stacked and left aligned, the avatar sat in
              a wide empty band and read as misplaced rather than as a column. */}
          <div className="relative z-10 flex flex-col items-stretch justify-between gap-6 px-6 md:flex-row md:items-center md:px-10 lg:px-12">
            <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:text-left">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-white/20 bg-black/20 shrink-0">
                <img src={profile?.avatar_url || dicebearUrl(profile?.full_name || "admin")} alt={profile?.full_name || "Admin"} className="w-full h-full object-cover" />
              </div>
              <div className="flex min-w-0 flex-col items-center md:items-start">
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight truncate">{profile?.full_name || "Administrator"}</h1>
                {/* Contact rather than a bio. An administrator is not
                    browsed by anybody, so a sentence about themselves had no
                    reader; how to reach them does. */}
                <div className="mt-3 flex flex-col items-center gap-1.5 md:items-start">
                  <span className="flex items-center gap-1.5 text-[14px] text-white/80">
                    <Mail size={14} className="shrink-0 text-white/60" />
                    {user?.email}
                  </span>
                  <span className="flex items-center gap-1.5 text-[14px] text-white/80">
                    <Phone size={14} className="shrink-0 text-white/60" />
                    {profile?.phone || "No phone set"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0 w-full md:w-auto">
              <button onClick={() => { setName(profile?.full_name || ""); setEditOpen(true); }}
                className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold h-11 px-4 rounded-lg transition-colors backdrop-blur-sm w-full md:w-auto">
                <SquarePenIcon size={16} /> Edit Profile
              </button>
              <button onClick={() => signOut()}
                className="flex items-center justify-center gap-2 !bg-tertiary/40 border border-tertiary/40 hover:!bg-secondary/30 !text-white font-semibold h-11 px-4 rounded-lg transition-colors w-full md:w-auto">
                <LogOut size={16} /> Log Out
              </button>
            </div>
          </div>
        </div>

        {/* The whole body is the settings. Recent activity was a shorter copy
            of the billing page, and this is the only screen where these can be
            changed at all. */}
        <div className="mx-auto w-full max-w-[1400px] p-6 pb-16 md:p-10 md:pb-20 lg:p-12 lg:pb-20">
          {/* Two independent stacks, not a grid. A grid aligns rows, so a
              group with one field left a hole beside one with three. Which
              group sits where is declared in SETTING_COLUMNS. */}
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            {SETTING_COLUMNS.map((groups, col) => (
              <div key={col} className="space-y-8">
                {groups.map((group, i) => (
                  /* A rule between groups, not before the first: on a phone
                     the columns stack, so one group ran straight into the
                     next with only a heading to separate them. */
                  <section key={group} className={i > 0 ? "border-t border-border pt-8" : undefined}>
                    <h3 className="mb-4 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </h3>
                    <div className="space-y-4">
                      {SETTING_FIELDS.filter((f) => f.group === group).map((f) => (
                        <SettingInput
                          key={f.key}
                          field={f}
                          value={settings[f.key] ?? ""}
                          saved={(savedSettings?.[f.key] ?? "").trim()}
                          onChange={(v) => setEdits((d) => ({ ...d, [f.key]: v }))}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-border pt-6">
            {/* The button or the sentence, never both: a disabled button beside
                "all changes saved" says the same thing twice. */}
            {dirty || savingSettings ? (
              <button
                onClick={() => void saveSiteSettings()}
                disabled={savingSettings}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
              >
                {savingSettings && <Loader2 size={14} className="animate-spin" />}
                {savingSettings ? "Saving..." : "Save settings"}
              </button>
            ) : (
              <p className="text-[12.5px] text-muted-foreground">All changes saved.</p>
            )}
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-[#202c33] w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95">
            <div className="flex items-center justify-between p-6 border-b border-[#e9edef] dark:border-[#2a3942]">
              <h2 className="text-[20px] font-bold text-[#111] dark:text-white">Edit Profile</h2>
              <button onClick={() => setEditOpen(false)} className="p-2 text-[#54656f] hover:text-[#111] dark:text-[#aebac1] dark:hover:text-white transition-colors rounded-full hover:bg-[#f8f9fa] dark:hover:bg-[#111b21]"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Full Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#111b21] text-[#111] dark:text-white focus:outline-none focus:border-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-medium text-[#54656f] dark:text-[#aebac1]">Email Address</label>
                <input value={user?.email || ""} disabled
                  className="w-full h-11 px-3 rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329] text-[#54656f] dark:text-[#aebac1] cursor-not-allowed opacity-70" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[#e9edef] dark:border-[#2a3942] bg-[#f8f9fa] dark:bg-[#182329]">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="h-10 px-6 border-[#e9edef] dark:border-[#2a3942]">Cancel</Button>
              <Button onClick={saveName} disabled={saving} className="h-10 px-6 bg-primary hover:bg-primary/90 text-white font-bold">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}


/**
 * One setting.
 *
 * A saved link or address shows as the thing it is: clickable, with an x to
 * clear it and type another. Reading a URL back out of a text box to check it
 * is right is the sort of small friction that stops somebody checking.
 */
function SettingInput({
  field,
  value,
  saved,
  onChange,
}: {
  field: SettingField;
  value: string;
  saved: string;
  onChange: (v: string) => void;
}) {
  const isLink = field.type === "url" || field.type === "email";
  // Only what is stored shows as a link. A half-typed URL is not one yet.
  const showPreview = isLink && !!saved && value.trim() === saved;

  const href = field.type === "email" ? `mailto:${saved}` : saved;

  return (
    <div>
      <label
        htmlFor={`setting-${field.key}`}
        className="mb-1.5 block text-[13px] font-medium text-foreground"
      >
        {field.label}
        <span className="font-normal text-muted-foreground"> ({field.hint})</span>
      </label>

      {showPreview ? (
        <div className="flex h-11 items-center gap-2 rounded-lg border border-border px-3">
          <a
            href={href}
            target={field.type === "url" ? "_blank" : undefined}
            rel="noopener noreferrer"
            className="min-w-0 flex-1 truncate text-[14px] text-primary underline-offset-2 hover:underline"
          >
            {saved}
          </a>
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label={`Clear ${field.label}`}
            title="Change"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <input
          id={`setting-${field.key}`}
          type={field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
          inputMode={field.type === "url" ? "url" : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-[14px] outline-none transition-colors focus:border-primary"
        />
      )}
    </div>
  );
}


import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Camera, ChevronRight, CreditCard, LogOut, Mail, Phone, SquarePenIcon, Users, X } from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { DetailRow } from "@/components/shared/DetailRow";
import { Section } from "@/components/shared/ResumeParts";
import { useAuth } from "@/contexts/AuthContext";
import { getBilling } from "@/services/packageService";
import { money } from "@/services/billingService";
import { getLinkedChildren } from "@/services/parentService";
import { dicebearUrl } from "@/utils/avatar";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/cloudinary";

// ============================================================
// The parent's own profile.
//
// Deliberately not a second billing page. Billing already answers the three
// money questions in three tabs, scoped per child, and this page carried a
// thinner copy of one of them. What belongs here is who the parent is, how to
// reach them, and the children the account is for; the payments block is three
// rows and a way through to the page that owns them.
// ============================================================

/** One figure in the teal banner. Module level: a component declared during
 *  render is a new type each time, so React remounts its subtree. */
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-medium uppercase tracking-wider text-white/70">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

/** Email and phone, said small under the name. */
function HeaderFact({ icon, value }: { icon: React.ReactNode; value?: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-white/85">
      <span className="shrink-0 text-white/70">{icon}</span>
      <span className="truncate">{value || "Not set"}</span>
    </span>
  );
}

/** One labelled box in the edit form. */
function Field({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-border bg-surface px-3 text-[14px] text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

export function ParentProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const { data: billing } = useQuery({
    queryKey: ["billing", user?.id],
    queryFn: () => getBilling(user!.id),
    enabled: !!user?.id,
  });

  const { data: children = [] } = useQuery({
    queryKey: ["linked-children", user?.id],
    queryFn: () => getLinkedChildren(user!.id),
    enabled: !!user?.id,
  });

  /**
   * What has actually been paid, newest first.
   *
   * Only paid invoices: an unpaid one is a thing to do, and this is a record
   * of what happened. The service is derived rather than stored, since an
   * invoice against a course is tutoring and one without is counselling.
   */
  const payments = (billing?.invoices ?? [])
    .filter((i) => i.paidAt)
    .sort((a, b) => (a.paidAt! < b.paidAt! ? 1 : -1));
  const paidTotal = payments.reduce((sum, p) => sum + p.amountCents, 0);

  function openEditor() {
    setForm({ fullName: profile?.full_name ?? "", phone: profile?.phone ?? "" });
    setEditOpen(true);
  }

  /**
   * Actually uploads now.
   *
   * This was a handler that toasted "Profile picture updated successfully!"
   * and did nothing else, so a parent who changed their photo was told it had
   * worked and saw the old one on every reload. Same Cloudinary path as every
   * other avatar in the app.
   */
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");
    try {
      const url = await uploadImage(file, "yakal/avatars");
      const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Photo updated.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      e.target.value = "";
    }
  };

  /**
   * And so does this.
   *
   * Save Changes used to toast "Profile saved!" and close, over two
   * uncontrolled inputs. Nothing was ever written, and there was no phone
   * field at all while the banner showed one, so the number a parent is
   * reached on could not be set from anywhere.
   */
  async function saveProfile() {
    if (!user) return;
    if (!form.fullName.trim()) return toast.error("A name is needed.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: form.fullName.trim(), phone: form.phone.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    await refreshProfile();
    toast.success("Profile saved.");
    setEditOpen(false);
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background pb-12">
        <div className="relative shrink-0 overflow-hidden bg-primary p-6 pb-0 text-white md:p-10 md:pb-0">
          <svg className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]" viewBox="0 0 400 200" preserveAspectRatio="none" fill="none">
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 mx-auto max-w-[1440px]">
            <div className="flex flex-col items-stretch justify-between gap-6 pb-10 md:flex-row md:items-center">
              <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
                <div className="group relative shrink-0 cursor-pointer">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/20 bg-black/20 md:h-28 md:w-28">
                    <img
                      src={profile?.avatar_url || dicebearUrl(profile?.full_name || "parent")}
                      alt={profile?.full_name || "User"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="text-white" size={24} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>

                <div className="flex min-w-0 flex-col items-center md:items-start">
                  <h1 className="truncate text-3xl font-bold tracking-tight md:text-4xl">
                    {profile?.full_name || "Parent"}
                  </h1>
                  {/* Also in the rail below, deliberately: the banner is where
                      you glance to check you are on the right account, and the
                      rail is where you go to copy the number. */}
                  <div className="mt-2 flex flex-col items-center gap-x-6 gap-y-1 sm:flex-row md:items-start">
                    <HeaderFact icon={<Mail size={14} />} value={profile?.email || user?.email} />
                    <HeaderFact icon={<Phone size={14} />} value={profile?.phone} />
                  </div>
                  {profile?.bio && <p className="mt-3 max-w-xl text-[14px] text-white/80">{profile.bio}</p>}
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto md:flex-col">
                <button
                  onClick={openEditor}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20 md:w-auto"
                >
                  <SquarePenIcon size={16} /> Edit Profile
                </button>
                <button
                  onClick={() => signOut()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-tertiary/40 !bg-tertiary/40 px-4 font-medium !text-white transition-colors hover:!bg-secondary/30 md:w-auto"
                >
                  <LogOut size={16} /> Log Out
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 border-t border-white/20 pb-6 pt-6 md:grid-cols-3">
              <Stat label="Children" value={children.length} />
              <Stat label="Payments" value={payments.length} />
              <Stat label="Paid to date" value={money(paidTotal)} />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          <div className="flex flex-col items-start gap-12 lg:flex-row">
            <div className="w-full shrink-0 space-y-6 lg:w-[320px]">
              <h3 className="text-[16px] font-medium text-foreground">Contact details</h3>
              <div className="space-y-4">
                <DetailRow
                  icon={<Mail size={18} />}
                  label="Email"
                  value={profile?.email || user?.email || "-"}
                  href={profile?.email || user?.email ? `mailto:${profile?.email || user?.email}` : undefined}
                  truncate
                />
                <DetailRow
                  icon={<Phone size={18} />}
                  label="Phone"
                  value={profile?.phone || "Not set"}
                  copy={!!profile?.phone}
                />
              </div>
            </div>

            <div className="w-full flex-1 space-y-10">
              <Section icon={<Users size={18} />} title="Children">
                {children.length === 0 ? (
                  <p className="py-4 text-[14px] text-muted-foreground">
                    Nobody linked yet.{" "}
                    <Link to="/parent/children" className="text-primary hover:underline">
                      Add a child
                    </Link>
                    .
                  </p>
                ) : (
                  <div>
                    {children.map((c) => (
                      <Link
                        key={c.id}
                        to="/parent/children"
                        className="group flex items-center gap-4 border-b border-border/60 py-3.5 last:border-b-0"
                      >
                        <img
                          src={c.avatar_url || dicebearUrl(c.full_name)}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-full object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
                            {c.full_name}
                          </p>
                          {c.grade_level && (
                            <p className="text-[13px] text-muted-foreground">{c.grade_level}</p>
                          )}
                        </div>
                        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </Section>

              {/* Three rows and a way through, not the whole ledger. Billing
                  owns payments, scoped per child and filtered by service, and
                  this page used to carry a thinner copy of that list. */}
              <Section icon={<CreditCard size={18} />} title="Recent payments">
                {payments.length === 0 ? (
                  <p className="py-4 text-[14px] text-muted-foreground">
                    Nothing paid yet. Courses and counselling plans appear here once they are bought.
                  </p>
                ) : (
                  <>
                    <div>
                      {payments.slice(0, 3).map((p) => {
                        const paid = new Date(p.paidAt!);
                        return (
                          <div
                            key={p.id}
                            className="flex items-center gap-4 border-b border-border/60 py-3.5 last:border-b-0"
                          >
                            <div className="flex w-10 shrink-0 flex-col items-center text-primary">
                              <span className="text-[17px] font-medium leading-none">{paid.getDate()}</span>
                              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-widest">
                                {paid.toLocaleDateString(undefined, { month: "short" })}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[15px] font-medium text-foreground">{p.description}</p>
                              <p className="truncate text-[13px] text-muted-foreground">
                                {p.courseId ? "Tutoring" : "College counselling"}
                                {p.studentName ? ` · ${p.studentName}` : ""}
                              </p>
                            </div>
                            <span className="shrink-0 text-[15px] font-medium text-foreground">
                              {money(p.amountCents)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <Link
                      to="/parent/billing"
                      className="mt-4 inline-block text-[13px] font-medium text-primary hover:underline"
                    >
                      See all in Billing
                    </Link>
                  </>
                )}
              </Section>
            </div>
          </div>
        </div>
      </div>

      {editOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-popover shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-6">
              <h2 className="text-[20px] font-medium text-foreground">Edit profile</h2>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <div className="flex flex-col items-center gap-3">
                <div className="group relative cursor-pointer">
                  <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border">
                    <img
                      src={profile?.avatar_url || dicebearUrl(profile?.full_name || "parent")}
                      alt="Avatar"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="text-white" size={20} />
                    <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  </label>
                </div>
                <p className="text-[13px] text-muted-foreground">Click to update picture</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={form.fullName}
                  onChange={(v) => setForm((f) => ({ ...f, fullName: v }))}
                />

                <div className="space-y-2">
                  <label className="text-[13px] font-medium text-muted-foreground">Email</label>
                  <input
                    type="email"
                    defaultValue={user?.email || ""}
                    disabled
                    className="h-11 w-full cursor-not-allowed rounded-lg border border-border bg-surface-raised px-3 text-[14px] text-muted-foreground opacity-70"
                  />
                </div>

                {/* A parent is the person Yakal actually rings about a payment
                    or a missed session, and there was nowhere to set this. */}
                <Field
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface-raised p-6">
              <Button variant="outline" onClick={() => setEditOpen(false)} className="h-10 px-6">
                Cancel
              </Button>
              <Button
                onClick={saveProfile}
                disabled={saving}
                className="h-10 bg-primary px-6 font-medium text-white hover:bg-primary-hover"
              >
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

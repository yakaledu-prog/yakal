import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, GraduationCap, LogOut, Mail, SquarePenIcon, X } from "lucide-react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { DetailRow } from "@/components/shared/DetailRow";
import { ResumePanel } from "@/components/shared/ResumePanel";
import { Section } from "@/components/shared/ResumeParts";
import { type SessionListItem } from "@/components/shared/SessionList";
import { ResumeEntryDialog } from "@/components/shared/ResumeEntryDialog";
import { StudentActivities, type StudentSection } from "@/components/shared/StudentActivities";
import { useAuth } from "@/contexts/AuthContext";
import { getStudentSessions } from "@/services/sessions";
import {
  getCollegeProfile,
  upsertAcademics,
  upsertApplication,
  type CollegeProfile,
  type StudentActivity,
  type StudentHonor,
} from "@/services/collegeService";
import { gradYearFromGrade } from "@/config/admissionsCalendar";
import { GRADE_LEVELS } from "@/config/grades";
import { dicebearUrl } from "@/utils/avatar";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/cloudinary";

/**
 * One figure in the teal banner.
 *
 * Module level on purpose: a component declared inside the page body is a new
 * type on every render, so React throws the old subtree away and rebuilds it.
 */
function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="mb-1 text-[13px] font-medium uppercase tracking-wider text-white/70">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

/** A labelled fact in the academic details grid. */
function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[12px] font-medium text-muted-foreground">{label}</p>
      <p className="truncate text-[14px] text-foreground">{value || "Not set"}</p>
    </div>
  );
}

/**
 * A select that lines up with the boxes beside it.
 *
 * Not SelectMenu, which is a 56px floating-label field: next to a 44px
 * label-above input its label sits inside the box and its baseline is 12px
 * low, so a two-column form reads as two forms. Dropdown is the other
 * house control and takes the height.
 */
function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <div className="space-y-2">
      <label className="text-[13px] font-medium text-muted-foreground">{label}</label>
      <Dropdown
        value={value}
        onChange={onChange}
        ariaLabel={label}
        options={options.map((o) => ({ value: o, label: o }))}
        buttonClassName="h-11 text-[14px] font-normal"
      />
    </div>
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

export function StudentProfile() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState<null | "profile" | "academics">(null);
  const [addingTo, setAddingTo] = useState<StudentSection | null>(null);
  const qc = useQueryClient();

  // Stage, intended major, graduation year, GPA, the college list and the
  // essays all arrive together. The same key the college list, the roadmap and
  // the tracker read, so opening any of them first leaves this page warm.
  const collegeKey = ["college-profile", user?.id];
  const { data: college } = useQuery({
    queryKey: collegeKey,
    queryFn: () => getCollegeProfile(user!.id),
    enabled: !!user?.id,
  });

  const app = college?.application ?? null;
  const academics = college?.academics ?? null;
  const activities = (academics?.activities ?? []) as StudentActivity[];
  const honors = (academics?.honors ?? []) as StudentHonor[];

  // Kept for the banner figure alone. The list of finished sessions that used
  // to sit under this page has a page of its own, and repeating six of them
  // here answered a question nobody opens a profile to ask.
  const { data: sessionRows = [] } = useQuery({
    queryKey: ["student-sessions", user?.id],
    queryFn: async () => {
      const { data } = await getStudentSessions(user!.id);
      return (data ?? []) as any[];
    },
    enabled: !!user?.id,
  });

  const sessions: SessionListItem[] = sessionRows.map((s: any) => ({
    id: s.id,
    date: s.date,
    startTime: s.start_time,
    durationMinutes: s.duration_minutes,
    status: s.status,
    title: s.subject,
    personName: s.tutor_name ?? null,
    personAvatarUrl: s.tutor_avatar ?? null,
  }));

  // Grade and major only. The graduation year said the same thing as the
  // grade directly beside it, and it is in the academic details either way.
  const summary = [profile?.grade_level, app?.program_interest].filter(Boolean) as string[];

  /**
   * Write one section back whole.
   *
   * jsonb has no append, and a read-modify-write is fine here: nobody edits
   * their own activities from two tabs at once.
   *
   * onMutate rather than a plain invalidate. Adding an activity is a thing a
   * person clicks and then watches, and a row that waits for the round trip
   * before it appears reads as a page that did not take the click.
   */
  const writeSection = useMutation({
    mutationFn: async (next: { activities?: StudentActivity[]; honors?: StudentHonor[] }) => {
      const res = await upsertAcademics(user!.id, next);
      if (!res.success) throw new Error(res.error || "Could not save that.");
    },
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: collegeKey });
      const previous = qc.getQueryData<CollegeProfile>(collegeKey);
      qc.setQueryData<CollegeProfile>(collegeKey, (old) =>
        old ? { ...old, academics: { ...(old.academics as any), ...next } } : old,
      );
      return { previous };
    },
    onError: (err: Error, _next, ctx) => {
      qc.setQueryData(collegeKey, ctx?.previous);
      toast.error(err.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: collegeKey }),
  });

  function addEntry(entry: Record<string, string>) {
    if (!addingTo) return;
    if (addingTo === "activities") {
      writeSection.mutate({
        activities: [...activities, entry as unknown as StudentActivity],
      });
    } else {
      writeSection.mutate({
        honors: [...honors, entry as unknown as StudentHonor],
      });
    }
    setAddingTo(null);
  }

  function removeEntry(section: StudentSection, index: number) {
    if (section === "activities") {
      writeSection.mutate({
        activities: activities.filter((_, i) => i !== index),
      });
    } else {
      writeSection.mutate({ honors: honors.filter((_, i) => i !== index) });
    }
  }

  // The form is opened from the profile, so it starts from what is stored
  // rather than from empty, and only writes what changed.
  const [form, setForm] = useState({
    fullName: "",
    gradeLevel: "",
    bio: "",
    major: "",
    gpa: "",
    sat: "",
    act: "",
  });
  const [saving, setSaving] = useState(false);

  /**
   * Both editors read from the same form, and each writes only its own half.
   *
   * Two dialogs rather than one: the Edit beside Academic details opening a
   * sheet that led with the avatar and the bio asked the student to scroll
   * past their own face to correct a test score.
   */
  function openEditor(which: "profile" | "academics") {
    setForm({
      fullName: profile?.full_name ?? "",
      gradeLevel: profile?.grade_level ?? "",
      major: app?.program_interest ?? "",
      bio: profile?.bio ?? "",
      gpa: academics?.gpa != null ? String(academics.gpa) : "",
      sat: academics?.sat_score != null ? String(academics.sat_score) : "",
      act: academics?.act_score != null ? String(academics.act_score) : "",
    });
    setEditing(which);
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) return toast.error("Please choose an image under 2 MB.");
    try {
      const url = await uploadImage(file, "yakal/avatars");
      const { error: saveErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", user.id);
      if (saveErr) throw saveErr;
      await refreshProfile();
      toast.success("Photo updated.");
    } catch (err: any) {
      toast.error(err.message || "Upload failed.");
    } finally {
      e.target.value = "";
    }
  };

  async function saveProfile() {
    if (!user) return;
    if (!form.fullName.trim()) return toast.error("A name is needed.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: form.fullName.trim(), bio: form.bio.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);

    await refreshProfile();
    toast.success("Profile saved.");
    setEditing(null);
  }

  async function saveAcademics() {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({ grade_level: form.gradeLevel || null })
      .eq("id", user.id);
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // The major lives on the college application, and the graduation year is
    // re-derived rather than asked for: correcting the grade in September has
    // to move the year with it, or the roadmap keeps showing last year's
    // timeline.
    //
    // Stage is deliberately not written here. It drives the roadmap and the
    // counsellor's list, and a student hand-picking "Submitted" with nothing
    // submitted makes both of them lie. It is set in the tracker, next to the
    // per-school statuses that are the evidence for it.
    const appRes = await upsertApplication(user.id, {
      program_interest: form.major.trim() || null,
      grad_year: gradYearFromGrade(form.gradeLevel, new Date()) ?? app?.grad_year ?? null,
    });
    if (!appRes.success) {
      setSaving(false);
      return toast.error(appRes.error || "Could not save your college details.");
    }

    // The same row the counselor's Academics tab writes, so a score entered
    // here reads back there rather than becoming a second copy of it.
    const acaRes = await upsertAcademics(user.id, {
      gpa: form.gpa.trim() ? Number(form.gpa) : null,
      sat_score: form.sat.trim() ? Number(form.sat) : null,
      act_score: form.act.trim() ? Number(form.act) : null,
    });
    setSaving(false);
    if (!acaRes.success) return toast.error(acaRes.error || "Could not save your scores.");

    await refreshProfile();
    qc.invalidateQueries({ queryKey: collegeKey });
    toast.success("Academic details saved.");
    setEditing(null);
  }

  return (
    <PageWrapper className="!p-0">
      <div className="flex-1 min-h-screen bg-background pb-12">
        {/* Teal Header */}
        <div className="relative shrink-0 overflow-hidden bg-primary p-6 pb-0 text-white md:p-10 md:pb-0">
          <svg
            className="pointer-events-none absolute right-0 top-0 h-full w-[60%] text-white/5 md:w-[40%]"
            viewBox="0 0 400 200"
            preserveAspectRatio="none"
            fill="none"
          >
            <path d="M 0 200 Q 100 50, 200 120 T 400 0 L 400 200 Z" fill="currentColor" />
            <path
              d="M 0 200 L 100 80 L 200 150 L 300 40 L 400 100 L 400 200 Z"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              opacity="0.3"
            />
            <circle cx="100" cy="80" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="200" cy="150" r="4" fill="currentColor" opacity="0.5" />
            <circle cx="300" cy="40" r="4" fill="currentColor" opacity="0.5" />
          </svg>

          <div className="relative z-10 mx-auto max-w-[1440px]">
            <div className="flex flex-col items-stretch justify-between gap-6 pb-10 md:flex-row md:items-center">
              {/* Centered on a phone: stacked and left-aligned, the avatar sat
                  in a wide empty band and read as misplaced rather than as a
                  column. */}
              <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
                <div className="group relative shrink-0 cursor-pointer">
                  <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-white/20 bg-black/20 md:h-28 md:w-28">
                    <img
                      src={profile?.avatar_url || dicebearUrl(profile?.full_name || "student")}
                      alt={profile?.full_name || "User"}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera className="text-white" size={24} />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>

                <div className="flex min-w-0 flex-col items-center md:items-start">
                  <h1 className="truncate text-3xl font-bold tracking-tight md:text-4xl">
                    {profile?.full_name || "Student"}
                  </h1>
                  {/* The name alone left the avatar unbalanced. This is the
                      same three facts the roadmap runs on, said in one line. */}
                  {summary.length > 0 && (
                    <p className="mt-1.5 text-[14px] text-white/80">{summary.join(" · ")}</p>
                  )}
                  {profile?.bio && (
                    <p className="mt-3 max-w-xl text-[14px] text-white/80">{profile.bio}</p>
                  )}
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 sm:flex-row md:w-auto md:flex-col">
                <button
                  onClick={() => openEditor("profile")}
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

            {/* Three, not the four contact facts that were here. Email and
                phone belong beside the rest of the details, and a count of
                colleges is the only one of them that was a figure. */}
            <div className="grid grid-cols-2 gap-6 border-t border-white/20 pb-6 pt-6 md:grid-cols-3">
              <Stat label="Colleges on list" value={college?.schools.length ?? 0} />
              <Stat label="Essays" value={college?.essays.length ?? 0} />
              <Stat
                label="Sessions done"
                value={sessions.filter((s) => s.status === "completed").length}
              />
            </div>
          </div>
        </div>

        {/* Lower Content */}
        <div className="mx-auto max-w-[1440px] p-6 md:p-10">
          <div className="flex flex-col items-start gap-12 lg:flex-row">
            {/* Details */}
            <div className="w-full shrink-0 space-y-6 lg:w-[320px]">
              <h3 className="text-[16px] font-medium text-foreground">Contact details</h3>
              <div className="space-y-4">
                <DetailRow
                  icon={<Mail size={18} />}
                  label="Email"
                  value={profile?.email || user?.email || "-"}
                  href={
                    profile?.email || user?.email
                      ? `mailto:${profile?.email || user?.email}`
                      : undefined
                  }
                  truncate
                />

                {/* The same private bucket a tutor's CV goes to, so a student's
                  activities resume is not a public Cloudinary URL carrying
                  their school and their address. Storage policy is written
                  against the folder, not the role, so nothing new was needed.

                  Note it is readable by the student and by an admin only. A
                  counsellor who should review it reads the Drive copy in the
                  documents panel. */}
                {user && (
                  <ResumePanel
                    variant="row"
                    userId={user.id}
                    resumePath={(profile as any)?.resume_url ?? null}
                    onReplaced={() => refreshProfile?.()}
                  />
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="w-full flex-1 space-y-10">
              <Section
                icon={<GraduationCap size={18} />}
                title="Academic details"
                addLabel="Edit"
                onAdd={() => openEditor("academics")}
              >
                <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-3">
                  {/* Derived from the grade, not stored separately, so it
                      moves when the grade is corrected. */}
                  <Fact label="Graduation year" value={app?.grad_year} />
                  <Fact label="Intended major" value={app?.program_interest} />
                  <Fact label="GPA" value={academics?.gpa} />
                  <Fact label="SAT" value={academics?.sat_score} />
                  <Fact label="ACT" value={academics?.act_score} />
                  {/* Only when there is one. Yakal's students are US
                      applicants, so an empty TOEFL row is a question almost
                      none of them are being asked. */}
                  {academics?.toefl_score != null && (
                    <Fact label="TOEFL" value={academics.toefl_score} />
                  )}
                </div>
              </Section>

              <StudentActivities
                activities={activities}
                honors={honors}
                onAdd={setAddingTo}
                onRemove={removeEntry}
              />
            </div>
          </div>
        </div>
      </div>

      {addingTo && (
        <ResumeEntryDialog section={addingTo} onSave={addEntry} onClose={() => setAddingTo(null)} />
      )}

      {/* Edit Profile Modal */}
      {editing && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-popover shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-border p-6">
              <h2 className="text-[20px] font-medium text-foreground">
                {editing === "profile" ? "Edit profile" : "Academic details"}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              {editing === "profile" ? (
                <>
                  <div className="flex flex-col items-center gap-3">
                    <div className="group relative cursor-pointer">
                      <div className="h-20 w-20 overflow-hidden rounded-full border-2 border-border">
                        <img
                          src={profile?.avatar_url || dicebearUrl(profile?.full_name || "student")}
                          alt="Avatar"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <Camera className="text-white" size={20} />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
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
                  </div>

                  <div className="space-y-2">
                    <label className="text-[13px] font-medium text-muted-foreground">About you</label>
                    <textarea
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                      rows={3}
                      placeholder="What you are working on, what you find hard, anything a tutor should know."
                      className="w-full resize-y rounded-lg border border-border bg-surface px-3 py-2.5 leading-relaxed text-[14px] text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Grade was asked for at onboarding and then had nowhere to
                      be corrected, which matters every September. The
                      graduation year follows from it and is not asked for. */}
                  <SelectField
                    label="Grade"
                    value={form.gradeLevel}
                    onChange={(v) => setForm((f) => ({ ...f, gradeLevel: v }))}
                    options={GRADE_LEVELS}
                  />

                  <Field
                    label="Intended major"
                    value={form.major}
                    onChange={(v) => setForm((f) => ({ ...f, major: v }))}
                    placeholder="e.g. Computer Science"
                  />

                  <Field
                    label="GPA"
                    value={form.gpa}
                    onChange={(v) => setForm((f) => ({ ...f, gpa: v }))}
                    placeholder="3.85"
                  />

                  <Field
                    label="SAT score"
                    value={form.sat}
                    onChange={(v) => setForm((f) => ({ ...f, sat: v }))}
                    placeholder="1480"
                  />

                  <Field
                    label="ACT score"
                    value={form.act}
                    onChange={(v) => setForm((f) => ({ ...f, act: v }))}
                    placeholder="32"
                  />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border bg-surface-raised p-6">
              <Button variant="outline" onClick={() => setEditing(null)} className="h-10 px-6">
                Cancel
              </Button>
              <Button
                onClick={editing === "profile" ? saveProfile : saveAcademics}
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

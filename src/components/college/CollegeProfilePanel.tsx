import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { toast } from "sonner";
import {
  GraduationCap, Plus, Trash2, Check, Loader2, CalendarDays, FileText,
  BookOpen, ClipboardList, Award, School,
} from "lucide-react";
import {
  getCollegeProfile, upsertApplication, addSchool, updateSchool, deleteSchool,
  addRequirement, toggleRequirement, deleteRequirement, addEssay, updateEssay, deleteEssay,
  upsertAcademics, addRecommendation, updateRecommendation, deleteRecommendation,
  addTask, updateTask, deleteTask,
  type SchoolTier, type SchoolStatus, type AppStage, type EssayStatus, type CollegeListItem,
} from "@/services/collegeService";

const PRIMARY = "#1099A1";
const TIERS: SchoolTier[] = ["dream", "target", "safety"];
const SCHOOL_STATUSES: SchoolStatus[] = ["considering", "applying", "submitted", "accepted", "rejected", "waitlisted"];
const STAGES: AppStage[] = ["research", "apply", "submitted", "decisions", "enrolled"];
const ESSAY_STATUSES: EssayStatus[] = ["todo", "drafting", "in_review", "done"];

type Tab = "overview" | "list" | "essays" | "academics" | "recs" | "tasks";

const tierLabel: Record<SchoolTier, string> = { dream: "Dream", target: "Target", safety: "Safety" };
const tierColor: Record<SchoolTier, string> = {
  dream: "bg-[#CAA25F]/15 text-[#8a6a2a]",
  target: "bg-[#1099A1]/10 text-[#1099A1]",
  safety: "bg-[#97CE9D]/25 text-[#2d7a54]",
};

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CollegeProfilePanel({
  studentId,
  readOnly = false,
  canEditNotes = false,
  renderHeader,
}: {
  studentId: string;
  readOnly?: boolean;
  canEditNotes?: boolean;
  renderHeader?: (tabsNode: React.ReactNode) => React.ReactNode;
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading } = useQuery({
    queryKey: ["college-profile", studentId],
    queryFn: () => getCollegeProfile(studentId),
    enabled: !!studentId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["college-profile", studentId] });
  async function run(p: Promise<{ success: boolean; error?: string }>, okMsg?: string): Promise<void> {
    const r = await p;
    if (!r.success) {
      toast.error(r.error || "Something went wrong.");
      return;
    }
    if (okMsg) toast.success(okMsg);
    invalidate();
  }

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin" style={{ color: PRIMARY }} />
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "overview", label: "Overview", icon: <GraduationCap size={15} /> },
    { key: "list", label: "College List", icon: <School size={15} />, count: data.schools.length },
    { key: "essays", label: "Essays", icon: <FileText size={15} />, count: data.essays.length },
    { key: "academics", label: "Academics", icon: <BookOpen size={15} /> },
    { key: "recs", label: "Recommendations", icon: <Award size={15} />, count: data.recommendations.length },
    { key: "tasks", label: "Tasks", icon: <ClipboardList size={15} />, count: data.tasks.length },
  ];

  const tabsNode = (
    <div className="flex gap-6 overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setTab(t.key)}
          className={cn(
            "flex items-center gap-1.5 px-1 py-3 text-[13px] font-bold uppercase tracking-wider whitespace-nowrap border-b-[3px] transition-colors",
            tab === t.key
              ? "border-white text-white"
              : "border-transparent text-white/70 hover:text-white hover:border-white/30"
          )}
        >
          {t.icon}{t.label}
          {t.count != null && <span className="text-[11px] opacity-80 font-medium">({t.count})</span>}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-background dark:bg-[#111b21]">
      {renderHeader ? (
        renderHeader(tabsNode)
      ) : (
        <div className="bg-[#1099A1] text-white px-6 pt-6 md:px-10 md:pt-10">
          <div className="">{tabsNode}</div>
        </div>
      )}

      <div className="w-full auto p-6 md:p-10">
        {tab === "overview" && (
          <OverviewTab data={data!} readOnly={readOnly} canEditNotes={canEditNotes} studentId={studentId} run={run} />
        )}
        {tab === "list" && <ListTab data={data!} readOnly={readOnly} studentId={studentId} run={run} />}
        {tab === "essays" && <EssaysTab data={data!} readOnly={readOnly} studentId={studentId} run={run} />}
        {tab === "academics" && <AcademicsTab data={data!} readOnly={readOnly} studentId={studentId} run={run} />}
        {tab === "recs" && <RecsTab data={data!} readOnly={readOnly} studentId={studentId} run={run} />}
        {tab === "tasks" && <TasksTab data={data!} readOnly={readOnly} studentId={studentId} run={run} />}
      </div>
    </div>
  );
}

type TabProps = {
  data: Awaited<ReturnType<typeof getCollegeProfile>>;
  readOnly: boolean;
  studentId: string;
  run: (p: Promise<{ success: boolean; error?: string }>, okMsg?: string) => Promise<void>;
};

const card = "bg-white dark:bg-[#111b21] border border-[#e9edef] dark:border-[#2a3942] rounded-xl";
const field =
  "w-full bg-white dark:bg-[#1a2730] border border-[#e9edef] dark:border-[#2a3942] rounded-lg px-3 py-2 text-[14px] text-[#111] dark:text-white outline-none focus:border-[#1099A1]";
const btnPrimary =
  "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1099A1] text-white text-[13px] font-semibold hover:bg-[#0d848b] transition-colors disabled:opacity-60";

// --- Overview -----------------------------------------------
function OverviewTab({ data, readOnly, canEditNotes, studentId, run }: TabProps & { canEditNotes: boolean }) {
  const app = data.application;
  const [stage, setStage] = useState<AppStage>(app?.stage || "research");
  const [major, setMajor] = useState(app?.program_interest || "");
  const [gradYear, setGradYear] = useState(app?.grad_year ? String(app.grad_year) : "");
  const [notes, setNotes] = useState(app?.counselor_notes || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await run(
      upsertApplication(studentId, {
        stage,
        program_interest: major.trim() || null,
        grad_year: gradYear ? Number(gradYear) : null,
        ...(canEditNotes ? { counselor_notes: notes.trim() || null } : {}),
      }),
      "Saved."
    );
    setSaving(false);
  };

  const submittedSchools = data.schools.filter((s) => ["submitted", "accepted", "rejected", "waitlisted"].includes(s.status)).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Schools" value={data.schools.length} />
        <Stat label="Submitted" value={submittedSchools} />
        <Stat label="Essays" value={data.essays.length} />
        <Stat label="Open tasks" value={data.tasks.filter((t) => t.status !== "done").length} />
      </div>

      <div className={cn(card, "p-5 space-y-4")}>
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">Stage</label>
            <select className={field} value={stage} disabled={readOnly} onChange={(e) => setStage(e.target.value as AppStage)}>
              {STAGES.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">Intended major</label>
            <input className={field} value={major} disabled={readOnly} onChange={(e) => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">Graduation year</label>
            <input className={field} type="number" value={gradYear} disabled={readOnly} onChange={(e) => setGradYear(e.target.value)} placeholder="2026" />
          </div>
        </div>

        <div>
          <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">
            Counselor notes {canEditNotes ? "" : "(read-only)"}
          </label>
          <textarea
            className={cn(field, "min-h-[80px] resize-y")}
            value={notes}
            disabled={readOnly || !canEditNotes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={canEditNotes ? "Guidance for this student…" : "No notes yet."}
          />
        </div>

        {!readOnly && (
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save overview
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={cn(card, "p-4")}>
      <p className="text-2xl font-bold text-[#111] dark:text-white leading-none">{value}</p>
      <p className="text-[12px] text-[#667781] dark:text-[#8696a0] mt-1.5">{label}</p>
    </div>
  );
}

// --- College List -------------------------------------------
function ListTab({ data, readOnly, studentId, run }: TabProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SchoolTier>("target");
  const [deadline, setDeadline] = useState("");

  const add = async () => {
    if (!name.trim()) return toast.error("Enter a school name.");
    await run(addSchool(studentId, { school_name: name.trim(), tier, deadline: deadline || null }), "School added.");
    setName(""); setDeadline(""); setTier("target"); setShowAdd(false);
  };

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div>
          {showAdd ? (
            <div className={cn(card, "p-4 space-y-3")}>
              <input className={field} placeholder="School name" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-3">
                <select className={field} value={tier} onChange={(e) => setTier(e.target.value as SchoolTier)}>
                  {TIERS.map((t) => <option key={t} value={t}>{tierLabel[t]}</option>)}
                </select>
                <input className={field} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className={btnPrimary} onClick={add}><Plus size={15} /> Add</button>
                <button className="px-3.5 py-2 text-[13px] font-semibold text-[#667781]" onClick={() => setShowAdd(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className={btnPrimary} onClick={() => setShowAdd(true)}><Plus size={15} /> Add school</button>
          )}
        </div>
      )}

      {data.schools.length === 0 ? (
        <Empty icon={<School size={36} />} text="No schools on the list yet." />
      ) : (
        TIERS.map((t) => {
          const schools = data.schools.filter((s) => s.tier === t);
          if (schools.length === 0) return null;
          return (
            <div key={t}>
              <p className={cn("inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2", tierColor[t])}>{tierLabel[t]}</p>
              <div className="space-y-2">
                {schools.map((s) => <SchoolRow key={s.id} school={s} readOnly={readOnly} run={run} />)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SchoolRow({ school, readOnly, run }: { school: CollegeListItem; readOnly: boolean; run: TabProps["run"] }) {
  const [open, setOpen] = useState(false);
  const [reqLabel, setReqLabel] = useState("");
  const reqs = school.requirements || [];
  const done = reqs.filter((r) => r.is_complete).length;

  return (
    <div className={cn(card, "p-4")}>
      <div className="flex items-center justify-between gap-3">
        <button className="flex-1 min-w-0 text-left" onClick={() => setOpen((v) => !v)}>
          <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{school.school_name}</p>
          <p className="text-[12px] text-[#667781] dark:text-[#8696a0] flex items-center gap-2">
            <CalendarDays size={12} /> {fmtDate(school.deadline)}
            {reqs.length > 0 && <span>· {done}/{reqs.length} requirements</span>}
          </p>
        </button>
        <select
          className="text-[12px] font-semibold rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#1a2730] px-2 py-1.5 outline-none"
          value={school.status}
          disabled={readOnly}
          onChange={(e) => run(updateSchool(school.id, { status: e.target.value as SchoolStatus }))}
        >
          {SCHOOL_STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
        {!readOnly && (
          <button className="text-[#c0392b] p-1.5 hover:bg-[#c0392b]/10 rounded-lg" onClick={() => run(deleteSchool(school.id), "Removed.")}>
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 pt-3 border-t border-[#e9edef] dark:border-[#2a3942] space-y-1.5">
          {reqs.map((r) => (
            <div key={r.id} className="flex items-center gap-2">
              <button
                disabled={readOnly}
                onClick={() => run(toggleRequirement(r.id, !r.is_complete))}
                className={cn("w-4 h-4 rounded border flex items-center justify-center shrink-0",
                  r.is_complete ? "bg-[#1099A1] border-[#1099A1] text-white" : "border-[#8696a0]")}
              >
                {r.is_complete && <Check size={11} />}
              </button>
              <span className={cn("text-[13px] flex-1", r.is_complete ? "line-through text-[#8696a0]" : "text-[#111] dark:text-[#e9edef]")}>{r.label}</span>
              {r.due_date && <span className="text-[11px] text-[#8696a0]">{fmtDate(r.due_date)}</span>}
              {!readOnly && (
                <button className="text-[#8696a0] hover:text-[#c0392b]" onClick={() => run(deleteRequirement(r.id))}><Trash2 size={13} /></button>
              )}
            </div>
          ))}
          {!readOnly && (
            <div className="flex gap-2 pt-1">
              <input
                className={cn(field, "!py-1.5 text-[13px]")}
                placeholder="Add a requirement…"
                value={reqLabel}
                onChange={(e) => setReqLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && reqLabel.trim()) {
                    run(addRequirement(school.id, reqLabel.trim()));
                    setReqLabel("");
                  }
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Essays -------------------------------------------------
function EssaysTab({ data, readOnly, studentId, run }: TabProps) {
  const [title, setTitle] = useState("");
  const add = async () => {
    if (!title.trim()) return toast.error("Enter an essay title.");
    await run(addEssay(studentId, { title: title.trim(), kind: "supplement", status: "todo" }), "Essay added.");
    setTitle("");
  };
  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex gap-2">
          <input className={field} placeholder="New essay title…" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className={btnPrimary} onClick={add}><Plus size={15} /> Add</button>
        </div>
      )}
      {data.essays.length === 0 ? (
        <Empty icon={<FileText size={36} />} text="No essays yet." />
      ) : (
        data.essays.map((e) => (
          <div key={e.id} className={cn(card, "p-4 flex items-center justify-between gap-3")}>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{e.title}</p>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0]">
                {e.kind === "personal_statement" ? "Personal statement" : "Supplement"} · due {fmtDate(e.due_date)}
              </p>
            </div>
            <select
              className="text-[12px] font-semibold rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#1a2730] px-2 py-1.5 outline-none"
              value={e.status}
              disabled={readOnly}
              onChange={(ev) => run(updateEssay(e.id, { status: ev.target.value as EssayStatus }))}
            >
              {ESSAY_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            {!readOnly && (
              <button className="text-[#c0392b] p-1.5 hover:bg-[#c0392b]/10 rounded-lg" onClick={() => run(deleteEssay(e.id), "Removed.")}><Trash2 size={15} /></button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// --- Academics ----------------------------------------------
function AcademicsTab({ data, readOnly, studentId, run }: TabProps) {
  const a = data.academics;
  const [gpa, setGpa] = useState(a?.gpa != null ? String(a.gpa) : "");
  const [sat, setSat] = useState(a?.sat_score != null ? String(a.sat_score) : "");
  const [act, setAct] = useState(a?.act_score != null ? String(a.act_score) : "");
  const [toefl, setToefl] = useState(a?.toefl_score != null ? String(a.toefl_score) : "");
  const [ap, setAp] = useState((a?.ap_courses || []).join(", "));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await run(
      upsertAcademics(studentId, {
        gpa: gpa ? Number(gpa) : null,
        sat_score: sat ? Number(sat) : null,
        act_score: act ? Number(act) : null,
        toefl_score: toefl ? Number(toefl) : null,
        ap_courses: ap.trim() ? ap.split(",").map((x) => x.trim()).filter(Boolean) : [],
      }),
      "Academics saved."
    );
    setSaving(false);
  };

  return (
    <div className={cn(card, "p-5 space-y-4 max-w-xl")}>
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "GPA", value: gpa, set: setGpa, ph: "3.85" },
          { label: "SAT", value: sat, set: setSat, ph: "1480" },
          { label: "ACT", value: act, set: setAct, ph: "32" },
          { label: "TOEFL", value: toefl, set: setToefl, ph: "108" },
        ].map((f) => (
          <div key={f.label}>
            <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">{f.label}</label>
            <input className={field} value={f.value} disabled={readOnly} onChange={(e) => f.set(e.target.value)} placeholder={f.ph} />
          </div>
        ))}
      </div>
      <div>
        <label className="text-[12px] font-semibold text-[#667781] dark:text-[#8696a0] block mb-1.5">AP courses (comma-separated)</label>
        <input className={field} value={ap} disabled={readOnly} onChange={(e) => setAp(e.target.value)} placeholder="AP Calculus BC, AP Physics C" />
      </div>
      {!readOnly && (
        <button className={btnPrimary} onClick={save} disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Save academics
        </button>
      )}
    </div>
  );
}

// --- Recommendations ----------------------------------------
function RecsTab({ data, readOnly, studentId, run }: TabProps) {
  const [name, setName] = useState("");
  const [rel, setRel] = useState("");
  const add = async () => {
    if (!name.trim()) return toast.error("Enter the recommender's name.");
    await run(addRecommendation(studentId, { recommender_name: name.trim(), relationship: rel.trim() || null, status: "requested" }), "Added.");
    setName(""); setRel("");
  };
  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className={cn(card, "p-4 grid sm:grid-cols-[1fr_1fr_auto] gap-2")}>
          <input className={field} placeholder="Recommender name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={field} placeholder="Relationship (e.g. Math teacher)" value={rel} onChange={(e) => setRel(e.target.value)} />
          <button className={btnPrimary} onClick={add}><Plus size={15} /> Add</button>
        </div>
      )}
      {data.recommendations.length === 0 ? (
        <Empty icon={<Award size={36} />} text="No recommendations requested yet." />
      ) : (
        data.recommendations.map((r) => (
          <div key={r.id} className={cn(card, "p-4 flex items-center justify-between gap-3")}>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-[#111] dark:text-white truncate">{r.recommender_name}</p>
              <p className="text-[12px] text-[#667781] dark:text-[#8696a0] truncate">{r.relationship || "-"}</p>
            </div>
            <select
              className="text-[12px] font-semibold rounded-lg border border-[#e9edef] dark:border-[#2a3942] bg-white dark:bg-[#1a2730] px-2 py-1.5 outline-none"
              value={r.status}
              disabled={readOnly}
              onChange={(e) => run(updateRecommendation(r.id, { status: e.target.value as any }))}
            >
              {["requested", "received", "submitted"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {!readOnly && (
              <button className="text-[#c0392b] p-1.5 hover:bg-[#c0392b]/10 rounded-lg" onClick={() => run(deleteRecommendation(r.id), "Removed.")}><Trash2 size={15} /></button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// --- Tasks --------------------------------------------------
function TasksTab({ data, readOnly, studentId, run }: TabProps) {
  const [title, setTitle] = useState("");
  const add = async () => {
    if (!title.trim()) return toast.error("Enter a task.");
    await run(addTask(studentId, { title: title.trim(), status: "todo" }), "Task added.");
    setTitle("");
  };
  return (
    <div className="space-y-2.5">
      {!readOnly && (
        <div className="flex gap-2">
          <input className={field} placeholder="New task…" value={title} onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()} />
          <button className={btnPrimary} onClick={add}><Plus size={15} /> Add</button>
        </div>
      )}
      {data.tasks.length === 0 ? (
        <Empty icon={<ClipboardList size={36} />} text="No tasks yet." />
      ) : (
        data.tasks.map((t) => (
          <div key={t.id} className={cn(card, "p-3.5 flex items-center gap-3")}>
            <button
              disabled={readOnly}
              onClick={() => run(updateTask(t.id, { status: t.status === "done" ? "todo" : "done" }))}
              className={cn("w-5 h-5 rounded-md border flex items-center justify-center shrink-0",
                t.status === "done" ? "bg-[#1099A1] border-[#1099A1] text-white" : "border-[#8696a0]")}
            >
              {t.status === "done" && <Check size={13} />}
            </button>
            <span className={cn("flex-1 text-[14px]", t.status === "done" ? "line-through text-[#8696a0]" : "text-[#111] dark:text-[#e9edef]")}>{t.title}</span>
            {t.due_date && <span className="text-[11px] text-[#8696a0]">{fmtDate(t.due_date)}</span>}
            {!readOnly && (
              <button className="text-[#8696a0] hover:text-[#c0392b]" onClick={() => run(deleteTask(t.id))}><Trash2 size={14} /></button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-14 text-[#8696a0]">
      <div className="flex justify-center mb-3 opacity-60">{icon}</div>
      <p className="text-[14px]">{text}</p>
    </div>
  );
}

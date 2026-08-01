import { supabase } from "@/lib/supabase";

// ============================================================
// What a parent has actually bought.
//
// There is no packages table. A purchase today is an invoice with the chosen
// slots in its booking column, plus the enrolment and sessions that fulfilment
// wrote from it. So a package is derived: one course for one child, the
// sessions paid for, and how many of those have been used.
//
// Deriving it rather than adding a table on a guess keeps the billing designs
// honest without committing to a schema before the shape is settled. If
// monthly plans go ahead this becomes a real table, and these fields are the
// ones it will need.
// ============================================================

export interface CoursePackage {
  courseId: string;
  courseTitle: string;
  subject: string;
  thumbnailUrl: string | null;
  studentId: string;
  studentName: string;
  studentAvatarUrl: string | null;
  tutorId: string | null;
  tutorName: string | null;
  tutorAvatarUrl: string | null;
  /** Sessions paid for across every invoice on this course. */
  slotsPurchased: number;
  slotsCompleted: number;
  slotsUpcoming: number;
  /** Paid for but never scheduled. Room to book more without buying more. */
  slotsUnscheduled: number;
  totalPaidCents: number;
  pricePerSlotCents: number | null;
  lastPaidAt: string | null;
  /** No such thing yet. Every purchase today is one-off. */
  recurring: boolean;
  /** The actual sessions, for showing what was booked and when. */
  sessions: PackageSession[];
}

export interface PackageSession {
  id: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  status: string;
}

export interface BillingInvoice {
  id: string;
  description: string;
  amountCents: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
  studentId: string | null;
  studentName: string | null;
  courseId: string | null;
}

export interface BillingData {
  packages: CoursePackage[];
  invoices: BillingInvoice[];
}

export async function getBilling(parentId: string): Promise<BillingData> {
  const { data: invoiceRows, error } = await supabase
    .from("invoices")
    .select(`id, description, amount_cents, status, created_at, paid_at, booking, course_id, student_id,
             student:profiles!invoices_student_id_fkey (id, full_name, avatar_url),
             course:courses (id, title, subject, thumbnail_url, price_cents, tutor_id,
                             tutor:profiles!courses_tutor_id_fkey (full_name, avatar_url))`)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getBilling failed:", error);
    return { packages: [], invoices: [] };
  }

  const rows = invoiceRows ?? [];

  const invoices: BillingInvoice[] = rows.map((r: any) => ({
    id: r.id,
    description: r.description,
    amountCents: r.amount_cents,
    status: r.status,
    createdAt: r.created_at,
    paidAt: r.paid_at,
    studentId: r.student_id,
    studentName: r.student?.full_name ?? null,
    courseId: r.course_id,
  }));

  // Sessions tell us what has been used. Purchases tell us what was bought.
  const courseIds = [...new Set(rows.map((r: any) => r.course_id).filter(Boolean))] as string[];
  const sessionsByKey = new Map<string, PackageSession[]>();

  if (courseIds.length > 0) {
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id, course_id, student_id, status, date, start_time, duration_minutes")
      .in("course_id", courseIds)
      .order("date", { ascending: true });

    for (const s of sessions ?? []) {
      const key = `${s.course_id}|${s.student_id}`;
      const list = sessionsByKey.get(key) ?? [];
      list.push({
        id: s.id,
        date: s.date,
        startTime: s.start_time,
        durationMinutes: s.duration_minutes,
        status: s.status,
      });
      sessionsByKey.set(key, list);
    }
  }

  // One package per course per child, summed across however many times it was
  // topped up.
  const byKey = new Map<string, CoursePackage>();

  for (const r of rows as any[]) {
    if (r.status !== "paid" || !r.course_id || !r.student_id) continue;

    const key = `${r.course_id}|${r.student_id}`;
    const slots = Array.isArray(r.booking) ? r.booking.length : 1;

    const existing = byKey.get(key);
    if (existing) {
      existing.slotsPurchased += slots;
      existing.totalPaidCents += r.amount_cents ?? 0;
      if (r.paid_at && (!existing.lastPaidAt || r.paid_at > existing.lastPaidAt)) {
        existing.lastPaidAt = r.paid_at;
      }
      continue;
    }

    byKey.set(key, {
      courseId: r.course_id,
      courseTitle: r.course?.title ?? "A course",
      subject: r.course?.subject ?? "",
      thumbnailUrl: r.course?.thumbnail_url ?? null,
      studentId: r.student_id,
      studentName: r.student?.full_name ?? "Your child",
      studentAvatarUrl: r.student?.avatar_url ?? null,
      tutorId: r.course?.tutor_id ?? null,
      tutorName: r.course?.tutor?.full_name ?? null,
      tutorAvatarUrl: r.course?.tutor?.avatar_url ?? null,
      slotsPurchased: slots,
      slotsCompleted: 0,
      slotsUpcoming: 0,
      slotsUnscheduled: 0,
      totalPaidCents: r.amount_cents ?? 0,
      pricePerSlotCents: r.course?.price_cents ?? null,
      lastPaidAt: r.paid_at,
      recurring: false,
      sessions: [],
    });
  }

  const packages = [...byKey.values()].map((p) => {
    const list = sessionsByKey.get(`${p.courseId}|${p.studentId}`) ?? [];
    p.sessions = list;
    const used = {
      completed: list.filter((s) => s.status === "completed").length,
      upcoming: list.filter((s) => s.status === "upcoming").length,
    };
    p.slotsCompleted = used.completed;
    p.slotsUpcoming = used.upcoming;
    // Never negative: a session can be added by hand without a purchase behind
    // it, and a package showing "-2 left" would be nonsense.
    p.slotsUnscheduled = Math.max(0, p.slotsPurchased - used.completed - used.upcoming);
    return p;
  });

  return { packages, invoices };
}

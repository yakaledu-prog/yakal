import { sendEmail, layout, appUrl } from "./email";

// ============================================================
// What happens after a course is paid for.
//
// Marking the invoice paid was the whole of it before, so a parent paid and
// nothing appeared anywhere: no enrolment, no sessions, and nobody told. This
// is the rest of it.
//
// Shared by the webhook and by the confirm redirect. Both can fire for the
// same payment, and on a slow connection they can fire at once, so every step
// is idempotent: the enrolment has a unique index on (course, student) and
// sessions are matched on the slot before being written. Running this twice
// must produce the same result as running it once.
//
// A failure here is logged, never thrown. The money has already moved by the
// time this runs; refusing the webhook would only make Stripe retry something
// that is already partly done.
// ============================================================

export interface BookingSlot {
  date: string;
  startTime: string;
  durationMinutes?: number;
}

interface Invoice {
  id: string;
  parent_id: string;
  student_id: string | null;
  tutor_id: string | null;
  course_id: string | null;
  booking: BookingSlot[] | null;
  description: string;
}

/** Fulfil every paid invoice in the list. Safe to call more than once. */
export async function fulfilInvoices(db: any, invoiceIds: string[]): Promise<void> {
  if (invoiceIds.length === 0) return;

  const { data: invoices, error } = await db
    .from("invoices")
    .select("id, parent_id, student_id, tutor_id, course_id, booking, description")
    .in("id", invoiceIds);

  if (error) {
    console.error("fulfil: could not read invoices:", error.message);
    return;
  }

  for (const invoice of (invoices ?? []) as Invoice[]) {
    try {
      await fulfilOne(db, invoice);
    } catch (err: any) {
      // One bad invoice must not stop the others.
      console.error(`fulfil: invoice ${invoice.id} failed:`, err?.message ?? err);
    }
  }
}

async function fulfilOne(db: any, invoice: Invoice): Promise<void> {
  // Nothing to enrol on. A plain invoice, e.g. a registration fee, is complete
  // once it is marked paid.
  if (!invoice.course_id || !invoice.student_id) return;

  const { data: course } = await db
    .from("courses")
    .select("id, title, subject, tutor_id")
    .eq("id", invoice.course_id)
    .single();
  if (!course) {
    console.error(`fulfil: course ${invoice.course_id} is missing`);
    return;
  }

  const tutorId = invoice.tutor_id ?? course.tutor_id ?? null;

  // ---- enrolment ----
  // The partial unique index refuses a second active row, so a duplicate
  // delivery lands here and is ignored rather than enrolling twice.
  const { error: enrolErr } = await db.from("enrolments").insert({
    course_id: course.id,
    student_id: invoice.student_id,
    purchased_by: invoice.parent_id,
    invoice_id: invoice.id,
  });
  const alreadyEnrolled = enrolErr?.code === "23505";
  if (enrolErr && !alreadyEnrolled) {
    console.error("fulfil: enrolment failed:", enrolErr.message);
    return;
  }

  // ---- sessions ----
  const slots = Array.isArray(invoice.booking) ? invoice.booking : [];
  let created = 0;

  if (tutorId && slots.length > 0) {
    // Match on the slot rather than trusting a flag: the second delivery has to
    // recognise the sessions the first one wrote.
    const { data: existing } = await db
      .from("sessions")
      .select("date, start_time")
      .eq("student_id", invoice.student_id)
      .eq("course_id", course.id);

    const seen = new Set(
      (existing ?? []).map((s: any) => `${s.date}|${String(s.start_time).slice(0, 5)}`)
    );

    const rows = slots
      .filter((s) => s?.date && s?.startTime && !seen.has(`${s.date}|${s.startTime.slice(0, 5)}`))
      .map((s) => ({
        student_id: invoice.student_id,
        tutor_id: tutorId,
        course_id: course.id,
        subject: course.subject,
        date: s.date,
        start_time: s.startTime,
        duration_minutes: s.durationMinutes ?? 60,
        mode: "online",
        status: "upcoming",
      }));

    if (rows.length > 0) {
      const { error: sessionErr } = await db.from("sessions").insert(rows);
      if (sessionErr) console.error("fulfil: sessions failed:", sessionErr.message);
      else created = rows.length;
    }
  }

  // Everything past this point is telling people. If the enrolment already
  // existed, the first delivery has already told them.
  if (alreadyEnrolled) return;

  await announce(db, {
    course,
    studentId: invoice.student_id,
    parentId: invoice.parent_id,
    tutorId,
    sessionCount: created,
  });
}

async function announce(
  db: any,
  input: {
    course: { id: string; title: string; subject: string };
    studentId: string;
    parentId: string;
    tutorId: string | null;
    sessionCount: number;
  }
): Promise<void> {
  const ids = [input.studentId, input.parentId, input.tutorId].filter(Boolean) as string[];
  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", ids);

  const by = new Map<string, { full_name: string; email: string | null }>(
    (people ?? []).map((p: any) => [p.id, p])
  );
  const student = by.get(input.studentId);
  const parent = by.get(input.parentId);
  const tutor = input.tutorId ? by.get(input.tutorId) : null;

  const sessionLine =
    input.sessionCount > 0
      ? `${input.sessionCount} session${input.sessionCount === 1 ? "" : "s"} booked`
      : "Times to be arranged";

  const notifications = [
    {
      user_id: input.studentId,
      type: "enrolment",
      title: "You are enrolled",
      message: `${input.course.title} is now on your dashboard. ${sessionLine}.`,
      link: "/student/my-learning",
    },
    {
      user_id: input.parentId,
      type: "enrolment",
      title: "Payment received",
      message: `${student?.full_name ?? "Your child"} is enrolled on ${input.course.title}. ${sessionLine}.`,
      link: "/parent/courses",
    },
  ];

  if (input.tutorId) {
    notifications.push({
      user_id: input.tutorId,
      type: "enrolment",
      title: "New student",
      message: `${student?.full_name ?? "A student"} joined ${input.course.title}. ${sessionLine}.`,
      link: `/tutor/courses/${input.course.id}`,
    });
  }

  // The in-app notification is the record; email is the copy. Neither is
  // allowed to take the transaction down with it.
  const { error } = await db.from("notifications").insert(notifications);
  if (error) console.error("fulfil: notifications failed:", error.message);

  const facts = [
    { label: "Course", value: input.course.title },
    { label: "Subject", value: input.course.subject },
    { label: "Tutor", value: tutor?.full_name ?? "To be assigned" },
    { label: "Sessions", value: sessionLine },
  ];

  await Promise.all([
    student?.email &&
      sendEmail({
        to: student.email,
        subject: `You are enrolled on ${input.course.title}`,
        html: layout({
          heading: "You are enrolled",
          intro: `${input.course.title} is now on your dashboard. Everything for it lives under My Learning.`,
          facts,
          cta: { label: "Open My Learning", url: appUrl("/student/my-learning") },
        }),
      }),
    parent?.email &&
      sendEmail({
        to: parent.email,
        subject: `Payment received for ${input.course.title}`,
        html: layout({
          heading: "Payment received",
          intro: `${student?.full_name ?? "Your child"} is enrolled on ${input.course.title}. You can follow their progress from your dashboard.`,
          facts,
          cta: { label: "View the course", url: appUrl("/parent/courses") },
        }),
      }),
    tutor?.email &&
      sendEmail({
        to: tutor.email,
        subject: `${student?.full_name ?? "A student"} joined ${input.course.title}`,
        html: layout({
          heading: "You have a new student",
          intro: `${student?.full_name ?? "A student"} has been enrolled on ${input.course.title}.`,
          facts,
          cta: { label: "Open the course", url: appUrl(`/tutor/courses/${input.course.id}`) },
        }),
      }),
  ]);
}

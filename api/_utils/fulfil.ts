import { sendEmail, layout, appUrl } from "./email.js";
import { zoomConfigured, createMeeting, deleteMeeting } from "./zoom.js";

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
  admissions_tier_id: string | null;
  booking: BookingSlot[] | null;
  description: string;
  payout_cents: number | null;
}

/** Fulfil every paid invoice in the list. Safe to call more than once. */
export async function fulfilInvoices(db: any, invoiceIds: string[]): Promise<void> {
  if (invoiceIds.length === 0) return;

  const { data: invoices, error } = await db
    .from("invoices")
    .select(
      "id, parent_id, student_id, tutor_id, course_id, admissions_tier_id, booking, description, payout_cents"
    )
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
  // An admissions tier grants a plan rather than an enrolment, so it takes a
  // different path and then stops.
  if (invoice.admissions_tier_id && invoice.student_id) {
    await fulfilAdmissions(db, invoice);
    return;
  }

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

  // No child_services write here. Access follows payment: the enrolment row
  // just written is the entitlement, and v_student_entitlements derives
  // tutoring access from it directly. There is no separate permission to set.

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

    // The tutor is paid a session at a time, so the invoice's share of the
    // money is split across the slots it bought. The remainder goes to the
    // first, which is the only way the parts add back up to the whole.
    const payable = slots.filter((s) => s?.date && s?.startTime);
    const perSession = payable.length > 0 ? Math.floor((invoice.payout_cents ?? 0) / payable.length) : 0;
    const remainder = payable.length > 0 ? (invoice.payout_cents ?? 0) % payable.length : 0;

    const rows = payable
      .map((s, i) => ({ slot: s, payout: perSession + (i === 0 ? remainder : 0) }))
      .filter(({ slot }) => !seen.has(`${slot.date}|${slot.startTime.slice(0, 5)}`))
      .map(({ slot, payout }) => ({
        student_id: invoice.student_id,
        tutor_id: tutorId,
        course_id: course.id,
        invoice_id: invoice.id,
        subject: course.subject,
        date: slot.date,
        start_time: slot.startTime,
        duration_minutes: slot.durationMinutes ?? 60,
        payout_cents: payout,
        mode: "online",
        status: "upcoming",
      }));

    // One at a time rather than one batch. A slot can be taken between the
    // checkout page and the payment landing, and the unique index on
    // (student, date, time) will refuse that row. As a batch, one refusal
    // loses every other session in the same purchase.
    for (const row of rows) {
      const { error: sessionErr } = await db.from("sessions").insert(row);
      if (!sessionErr) {
        created += 1;
        continue;
      }
      if (sessionErr.code === "23505") {
        // Paid for, and not bookable. The parent is owed this session at
        // another time, so it is loud rather than swallowed.
        console.error(
          `fulfil: invoice ${invoice.id} paid for ${row.date} ${row.start_time}, but student ${invoice.student_id} is already booked then. Needs rescheduling.`
        );
      } else {
        console.error("fulfil: session insert failed:", sessionErr.message);
      }
    }

    // A booked session without a meeting is a session nobody can attend, so
    // this runs whether or not anything was inserted just now: a delivery that
    // found the rows already there still repairs one Zoom failed on last time.
    await attachZoomMeetings(db, {
      studentId: invoice.student_id!,
      courseId: course.id,
      topic: course.title,
    });
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

/**
 * Give every meetingless session on this course a Zoom meeting.
 *
 * Sessions were being written with a null zoom_meeting_id and nothing ever
 * filled it in, so every booked lesson had a time and no room.
 *
 * The webhook and the confirm redirect can both be here at once, which would
 * book two meetings for one session. The update is guarded on the column still
 * being null, so exactly one of them wins and the loser tidies its meeting
 * away rather than leaving it on the calendar.
 */
async function attachZoomMeetings(
  db: any,
  input: { studentId: string; courseId: string; topic: string }
): Promise<void> {
  if (!zoomConfigured()) return;

  const { data: pending, error } = await db
    .from("sessions")
    .select("id, date, start_time, duration_minutes")
    .eq("student_id", input.studentId)
    .eq("course_id", input.courseId)
    .eq("status", "upcoming")
    .is("zoom_meeting_id", null);

  if (error) {
    console.error("fulfil: could not list sessions needing a meeting:", error.message);
    return;
  }

  for (const session of pending ?? []) {
    try {
      const meeting = await createMeeting({
        topic: input.topic,
        date: session.date,
        startTime: String(session.start_time),
        durationMinutes: session.duration_minutes ?? 60,
      });

      const { data: claimed } = await db
        .from("sessions")
        .update({
          zoom_meeting_id: meeting.meetingId,
          zoom_password: meeting.password,
          zoom_link: meeting.joinUrl,
        })
        .eq("id", session.id)
        .is("zoom_meeting_id", null)
        .select("id");

      // Someone else got there first. Two meetings for one session would leave
      // half the people in an empty room.
      if (!claimed?.length) {
        await deleteMeeting(meeting.meetingId).catch(() => {});
      }
    } catch (err: any) {
      // The session keeps its time and loses only its room, which the next
      // delivery, or a rebooking, can still put right.
      console.error(`fulfil: no Zoom meeting for session ${session.id}:`, err?.message ?? err);
    }
  }
}

/**
 * A paid admissions tier.
 *
 * Two things have to become true: the student is on that tier, and the
 * admissions side of the product is switched on for them. The second is what
 * the rest of the app already checks, so the plan drives the switch rather
 * than sitting next to it and disagreeing.
 *
 * Idempotent like the rest of this file. A repeated delivery finds the plan
 * already there and tells nobody twice.
 */
async function fulfilAdmissions(db: any, invoice: Invoice): Promise<void> {
  const { data: tier } = await db
    .from("admissions_tiers")
    .select("id, name, price_cents, instalment_months")
    .eq("id", invoice.admissions_tier_id)
    .single();
  if (!tier) {
    console.error(`fulfil: admissions tier ${invoice.admissions_tier_id} is missing`);
    return;
  }

  // Already on this exact tier from this exact invoice: a second delivery.
  const { data: existing } = await db
    .from("admissions_plans")
    .select("id, tier_id, invoice_id")
    .eq("student_id", invoice.student_id)
    .eq("status", "active")
    .maybeSingle();

  if (existing?.invoice_id === invoice.id) return;

  // Buying a different tier replaces the old one and keeps the history, so
  // what a family was on last year is still answerable.
  if (existing) {
    await db
      .from("admissions_plans")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", existing.id);
  }

  // Who the family will actually be working with. Kept if they already had a
  // plan, so buying a bigger tier does not hand them to a stranger halfway
  // through an application; otherwise the counsellor with the fewest live
  // plans. Null when nobody has been hired yet, which leaves the plan
  // unassigned for an admin to place rather than failing the purchase.
  let counselorId: string | null = null;
  if (existing) {
    const { data: prior } = await db
      .from("admissions_plans")
      .select("counselor_id")
      .eq("id", existing.id)
      .maybeSingle();
    counselorId = prior?.counselor_id ?? null;
  }
  if (!counselorId) {
    const { data: picked, error: pickErr } = await db.rpc("next_counselor");
    if (pickErr) console.error("fulfil: choosing a counsellor failed:", pickErr.message);
    counselorId = (picked as string | null) ?? null;
  }

  // Granted on the first payment, not the last. The instalments are how the
  // money is collected; the family gets the whole engagement straight away.
  const { error: planErr } = await db.from("admissions_plans").insert({
    student_id: invoice.student_id,
    purchased_by: invoice.parent_id,
    tier_id: tier.id,
    invoice_id: invoice.id,
    counselor_id: counselorId,
    payments_made: 1,
    payments_due: tier.instalment_months ?? 1,
  });
  if (planErr) {
    // The unique index refuses a second active plan, which is a duplicate
    // delivery arriving while the first is still in flight.
    if (planErr.code !== "23505") console.error("fulfil: admissions plan failed:", planErr.message);
    return;
  }

  // The workspace the counsellor opens. Created here rather than waiting for
  // the student to touch a college list, so the family appears on their
  // counsellor's dashboard the moment the payment clears rather than whenever
  // somebody first saves something.
  if (counselorId) {
    const { data: app } = await db
      .from("college_guide_applications")
      .select("id")
      .eq("student_id", invoice.student_id)
      .maybeSingle();

    const { error: appErr } = app
      ? await db.from("college_guide_applications").update({ counselor_id: counselorId }).eq("id", app.id)
      : await db.from("college_guide_applications").insert({
          student_id: invoice.student_id,
          counselor_id: counselorId,
        });
    if (appErr) console.error("fulfil: assigning the counsellor failed:", appErr.message);
  }

  // No child_services write. The admissions_plan row is the entitlement, and
  // v_student_entitlements derives admissions access from it. Access follows
  // payment, with nothing else to switch on.

  const { data: people } = await db
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [invoice.student_id, invoice.parent_id]);

  const by = new Map<string, any>((people ?? []).map((p: any) => [p.id, p]));
  const student = by.get(invoice.student_id!);
  const parent = by.get(invoice.parent_id);

  const { error: noteErr } = await db.from("notifications").insert([
    {
      user_id: invoice.student_id,
      type: "admissions_plan",
      title: "College counselling is open",
      message: `You are on ${tier.name}. Your college list, essays and roadmap are now yours to work on.`,
      link: "/student/college-list",
    },
    {
      user_id: invoice.parent_id,
      type: "admissions_plan",
      title: "Payment received",
      message: `${student?.full_name ?? "Your child"} is on ${tier.name} admissions counselling.`,
      link: "/parent/billing",
    },
  ]);
  if (noteErr) console.error("fulfil: admissions notifications failed:", noteErr.message);

  const facts = [
    { label: "Plan", value: tier.name },
    { label: "Student", value: student?.full_name ?? "Your child" },
  ];

  await Promise.all([
    student?.email &&
      sendEmail({
        to: student.email,
        subject: "Your college counselling is open",
        html: layout({
          heading: "College counselling is open",
          intro: `You are on ${tier.name}. Your college list, essays and roadmap are ready when you are.`,
          facts,
          cta: { label: "Open your college list", url: appUrl("/student/college-list") },
        }),
      }),
    parent?.email &&
      sendEmail({
        to: parent.email,
        subject: `${tier.name} admissions counselling`,
        html: layout({
          heading: "Payment received",
          intro: `${student?.full_name ?? "Your child"} is on ${tier.name}. You can follow their progress from your dashboard.`,
          facts,
          cta: { label: "View your plans", url: appUrl("/parent/billing") },
        }),
      }),
  ]);
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

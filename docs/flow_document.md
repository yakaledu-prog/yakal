# Yakal Education Services, Role Workflows (Source of Truth)

Hierarchy: **Super Admin → Counselor / Tutor → Parent → Student**

This is the canonical product flow that V1 implements. All features trace back here.

---

## 1. Super Admin Workflow (top of hierarchy)

1. Log in to the Super Admin dashboard.
2. Review pending Tutor registrations and verify credentials (certificates, ID, subject expertise).
3. Approve or reject each Tutor application.
   - Approved → Tutor status = **Active**; can accept students / conduct sessions.
   - Rejected → Tutor notified with a reason; may resubmit.
4. Review and approve/reject Counselor accounts (same verification logic).
5. Manage all user accounts (Students, Parents, Tutors, Counselors), activate, suspend, delete.
6. Manage CMS content, Blogs, Testimonials, Team, Courses, College Guide promo content.
7. Configure platform settings (session rules, payment rates, categories, policies).
8. Monitor reports/analytics, bookings, revenue, active users, tutor performance.
9. Handle escalations (disputes, complaints, technical issues) not resolved at Tutor/Counselor level.

## 2. Tutor Workflow

1. Register with Full Name, Email, Password, and required credentials.
2. Submit profile for verification (status = **Pending Approval**).
3. Wait for Super Admin approval, cannot accept students, publish availability, or conduct sessions until approved.
4. Once approved, complete profile: subject expertise, hourly/session rate, personal Zoom/Meet link (used for all sessions).
5. Publish available time slots for students to book.
6. Accept/manage session bookings from students.
7. Conduct sessions via the Zoom link configured in profile.
8. Create and manage assignments (post, set due dates, review submissions).
9. Communicate with students via in-app chat.
10. Track session history (upcoming/past) and earnings based on rate.

## 3. Counselor Workflow

1. Register with Full Name, Email, Password.
2. Submit profile for verification; wait for Super Admin approval.
3. Once approved, access the Counselor dashboard.
4. Review incoming College Guide applications from students.
5. Evaluate student admission progress and required documents.
6. Use the WYSIWYG editor to add notes, feedback, or admission guidance.
7. Update application status (In Review → Action Needed → Approved/Completed).
8. Communicate guidance/next steps to the student (chat or status notes).
9. Track all College Guide submissions until completion.

## 4. Parent Workflow

1. Register with Full Name, Email, Password.
2. Link one or more student accounts (via student email/ID or invite code, with student/guardian confirmation).
3. View each linked student's dashboard summary (sessions, assignments, progress).
4. Monitor chat history between student and tutor (view-only, for safety/oversight).
5. Track payment/billing status per student.
6. Receive notifications for upcoming sessions, missed assignments, status changes.
7. Switch between multiple linked children from a single account.

## 5. Student Workflow

1. Register with Full Name, Email, Password.
2. Complete/update profile.
3. Browse **approved Tutors only** (unapproved tutors are not visible/bookable).
4. View a tutor's published available time slots.
5. Book a session, system confirms and adds it to "Upcoming Sessions."
6. Join scheduled session using the Zoom link on the dashboard/booking confirmation.
7. View and submit assignments before due dates.
8. Chat with assigned tutor in-app.
9. (Optional) Enroll in College Guide, submit application/documents to Counselor.
10. Track application status and guidance from Counselor.
11. View payment/session history and past sessions on dashboard.

---

## Cross-Role Rules

- **Approval Gate:** No Tutor or Counselor can operate until Super Admin approval (status = Active).
- **Zoom Link Ownership:** Only Tutors set/update their own link; it auto-populates all their sessions.
- **Booking Restriction:** Students can only see and book approved/active Tutors.
- **Parent-Student Linking:** Requires confirmation (invite/approval) to prevent unauthorized linking.
- **College Guide Flow:** Student submits → Counselor reviews → status flows back to Student (visible to linked Parent).
- **File Storage (V1):** All uploads (assignments, documents, profile files) stored as Google Drive URL references, no dedicated storage service. (Exception: profile photos may use DiceBear or an optional Supabase `avatars` bucket.)
- **CMS Control:** Only Super Admin edits Blogs, Testimonials, Team, and Course listings on the public site.

---

## V1 Implementation Decisions (not in original doc)

- **Session link = fixed per-tutor** link on the profile (personal room), reused for every session. Simplest correct model; no video SDK.
- **Rate:** stored per tutor as "rate per session"; drives earnings + parent billing views.
- **One role per account** in V1, a person who is both student and tutor uses separate emails. Multi-role is post-V1.
- **Onboarding fields**
  - Student: name, avatar, grade level, subjects of interest, theme.
  - Tutor: name, avatar, phone, subjects taught, rate/session, session link (required), bio, theme.
  - Parent: name, avatar, phone (child linking happens in the Parent portal, Phase 7).
  - Counselor: name, avatar, phone, bio.

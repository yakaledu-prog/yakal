# Yakal Version 1, Full Implementation Plan

**Branch:** `version1`  
**Goal:** Replace all mocks with real Supabase-backed data and flows. Deliver a production-ready platform with no mocked values, ready for user testing.

---

## Background & Scope

The product must support five distinct roles:

- **Super Admin**, Platform configuration, user approval, CMS, analytics
- **Tutor**, Availability, sessions, assignments, earnings, Zoom link
- **Counselor**, College Guide application reviews, notes
- **Parent**, Linked child monitoring, payment tracking
- **Student**, Booking, sessions, assignments, College Guide

**Core constraints:**

- File storage via Google Drive links (no native uploads Phase 1)
- Video sessions via External Links (tutor saves Zoom/Meet URL on profile, auto-populates sessions)
- Messaging: Supabase Realtime (text only, no voice, no file uploads)
- No CMS in base MVP (landing page is static)
- Demo accounts must be real DB rows (not JSON files)

---

## Critical Analysis: What Exists vs. What Is Needed

| Area | Current State | Action Required |
|---|---|---|
| **Auth / Profiles** | Basic email/pass, single role, no approval gate | Rebuild: add `status`, `bio`, `zoom_link`, `counselor` role |
| **Student Home** | 100% mocked, hardcoded data | Rebuild with real Supabase queries |
| **Tutor Home** | Calls `studentService` (wrong service!) | Rebuild with tutor-specific queries |
| **Messages** | Entire page uses `mockConversations` from `chatData.ts` | Rebuild with Supabase Realtime messages table |
| **Course Catalog** | `courseData` hardcoded object | Rebuild: `courses` table with admin CRUD |
| **Booking** | `createZoomMeeting` + `getFirstAvailableTutor` (generic, not linked to tutor) | Rebuild: link to specific tutor from course detail |
| **Sessions** | Service layer exists but UI shows mocks | Connect existing `sessions.ts` to real UI |
| **Notifications** | Entire page is mock | Rebuild: `notifications` table |
| **Resources** | Mock data | Rebuild: `resources` table (Google Drive links) |
| **Assignments (Tasks)** | Mock data | Rebuild: `assignments` + `submissions` tables |
| **Admin Portal** | `<div>Admin Dashboard (Placeholder)</div>` in router | Build from scratch |
| **Parent Portal** | `<div>Parent Dashboard (Placeholder)</div>` in router | Build from scratch |
| **Counselor Portal** | Does not exist at all | Build from scratch |
| **Onboarding** | Always navigates to `/student` regardless of role | Fix: role-based redirect |
| **Profile Page** | Mock data, avatar click does nothing | Rebuild: real Supabase update |
| **My Learning** | Mock data | Rebuild: real enrolled sessions/courses |
| **Calendar** | Mock events | Rebuild: real sessions |
| **Student Study Chart** | Hardcoded `[{hours: 2}, ...]` | Compute from real `sessions` table |

---

## Phase Overview

| Phase | Name | Priority |
|---|---|---|
| 0 | Database Wipe & Rebuild | **CRITICAL, do first** |
| 1 | Auth, Profiles & Role-Based Routing | **CRITICAL** |
| 2 | Tutor Portal, Full Build | HIGH |
| 3 | Student Portal, Full Build | HIGH |
| 4 | Admin Portal, Full Build | HIGH |
| 5 | Messaging, Supabase Realtime | HIGH |
| 6 | Notifications System | MEDIUM |
| 7 | Parent Portal | MEDIUM |
| 8 | Counselor Portal | MEDIUM |
| 9 | Polish, Testing & Final Handover | CRITICAL before handover |

---

## Phase 0: Database, Wipe & Rebuild

> **You must run these SQL files in Supabase SQL Editor in this order:**
> 1. `docs/db_wipe.sql`, wipes everything
> 2. `docs/db_schema.sql`, creates all tables, RLS, triggers, indexes
> 3. `docs/db_seed.sql`, inserts 5 demo accounts with realistic linked data

### New Database Tables

| Table | Purpose |
|---|---|
| `profiles` | Extended user profile (role, status, bio, zoom_link, subjects, hourly_rate) |
| `courses` | Admin-created courses (title, subject, tutor_id, description, thumbnail_url) |
| `tutor_availability` | Weekly time grid per tutor |
| `sessions` | All booked sessions (student, tutor, course, date, time, status, notes, zoom_link) |
| `assignments` | Assignments posted by tutors (title, description, due_date, course_id, drive_link) |
| `submissions` | Student submissions (assignment_id, student_id, drive_link, status, reviewed_at) |
| `conversations` | Chat thread between two users (participant_1_id, participant_2_id) |
| `messages` | Individual messages (conversation_id, sender_id, text, is_read, created_at) |
| `notifications` | In-app alerts (user_id, type, message, link, is_read) |
| `parent_student_links` | Parent-student connection (parent_id, student_id, status: pending/active) |
| `college_guide_applications` | Student-submitted applications (student_id, counselor_id, status, documents, notes) |

### RLS Policy Strategy

- Users can only read/write their OWN rows (by `user_id = auth.uid()`)
- Admins can read/write ALL rows (checked via `profiles.role = 'admin'`)
- Parents can read their linked student's sessions, messages, assignments (via `parent_student_links`)
- Tutors can read sessions where `tutor_id = auth.uid()`
- Counselors can read all `college_guide_applications`

---

## Phase 1: Auth, Profiles & Role-Based Routing

### Files to Modify

**`src/contexts/AuthContext.tsx`**
- Add to `Profile` type: `status`, `bio`, `zoom_link`, `phone`, `subjects` (text[]), `hourly_rate`
- Add `refreshProfile()` method (called after profile updates)

**`src/pages/shared/AuthPage.tsx`**
- Add role selection pill on registration: Student | Tutor | Parent
- (Counselor is admin-created, not self-registered)
- Role stored in `raw_user_meta_data` → triggers `profiles` insert

**`src/pages/shared/OnboardingPage.tsx`**
- Role-specific question steps:
  - **Tutor:** Full name, phone, subjects (multi-select), hourly rate, Zoom link
  - **Student:** Full name, grade level, subjects of interest
  - **Parent:** Full name, phone
- Fix critical bug: always redirect to `/student`, must redirect based on `profile.role`
- After submit: navigate to `/${profile.role}` (admin → `/admin`, parent → `/parent`, etc.)

**`src/app/Router.tsx`**
- Add role guard: if tutor/counselor `status = 'pending'`, redirect to `PendingApprovalPage`
- Add admin routes (full layout)
- Add parent routes (full layout)
- Add counselor routes (full layout)
- Remove placeholder divs for admin/parent

### New Files

**`src/pages/shared/PendingApprovalPage.tsx`**
- Shows when tutor/counselor has registered but is not yet approved by admin
- "Your application is under review. You will be notified when approved."

---

## Phase 2: Tutor Portal, Full Build

### Files to Modify/Replace

**`src/pages/tutor/TutorHome.tsx`**
- Remove: `studentService.getDashboardSummary()` (wrong service)
- Remove: hardcoded `studyHoursData` chart
- Add real queries:
  - Today's sessions from `sessions` table
  - Pending booking requests
  - Count of active students
  - Weekly sessions chart from `sessions` (count by day of week)

**`src/pages/tutor/TutorProfile.tsx`**
- Real editable fields: full name, bio, subjects (multi-select), hourly rate, Zoom link, phone
- Avatar: show initials-based avatar (no file upload)
- Submit: `supabase.from('profiles').update(...)` with `refreshProfile()` after

**`src/pages/tutor/TutorCalendar.tsx`**
- Replace mock events with real sessions from `sessions` table
- Availability grid persisted in `tutor_availability`

**`src/pages/tutor/TutorSessions.tsx`**
- Real sessions via `getTutorSessions(userId)`
- Actions: "Mark as Complete" (updates `status`), "Add Session Notes" (updates `notes`)
- Show Zoom link button that opens tutor's saved `zoom_link`

**`src/pages/tutor/TutorCourses.tsx`**
- Show courses from `courses` table WHERE `tutor_id = me`
- Read-only (admin manages course catalog)

### Files to Delete / Repurpose

Remove routes and pages that don't apply to tutors per the scope:
- `TutorMyLearning.tsx` → replace with **My Students** page
- `TutorResources.tsx` → replace with **Resources** (Drive links tutor can post per session)
- `TutorCourseDashboard.tsx`, `TutorCourseOverview.tsx`, `TutorCourseSessions.tsx`, `TutorCourseResources.tsx`, `TutorCourseTasks.tsx` → student-era pages, remove

### New Files

**`src/pages/tutor/TutorStudents.tsx`**
- List of students who have booked the tutor's sessions
- Shows session count, last session date

**`src/pages/tutor/TutorAssignments.tsx`**
- Create assignment: title, description, due date, Google Drive link (optional template)
- View submissions per assignment
- Mark submission as reviewed

---

## Phase 3: Student Portal, Full Build

### Files to Modify

**`src/pages/student/StudentHome.tsx`**
- Next session: real query (`sessions WHERE student_id = me AND status = 'upcoming' ORDER BY date ASC LIMIT 1`)
- Homework due: real query (`submissions WHERE student_id = me AND status = 'pending'` + join `assignments`)
- Study hours chart: compute from `sessions` (sum `duration_minutes` grouped by day of week for last 7 days)
- Welcome banner: use `profile.full_name` from AuthContext (not hardcoded "Brooklyn!")

**`src/pages/student/StudentCourses.tsx`**
- Browse all `courses` from Supabase
- Show: title, subject, tutor name, thumbnail, hourly rate

**`src/pages/student/StudentCourseCatalogDetail.tsx`**
- Replace hardcoded `courseData` with real fetch: `supabase.from('courses').select('*, profiles(*)').eq('id', courseId)`
- Link availability grid to `profiles.tutor_id` from course
- Booking: creates a `sessions` row; Zoom link comes from `profiles.zoom_link` of the tutor (NOT Zoom SDK)
- No more `createZoomMeeting()` API call

**`src/pages/student/StudentSessions.tsx`**
- Real sessions from `getStudentSessions(userId)`
- "Join Session" button opens `session.zoom_link` in new tab

**`src/pages/student/StudentCalendar.tsx`**
- Real sessions plotted on calendar

**`src/pages/student/StudentNotifications.tsx`**
- Real notifications from `notifications` table

**`src/pages/student/StudentProfile.tsx`**
- Real editable profile (full name, phone, grade)

### Remove / Replace

Same as Tutor: remove `StudentMyLearning.tsx`, `StudentCourseDashboard.tsx`, `StudentCourseOverview.tsx`, `StudentCourseSessions.tsx`, `StudentCourseResources.tsx`, `StudentCourseTasks.tsx`

### New Files

**`src/pages/student/StudentAssignments.tsx`**
- View all assignments for courses where student has active sessions
- Submit via Google Drive link
- View submission status (pending | reviewed)

**`src/pages/student/StudentCollegeGuide.tsx`** *(optional, add if scope confirmed)*
- Submit College Guide application form (name, program interest, documents as Drive links)
- View application status + counselor notes

---

## Phase 4: Admin Portal, Full Build

**`src/pages/admin/AdminLayout.tsx`**
Sidebar: Dashboard, Users, Tutor Approvals, Counselor Approvals, Courses, Sessions, Analytics, Settings

**`src/pages/admin/AdminHome.tsx`**
- Stats cards: total students, active tutors, sessions this month, pending approvals
- Quick actions: Go to Approvals, Add Course

**`src/pages/admin/AdminTutorApprovals.tsx`**
- List `profiles WHERE role = 'tutor' AND status = 'pending'`
- Show: full name, email, subjects, zoom link, registered date
- Actions: **Approve** (set `status = 'active'`) / **Reject** (set `status = 'rejected'`, prompt for reason)
- Both actions create a `notifications` row for the tutor

**`src/pages/admin/AdminCounselorApprovals.tsx`**
- Same as tutor approvals but for `role = 'counselor'`

**`src/pages/admin/AdminCourses.tsx`**
- Full CRUD for `courses` table
- Create: title, subject (dropdown: Math/Physics/Chemistry/SAT/College Advising), description, tutor (dropdown of active tutors), thumbnail (Google Drive URL)
- Edit / Delete

**`src/pages/admin/AdminUsers.tsx`**
- Table of all users grouped by role
- Actions: Suspend / Activate / Delete (soft delete)

**`src/pages/admin/AdminSessions.tsx`**
- Read-only table of all sessions
- Filter by status, tutor, date

**`src/pages/admin/AdminAnalytics.tsx`**
- Basic counters (no charts needed for Phase 1):
  - Total users by role
  - Sessions this week / month
  - Top tutors by session count

---

## Phase 5: Messaging, Supabase Realtime

> This replaces the entire `chatData.ts` mock system.

**`src/services/messageService.ts`** (new)
- `getOrCreateConversation(userId, otherUserId)`, find or create a row in `conversations`
- `getMessages(conversationId)`, fetch all messages
- `sendMessage(conversationId, senderId, text)`, insert into `messages`
- `subscribeToMessages(conversationId, callback)`, Supabase Realtime channel
- `markConversationRead(conversationId, userId)`, update `is_read = true`

**`src/pages/student/StudentMessages.tsx`** (rebuild)
- Remove ALL `chatData.ts` imports
- Remove voice message UI (mic button, audio visualizer, wavesurfer)
- Remove file attachments from UI
- Conversation list from real `conversations` table
- Message display from real `messages` table
- Supabase Realtime subscription for live updates
- Text input + send

**`src/pages/tutor/TutorMessages.tsx`** (rebuild)
- Same architecture as student messages

**DELETE** `src/mock/chatData.ts` after Phase 5

---

## Phase 6: Notifications

**`src/services/notificationService.ts`** (new)
```typescript
export const notificationService = {
  getAll: (userId) => supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  markRead: (id) => supabase.from('notifications').update({ is_read: true }).eq('id', id),
  markAllRead: (userId) => supabase.from('notifications').update({ is_read: true }).eq('user_id', userId),
  create: (userId, type, message, link?) => supabase.from('notifications').insert({ user_id: userId, type, message, link })
}
```

**`src/pages/student/StudentNotifications.tsx`**, rebuild with real service  
**`src/pages/tutor/TutorNotifications.tsx`**, rebuild with real service

**Notification triggers (created in code, not DB triggers):**
- Booking created → notify tutor
- Booking confirmed → notify student
- Assignment posted → notify student
- Admin approves tutor → notify tutor
- Parent link request → notify student
- Student approves link → notify parent
- Application status changes → notify student

---

## Phase 7: Parent Portal

**`src/pages/parent/ParentLayout.tsx`**
Sidebar: Dashboard, My Children, Notifications

**`src/pages/parent/ParentHome.tsx`**
- List linked children (from `parent_student_links WHERE parent_id = me AND status = 'active'`)
- For each child: avatar, name, next session, pending assignments count

**`src/pages/parent/ParentLinkStudent.tsx`**
- Input: student email
- Creates `parent_student_links` with `status = 'pending'`
- Creates notification for student: "A parent requested to link your account"

**`src/pages/parent/ParentStudentView.tsx`**
- Read-only view of a specific linked student
- Sessions list, assignments list, study hours
- Chat history between student and their tutors (read-only)

---

## Phase 8: Counselor Portal

**`src/pages/counselor/CounselorLayout.tsx`**
Sidebar: Dashboard, Applications, Messages, Profile

**`src/pages/counselor/CounselorHome.tsx`**
- Pending applications count, in-review count

**`src/pages/counselor/CounselorApplications.tsx`**
- List all `college_guide_applications`
- Filter: submitted | in_review | action_needed | completed
- Assign to self if unassigned

**`src/pages/counselor/CounselorApplicationDetail.tsx`**
- Student's full name, profile, program interest
- Submitted document Drive links (clickable)
- Notes textarea (saved to DB)
- Status dropdown (update `status`)
- Send message to student (via `messages` table)

**`src/pages/counselor/CounselorProfile.tsx`**
- Edit bio, specializations, credentials (text fields)

---

## Phase 9: Polish, Testing & Handover

### Cleanup Checklist
- [ ] Delete `src/mock/chatData.ts`
- [ ] Delete `src/mock/mockData.ts`
- [ ] Delete `src/services/studentService.ts` (fully replaced)
- [ ] Delete `src/services/zoom.ts` (Zoom SDK removed)
- [ ] Remove unused packages: `@zoom/meetingsdk`, `@jitsi/react-sdk`, `react-audio-visualize`, `wavesurfer.js`, `emoji-picker-react`
- [ ] Fix TypeScript: `tsc --noEmit` must pass with 0 errors
- [ ] `npm run build` must complete successfully

### Testing Protocol (Manual)

For each role, test the full user journey:

**Admin:**
1. Login as `admin@yakal.com` / `demo123`
2. Approve the pending demo tutor
3. Create a new course
4. View all users and sessions

**Tutor:**
1. Login as `tutor@yakal.com` / `demo123`
2. Complete profile (add Zoom link, subjects)
3. Set availability
4. View assigned session
5. Create an assignment
6. Send message to student

**Student:**
1. Login as `student@yakal.com` / `demo123`
2. Browse course catalog
3. Book a session with the tutor
4. View session (should show Zoom link from tutor profile)
5. Submit an assignment
6. Send message to tutor
7. Check notifications

**Parent:**
1. Login as `parent@yakal.com` / `demo123`
2. Link to student account (student must approve)
3. View linked student's dashboard
4. Check session history

**Counselor:**
1. Login as `counselor@yakal.com` / `demo123`
2. View submitted College Guide application
3. Update status and add notes
4. Send message to student

---

## Environment Variables

```env
# Already configured, no changes needed for Phase 1-9
VITE_SUPABASE_URL=https://ghruwaysryzfdiagzqfz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...

# Remove these (no longer needed after removing Zoom SDK):
# VITE_ZOOM_MEETING_CLIENT_ID=...
# ZOOM_MEETING_CLIENT_SECRET=...
# ZOOM_S2S_ACCOUNT_ID=...
# ZOOM_S2S_CLIENT_ID=...
# ZOOM_S2S_CLIENT_SECRET=...
# VITE_JAAS_APP_ID=...
```

---

## Important Notes

- `.env` contains live production Supabase credentials. Confirm `.env` is in `.gitignore` before any branch is pushed.
- Demo accounts are real Supabase auth users with linked realistic `profiles` rows, NOT JSON files.
- The counselor account (`counselor@yakal.com`) does NOT need admin approval in the seed, it's pre-approved for demo purposes.
- All "session Zoom links" come from `profiles.zoom_link` of the tutor, there is no SDK integration.

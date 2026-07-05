# Yakal V1, Master Checklist

Track implementation progress. Mark items as you complete them.

Legend: `[ ]` = Not Started | `[/]` = In Progress | `[x]` = Done

---

## Phase 0: Database Setup

- [ ] Run `docs/db_wipe.sql` in Supabase SQL Editor
- [ ] Run `docs/db_schema.sql` in Supabase SQL Editor
- [ ] Run `docs/db_seed.sql` in Supabase SQL Editor
- [ ] Verify 5 demo accounts exist in Supabase Auth dashboard
- [ ] Verify all 11 tables created in Database > Tables
- [ ] Enable Realtime for `messages`, `notifications`, `conversations` in Database > Replication
- [ ] Test login: `admin@yakal.com` / `demo123` → lands on admin portal
- [ ] Test login: `tutor@yakal.com` / `demo123` → lands on tutor portal

---

## Phase 1: Auth, Profiles & Role-Based Routing

- [x] Update `Profile` type in `AuthContext.tsx` (add: email, status, bio, phone, zoom_link, subjects, hourly_rate, grade_level, rejection_reason)
- [x] Add `refreshProfile()` to `AuthContext`
- [x] Add role selection to `AuthPage.tsx` (Student / Tutor / Parent, already present; login now routes by role, counselor added to demo grid)
- [x] Create `src/utils/roleRoutes.ts`, `homePathForRole` / `postAuthPath` / `requiresApproval`
- [x] Update `OnboardingPage.tsx`:
  - [x] Role-specific form fields (tutor: subjects/rate/zoom/bio; student: grade/subjects; parent/counselor: phone/bio)
  - [x] Fix redirect to role-based dashboard (not always `/student`)
  - [x] Remove "(Mock)" avatar label → initials avatar
- [x] Create `PendingApprovalPage.tsx` (pending + rejected states, check-status, sign-out)
- [x] Add role guard in `Router.tsx`: pending/rejected tutors & counselors → `PendingApprovalPage`
- [x] Add `/pending-approval` route
- [x] Add counselor placeholder route in `Router.tsx` (full portal in Phase 8)
- [~] Admin/parent routes remain placeholders (full builds in Phase 4 / Phase 7)
- [x] tsc --noEmit passes, `npm run build` passes
- [ ] Test: register as student → goes to `/student`
- [ ] Test: register as tutor → onboarding → pending page
- [ ] Test: after admin approves (Phase 4) → tutor goes to `/tutor`

---

## Phase 2: Tutor Portal

- [ ] `TutorHome.tsx`, replace `studentService` mock with real Supabase
  - [ ] Today's sessions (real)
  - [ ] Session count chart (real, computed from sessions table)
  - [ ] Welcome banner uses `profile.full_name`
- [ ] `TutorProfile.tsx`, real profile update (bio, subjects, zoom_link, hourly_rate)
- [ ] `TutorCalendar.tsx`, real sessions from DB
- [ ] `TutorSessions.tsx`, real sessions + mark complete + session notes
- [ ] `TutorCourses.tsx`, courses from DB where `tutor_id = me`
- [ ] Create `TutorStudents.tsx`, list my students
- [ ] Create `TutorAssignments.tsx`, create/view/review assignments
- [ ] Remove pages: `TutorMyLearning`, `TutorCourseDashboard`, `TutorCourseOverview`, `TutorCourseSessions`, `TutorCourseResources`, `TutorCourseTasks`
- [ ] Update `Router.tsx` to reflect new tutor pages
- [ ] Test: tutor marks a session as complete
- [ ] Test: tutor creates an assignment

---

## Phase 3: Student Portal

- [ ] `StudentHome.tsx`, all real data
  - [ ] Next session (real query)
  - [ ] Homework due (real query)
  - [ ] Study hours chart (computed from sessions)
  - [ ] Welcome banner uses real name
- [ ] `StudentCourses.tsx`, browse real courses from DB
- [ ] `StudentCourseCatalogDetail.tsx`
  - [ ] Fetch course by ID from DB
  - [ ] Tutor availability linked to actual course tutor
  - [ ] Booking creates a `sessions` row (NOT Zoom SDK)
  - [ ] Zoom link = tutor's `profiles.zoom_link`
- [ ] `StudentSessions.tsx`, real sessions, "Join Session" opens `zoom_link`
- [ ] `StudentCalendar.tsx`, real sessions on calendar
- [ ] `StudentProfile.tsx`, real profile update
- [ ] `StudentNotifications.tsx`, real notifications
- [ ] Create `StudentAssignments.tsx`, view + submit via Drive link
- [ ] Create `StudentCollegeGuide.tsx` (optional, if confirmed in scope)
- [ ] Remove pages: `StudentMyLearning`, `StudentCourseDashboard`, etc.
- [ ] Test: student books a session → appears in sessions list + calendar
- [ ] Test: student submits an assignment → visible to tutor

---

## Phase 4: Admin Portal

- [ ] Create `AdminLayout.tsx` with sidebar
- [ ] Create `AdminHome.tsx` (stats cards)
- [ ] Create `AdminTutorApprovals.tsx`
  - [ ] List pending tutors
  - [ ] Approve action (status = 'active' + notification)
  - [ ] Reject action (status = 'rejected', reason + notification)
- [ ] Create `AdminCounselorApprovals.tsx` (same pattern)
- [ ] Create `AdminCourses.tsx` (full CRUD)
- [ ] Create `AdminUsers.tsx` (view + suspend/activate)
- [ ] Create `AdminSessions.tsx` (read-only oversight)
- [ ] Create `AdminAnalytics.tsx` (basic counters)
- [ ] Add all admin routes to `Router.tsx`
- [ ] Test: admin approves tutor → tutor can now log in to tutor portal
- [ ] Test: admin creates a course → visible to students in catalog

---

## Phase 5: Messaging, Supabase Realtime

- [ ] Create `src/services/messageService.ts`
  - [ ] `getOrCreateConversation()`
  - [ ] `getMessages(conversationId)`
  - [ ] `sendMessage()`
  - [ ] `subscribeToMessages(conversationId, callback)`
  - [ ] `markConversationRead()`
- [ ] Rebuild `StudentMessages.tsx`
  - [ ] Remove all `chatData.ts` imports
  - [ ] Remove voice message UI
  - [ ] Real conversation list
  - [ ] Real message display + Realtime subscription
  - [ ] Text send
- [ ] Rebuild `TutorMessages.tsx` (same architecture)
- [ ] Delete `src/mock/chatData.ts`
- [ ] Test: student sends message → tutor sees it in real time
- [ ] Test: read receipts update

---

## Phase 6: Notifications

- [ ] Create `src/services/notificationService.ts`
- [ ] Rebuild `StudentNotifications.tsx` with real service
- [ ] Rebuild `TutorNotifications.tsx` with real service
- [ ] Wire notifications on these events (in code, at call site):
  - [ ] Booking created → notify tutor
  - [ ] Admin approves tutor → notify tutor
  - [ ] Assignment posted → notify enrolled students
  - [ ] Parent link request → notify student
  - [ ] Student approves parent link → notify parent
  - [ ] Application status changes → notify student
- [ ] Test: book a session → tutor gets notification
- [ ] Test: admin approves tutor → tutor gets notification

---

## Phase 7: Parent Portal

- [ ] Create `ParentLayout.tsx` with sidebar
- [ ] Create `ParentHome.tsx`, linked children list
- [ ] Create `ParentLinkStudent.tsx`, request link by student email
- [ ] Create `ParentStudentView.tsx`, read-only student dashboard
- [ ] Add parent routes to `Router.tsx`
- [ ] Test: parent requests link → student sees notification → approves
- [ ] Test: parent views linked student's sessions and assignments

---

## Phase 8: Counselor Portal

- [ ] Create `CounselorLayout.tsx` with sidebar
- [ ] Create `CounselorHome.tsx`, application stats
- [ ] Create `CounselorApplications.tsx`, list with status filter
- [ ] Create `CounselorApplicationDetail.tsx`, notes, status update, message
- [ ] Create `CounselorProfile.tsx`
- [ ] Add counselor routes to `Router.tsx`
- [ ] Test: counselor updates application status → student notified
- [ ] Test: counselor sends message → student receives it

---

## Phase 9: Cleanup & Polish

- [ ] Delete `src/mock/chatData.ts`
- [ ] Delete `src/mock/mockData.ts`
- [ ] Delete `src/services/studentService.ts`
- [ ] Delete `src/services/zoom.ts`
- [ ] Remove unused npm packages: `@zoom/meetingsdk`, `@jitsi/react-sdk`, `react-audio-visualize`, `wavesurfer.js`, `emoji-picker-react`
- [ ] Run `npm run build`, must succeed with 0 errors
- [ ] Run `tsc --noEmit`, must succeed with 0 type errors
- [ ] Full manual test of all 5 user journeys (see test protocol in `v1_implementation_plan.md`)
- [ ] Confirm `.env` is in `.gitignore` before final commit
- [ ] Final commit: `"feat: Yakal V1 complete - all portals live, no mocks"`
- [ ] Tag the release: `git tag -a v1.0.0 -m "Version 1 - Production Ready"`

---

## Package Cleanup

| Package | Status | Action |
|---|---|---|
| `@zoom/meetingsdk` | To Remove | No longer used |
| `@jitsi/react-sdk` | To Remove | No longer used |
| `react-audio-visualize` | To Remove | Voice messages descoped |
| `wavesurfer.js` | To Remove | Voice messages descoped |
| `emoji-picker-react` | To Remove | Descoped from messages |
| `jsonwebtoken` | To Remove | Was for Zoom JWT |

---

## Known Issues to Fix

| Issue | File | Priority |
|---|---|---|
| Onboarding always redirects to `/student` | `OnboardingPage.tsx` | CRITICAL |
| TutorHome calls `studentService` (wrong!) | `TutorHome.tsx` | HIGH |
| Welcome banner says "Brooklyn!" hardcoded | `StudentHome.tsx`, `TutorHome.tsx` | HIGH |
| Course detail uses hardcoded `courseData` object | `StudentCourseCatalogDetail.tsx` | HIGH |
| Booking creates Zoom meeting via API (descoped) | `StudentCourseCatalogDetail.tsx` | HIGH |
| Messages page uses `mockConversations` entirely | Both messages pages | HIGH |
| Notifications page uses mock data | Both notifications pages | MEDIUM |
| Avatar "Click to change (Mock)" does nothing | `OnboardingPage.tsx`, profile pages | MEDIUM |
| Zoom SDK package still in `package.json` | `package.json` | LOW |

---

*Last Updated: Phase 0, Branch `version1` created*

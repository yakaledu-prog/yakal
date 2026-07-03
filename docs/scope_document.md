# Yakal — Project Scope & Feature Specification

**Prepared for:** Client  
**Prepared by:** Development Team  
**Date:** July 3, 2026  
**Version:** 1.0

---

## 1. Project Overview

Yakal is a web-based tutoring platform that connects students with tutors for personalized academic support. The platform supports online and in-person sessions across subjects such as Mathematics, Science, SAT Prep, and College Advising.

The system serves four user roles: **Students**, **Tutors**, **Parents**, and **Administrators**. Each role has a dedicated portal with role-specific navigation, dashboards, and capabilities.

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend / Auth | Supabase (PostgreSQL, Auth, Row Level Security) |
| Serverless API | Vercel Serverless Functions (TypeScript) |
| Hosting | Vercel (frontend + serverless functions) |
| File Storage | Google Drive (links only — no native upload) |

> [!IMPORTANT]
> **No native file storage is included in this phase.** All videos, PDFs, worksheets, and learning materials will be distributed as Google Drive links. Tutors and administrators will paste shareable Google Drive URLs into the platform, and students will click to open them in a new tab. This avoids the infrastructure cost and complexity of file upload/storage services.

---

## 2. User Portals — What Each One Looks Like

### 2.1 Public Landing Page

The public-facing website is a single-page marketing site with the following sections:

- **Hero** — headline, call-to-action ("Get Started"), background image
- **Why Join Us** — value propositions
- **Subjects** — cards for each subject area (Algebra, Geometry, Physics, SAT Prep, etc.)
- **Parent Resources** — information targeted at parents
- **About** — company story and mission
- **Testimonials** — student/parent testimonials carousel
- **Team** — tutor and staff profiles
- **FAQ** — collapsible frequently asked questions
- **Blog** — featured articles (study habits, test prep, online tutoring)
- **Contact** — contact form
- **Footer** — links, social media, copyright

A visitor can browse freely, then click "Get Started" to reach the login/signup page.

---

### 2.2 Student Portal

After login, students land on a personalized dashboard. The left sidebar contains:

| Sidebar Item | Description |
|---|---|
| **Home** | Dashboard with welcome banner, next session card, homework due, weekly study hours chart |
| **Courses** | Browse the course catalog, view course details, read reviews, check tutor availability, and book sessions |
| **My Learning** | View enrolled courses with progress bars, statuses (In Progress / Done / Pending), and deadlines |
| **Calendar** | Month / week / day views showing upcoming sessions with tutor names and times |
| **Sessions** | List of all sessions (Upcoming / Past), with search, status badges, and action buttons |
| **Messages** | Full chat interface with conversation list, real-time messaging, emoji picker, voice messages, file sharing (via links) |
| **Notifications** | Inbox-style notification center with read/unread states, archive, and detail view |

**Additional pages accessible from links within the portal:**
- **Profile** — avatar, stats (active courses, completed sessions, upcoming tasks), recent activity, theme toggle
- **Settings** — profile information, notification preferences, dark mode toggle
- **Meeting** — video session page (when clicking "Join Meeting" from a session)
- **Session Detail** — detailed view of a single session with tutor info, date, time, and notes

#### How a Student Books a Session

1. Navigate to **Courses** in the sidebar.
2. Browse the catalog and click on a course (e.g., "Algebra Fundamentals").
3. View the course detail page with tabs: **Outline**, **Reviews**, **Resume**, **Availability**.
4. Click the **Availability** tab to see the tutor's weekly time grid.
5. The grid shows time slots from 8 AM – 8 PM across all 7 days. Each slot is color-coded:
   - 🟢 Green = Online
   - 🔵 Blue = In-Person
   - 🟡 Gold = Both (Online + In-Person)
   - Gray = Unavailable
6. Click one or more available slots, then click **Book N Slot(s)**.
7. The system creates a session record in the database and (when video integration is active) generates a meeting room.
8. The student can now see the session in **Sessions** and **Calendar**.
9. When the session time arrives, click **Join Meeting** to enter the video room.

---

### 2.3 Tutor Portal

The tutor portal mirrors the student layout with tutor-specific functionality. The sidebar contains the same navigation items:

| Sidebar Item | Description |
|---|---|
| **Home** | Dashboard with welcome banner, upcoming sessions, tasks assigned to students |
| **Courses** | Manage courses they teach — view enrollment, session history |
| **My Learning** | View courses they are assigned to with progress tracking |
| **Calendar** | See all scheduled sessions with student names |
| **Sessions** | Manage sessions — view upcoming, mark complete, cancel |
| **Messages** | Chat with students and parents |
| **Notifications** | Receive system alerts, session reminders, new bookings |

#### How a Tutor Sets Their Availability

1. Navigate to **Calendar** in the sidebar.
2. Click the **Set Availability** button.
3. A full-screen modal opens with a weekly grid editor:
   - Rows represent hours (8 AM to 8 PM)
   - Columns represent days (Sun – Sat)
4. Select a paint tool:
   - 🎥 **Online** — marks the slot as available for online sessions
   - 📍 **In-Person** — marks the slot as available for in-person sessions
   - 🔲 **Both** — marks the slot as available for either
   - 🧹 **Eraser** — clears a slot
5. Click-and-drag across cells to paint multiple slots at once.
6. Optionally disable entire days by toggling the day header checkbox.
7. Click **Save** — the availability is persisted to Supabase and immediately visible to students browsing the course catalog.

#### How a Tutor Starts a Session

1. Navigate to **Sessions** and find the upcoming session.
2. Click **Start Meeting** — this opens the video room as the host (role = 1).
3. Alternatively, click the session from the **Home** dashboard's "Next Session" card.

---

### 2.4 Parent Portal *(Planned — Not Yet Implemented)*

The parent portal is currently a placeholder route (`/parent/*`) that renders a basic placeholder page. The planned design includes:

| Sidebar Item | Description |
|---|---|
| **Home** | Dashboard overview of linked children's progress |
| **Children** | List of linked student accounts with quick access to each child's performance |
| **Sessions** | View upcoming and past sessions for each child |
| **Reports** | Progress reports, attendance summaries, grades |
| **Messages** | Communicate with tutors |
| **Notifications** | Alerts about session reminders, grade updates, missed sessions |

#### How a Parent Monitors Progress

1. Log in and see an overview dashboard with each linked child's summary.
2. Click on a child to see their enrolled courses, session attendance, and task completion.
3. View progress reports generated from session data.
4. Message tutors directly from the child's profile.

> [!NOTE]
> The parent portal requires a **parent-child linking** mechanism (likely an invitation code or email link). The data model for this relationship needs to be designed and implemented. This is included in the current scope as a **basic implementation** — a parent can view their child's sessions and course progress.

---

### 2.5 Admin Portal *(Planned — Not Yet Implemented)*

The admin portal is currently a placeholder route (`/admin/*`). The planned design includes:

| Sidebar Item | Description |
|---|---|
| **Dashboard** | Platform-wide statistics: total users, active sessions, revenue, recent signups |
| **Users** | Manage all accounts (students, tutors, parents) — activate, deactivate, view profiles |
| **Courses** | Create, edit, and archive courses in the catalog |
| **Sessions** | View all sessions across the platform, filter by tutor/student/date |
| **Reports** | Platform analytics — session volume, popular courses, tutor utilization |
| **Settings** | System-wide configuration — default session duration, notification templates |

#### How an Admin Manages the Platform

1. View the dashboard for a quick snapshot of platform health.
2. Navigate to **Users** to search for and manage accounts.
3. Navigate to **Courses** to add new courses to the catalog, assign tutors, and set pricing.
4. Review **Sessions** to identify issues (cancellations, no-shows) and intervene.
5. Generate **Reports** for stakeholder presentations.

---

## 3. Features Included in Current Budget

### 3.1 Authentication & User Management

| Feature | Status | Details |
|---|---|---|
| Email/password signup and login | ✅ Built | Supabase Auth with email confirmation flow |
| Role selection during signup | ✅ Built | Student, Tutor, or Parent role picker |
| Onboarding flow | ✅ Built | First-time profile setup (name, avatar, theme) |
| Profile management | ✅ Built | Edit name, avatar, theme preference |
| Demo accounts for testing | ✅ Built | 4 pre-seeded accounts (Admin, Parent, Student, Tutor) |
| Google OAuth | ⬜ Planned | Supabase supports this natively — low effort |
| Password reset | ⬜ Planned | Supabase provides this out of the box |

### 3.2 Course Management

| Feature | Status | Details |
|---|---|---|
| Course catalog with search | ✅ Built | Grid/list view with category filtering |
| Course detail page | ✅ Built | Tabs for Outline, Reviews, Resume, Availability |
| Course syllabus with modules | ✅ Built | Expandable module list with session counts and durations |
| Course reviews | ✅ Built | Student review display with ratings |
| Tutor profile on course page | ✅ Built | Bio, response time, certification badges |
| My Learning dashboard | ✅ Built | Enrolled courses with progress bars |
| Course progress tracking | ✅ Built | Per-course overview, tasks, sessions, resources tabs |

> [!NOTE]
> Course data is currently served from mock/static data embedded in the frontend. Migrating this to a Supabase database table is part of the current scope and will be completed before launch.

### 3.3 Session Booking & Scheduling

| Feature | Status | Details |
|---|---|---|
| Tutor availability grid editor | ✅ Built | Drag-to-paint weekly grid with Online/In-Person/Both modes |
| Student booking from availability grid | ✅ Built | Click slots → Book → session created in database |
| Session list with Upcoming/Past tabs | ✅ Built | Search, filter, status badges |
| Session detail page | ✅ Built | Full session info with tutor/student names |
| Calendar views (month/week/day) | ✅ Built | Visual calendar with session events |
| Session status management | ✅ Built | Upcoming → Completed or Canceled |
| Reschedule / Cancel buttons | 🔲 UI Built | Buttons exist but backend logic needs wiring |

### 3.4 Messaging

| Feature | Status | Details |
|---|---|---|
| Conversation list with avatars | ✅ Built | WhatsApp-style contact list with last message preview |
| Real-time chat interface | ✅ Built | Message bubbles, read receipts (✓✓), timestamps |
| Emoji picker | ✅ Built | Full emoji keyboard integration |
| Voice messages | ✅ Built | Record, visualize waveform, playback |
| File sharing via links | ✅ Built | Send Google Drive links in chat |
| Search within conversations | ✅ Built | Filter conversations by name |

> [!NOTE]
> Messaging currently uses mock data. Migrating to Supabase Realtime (real-time subscriptions on a `messages` table) is included in the current scope. This enables live message delivery without polling.

### 3.5 Notifications

| Feature | Status | Details |
|---|---|---|
| Notification inbox | ✅ Built | Gmail-style inbox with read/unread, archive, delete |
| Notification detail view | ✅ Built | Expand notification to see full content |
| Session reminders | ✅ Built | System-generated reminders before sessions |
| Resource upload alerts | ✅ Built | Notify when tutor adds new materials |

### 3.6 Learning Resources

| Feature | Status | Details |
|---|---|---|
| Resource library | ✅ Built | List of PDFs, Videos, Links with search and category filter |
| Resource type icons | ✅ Built | Visual distinction between PDF, Video, Link types |
| Per-course resources tab | ✅ Built | Resources scoped to each enrolled course |

> [!IMPORTANT]
> **All resources are delivered via Google Drive links.** Tutors paste a Google Drive share URL when adding a resource. Students click the link to open the file in Google Drive in a new tab. There is no file upload, download, or preview within the platform itself. This keeps the infrastructure simple and cost-free for file storage.

### 3.7 Settings & Preferences

| Feature | Status | Details |
|---|---|---|
| Dark mode / Light mode | ✅ Built | Persisted to user profile in database |
| Profile editing | ✅ Built | Name, avatar, email |
| Notification preferences | ✅ Built | Toggle email and SMS notifications |

### 3.8 Analytics & Charts

| Feature | Status | Details |
|---|---|---|
| Weekly study hours chart | ✅ Built | Bar chart on student home dashboard |
| Profile stats cards | ✅ Built | Active courses, completed sessions, upcoming tasks |

---

## 4. Video Sessions — Options Comparison

Video conferencing is a core feature. Here is a detailed comparison of the options we have evaluated:

### Option A: Zoom Meeting SDK (Embedded)

| Aspect | Details |
|---|---|
| **How it works** | Embed Zoom meetings directly inside the web app using the Component View SDK. Users never leave the platform. |
| **Development effort** | Medium. Requires serverless API for JWT signature generation and S2S OAuth for meeting creation. Already partially implemented. |
| **Ongoing maintenance** | Low. Zoom handles all infrastructure. SDK updates are infrequent. |
| **Hosting / Infrastructure** | None. Zoom's cloud handles everything. |
| **Cost** | Free tier: 10,000 participant-minutes/month (≈166 hours). Paid plans start at ~$100/month for more. |
| **Reliability** | Excellent. Enterprise-grade infrastructure, 99.9% uptime SLA. |
| **Recording** | Available on paid plans only (cloud recording). |
| **Limitations** | Free tier has a per-meeting 40-minute limit. SDK has strict React version peer dependency (requires `react@18.2.0`), which conflicts with the current `react@18.3.1` and causes CSS injection that breaks Tailwind styles. The "Client View" SDK injects Bootstrap globally and takes over the entire viewport. The "Component View" SDK is more compatible but still has integration friction. |

### Option B: Jitsi Meet (Embedded via IFrame API)

| Aspect | Details |
|---|---|
| **How it works** | Embed Jitsi video rooms via an iframe using the Jitsi IFrame API or `@jitsi/react-sdk`. Rooms are created instantly — no API calls needed. |
| **Development effort** | Very low. Just pass a room name to the component. No backend API needed for basic usage. |
| **Ongoing maintenance** | Very low if using `meet.jit.si` (public servers). Medium-high if self-hosting. |
| **Hosting / Infrastructure** | None (public servers) or significant (self-hosting requires a dedicated VM with 4+ CPU cores, 8+ GB RAM). |
| **Cost** | Free (public servers). Self-hosting: $20–80/month for a VPS. |
| **Reliability** | Good on public servers during off-peak hours. Can freeze during peak usage. Self-hosting gives full control but requires DevOps expertise. |
| **Recording** | Possible with Jibri (self-hosted only). Requires a separate server with 4+ cores and 8+ GB RAM dedicated solely to recording. |
| **Limitations** | Public servers have no SLA and can be unreliable during high-traffic periods. No participant-level analytics. Self-hosted recording (Jibri) is notoriously difficult to set up and maintain. |

### Option C: JaaS (Jitsi as a Service by 8×8)

| Aspect | Details |
|---|---|
| **How it works** | Managed Jitsi service by 8×8. Similar to Jitsi Meet but with dedicated infrastructure, JWT authentication, and analytics. |
| **Development effort** | Low. Similar to Jitsi IFrame API with added JWT token generation. |
| **Ongoing maintenance** | Low. 8×8 manages infrastructure. |
| **Hosting / Infrastructure** | None. Cloud-managed. |
| **Cost** | Free tier: 25 monthly active users. Paid plans start at ~$10/user/month. |
| **Reliability** | Good. Dedicated infrastructure performs better than public `meet.jit.si`. |
| **Recording** | Available on paid plans. Cloud-based, no Jibri setup needed. |
| **Limitations** | "25 monthly active users" means 25 *unique users* per month, not 25 sessions. This limit is extremely low for a tutoring platform and would be exceeded almost immediately. Paid tier pricing scales per-user, which can become expensive. |

### Option D: MiroTalk / BigBlueButton / Nextcloud Talk (Self-Hosted)

| Aspect | Details |
|---|---|
| **How it works** | Self-hosted open-source video conferencing solutions. Requires setting up and maintaining your own server infrastructure. |
| **Development effort** | High. Requires installing, configuring, and integrating each solution. Custom API development for room management, authentication, and embedding. |
| **Ongoing maintenance** | High. OS updates, security patches, SSL certificates, TURN/STUN server configuration, monitoring, backup. This is effectively running a second product. |
| **Hosting / Infrastructure** | Significant. Minimum 4-core CPU, 8 GB RAM dedicated server ($40–100+/month). BigBlueButton specifically recommends 8 cores and 16 GB RAM. |
| **Cost** | Software is free (open source). Infrastructure: $40–100+/month. DevOps labor: ongoing. |
| **Reliability** | Depends entirely on your infrastructure and maintenance diligence. No vendor SLA. |
| **Recording** | BigBlueButton has built-in recording. MiroTalk requires additional setup. |
| **Limitations** | Substantial ongoing DevOps burden. Not practical within the current budget unless the client already has dedicated infrastructure and DevOps staff. Any downtime is your responsibility. |

### Recommendation

> [!TIP]
> **For the current budget and timeline, we recommend Jitsi Meet (public servers) with JaaS as a near-term upgrade path.**
> 
> - **Phase 1 (Now):** Use the Jitsi IFrame API with public `meet.jit.si` servers. This is already partially implemented, requires zero infrastructure, and provides a working video experience at zero cost.
> - **Phase 2 (Growth):** When call quality becomes a concern or you need recording/analytics, upgrade to JaaS (paid tier) or Zoom Meeting SDK (Component View). Both are drop-in replacements that reuse the same frontend patterns.
> 
> Self-hosted solutions (MiroTalk, BigBlueButton) are **not recommended** unless the client is prepared to fund a dedicated server and ongoing DevOps support.

---

## 5. Implementation Considerations

### 5.1 Data Migration: Mock → Database

Many features currently render data from hardcoded mock objects embedded in the frontend code. Before launch, the following must be migrated to Supabase database tables:

| Data | Current State | Migration Effort |
|---|---|---|
| Course catalog | Hardcoded in `StudentCourseCatalogDetail.tsx` | Create `courses` table, admin CRUD, fetch from DB |
| Tutor profiles | Hardcoded in course detail mock | Extend `profiles` table with tutor-specific fields |
| Dashboard summary | `studentService.ts` returns static mock | Query sessions, tasks from DB and compute |
| Chat messages | `mock/chatData.ts` | Create `messages` table with Supabase Realtime |
| Notifications | Hardcoded in `StudentNotifications.tsx` | Create `notifications` table with triggers |
| Resources | Hardcoded in `StudentResources.tsx` | Create `resources` table (title, type, google_drive_url) |
| Calendar events | Hardcoded in `StudentCalendar.tsx` | Already partially live — sessions from DB render on calendar |

### 5.2 Google Drive as File Storage

Since we are not implementing native file upload/storage in this phase:

- **Tutors** will paste Google Drive share links when adding resources.
- **Students** will click links that open in a new tab.
- The `resources` database table will store: `id`, `title`, `type` (PDF/Video/Link), `url` (Google Drive link), `course_id`, `created_by`, `created_at`.
- We will validate that URLs match the `drive.google.com` domain pattern.
- Tutors are responsible for setting correct sharing permissions on their Google Drive files (e.g., "Anyone with the link can view").

### 5.3 Parent-Child Account Linking

To enable the parent portal, we need a mechanism to link parent accounts to student accounts. Proposed approach:

1. When a parent signs up, they enter their child's email address.
2. The system generates an invitation link or code.
3. The student (or an admin) confirms the link.
4. Once linked, the parent can view the student's sessions, courses, and progress in read-only mode.

This requires a `parent_student_links` table in the database.

### 5.4 Admin Portal

The admin portal requires:
- A user management interface with search, filter, role display.
- Course CRUD (create, edit, archive/delete).
- Session oversight (view all, filter, export).
- Basic analytics dashboard (total users, sessions per week, popular courses).

This is standard CRUD work but represents a meaningful development effort.

---

## 6. Feature Feasibility Notes

### Payments / Billing
**Not included in current scope.** If payment processing is needed later, Stripe is the recommended integration. Estimated cost: $500–1,500 depending on complexity (subscriptions vs. one-time, invoices, refunds). Stripe's processing fee is 2.9% + $0.30 per transaction.

### Session Recording
**Not feasible at zero cost.** All free video options either don't support recording or require expensive self-hosted infrastructure (Jibri for Jitsi requires a dedicated $40+/month server). Cloud recording is available on Zoom paid plans (~$13.99/user/month) and JaaS paid plans. Consider this a future enhancement.

### Transcription
**Not feasible within current budget.** Real-time transcription requires a paid API (Google Cloud Speech-to-Text, AssemblyAI, or Deepgram) at ~$0.006–0.015 per minute of audio. For 100 hours of sessions per month, this would cost $36–90/month in API fees alone, plus development effort. Recommend deferring to a future phase.

### Mobile App
**Not included in current scope.** The web application is fully responsive and works well on mobile browsers. A native iOS/Android app would be a separate project estimated at $5,000–15,000 depending on feature parity.

---

## 7. Future Enhancements *(Outside Current Scope)*

The following features are intentionally postponed. They are listed here with estimated implementation costs so the client can plan for future development phases.

| Feature | Estimated Cost | Complexity | Notes |
|---|---|---|---|
| **Native File Storage** (upload/download/preview) | $800 – $1,500 | Medium | Supabase Storage or AWS S3. Includes upload UI, storage bucket, access policies, preview. Replaces Google Drive links with native experience. |
| **Session Recording** | $500 – $1,200 | Medium–High | Requires paid Zoom/JaaS plan. Includes recording trigger, storage, playback UI. Ongoing API costs apply. |
| **Real-time Transcription** | $1,000 – $2,000 | High | Third-party speech-to-text API integration. Ongoing per-minute costs. |
| **Payment Processing** (Stripe) | $500 – $1,500 | Medium | Session-based or subscription billing. Includes checkout, invoices, refund handling. |
| **Mobile App** (React Native) | $5,000 – $15,000 | High | Native iOS/Android app with push notifications. |
| **Advanced Analytics** | $800 – $1,500 | Medium | Tutor performance dashboards, student engagement metrics, exportable reports. |
| **Automated Email Campaigns** | $300 – $600 | Low | Session reminders, follow-ups, marketing emails via SendGrid/Resend. |
| **Multi-language Support (i18n)** | $500 – $1,000 | Medium | Amharic and English support. Requires translation of all UI strings. |
| **AI Tutor / Homework Help** | $1,500 – $3,000 | High | GPT-powered chat assistant for homework questions. Ongoing API costs. |

---

## 8. Summary of Deliverables

### Included in Current Budget ✅

1. **Public landing page** — fully designed with all sections
2. **Authentication system** — signup, login, onboarding, demo accounts
3. **Student portal** — dashboard, course catalog, booking, sessions, calendar, messaging, notifications, profile, resources, settings
4. **Tutor portal** — dashboard, availability editor, session management, messaging, notifications, profile, resources, settings
5. **Parent portal** — basic implementation with child linking and read-only progress views
6. **Admin portal** — user management, course CRUD, session oversight, basic analytics
7. **Video sessions** — embedded video conferencing (Jitsi or equivalent, see Section 4)
8. **Database migration** — move all mock data to Supabase tables
9. **Google Drive resource sharing** — tutors add links, students access via links
10. **Responsive design** — works on desktop, tablet, and mobile browsers
11. **Dark mode** — full dark theme support across all portals

### Not Included ❌

1. Native file upload/storage (using Google Drive links instead)
2. Session recording or transcription
3. Payment/billing integration
4. Native mobile app
5. Advanced analytics or reporting exports
6. AI-powered features

---

## 9. Approval

This document defines the agreed-upon scope of work. Features listed in Section 3 are included in the current budget. Features in Section 7 are explicitly excluded and will require additional development time and budget.

Any feature request not covered in this document will be evaluated as a change request with its own timeline and cost estimate.

| | Name | Signature | Date |
|---|---|---|---|
| **Client** | | | |
| **Developer** | | | |

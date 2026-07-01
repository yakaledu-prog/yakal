# Zoom Meeting SDK Integration

Integrate the Zoom Meeting SDK so that when a student books a session, a real Zoom meeting is created, and both the student and tutor can join it directly from the app.

## User Review Required

> [!IMPORTANT]
> **You need to create a Zoom App** on the [Zoom Marketplace](https://marketplace.zoom.us/). Follow these steps:
> 1. Go to **Zoom Marketplace → Develop → Build App**
> 2. Choose **Meeting SDK** app type
> 3. Note down your **SDK Key** (Client ID) and **SDK Secret** (Client Secret)
> 4. Also create a **Server-to-Server OAuth** app to get API credentials for creating meetings:
>    - Note down the **Account ID**, **Client ID**, and **Client Secret**
> 5. I will place all placeholder env vars in `.env` — you just fill in the values.

> [!WARNING]
> The Zoom Meeting SDK requires a **paid Zoom account** (Pro or higher) to create meetings via API. Free accounts can only join meetings.

## Environment Variables Needed

I will add these to your `.env` file. You fill in the actual values:

```env
# Zoom Meeting SDK (for client-side SDK auth)
VITE_ZOOM_SDK_KEY=your_zoom_sdk_key_here

# Zoom Server-to-Server OAuth (for creating meetings via API)
ZOOM_SDK_SECRET=your_zoom_sdk_secret_here
ZOOM_S2S_ACCOUNT_ID=your_zoom_s2s_account_id
ZOOM_S2S_CLIENT_ID=your_zoom_s2s_client_id
ZOOM_S2S_CLIENT_SECRET=your_zoom_s2s_client_secret
```

## Proposed Changes

### Vercel Serverless API

Since the project is a Vite SPA deployed on Vercel, we'll use **Vercel Serverless Functions** (`/api` directory) to handle server-side Zoom operations securely (secrets never exposed to the client).

#### [NEW] `api/zoom-signature.ts`
- Serverless function that generates a **Meeting SDK JWT** for the client.
- Accepts `POST { meetingNumber, role }` and returns `{ signature }`.
- Uses `VITE_ZOOM_SDK_KEY` + `ZOOM_SDK_SECRET` to create an HMAC-SHA256 JWT.
- This is the auth endpoint the Zoom SDK needs.

#### [NEW] `api/zoom-create-meeting.ts`
- Serverless function that creates a Zoom meeting via the **Zoom REST API**.
- Accepts `POST { topic, startTime, duration, tutorEmail }`.
- First obtains a Server-to-Server OAuth access token using `ZOOM_S2S_*` credentials.
- Then calls `POST https://api.zoom.us/v2/users/me/meetings` to create a meeting.
- Returns `{ meetingNumber, password, joinUrl }`.

---

### Database Schema

#### [MODIFY] `supabase-schema.sql` / new migration
- Add columns to the `sessions` table:
  - `zoom_meeting_id` (text, nullable) — The Zoom meeting number
  - `zoom_password` (text, nullable) — The Zoom meeting password
  - `zoom_join_url` (text, nullable) — The join URL
  - `status` (text, default 'upcoming') — 'upcoming' | 'completed' | 'canceled'

---

### Services Layer

#### [MODIFY] [sessions.ts](file:///home/binyam/products/yakal/src/services/sessions.ts)
- Update `createSession` to also accept and store `zoom_meeting_id`, `zoom_password`, `zoom_join_url`.
- Add `updateSessionStatus(sessionId, status)` function.

#### [NEW] `src/services/zoom.ts`
- `generateSignature(meetingNumber, role)` → calls `/api/zoom-signature`
- `createZoomMeeting(topic, startTime, duration)` → calls `/api/zoom-create-meeting`

---

### Components

#### [NEW] `src/components/feature/ZoomMeeting.tsx`
- React component that embeds the Zoom Meeting SDK using **Component View**.
- Props: `meetingNumber`, `password`, `userName`, `userEmail`, `role` (0=participant, 1=host).
- On mount: loads `@zoom/meetingsdk`, calls `/api/zoom-signature` to get a JWT, then `client.join()`.
- Renders the Zoom meeting UI within a container div inside the app.

---

### Page Updates

#### [MODIFY] [StudentCourseCatalogDetail.tsx](file:///home/binyam/products/yakal/src/pages/student/StudentCourseCatalogDetail.tsx)
- Update `handleBookSlot` to:
  1. Call `createZoomMeeting()` to get a real meeting number + password.
  2. Pass the Zoom meeting data to `createSession()` so it's persisted in the DB.

#### [MODIFY] [StudentSessions.tsx](file:///home/binyam/products/yakal/src/pages/student/StudentSessions.tsx)
- Add a "Join Meeting" button that navigates to `/student/meeting/:sessionId`.
- Fetch and display the `zoom_join_url` for each session.

#### [MODIFY] [TutorSessions.tsx](file:///home/binyam/products/yakal/src/pages/tutor/TutorSessions.tsx)
- Add a "Start Meeting" button that navigates to `/tutor/meeting/:sessionId`.
- Tutor joins with `role=1` (host).

#### [NEW] `src/pages/student/StudentMeeting.tsx`
- Full-page component that wraps `<ZoomMeeting />`.
- Fetches the session from the DB to get the meeting number + password.
- Passes `role=0` (participant) to the Zoom SDK.

#### [NEW] `src/pages/tutor/TutorMeeting.tsx`
- Same as above but with `role=1` (host).
- The tutor starts the meeting.

#### [MODIFY] [Router.tsx](file:///home/binyam/products/yakal/src/app/Router.tsx)
- Add routes: `/student/meeting/:sessionId` and `/tutor/meeting/:sessionId`.

## Verification Plan

### Manual Verification
1. Log in as `tutor@yakal.com`, set availability.
2. Log in as `student@yakal.com` in incognito, browse to a course, book a session.
3. Verify the session appears in both the Student and Tutor Sessions pages with a "Join Meeting" / "Start Meeting" button.
4. Click "Start Meeting" as the Tutor → Zoom meeting loads in-app.
5. Click "Join Meeting" as the Student → Zoom meeting loads in-app, and both users can see and hear each other.

### Automated Tests
- `npm run typecheck` to ensure no type errors.

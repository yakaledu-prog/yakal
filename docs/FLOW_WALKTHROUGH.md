# Walking the whole flow, once

Admin creates a course, parent buys it for their child, child reads the work.
Every password is `demo123`.

## The accounts

| Role                                                | Sign in as                        | Notes                                                        |
| -----------------------------------------------------| -----------------------------------| --------------------------------------------------------------|
| Admin, and the Google account that owns the classes | `binyam2537@gmail.com`            | holds `GOOGLE_OAUTH_REFRESH_TOKEN`                           |
| **Parent**                                          | **`binyam2537+parent@gmail.com`** | **this is the one linked to the child below**                |
| Child                                               | `binyammamo01@gmail.com`          | "Binyam (student)", the only real Google account on a roster |
| Tutor                                               | `binyam2537+tutor@gmail.com`      | an alias, no Google account needed                           |

The child is **already enrolled in K-12 Mathematics** from the seed, so use a
different course for this walkthrough or the purchase step has nothing to do.

Run `npm run dev` first. Both servers matter: the Classroom read goes through
our API on 3001, not the browser.

---

## 1. Admin: create the course

Sign in as `binyam2537@gmail.com`, go to **Courses**, **New course**.

1. **Basic info**: title, subject, thumbnail.
2. **Description**: anything.
3. **Classroom and pricing**:
   - Paste the class URL, for example `https://classroom.google.com/c/ODcwNjI3MzQ5NDc2` (the `yakal` class)
   - Click **Fetch Details**. It should list the assignments in that class.
     That is the confirmation you attached the right one. No Google sign-in,
     no popup.
   - Set a price. Keep it small; this is a real Stripe test charge.
4. Save.

If Fetch Details errors, the message says which: "not found for the Yakal
Google account" means the class belongs to a different Google account, and
"Google access has expired" means the refresh token is dead.

## 1b. Give the course a tutor, or the parent will never see it

**The course modal has no tutor field, on purpose.** A tutor is assigned by
applying, and the parent catalog lists only courses that have one, because a
course with no tutor has no calendar to book a time from and every card would
be a dead end.

So a course you just created is invisible to parents until:

1. Sign in as a tutor, for example `binyam2537+tutor@gmail.com`
2. **Find Courses**, find the new course, **Apply**
3. Back as the admin, open the course, **Tutors** tab, approve them

Faster, if you only want to test the purchase: set `tutor_id` on the course in
Supabase Studio on port 54323.

## 2. Parent: buy it for the child

Sign out, sign in as **`binyam2537+parent@gmail.com`**.

1. **Courses**, find the course you just made, open it.
2. Book it, choosing **Binyam (student)** as the child.
3. Pay with the Stripe test card:

```
4242 4242 4242 4242    any future expiry    any CVC    any postcode
```

You do not need the Stripe CLI running. The app confirms the session when you
return from Stripe, so fulfilment happens without the webhook. Wait for the
redirect back rather than closing the tab.

The enrolment is written on return. That is the moment the child gets access.

## 3. Child: read the course

Sign out, sign in as **`binyammamo01@gmail.com`**.

**My Learning** should now show the course. Open it, and the assignments from
that Google class should be there: titles, descriptions, materials, due dates,
and topic headings if the class uses topics.

This works with no Google sign-in and no Classroom membership, because the
server reads the class as the operations account. That is the point of the
design: buying the course is the only thing the family had to do.

## 4. Tutor and admin: the other side

`binyam2537+tutor@gmail.com`, then **Courses**, the same course: the same list
of work, plus who has turned in, if anyone has.

`binyam2537@gmail.com` sees the same from **Courses**.

---

## What will not work yet, and why

**No turned-in state or grades** unless the child has joined the Google class.
Read access does not need membership, but submissions do: Classroom has no
submission rows for somebody who is not on the roster.

To see that half working, invite `binyammamo01@gmail.com` to the class from
Classroom, accept from that account, turn something in, then grade and
**Return** it.

**Sending that invite is still manual.** Automatic invite on purchase, a
**Join** button on the child's course page, and an invite state per student in
the admin's Students tab are the next thing to build. See
`docs/COURSE_LIFECYCLE.md`.

**Nothing shows this to a parent.** The API grants a parent their child's view
and it is covered by tests, but no parent page renders the assignment list yet.

# Production, 10 September 2026

Tested against yakal.me after pushing the September work. Local findings are in
the other files here; this is only what differs once deployed.

## 1. Zoom cannot work in production. One environment variable.

`VITE_ZOOM_MEETING_CLIENT_ID` on the deployment is set to
**`your-meeting-sdk-client-id`**, the value from `.env.example`.

Decoded straight from the live site:

```
POST https://yakal.me/api/zoom?action=signature
  {"meetingNumber":"88082791691","role":0}

{"appKey":"your-meeting-sdk-client-id","mn":"88082791691","role":0,...}
```

The Meeting SDK reads `appKey` out of the signature, so every join is being
handed a token signed for an application that does not exist. Zoom refuses it
the moment somebody presses Join.

**What made it invisible:** the handler checked the credentials were *present*,
and a placeholder is a perfectly good non-empty string. So it answered `200`
with a valid-looking signature. The browser cannot tell a good signature from a
bad one, so there is no error to see anywhere: the first symptom is a person
sitting in front of a meeting that will not open, with nothing in any log.

Fixed so it refuses anything still shaped like an example and names the
variables an administrator has to set. A `500` that says what is wrong is worth
more than a `200` that cannot work. Pinned by
`scripts/verify/zoom-signature.ts`.

**Still to do, and only you can:** set `VITE_ZOOM_MEETING_CLIENT_ID` and
`ZOOM_MEETING_CLIENT_SECRET` on Render to the real Meeting SDK credentials.
The server-to-server variables (`ZOOM_S2S_*`) are a different app and are worth
checking at the same time, since those are what create the meetings.

One correction to something I said while testing: I claimed the placeholder was
in the frontend bundle too. It is not. The client id is never baked into the
browser; the SDK takes it from the signature. This is one variable, server side.

## 2. What is fine

- The site is up, serving, and the health of the API routes is right: the jobs
  endpoint answers `401` without its token, the refund endpoint answers `401`
  without a session, and the signature endpoint validates its input.
- Supabase points at the hosted project, not local.
- The migrations from this work applied cleanly. The `Database` workflow builds
  the schema from nothing on a clean runner, seeds it, checks it, and only then
  pushes to the hosted project, and it passed.
- CI passed on the same commit.

## 3. To confirm once the deploy lands

The push went in while Render was still serving the previous bundle, so the
following were checked locally and need one more pass against production:

- the install card only on the landing page
- `/` no longer flashing the marketing page at a signed-in visitor
- `/login` sending a signed-in visitor to their dashboard
- diagnostics loading from the database with no answer key in the bundle
- the refunded state showing on both the admin and parent billing pages

## 4. Environment, separately

`VITE_DEV_PREVIEW` is on in the production build. The app logs it itself on
boot:

```
[YAKAL] DEV_PREVIEW is ON in a production build: demo logins and /preview are
public. Unset VITE_DEV_PREVIEW to close them.
```

That leaves the demo logins and the `/preview` routes reachable by anybody. Fine
while this is a testing deployment, not fine on the day real families arrive.

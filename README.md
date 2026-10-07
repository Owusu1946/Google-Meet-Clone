# Google Meet Clone

A Next.js 15 / React 19 meeting application using Clerk for accounts and Stream for video, captions, recording, and persistent collaboration.

## Run locally

Use Node.js 22.13+ and pnpm 10.33.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Fill in your Clerk and Stream credentials.
pnpm setup:stream
pnpm dev
```

On PowerShell, use `Copy-Item .env.example .env`. Configure Clerk sign-in/sign-up URLs and allow the application origin in the provider dashboards. Camera, microphone, and screen sharing require HTTPS outside localhost. No browser launches automatically.

`pnpm setup:stream` provisions the dedicated `meet`, `meet-chat`, `meet-board`, and `meet-requests` types. Run it before creating meetings and when changing their permissions. It changes those dedicated types only. Video participants receive the explicit `call_member` role; the creator receives `host`. Ordinary users have no access to these calls or channels until the server admits them. Board and admission channels reject direct client writes.

Existing meetings created under the old `default` call type are not migrated or exposed through the new flow. Create a new meeting link after setup; existing service data is preserved.

## Configuration

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`: Clerk application keys.
- `NEXT_PUBLIC_STREAM_API_KEY` and `STREAM_API_SECRET`: Stream application keys with Video and Chat enabled.
- `GUEST_SESSION_SECRET`: optional independent random secret for signed, HttpOnly guest identities; otherwise the server uses the Stream secret. Guest sessions expire after 24 hours and Stream tokens after 15 minutes.
- `WEBHOOK_SECRET`: Clerk/Svix signing secret for `/api/webhooks`; subscribe to user created, updated, and deleted events.
- `RESEND_API_KEY` and `MEETING_EMAIL_FROM`: optional email delivery with a verified sender. Without these, invitations use the user's email app or copied link. Recipients are sent separate messages with retry idempotency.
- `MEET_BUILD_DIR`: optional separate Next build output, e.g. `.next-verify` for a second local validation server or `.next-build` for production validation alongside dev.

Keep all server keys out of client bundles and version control. Configure captions and recording availability/storage in the Stream project. Starting either feature requires service support and an active call; the UI reports rejected requests. Completed recordings are visible to the host in-call, from recent meetings, and after leaving, once processing finishes.

## Meeting flow

Signed-in users create instant or reusable meeting links. Everyone enters a prejoin lobby; named guests receive server-signed identities. Microphone and camera start off by default, and saved device choices survive navigation. Restricted meetings require admission; open meetings admit link holders automatically. Hosts can lock new entry, deny applicants, mute/remove participants, disable drawing, present the shared board, and end the call for everyone.

The meeting has tiled and active-speaker layouts, screen sharing, one side panel at a time, durable chat and hand state, reactions, device settings, genuine background blur, and per-viewer caption visibility. Captions come from the meeting transcription service with the service's speaker identity; they are not local browser microphone recognition.

The board uses world coordinates, pointer capture, bounded stroke segments, server-validated writes, persistent history, deterministic replay, own-stroke undo/redo, host-only clear, and whole-board PNG export. Failed edits remain queued, can be retried, and survive reload in the same tab. Normal leaving waits for pending edits. Each viewer can open/close the board; host presentation announces and opens it for others and late joiners.

Keyboard shortcuts: Ctrl/Command+D toggles the microphone; Ctrl/Command+E toggles the camera. Escape closes dialogs or the focused side panel. The More options menu keeps collaboration features available on phones.

## Validation

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

For live service/API checks, start a local server, then explicitly run:

```powershell
$env:VERIFY_BASE_URL='http://localhost:3000'
pnpm verify:services
```

This creates disposable users/calls/channels, tests admission, ownership, service permissions, board retries, locking/removal, recording access, and meeting end, then deletes only its fixtures. It does not start recordings/captions or send email. It requires the configured Stream project and a running application. Transient 503 responses are retried twice. The host fixture is provisioned with server credentials, so this does not validate a real Clerk login or signed-in meeting creation.

CI runs deterministic checks and production compilation without live credentials. Live service checks are intentionally opt-in. See [MANUAL_TESTS.md](MANUAL_TESTS.md) for browser/media acceptance, and [PROJECT_AUDIT.md](PROJECT_AUDIT.md) for the original findings and resolution status. Automated success does not establish browser layout, WebRTC audio/video, caption accuracy, email delivery, or recording playback.

For the host-mute regression, run `pnpm verify:mute`. It reproduces the rejected server request without a moderator identity and verifies the corrected request using disposable fixtures. With `VERIFY_BASE_URL` set to the local app, it also checks the real host route, nonhost denial, and self-mute denial. It does not test browser microphone delivery.

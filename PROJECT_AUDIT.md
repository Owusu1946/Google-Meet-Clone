# Meeting project audit

Reviewed 7 October 2026. This is a source and local tooling audit, not a completed multi-browser end-to-end test. Application code has not been changed.

## Verification

- Read the home, lobby, meeting, and exit routes; providers; API handlers; media controls; chat; people; captions; whiteboard; reactions; recording list; effects; and layout helpers.
- `tsc --noEmit --incremental false` failed. Errors include Next route parameter types, asynchronous `headers()`, obsolete speaker-layout SDK API, and provider user types.
- Installed Next is 15.5.27 and React is 19.3.0. Package declarations start from release candidates; there are npm, Yarn, and pnpm lockfiles. The existing untracked pnpm lockfile was preserved.
- `npm run lint` failed on the header's home navigation anchor and reported hook dependency warnings in the exit page, reactions, and whiteboard. It also emitted a Next lint deprecation warning and selected `C:\Users\HP` as the workspace root because of competing lockfiles.
- No live meeting, production build, provider dashboard configuration, transcription service, invitation delivery, or recording playback has been verified.

## Critical foundations

1. **Identity impersonation through token issuance.** `src/app/api/token/route.ts` signs a token for any body-supplied user ID without checking Clerk identity or a server-issued guest identity. An unauthenticated requester can request credentials for another user. Resolve authenticated identity on the server and define a controlled guest session flow; validate input and token lifetime.
2. **Unrestricted profile updates.** `src/app/api/user/route.ts` accepts an arbitrary user ID and name and updates that user with the server secret, including setting their role to `user`. Bind profile writes to the caller's identity; prohibit caller-selected target IDs and role changes.
3. **Connection lifecycle restarts itself.** `src/contexts/MeetProvider.tsx` includes `loading` in its connection effect dependencies, then changes loading after chat connects. This tears down the initial clients and starts a second setup, with no cancellation or stale-result protection. Failures have no rendered error/retry state. Chat failure can prevent entry to video entirely.
4. **Framework and SDK compatibility is already broken.** Dynamic route props are synchronous although generated Next types require promises. Webhook headers need awaiting. `SpeakerLayout.tsx` calls `dynascaleManager.setViewport`, which the installed types do not expose. The provider's combined chat/video user type does not satisfy the video constructor. These are confirmed compiler failures.
5. **Empty participant state can crash the call.** `GridLayout.tsx` accesses `selectedGroup.length` when no group exists. This occurs with zero participants or an out-of-range page after departures, before the page correction effect runs.

## Home, creation, and lobby

6. **“Code or link” only accepts an exact lowercase code.** Home returns silently for URLs, surrounding whitespace, uppercase input, or malformed text. Parse supported meeting links, normalize codes, and display validation errors.
7. **Code lookup lacks complete cleanup/error handling.** Home creates a separate guest video client without disconnecting it. Non-404 errors provide no useful user message. The lookup guest ID differs from the provider's guest ID; behavior depends on Stream guest permissions and needs verification.
8. **Instant meeting creation depends on transient React state.** The creation intent exists only in `AppContext.newMeeting`, so a reload before successful creation loses it. Creation is triggered by a broadly dependent effect with no in-flight guard or error recovery. Leave and get/create are started without sequencing.
9. **Failed join can leave an endless spinner.** Lobby sets `joining=true` but has no catch/finally around joining, no retry message, and no reset after rejection.
10. **Lookup errors can be treated as permission to continue.** Lobby handles 404 specially but allows other failures to proceed to join without explaining permission, network, or service errors. Navigation on lookup failure also occurs during render.
11. **Guest naming is inconsistent across clients.** The guest profile update ignores HTTP failure status and reconnects chat but does not explicitly refresh video identity. The provider initially names every guest “Guest.” Verify names on remote tiles, participant lists, chat, and rejoins. Whitespace-only names currently pass the name gate.
12. **Prejoin preferences and permission recovery are incomplete.** Preview automatically enables both devices on mount; no persisted preference is shown. Device errors mostly go to console. Camera placeholder text is toggled independently of actual device state. Device selection is hidden below desktop width and no in-call device settings are provided.

## Meeting behavior and host controls

13. **Host admission is advertised but not implemented in app flow.** Copy says users require host permission, while lobby calls `join()` directly. There is no request/admit/reject queue, lock interface, or waiting-room flow. Provider dashboard settings must be inspected before stating the actual access policy.
14. **Host controls are incomplete.** There is no explicit end-for-everyone action, admission UI, meeting lock, or restrictions for whiteboard collaboration. Participant menus delegate some capabilities to the SDK; their available moderation actions must be tested against configured permissions.
15. **Speaker layout does not follow the active speaker.** Both sorting presets only consider screen sharing and pins. Speaker mode activates only for a pinned or sharing first participant, rather than providing selectable active-speaker mode.
16. **Disconnected and ended calls lack a complete state flow.** Meeting only routes away for UNKNOWN/IDLE. There is no explicit UI for reconnecting, reconnect failure, removal, or remote meeting end. Leave rejection has no recovery state.
17. **Chat setup errors are hidden.** Channel watch and membership failures are logged, yet the channel is still passed to the UI. Channel creation and membership depend on dashboard permissions and have no server-side admission coupling in this repository.
18. **People and chat panels can collide.** Both can be open at once in the same right-hand location and both independently mutate/clear meeting-root padding. Use a single active side panel and one layout owner.
19. **Participant device indicators use guessed fields.** People popup reads `audioEnabled`, `isAudioEnabled`, and `audioStream.enabled` with similar video fallbacks. Align with the installed SDK's published-track state; verify remote mute/camera changes instead of relying on loosely typed fields.
20. **Raised hands are ephemeral.** Hand state is kept locally and propagated by transient chat events. Late joiners/reloads do not recover existing raised hands. The button checks `user.id` while toggle logic uses canonical `meId`, which can produce inconsistent state if those differ.
21. **Reaction self-echo is not excluded.** Reaction sending adds an optimistic local animation and the receive handler also accepts own reaction events. If Stream delivers the sender's event back, the sender sees duplicate reactions. Verify delivery semantics and deduplicate by event ID.

## Captions

22. **Current captions do not transcribe the meeting.** `useLiveCaptions.ts` starts browser SpeechRecognition using local microphone input. It does not consume remote participant tracks or a meeting transcription stream.
23. **No speaker attribution.** Overlay data is only text strings and interim text. It has no participant/session ID, speaker name, timestamps, or utterance identity. Correct captions need text attributed at transcription time; assigning local text to whoever has the speaking indicator would misattribute speech.
24. **Recognition is separate from call mute/device state.** No integration stops recognition when the call microphone is muted or ensures the recognizer uses the selected call input.
25. **Caption control and failure states are unreliable.** Errors are swallowed, permission/network failures trigger a 250 ms restart loop, and `listening` doubles as user intent even though onend sets it false. Unsupported browsers only receive an alert indicator. No language selection, clear error state, or transcript expiry exists; final lines remain until manually cleared.

Recommended outcome: each participant's utterance carries a trusted speaker identity, timestamp, interim/final state, and text. Caption visibility is per viewer. Support overlapping speakers, mute behavior, language settings, reconnects, and a documented browser/service support range.

## Whiteboard

26. **Canvas coordinates and displayed size disagree.** Backing dimensions use the outer full-meeting container, while the canvas is displayed inside an inset board. Pointer positions use the inset board. The browser rescales the oversized canvas, causing pointer/stroke misalignment and distortion.
27. **Toolbar interactions enter the drawing handler.** Pointerdown is attached to the whole board, including toolbar buttons, color input, size slider, and close control, with no target exclusion. These interactions can create strokes or capture pointers unintentionally.
28. **Highlighter accumulates opacity incorrectly.** Appending a point repaints the entire stroke onto existing pixels without clearing. Its earlier segments darken repeatedly; eraser ordering can also diverge when old strokes are painted over later operations. A single-point stroke has no explicit dot rendering, and curves do not reach the final point.
29. **Pan/zoom uses stale transforms.** Handlers call redraw immediately after state setters, using the previous render's transform. Wheel code calculates before and after through the same closed-over transform. There is no dedicated redraw effect tied to scale/offset; resize also closes over an old redraw callback.
30. **Touch and cancellation handling is incomplete.** There is no explicit touch-action suppression, pointercancel/lost-capture handler, or drawing cleanup for closing/unmounting while a stroke/frame is pending. Toolbar does not wrap for narrow screens.
31. **Remote open/close is never broadcast.** Meeting listens for `wb_present_start/stop` but no sender emits those events. `wbChangeSource` is assigned but never consumed.
32. **Late join/reopen state is not synchronized.** Board only subscribes while open, ignores snapshot responses, never initiates snapshot requests, and stores strokes in local refs. People who open later miss past events; closing misses edits; reloading loses state.
33. **Undo/redo is local only.** No undo/redo events are sent; local undo can also remove another person's most recent stroke. Collaborators therefore see different boards.
34. **Incoming strokes lack echo/order/deduplication handling.** Local stroke points are already inserted, then receive handlers append any matching event again. Own echoes can duplicate points. There are no sequence numbers, idempotency checks, or validated event payloads.
35. **Synchronization failures silently disappear.** Draw and cursor events can be sent every frame/50 ms respectively, with no backpressure, reliable delivery, retry state, or event-size limits. Some failures are swallowed. Everyone can clear, and no authorization checks validate received operations. Export is a transparent PNG of the current viewport, not necessarily the entire board.

Recommended outcome: a shared board document with stable world coordinates, validated ordered operations, participant ownership, synchronized history, late-join snapshots, explicit presenter controls, reliable errors, and mouse/touch input limited to the drawing surface.

## Incomplete visible features and polish

36. **Invitations are mocked.** AddPeoplePopup contains three example contacts; MeetingPopup's invite callback only logs emails. No invitations are sent. Checkbox and parent row both toggle, creating a bubbling/double-toggle risk.
37. **Visible controls have no handler.** Meeting details, preview more-options, participant visual-effects button, header support/report/settings/apps, switch-account text, and exit feedback/learn-more have no implemented action or point to placeholders.
38. **Mobile loses important features.** Chat, people, captions, effects, reactions, and recording list are hidden at small widths with no alternate menu. Remaining controls form a long unwrapped row; verify overflow and touch usability.
39. **Image allowlist is wrong for used assets.** `next.config.mjs` allows `gstatic.com` while Next Image components use `www.gstatic.com`. These are distinct hosts, so the source/config mismatch can cause image-render errors.
40. **Effects selection can disagree with actual media state.** Lobby and meeting each have independent selection state initialized to none. A retained blur can therefore display as none after navigation. The unused useVirtualBackground hook only simulates processing and CSS blur; do not treat it as a functional media integration.
41. **Recording flow lacks post-meeting access.** In-call query/list exists but no home/history or exit-page recording access. Fetch failures appear like no recordings; loading is not reset when reopening. SDK recording button behavior, host permissions, processing delay, storage and playback remain unverified.
42. **Webhook robustness is incomplete.** Besides the confirmed asynchronous-headers error, verification reconstructs JSON rather than preserving raw request bytes. Email lookup assumes a first address, names can contain null values, deletion is unhandled, and provider write failures have no controlled response.
43. **Shared popup height cannot be generated reliably.** Dynamic Tailwind string `h-[${height}px]` is not statically discoverable. Dialogs lack a consistent focus/escape/accessibility pattern; several icon-only controls have no explicit accessible label.
44. **Exit flow depends on in-memory call state.** Refresh/direct visit can redirect home instead of showing an exit state. Invalid-meeting content reads `window.location.host` during render. Automatic redirect runs after 60 seconds rather than offering a persistent post-meeting summary.
45. **Quality gates are missing.** No project test script or versioned meeting workflow tests exist. README runtime guidance is stale, three lockfiles make installs ambiguous, and lint selected the wrong workspace root. Unused avatar/LiveKit dependencies and simulated legacy effects need a usage/dependency review before removal.

## Fix sequence

1. Identity/token/profile security; dependency and Next/SDK compatibility; connection lifecycle; empty-grid crash; image configuration.
2. Reliable home → create/join → lobby → meeting → leave/rejoin flow, with recoverable errors and explicit device preferences.
3. Host policy and admission, coherent meeting states, chat membership, one side panel, and accessible mobile controls.
4. Shared whiteboard model and input/rendering rewrite; speaker-attributed meeting transcription.
5. Real invitations, recording history/access, effects state, reactions/hands recovery, and visual/accessibility polish.

## Acceptance scenarios for actual end-to-end verification

- Signed-in host creates instant and later meetings. Another signed-in user and a named guest join via copied URL and normalized code. Reload every step; invalid/expired codes and backend failures provide recovery.
- Deny camera/mic permission, join muted/camera-off, change devices, unplug devices, and verify remote state. Leaving/navigation releases media and does not leak connections.
- Verify waiting/admission policy, rejection, lock, moderation capabilities, end-for-everyone, removal, and safe credential/profile ownership.
- Use 2+ browsers/devices; test active speaker, pin/unpin, screen-share start/stop/cancellation/audio, zero participants and 7+ participant pagination.
- Send messages, reactions and hand raises; test own echoes, late joins, departures, reload and reconnect; open/close each side panel.
- Alternate and overlap speech between participants; captions show the correct source and respect mute/device/language state. Test unsupported browser and transcription failure.
- Draw with mouse/touch/stylus, use toolbar without drawing, pan/zoom/resize, erase/highlight, undo/redo, clear/export; verify identical boards for late joins, reopen, reload and reconnect.
- Record as permitted, stop, wait for processing, leave, find recording again and play it as an authorized user. Verify denied recording access and failed fetch messaging.
- Test narrow phones, tablet/desktop, keyboard navigation, screen-reader labels and focus restoration.

Completing this matrix, including provider configuration checks, is necessary before claiming the project works end to end.

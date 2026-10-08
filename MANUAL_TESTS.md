# Manual meeting acceptance

## Larger calls and admit all

- Join 11 sessions, including a host and several ordinary participants. The adaptive grid shows a bounded number of tiles plus an accurate N others tile, retains your own tile, and keeps grouped remote speakers audible. Both hosts and nonhosts can click the group tile or the numbered others link in the hover preview to open the full searchable People panel. Resize with the panel open, remove/leave several sessions, and verify counts immediately recompute without stale pages or duplicate audio.
- The participant pill shows up to four small avatars and the actual participant count. Search lists all joined sessions, including grouped people; it must not expose host admission actions to nonhosts.
- As host, open Admit all from People or the admission popover. The confirmation lists the specific applicants. Cancel/Escape changes nothing. Confirm admits only that snapshot; applicants arriving while it is open wait for the next action. During admission, duplicate submission is disabled. Reject one API request or lock the call: successful admissions remain successful, failures remain visible, and Retry remaining does not resubmit successful IDs. Check cancellation/denial by another action and reopening the dialog. Host authorization remains enforced by each existing admission API call.

## People and presenter UI

- Hover the top-right participant pill using a mouse: a dark People preview appears. Moving into the preview keeps it open; leaving closes it. Keyboard focus also exposes it; Escape dismisses it. Click the pill or View everyone to open the full People panel. On touch, tap opens the panel directly.
- Search for names with mixed case/whitespace, clear the search, collapse/expand Contributors, and check the no-results state. Host mute/remove and admission still act on the correct authenticated participant. Screen shares appear as presentation entries under their owners; ordinary participants never gain host actions.
- Start sharing a tab with audio, a window, and an entire screen. Viewers see the uncropped presentation on the left and camera tiles on the right, including the presenter. Stop through the banner, toolbar, or browser sharing control; normal layout returns. Repeat with People open, mobile/landscape, multiple presenters, and a late joiner. Confirm the presenter's microphone and shared audio each play once.
- In a browser supporting Document Picture-in-Picture, present, then click Picture-in-picture in the presenter banner. Check remote and local camera tiles, the silent shared-screen thumbnail, live mic/camera state, stop sharing, Back to call, browser close, leave, and host leave confirmation. Resize the floating window and scroll its participant list with many attendees. The main tab shows the return-to-call placeholder while the floating window is open; closing it returns the normal presentation stage.
- Stop sharing or leave while the floating-window request is pending. No orphan window may remain. Reopen after browser close, double-click the button, deny the request, and retry. Unsupported browsers retain normal screen sharing and omit the unavailable PiP control. PiP opens from an explicit user action rather than automatically after the asynchronous share picker. Verify media continues correctly when the main tab is hidden and across window focus changes; these native/browser behaviors were not automated.

Use a signed-in host plus a second signed-in account and a named guest in separate browser profiles/devices. Repeat the core media checks in Chrome/Edge, Firefox, Safari, and a narrow phone where available. No browser checks were performed by the implementation agent.

## Meet-style lobby and overlay acceptance

- On a fresh browser profile, the prejoin screen shows the permission explanation and disabled device selectors. Clicking a microphone/camera control opens the corresponding explanation, with the supplied illustration. Closing it requests nothing. Affirming requests only the selected device; the combined option requests both. Reject either independently and verify the other remains usable. Recover through browser permissions and retry. A saved enabled preference must not trigger a revoked permission prompt on reload.
- With devices allowed, check the live mirrored preview, input selection, speaker selection carried into the call, unplug/reconnect, and camera/mic off states. Select slight/strong blur in the effects dialog: the person stays sharp, the background blurs, and remote viewers see the selected effect after joining. No image backgrounds or filters are offered. Check unavailable WebGL/model downloads, visible failure messages, and camera release after leaving. Switching effects repeatedly must not leak camera tracks or processors.
- Ask to join a restricted meeting. The dark waiting room retains the self preview and microphone/camera/effects controls. It must not receive call media before admission. Cancel removes the applicant from the host queue; asking again restores it. A nonhost cannot cancel another applicant by submitting their ID. Test cancellation while admission/polling is in flight and failed cancellation followed by retry.
- Host admission badge reflects the live queue. Admit/Deny acts on the named person; View all opens People. Escape restores trigger focus and clicking outside closes the popover. Nonhosts never see the queue. The first-join welcome card shows the actual link, signed-in identity, and current open/restricted/locked policy. Copy, Add others, dismissal, and reload work; a dismissed card stays hidden in the same tab.
- Solo calls show a centered large tile; two-person auto layout shows the remote participant with a corner self preview. Adding a third participant returns to tiles; screen sharing, explicit layout changes, and pin/unpin retain spotlight behavior. Check names, mute state, captions, and side panels across transitions.
- Check 320px phone, tablet, wide desktop, browser zoom, and short landscape windows. Waiting controls and in-call controls remain centered and reachable; popovers/dialogs scroll without hiding their close controls, and self previews do not block controls. Verify keyboard focus, Escape, screen-reader labels, and live status/error messages. Visual matching and real media behavior remain manual checks.

## Entry and admission

1. Sign in; create an instant meeting, then create a meeting for later. Copy links and verify both survive reload.
2. Join via uppercase/whitespace code and full link. Invalid and nonexistent codes must display a useful error and a working home link.
3. Enter a guest name. Reject camera/microphone access independently; join camera-off/muted, then recover permissions and enable devices. Remote tiles/chat must show the correct name.
4. In a restricted call, the guest must wait without hearing/seeing the call. Host sees the queue; admit joins automatically. Deny prevents entry, including reload.
5. Lock the call: new users cannot enter; existing admitted users can rejoin. Unlock and change access to open; a new link holder enters without host admission.
6. Switch accounts in the lobby and verify identity/access refresh rather than carrying the prior user's access.

## In-call behavior

7. With several participants, verify empty/loading state, grid pagination beyond six, departures on the last page, local pin/unpin, and active speaker changes.
8. Share a screen/window/tab, cancel the browser chooser, share with audio where supported, and stop sharing through the browser's control. Auto layout must recover correctly.
9. Toggle microphone/camera with buttons and Ctrl/Command+D/E. Select other input/output devices and unplug one; recover through Settings. Ensure no feedback from the local preview.
10. Open People, Chat, Details, Settings, Recordings, and Host controls. Only one side panel appears. Keyboard focus, Escape, screen-reader names, and dialog focus trapping/restoration must work.
11. Send messages/reactions from each device. Sender gets one reaction, remote chat updates, unread counts reset on opening chat, and earlier messages remain available after reload.
12. Raise/lower hands, reload and join late, and leave/rejoin: only the active participant session's raised hand is shown.
13. Host mutes another participant, who can choose to unmute. Host removes a user: they leave, cannot rejoin, and lose chat/board access.
14. Simulate offline/reconnect and failed connection; recovery status and retry must appear. Leave releases camera/microphone. Host Just leave keeps others connected; End for everyone routes everyone to the ended screen.

## Captions and recording

15. Enable captions on one viewer only. Alternate speakers, speak simultaneously, mute, switch microphones, and pause. Every utterance must carry its actual speaker name; old lines expire.
16. Change caption language as host; stop/restart captions. Check visible service errors on an unavailable project. Confirm caption visibility remains per viewer.
17. With everyone informed, start/stop a recording. All participants see the recording notice. Wait for processing, leave, reopen from Recent meetings/exit screen, and play. Nonhosts cannot retrieve recording URLs from the API.

## Shared whiteboard

18. Draw dots and continuous strokes using mouse/touch/stylus at different sizes and device pixel ratios. Pointer and stroke must align. Toolbar clicks/color/size/close must not draw.
19. Pan with Move/Shift-drag; zoom with Ctrl/Command+scroll; resize/rotate the window. Zoom anchors to the pointer, and collaborators see the same world-space drawing.
20. Highlight/erase overlapping strokes. Undo/redo affects only your strokes and synchronizes. Host clear resets everyone's board; participants cannot clear.
21. Open late, close/reopen, reload, and reconnect. Entire history must converge without duplicated echoes or missing stroke segments.
22. Interrupt connectivity while drawing. Pending/error status appears; Retry syncs once. Reload retains pending edits in the same tab. Normal leaving waits for sync.
23. Disable participant drawing as host. Present/stop presenting the board; existing and late viewers are notified/open it. A viewer can close it without closing other viewers' boards.
24. Export after panning: PNG includes the whole drawing on a white background.

## Invitations and responsive UI

25. Without Resend keys, copy link/use email-app invitation. With a verified sender configured, send test invitations to addresses you control; verify delivery, privacy, valid links, duplicate-retry behavior, and visible errors.
26. Test 320px phone, tablet, and desktop widths. Mic/camera/leave and People/Chat remain reachable; More exposes captions, sharing, reactions, settings, and the board without toolbar overflow.
27. Refresh/directly visit the exit page, use Rejoin/Home, and verify host recordings still load. Nothing redirects on a countdown.

Record browser/device, scenario number, expected/actual result, and console/service error when reporting failures. Only mark end-to-end complete after media, service, and visual checks pass.

## Real-time chat and board regression

28. Type in main chat and in a thread: the other client sees your name only in that conversation. Stop, blur, send, close the panel, or disconnect: the indicator disappears. Empty drafts must not announce typing.
29. Reply to a root message; check the reply count, open the thread on both devices, paginate earlier replies, and return to all messages. Replies stay inside the thread. Fail a send, then retry: preserve the draft and display exactly one message.
30. Close Chat on one client and send both root messages and replies from another. The toolbar count includes both, ignores your own messages, and resets when you open Chat. Reload with Chat closed: server unread state is restored. Scroll up in a long conversation: incoming messages do not jump you away from history.
31. Draw a dot, hold the pointer down, then draw a long stroke. Another client should see the first point immediately through the live path and progressive segments approximately every 80ms plus network delivery time. Record actual latency on separate devices/networks; this cadence is not a guaranteed end-to-end latency.
32. Throttle the network and draw continuously, reload a third client, and disconnect/reconnect the sender. Saved segments must converge exactly once; unsaved remote previews expire after 30 seconds, while the sender retains pending edits for retry. Host clear, undo/redo, and disabled collaboration must still apply. Inspect sustained drawing CPU/network usage on a phone before a production rollout.

33. On a wide desktop, open the board and reaction picker directly from the bottom toolbar. Verify settings, layout cycling, invitations, captions, sharing, and host-only actions. Resize continuously: controls that no longer fit move into More without duplicates or horizontal overflow; More disappears when every action fits. At 320px, mic/camera/leave/People/Chat remain reachable and additional actions appear in More. Test browser zoom and an embedded/narrow meeting container, keyboard focus, Escape, and the reaction dialog on a phone.

34. As host, end for everyone with People open and participants connected. Every device, including the host, reaches the ended page without an already-left error or lingering confirmation. Repeat with delayed responses and double clicks. Just leave must preserve the call for peers; an ordinary failed leave remains retryable. At desktop widths with and without meeting metadata, the control group's midpoint aligns with the footer midpoint, People/Chat stay on the right, and overflow actions move to More before either side overlaps. Repeat at browser zoom and on mobile.

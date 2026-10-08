# Collaborative workspace implementation

The board must support design planning, writing, developer diagrams, Kanban, frames, nodes and connectors, freehand drawing, and real-time multi-user work within meetings. Preserve admission, host collaboration controls, board presentation, durable retries and recovery.

## Delivery gates

- [ ] Versioned object operations, bounded validation, deterministic property-level merge and safe tombstones alongside existing strokes.
- [ ] Canvas selection, movement, resizing, frames, editable text/notes/code/cards/shapes, connected nodes and Kanban movement.
- [ ] Domain templates, keyboard/touch controls, contextual editing, undo/redo, useful export/import.
- [ ] Live cursors/selection and progressive object changes; reconnection, late join and pending recovery.
- [ ] Adversarial model tests, live multi-client protocol checks, typecheck/lint/format/build.
- [ ] Manual visual/media checks documented (user requested no browser automation).

Atomic commits will separate model/protocol, interaction surfaces, collaboration, templates/export and verification. Completion requires evidence for all requested workflows; passing existing drawing tests alone does not prove the new workspace.

## Verification evidence

46 automated tests, typecheck and lint pass. Live verification passed 83 API/service checks, including object persistence, retries, permissions, presence, concurrent writing, selective text undo, text recovery, collaboration restrictions, and shared presentation settings. The production build passed after the interaction refinements and marquee/frame keyboard changes and ordered Kanban interaction fixes and editor draft save barriers and bulk enqueue/persistence and reversible mixed object/ink imports and Clear/deletion interaction resets. Manual visual, touch, multi-device text editing and latency checks remain outstanding in MANUAL_TESTS.md. No browser was opened.

- Concurrent object history follow-up: 48 automated tests pass, including selective property Undo/Redo and consecutive ownership transfer. Typecheck and lint pass. Manual multi-user history acceptance is listed in steps 45–46; browser verification remains pending.

- Export capture follow-up: 49 tests, typecheck and lint pass. Export drains editor drafts and reads current operations synchronously; JSON retains raw editable ordering while visual exports derive Kanban layout. Manual export acceptance is listed in step 47.

- Isolated production build passed after selective/consecutive object history and synchronous export capture changes.

- Fit/export bounds follow-up: 50 automated tests pass; typecheck and lint pass. Eraser-only extents no longer enlarge framing, visible ink width is included, and bounds scan points without allocating a duplicate array. Manual acceptance is step 48.

- Developer editing follow-up: 53 tests, typecheck and lint pass. Code editors support caret/multiline indentation and outdent; Escape saves and restores canvas focus without interrupting IME composition. Manual keyboard/collaboration acceptance is step 49.

- Diagram keyboard follow-up: typecheck and lint pass. Pointer and keyboard connection creation share one path, and connectors expose keyboard focus, endpoint labels and selection for contextual actions. Manual acceptance is step 50. Browser interaction remains unverified.

- Connector label editing follow-up: connectors now render the shared text editor, accessible via double-click, F2 or contextual Edit content; visual exports include escaped labels. Typecheck and lint pass. Manual acceptance is step 51.

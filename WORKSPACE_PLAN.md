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

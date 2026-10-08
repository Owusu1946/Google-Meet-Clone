// Editors may debounce network operations, but leaving must include their latest
// local input. Draining is synchronous; transport acknowledgements follow it.
export function createDraftBarrier() {
  const writers = new Set<() => boolean | void>();
  let draining = false;
  return {
    register(writer: () => boolean | void) {
      writers.add(writer);
      return () => {
        writers.delete(writer);
      };
    },
    flush() {
      // A writer can enqueue operations that themselves request a save.
      if (draining) return true;
      draining = true;
      let complete = true;
      try {
        for (const writer of [...writers]) {
          try {
            if (writer() === false) complete = false;
          } catch {
            complete = false;
          }
        }
      } finally {
        draining = false;
      }
      return complete;
    },
  };
}

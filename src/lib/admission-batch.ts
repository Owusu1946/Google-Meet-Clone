// Use the confirmed snapshot; do not include applicants arriving mid-operation.
export async function admitRequests(
  ids: string[],
  admit: (id: string) => Promise<unknown>,
) {
  const admitted: string[] = [];
  const failed: string[] = [];
  for (const id of new Set(ids)) {
    try {
      await admit(id);
      admitted.push(id);
    } catch {
      failed.push(id);
    }
  }
  return { admitted, failed };
}

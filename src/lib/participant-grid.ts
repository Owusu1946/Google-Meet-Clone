export function groupedParticipants<
  T extends { sessionId: string; isLocalParticipant?: boolean },
>(participants: T[], capacity: number) {
  const limit = Math.max(2, Math.floor(capacity));
  if (participants.length <= limit)
    return { visible: participants, hidden: [] as T[] };
  const local = participants.find(
    (participant) => participant.isLocalParticipant,
  );
  const remote = participants.filter((participant) => participant !== local);
  const visible = remote.slice(0, limit - 1 - (local ? 1 : 0));
  if (local) visible.push(local);
  const sessions = new Set(visible.map((participant) => participant.sessionId));
  return {
    visible,
    hidden: participants.filter(
      (participant) => !sessions.has(participant.sessionId),
    ),
  };
}

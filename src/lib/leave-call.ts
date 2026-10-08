// The ended event can finish SDK cleanup before or during our explicit leave.
// Once ending is confirmed, local cleanup must never block the exit page.
export async function leaveCallOnce(
  call: { state: { callingState: string }; leave: () => Promise<void> },
  endConfirmed = false,
): Promise<void> {
  if (call.state.callingState === 'left') return;
  try {
    await call.leave();
  } catch (error) {
    if (!endConfirmed && call.state.callingState !== 'left') throw error;
  }
}

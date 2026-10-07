import assert from 'node:assert/strict';
import { randomUUID, randomInt } from 'node:crypto';
import { StreamClient } from '@stream-io/node-sdk';
import { signGuest } from '../src/lib/server/guest-session';

// Disposable fixture only: never mute participants in an existing meeting.
const client = new StreamClient(
  process.env.NEXT_PUBLIC_STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!,
  { timeout: 30_000 },
);
const host = `guest_${randomUUID()}`;
const participant = `guest_${randomUUID()}`;
const base = process.env.VERIFY_BASE_URL;
if (base && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
  throw new Error('VERIFY_BASE_URL must point to a local application server.');
}
const word = (length: number) =>
  Array.from(
    { length },
    () => 'abcdefghijklmnopqrstuvwxyz'[randomInt(26)],
  ).join('');
const call = client.video.call('meet', `${word(3)}-${word(4)}-${word(3)}`);
let created = false;
try {
  await client.upsertUsers([
    { id: host, name: 'Mute verification host' },
    { id: participant, name: 'Mute verification participant' },
  ]);
  await call.getOrCreate({
    data: {
      created_by_id: host,
      members: [
        { user_id: host, role: 'host' },
        { user_id: participant, role: 'call_member' },
      ],
    },
  });
  created = true;
  let rejected = false;
  try {
    await call.muteUsers({ user_ids: [participant], audio: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    assert.match(message, /muted_by|muting user|user.*required/i);
    rejected = true;
    console.log(
      'Reproduced: server mute without an acting moderator is rejected.',
    );
  }
  assert.ok(rejected, 'The original request should reproduce the failure.');
  await call.muteUsers({
    user_ids: [participant],
    audio: true,
    muted_by_id: host,
  });
  console.log(
    'Passed: server mute succeeds with the authenticated host identity.',
  );
  if (base) {
    const request = async (user: string, target: string, expected: number) => {
      const session = signGuest(
        { id: user, name: 'Mute verification', expires: Date.now() + 3600_000 },
        process.env.GUEST_SESSION_SECRET || process.env.STREAM_API_SECRET!,
      );
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(`${base}/api/meetings/${call.id}/host`, {
          method: 'POST',
          headers: {
            origin: base,
            cookie: `meet_guest=${session}`,
            'content-type': 'application/json',
          },
          // The route must ignore a caller-supplied moderator identity.
          body: JSON.stringify({
            action: 'mute',
            userId: target,
            muted_by_id: participant,
          }),
          signal: AbortSignal.timeout(60_000),
        });
        const result = await response.json();
        if (response.status === 503 && attempt < 2) continue;
        assert.equal(
          response.status,
          expected,
          result.error || 'Unexpected mute response.',
        );
        return;
      }
    };
    await request(host, participant, 200);
    await request(participant, host, 403);
    await request(host, host, 400);
    console.log(
      'Passed: host API mute, nonhost rejection, and self-mute rejection.',
    );
  }
} catch (error) {
  // SDK errors may contain credential-bearing request objects; log messages only.
  console.error(
    error instanceof Error
      ? error.message.slice(0, 500)
      : 'Mute verification failed.',
  );
  process.exitCode = 1;
} finally {
  if (created)
    await call.delete({ hard: true }).catch(() => {
      console.error(`Fixture cleanup failed for ${call.id}.`);
      process.exitCode = 1;
    });
  await client
    .deleteUsers({
      user_ids: [host, participant],
      user: 'hard',
      messages: 'hard',
    })
    .catch(() => {
      console.error('Disposable mute user cleanup failed.');
      process.exitCode = 1;
    });
}

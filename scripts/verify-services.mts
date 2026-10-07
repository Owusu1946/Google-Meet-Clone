import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { StreamClient } from '@stream-io/node-sdk';
import { StreamChat } from 'stream-chat';
import { signGuest } from '../src/lib/server/guest-session';

// Explicitly opt in: creates disposable fixtures in the configured Stream app.
// Never starts recording, captions, or sends email. No credentials are logged.
const base = process.env.VERIFY_BASE_URL;
if (!base || !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(base)) {
  throw new Error('Set VERIFY_BASE_URL to the local running application.');
}
const key = process.env.NEXT_PUBLIC_STREAM_API_KEY!;
const secret = process.env.STREAM_API_SECRET!;
const video = new StreamClient(key, secret, { timeout: 30_000 });
const chat = new StreamChat(key, secret, {
  timeout: 30_000,
  disableCache: true,
});
const host = `guest_${randomUUID()}`;
const applicant = `guest_${randomUUID()}`;
const outsider = `guest_${randomUUID()}`;
const users = [host, applicant, outsider];
const word = (length: number) =>
  Array.from(
    { length },
    () => 'abcdefghijklmnopqrstuvwxyz'[randomInt(26)],
  ).join('');
const id = `${word(3)}-${word(4)}-${word(3)}`;
const call = video.video.call('meet', id);
const cookies = new Map(
  users.map((user) => [
    user,
    `meet_guest=${signGuest({ id: user, name: 'Service verification', expires: Date.now() + 3600_000 }, process.env.GUEST_SESSION_SECRET || secret)}`,
  ]),
);
const path = `/api/meetings/${id}`;
let checks = 0;
async function request(
  route: string,
  user: string,
  body?: unknown,
  expected = 200,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${base}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: base!,
        cookie: cookies.get(user)!,
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(90_000),
    });
    const value = await response.json();
    if (response.status === 503 && attempt < 2) continue;
    assert.equal(
      response.status,
      expected,
      `${route}: ${JSON.stringify(value)}`,
    );
    checks++;
    return value;
  }
  throw new Error('Verification request exhausted retries.');
}
async function servicePermission(
  url: string,
  user: string,
  body?: unknown,
  allowed = false,
) {
  const token = video.generateUserToken({
    user_id: user,
    validity_in_seconds: 300,
  });
  const response = await chat.axiosInstance.request({
    url,
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: token,
      'stream-auth-type': 'jwt',
      'content-type': 'application/json',
      'x-stream-client': 'meet-verification',
    },
    data: body,
    validateStatus: () => true,
    timeout: 30_000,
  });
  const value = response.data;
  assert.equal(
    response.status >= 200 && response.status < 300,
    allowed,
    `Service permission: ${response.status} ${value.message || ''}`,
  );
  if (!allowed)
    assert.ok(
      [400, 403].includes(response.status),
      'An outage does not prove permissions are denied.',
    );
  checks++;
}

try {
  await video.upsertUsers(
    users.map((user) => ({
      id: user,
      name: 'Disposable meeting verification',
    })),
  );
  await call.getOrCreate({
    data: {
      created_by_id: host,
      members: [{ user_id: host, role: 'host' }],
      custom: { access: 'restricted', locked: false, collaboration: true },
    },
  });
  for (const type of ['meet-chat', 'meet-board'])
    await chat
      .channel(type, id, { created_by_id: host, members: [host] })
      .create();
  assert.equal(
    (await request(`${path}/access`, applicant, {})).status,
    'request',
  );
  await request('/api/token', applicant, { meetingId: id, userId: host }, 403);
  await request(
    `${path}/host`,
    applicant,
    { action: 'settings', access: 'open' },
    403,
  );
  assert.equal(
    (
      await request(`${path}/access`, applicant, {
        ask: true,
        name: 'Applicant',
      })
    ).status,
    'waiting',
  );
  const queue = await request(`${path}/host`, host);
  assert.equal(queue.requests[0]?.id, applicant);
  await request(`${path}/host`, host, { action: 'admit', userId: applicant });
  assert.equal(
    (await request(`${path}/access`, applicant, {})).status,
    'ready',
  );
  const token = await request('/api/token', applicant, {
    meetingId: id,
    userId: host,
  });
  assert.equal(
    JSON.parse(Buffer.from(token.token.split('.')[1], 'base64url').toString())
      .user_id,
    applicant,
  );
  const serviceCall = `https://video.stream-io-api.com/api/v2/video/call/meet/${id}?api_key=${key}`;
  await servicePermission(serviceCall, applicant, undefined, true);
  await servicePermission(serviceCall, outsider);
  const chatBase = chat.baseURL || 'https://chat.stream-io-api.com';
  await servicePermission(
    `${chatBase}/channels/meet-board/${id}/message?api_key=${key}`,
    applicant,
    { message: { text: 'unauthorized board write' } },
  );
  await servicePermission(
    `${chatBase}/channels/meet-chat/${id}/message?api_key=${key}`,
    applicant,
    { message: { text: 'Verification message' } },
    true,
  );
  await request(`${path}/recordings`, applicant, undefined, 403);
  await request(`${path}/recordings`, host);
  const stroke = {
    id: randomUUID(),
    kind: 'stroke',
    strokeId: `${applicant}:${randomUUID()}`,
    segment: 0,
    points: [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ],
    color: '#202124',
    width: 3,
    mode: 'pen',
  };
  const first = await request(`${path}/board`, applicant, stroke);
  const retry = await request(`${path}/board`, applicant, stroke);
  assert.deepEqual(
    first.operation,
    retry.operation,
    'Board retry must preserve canonical operation and timestamp.',
  );
  await request(
    `${path}/board`,
    applicant,
    { id: randomUUID(), kind: 'clear' },
    403,
  );
  await request(
    `${path}/board`,
    applicant,
    { ...stroke, id: randomUUID(), strokeId: `${host}:forged` },
    400,
  );
  await request(`${path}/host`, host, {
    action: 'settings',
    collaboration: false,
    locked: true,
  });
  await request(
    `${path}/board`,
    applicant,
    { ...stroke, id: randomUUID() },
    403,
  );
  assert.equal(
    (await request(`${path}/access`, outsider, { ask: true })).status,
    'locked',
  );
  await request(`${path}/host`, host, { action: 'remove', userId: applicant });
  assert.equal(
    (await request(`${path}/access`, applicant, {})).status,
    'denied',
  );
  await request('/api/token', applicant, { meetingId: id }, 403);
  await servicePermission(serviceCall, applicant);
  await request(`${path}/host`, host, {
    action: 'settings',
    locked: false,
    access: 'open',
  });
  assert.equal(
    (await request(`${path}/access`, outsider, { ask: true })).status,
    'ready',
  );
  await request(`${path}/host`, host, { action: 'end' });
  assert.equal((await request(`${path}/access`, outsider, {})).status, 'ended');
  await request('/api/token', outsider, { meetingId: id }, 410);
  console.log(`Passed ${checks} live API and service permission checks.`);
} catch (error) {
  console.error(
    `Verification failed: ${error instanceof Error ? error.message.slice(0, 600) : 'Unknown error'}`,
  );
  process.exitCode = 1;
} finally {
  // Delete only exact fixture IDs created above. Existing meetings are untouched.
  const cleanup = await Promise.allSettled([
    ...['meet-chat', 'meet-board'].map((type) =>
      chat.channel(type, id).delete(),
    ),
    chat
      .channel('meet-requests', `${id}_${applicant}`)
      .delete()
      .catch(() => undefined),
    call.delete({ hard: true }),
  ]);
  if (cleanup.some((result) => result.status === 'rejected')) {
    console.error(`Fixture cleanup needs retry for meeting ${id}.`);
    process.exitCode = 1;
  }
  await video
    .deleteUsers({ user_ids: users, user: 'hard', messages: 'hard' })
    .catch(() => {
      console.error('Disposable user cleanup failed.');
      process.exitCode = 1;
    });
}

import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { randomInt, randomUUID } from 'node:crypto';
import { StreamClient } from '@stream-io/node-sdk';
import {
  StreamChat,
  type EventTypes,
  type Channel,
  type Event,
} from 'stream-chat';
import { newObject, workspaceObjects } from '../src/lib/workspace';
import { boardBatch, canonicalBoardOperations } from '../src/lib/whiteboard';
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
const realtimeClients: StreamChat[] = [];
function nextEvent(
  channel: Channel,
  type: EventTypes,
  matches: (event: Event) => boolean = () => true,
) {
  const waiting = new Promise<Event>((resolve, reject) => {
    const timer = setTimeout(() => {
      subscription.unsubscribe();
      reject(new Error(`Timed out waiting for ${type}`));
    }, 15000);
    const subscription = channel.on(type, (event) => {
      if (!matches(event)) return;
      clearTimeout(timer);
      subscription.unsubscribe();
      resolve(event);
    });
  });
  void waiting.catch(() => undefined);
  return waiting;
}
async function request(
  route: string,
  user: string,
  body?: unknown,
  expected = 200,
  tab?: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${base}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        origin: base!,
        ...(tab ? { 'x-meet-guest-tab': tab } : {}),
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

const fixtureManifest = join(tmpdir(), `meet-verification-${id}.json`);
await writeFile(fixtureManifest, JSON.stringify({ id, users }), {
  encoding: 'utf8',
  mode: 0o600,
});
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
  // Cancellation only applies to the authenticated applicant, never a body ID.
  await request(`${path}/access`, outsider, {
    cancel: true,
    userId: applicant,
  });
  assert.equal(
    (await request(`${path}/host`, host)).requests[0]?.id,
    applicant,
  );
  assert.equal(
    (await request(`${path}/access`, applicant, { cancel: true })).status,
    'request',
  );
  assert.equal((await request(`${path}/host`, host)).requests.length, 0);
  assert.equal(
    (await request(`${path}/access`, applicant, { ask: true })).status,
    'waiting',
  );
  assert.equal(
    (await request(`${path}/host`, host)).requests[0]?.id,
    applicant,
  );
  await request(`${path}/host`, host, { action: 'admit', userId: applicant });
  await request(`${path}/host`, host, {
    action: 'settings',
    boardPresenting: true,
  });
  assert.equal((await call.get()).call.custom.boardPresenting, true);
  await request(
    `${path}/host`,
    applicant,
    { action: 'settings', boardPresenting: false },
    403,
  );
  assert.equal((await call.get()).call.custom.boardPresenting, true);
  await request(`${path}/host`, host, {
    action: 'settings',
    boardPresenting: false,
  });
  assert.equal((await call.get()).call.custom.boardPresenting, false);
  checks += 3;
  // A new tab carries the browser's admitted legacy cookie, but must receive
  // a separate identity and remain outside the restricted call.
  const freshTab = await request(
    `${path}/access`,
    applicant,
    {},
    200,
    randomUUID(),
  );
  assert.equal(freshTab.status, 'request');
  assert.notEqual(freshTab.identity.id, applicant);
  assert.equal(
    (
      await request(`${path}/access`, outsider, {
        ask: true,
        name: 'Second guest',
      })
    ).status,
    'waiting',
  );
  await request('/api/token', outsider, { meetingId: id }, 403);
  assert.equal((await request(`${path}/host`, host)).requests[0]?.id, outsider);
  await request(`${path}/access`, outsider, { cancel: true });

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
  // Authenticate two headless websocket clients; no browser or media capture.
  for (const user of [host, applicant]) {
    const client = new StreamChat(key, {
      allowServerSideConnect: true,
      timeout: 30000,
    });
    realtimeClients.push(client);
    await client.connectUser({ id: user }, chat.createToken(user));
  }
  const sender = realtimeClients[1].channel('meet-chat', id);
  const receiver = realtimeClients[0].channel('meet-chat', id);
  await Promise.all([sender.watch(), receiver.watch()]);
  await receiver.markRead();
  const started = nextEvent(receiver, 'typing.start');
  await sender.keystroke();
  assert.equal((await started).user?.id, applicant);
  checks++;
  const stopped = nextEvent(receiver, 'typing.stop');
  await sender.stopTyping();
  assert.equal((await stopped).user?.id, applicant);
  checks++;
  const root = await sender.sendMessage({ text: 'Thread verification' });
  const replyEvent = nextEvent(
    receiver,
    'message.new',
    (event) => event.message?.parent_id === root.message.id,
  );
  await sender.sendMessage({
    text: 'Reply verification',
    parent_id: root.message.id,
    show_in_channel: true,
  });
  assert.equal((await replyEvent).message?.parent_id, root.message.id);
  checks++;
  const replies = await receiver.getReplies(root.message.id, { limit: 50 });
  assert.equal(replies.messages.length, 1);
  checks++;
  assert.ok(receiver.countUnread() >= 2);
  checks++;
  const readEvent = nextEvent(receiver, 'message.read');
  await receiver.markRead();
  await readEvent;
  assert.equal(receiver.countUnread(), 0);
  checks++;
  const boardSender = realtimeClients[1].channel('meet-board', id);
  const boardReceiver = realtimeClients[0].channel('meet-board', id);
  await Promise.all([boardSender.watch(), boardReceiver.watch()]);
  const preview = nextEvent(boardReceiver, 'board_preview' as EventTypes);
  const previewOperation = {
    id: randomUUID(),
    actor: applicant,
    time: new Date().toISOString(),
    kind: 'stroke',
    strokeId: `${applicant}:${randomUUID()}`,
    segment: 0,
    points: Array.from({ length: 80 }, (_, index) => ({ x: index, y: index })),
    color: '#202124',
    mode: 'pen',
    width: 3,
  };
  const previewStart = performance.now();
  await boardSender.sendEvent({
    type: 'board_preview' as EventTypes,
    operations: [previewOperation],
  });
  const delivered = await preview;
  assert.equal(delivered.user?.id, applicant);
  assert.deepEqual(delivered.operations, [previewOperation]);
  checks++;
  console.log(
    `Authenticated board preview delivered in ${Math.round(performance.now() - previewStart)}ms (one sample, not a production latency guarantee).`,
  );
  const objectId = `${applicant}:${randomUUID()}`;
  const createObject = {
    id: randomUUID(),
    kind: 'object-create',
    objectId,
    objectType: 'card',
    fields: newObject('card', 40, 50),
  };
  const objectEvent = nextEvent(
    boardReceiver,
    'message.new',
    (event) =>
      (event.message?.board_operation as { kind?: string } | undefined)
        ?.kind === 'object-create',
  );
  const createdObject = await request(`${path}/board`, applicant, createObject);
  assert.equal((await objectEvent).message?.user?.id, applicant);
  checks++;
  const objectRetry = await request(`${path}/board`, applicant, createObject);
  assert.deepEqual(createdObject, objectRetry);
  checks++;
  const movedObject = await request(`${path}/board`, host, {
    id: randomUUID(),
    kind: 'object-patch',
    objectId,
    fields: { x: 400, y: 250 },
  });
  const writtenObject = await request(`${path}/board`, applicant, {
    id: randomUUID(),
    kind: 'object-patch',
    objectId,
    fields: { text: 'Shared task' },
  });
  const replay = workspaceObjects([
    writtenObject.operation,
    createdObject.operation,
    movedObject.operation,
  ]);
  assert.equal(replay[0].x, 400);
  assert.equal(replay[0].text, 'Shared task');
  checks++;
  const presenceEvent = nextEvent(
    boardReceiver,
    'board_presence' as EventTypes,
  );
  await boardSender.sendEvent({
    type: 'board_presence' as EventTypes,
    presence: {
      point: { x: 20, y: 40 },
      selected: [objectId],
      editing: objectId,
    },
  });
  assert.equal((await presenceEvent).user?.id, applicant);
  checks++;
  const liveObjectEvent = nextEvent(
    boardReceiver,
    'board_preview' as EventTypes,
  );
  await boardSender.sendEvent({
    type: 'board_preview' as EventTypes,
    operations: [
      {
        ...movedObject.operation,
        id: randomUUID(),
        actor: applicant,
        fields: { x: 500 },
      },
    ],
  });
  assert.equal((await liveObjectEvent).user?.id, applicant);
  checks++;
  const restoredHistory = await boardReceiver.query({
    messages: { limit: 100 },
  });
  const restoredObjects = workspaceObjects(
    restoredHistory.messages.flatMap((message) =>
      canonicalBoardOperations(
        message.board_operations || message.board_operation,
        message.user?.id || '',
        message.created_at!,
        message.id,
      ),
    ),
  );
  assert.equal(
    restoredObjects.find((item) => item.id === objectId)?.text,
    'Shared task',
  );
  checks++;
  await request(
    `${path}/board`,
    applicant,
    { ...createObject, id: randomUUID(), objectId: `${host}:forged` },
    400,
  );
  await request(
    `${path}/board`,
    outsider,
    {
      id: randomUUID(),
      kind: 'object-patch',
      objectId,
      fields: { text: 'Outside' },
    },
    403,
  );
  const hiddenObject = await request(`${path}/board`, host, {
    id: randomUUID(),
    kind: 'object-visible',
    objectId,
    visible: false,
  });
  assert.equal(
    workspaceObjects([createdObject.operation, hiddenObject.operation])[0]
      .visible,
    false,
  );
  checks++;
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
  const batch = {
    operations: [
      { ...stroke, id: randomUUID() },
      { ...stroke, id: randomUUID(), segment: 1 },
    ],
  };
  const batchSaved = await request(`${path}/board`, applicant, batch);
  const batchRetried = await request(`${path}/board`, applicant, batch);
  assert.deepEqual(batchSaved.operations, batchRetried.operations);
  assert.equal(batchSaved.operations.length, 2);
  checks++;
  const heavy = boardBatch(
    Array.from({ length: 16 }, (_, segment) => ({
      ...stroke,
      id: randomUUID(),
      actor: applicant,
      time: new Date().toISOString(),
      segment,
      points: Array.from({ length: 80 }, () => ({ x: 99999.99, y: 99999.99 })),
      kind: 'stroke' as const,
      mode: 'pen' as const,
    })),
  );
  const heavySaved = await request(`${path}/board`, applicant, {
    operations: heavy,
  });
  assert.equal(heavySaved.operations.length, heavy.length);
  checks++;

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
  await Promise.allSettled(
    realtimeClients.map((client) => client.disconnectUser()),
  );
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
  const cleanupFailed = cleanup.some((result) => result.status === 'rejected');
  if (cleanupFailed) {
    console.error(`Fixture cleanup needs retry for meeting ${id}.`);
    process.exitCode = 1;
  }
  let usersCleanupFailed = false;
  await video
    .deleteUsers({ user_ids: users, user: 'hard', messages: 'hard' })
    .catch(() => {
      usersCleanupFailed = true;
      console.error('Disposable user cleanup failed.');
      process.exitCode = 1;
    });
  if (!cleanupFailed && !usersCleanupFailed)
    await unlink(fixtureManifest).catch(() => undefined);
  else console.error(`Fixture manifest retained: ${fixtureManifest}`);
}

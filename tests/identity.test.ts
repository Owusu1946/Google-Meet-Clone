import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGuest, readGuest, signGuest } from '../src/lib/server/guest-session';
import { assertSameOrigin, readBody } from '../src/lib/server/http';

test('guest identity rejects forged, expired, malformed, and cross-secret sessions', () => {
  const guest = newGuest();
  guest.name = 'Ada';
  const token = signGuest(guest, 'secret');
  assert.deepEqual(readGuest(token, 'secret'), guest);
  assert.equal(readGuest(token, 'different'), null);
  assert.equal(readGuest(token, 'secret', guest.expires), null);
  assert.equal(readGuest(`${token}.extra`, 'secret'), null);
  const [body, signature] = token.split('.');
  const altered = Buffer.from(JSON.stringify({ ...guest, id: 'user_host' })).toString('base64url');
  assert.equal(readGuest(`${altered}.${signature}`, 'secret'), null);
  assert.equal(readGuest(`${body}.bad`, 'secret'), null);
});

test('mutations reject cross-site requests and invalid or oversized bodies', async () => {
  assert.throws(() => assertSameOrigin(new Request('https://meet.test/api/token', { headers: { origin: 'https://attacker.test' } })));
  assert.throws(() => assertSameOrigin(new Request('https://meet.test/api/token')));
  assert.doesNotThrow(() => assertSameOrigin(new Request('https://meet.test/api/token', { headers: { origin: 'https://meet.test' } })));
  await assert.rejects(readBody(new Request('https://meet.test', { method: 'POST', body: '[]' })));
  await assert.rejects(readBody(new Request('https://meet.test', { method: 'POST', body: 'x'.repeat(32_001) })));
});

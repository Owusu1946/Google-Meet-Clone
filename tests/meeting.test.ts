import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeetingCode } from '../src/lib/meeting';

test('join field accepts normalized codes and actual meeting links', () => {
  for (const value of [
    ' ABC-DEFG-HIJ ',
    'https://meet.test/abc-defg-hij',
    'meet.test/abc-defg-hij/meeting?from=invite',
  ])
    assert.equal(parseMeetingCode(value), 'abc-defg-hij');
  for (const value of [
    '',
    'https://meet.test/not-a-code',
    'https://meet.test/abc-defg-hij/unknown',
    'javascript:alert(1)',
  ])
    assert.equal(parseMeetingCode(value), null);
});

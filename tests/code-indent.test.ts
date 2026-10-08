import { test } from 'node:test';
import assert from 'node:assert/strict';
import { indentCode } from '../src/lib/code-indent';
test('code indentation inserts spaces at the caret without damaging Unicode', () => {
  assert.deepEqual(indentCode('😀x', 2, 2, false), {
    text: '😀  x',
    start: 4,
    end: 4,
  });
});
test('multiline indent excludes the following unselected line and reverses with outdent', () => {
  const source = 'first\nsecond\nthird';
  const indented = indentCode(source, 0, 13, false);
  assert.deepEqual(indented, {
    text: '  first\n  second\nthird',
    start: 2,
    end: 17,
  });
  assert.deepEqual(
    indentCode(indented.text, indented.start, indented.end, true),
    { text: source, start: 0, end: 13 },
  );
});
test('outdent handles tabs, one space and unindented lines without deleting content', () => {
  assert.deepEqual(indentCode('\tx\n y\nz', 0, 7, true), {
    text: 'x\ny\nz',
    start: 0,
    end: 5,
  });
  assert.deepEqual(indentCode('abc', 1, 1, true), {
    text: 'abc',
    start: 1,
    end: 1,
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseReaderSettings } from '../src/features/stories/readerSettings.ts';

test('reader preferences tolerate corrupt or outdated storage', () => {
  for (const input of [null, 'broken', 'null', '42', '{"fontSize":"huge","underlines":0}']) {
    assert.deepEqual(parseReaderSettings(input), { fontSize: 22, underlines: true });
  }
  assert.deepEqual(parseReaderSettings('{"fontSize":900,"underlines":false}'), { fontSize: 32, underlines: false });
  assert.equal(parseReaderSettings('{"fontSize":-20}').fontSize, 18);
});

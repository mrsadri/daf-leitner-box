import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlagValue, previewRequested, resolveFlag } from '../src/services/dictation/flag.ts';

test('the remote flag decides when it can be read', () => {
  assert.deepEqual(resolveFlag({ remote: true, build: false, isAdmin: false, previewParam: false }), { enabled: true, preview: false });
  assert.deepEqual(resolveFlag({ remote: false, build: true, isAdmin: false, previewParam: false }), { enabled: false, preview: false });
});

test('an unreadable flag fails open to the build constant', () => {
  assert.equal(resolveFlag({ remote: null, build: true, isAdmin: false, previewParam: false }).enabled, true);
  assert.equal(resolveFlag({ remote: null, build: false, isAdmin: false, previewParam: false }).enabled, false);
});

test('?dictation=1 only works for admins, and marks the view as a preview', () => {
  assert.deepEqual(resolveFlag({ remote: false, build: false, isAdmin: true, previewParam: true }), { enabled: true, preview: true });
  assert.deepEqual(resolveFlag({ remote: false, build: false, isAdmin: false, previewParam: true }), { enabled: false, preview: false });
  assert.deepEqual(resolveFlag({ remote: false, build: false, isAdmin: true, previewParam: false }), { enabled: false, preview: false });
  assert.deepEqual(resolveFlag({ remote: true, build: false, isAdmin: true, previewParam: true }), { enabled: true, preview: false });
});

test('flag values: booleans and their string forms; anything else is unreadable', () => {
  assert.equal(parseFlagValue(true), true);
  assert.equal(parseFlagValue('false'), false);
  assert.equal(parseFlagValue(0), null);
  assert.equal(parseFlagValue(null), null);
});

test('previewRequested reads the query string', () => {
  assert.equal(previewRequested('?dictation=1'), true);
  assert.equal(previewRequested('?go=dictation&dictation=1'), true);
  assert.equal(previewRequested('?dictation=0'), false);
  assert.equal(previewRequested(''), false);
});

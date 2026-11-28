import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldLoadClarity, CLARITY_HOSTNAME } from '../src/shared/lib/clarity.ts';

test('clarity loads only in a production build on the production host', () => {
  assert.equal(shouldLoadClarity({ prod: true, demo: false, hostname: CLARITY_HOSTNAME }), true);
});

test('clarity stays off in dev, demo builds, previews and localhost', () => {
  assert.equal(shouldLoadClarity({ prod: false, demo: false, hostname: CLARITY_HOSTNAME }), false);
  assert.equal(shouldLoadClarity({ prod: true, demo: true, hostname: CLARITY_HOSTNAME }), false);
  assert.equal(shouldLoadClarity({ prod: true, demo: false, hostname: 'daf-leitner-box-git-feature.vercel.app' }), false);
  assert.equal(shouldLoadClarity({ prod: true, demo: false, hostname: 'localhost' }), false);
});

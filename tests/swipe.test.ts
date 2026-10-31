import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lockAxis, releaseDecision, swipeThreshold, stampOpacity, dragRotation } from '../src/services/swipe.ts';

test('direction lock: small moves undecided, clear horizontal → drag, otherwise scroll', () => {
  assert.equal(lockAxis(4, 3), null);
  assert.equal(lockAxis(20, 5), 'x');
  assert.equal(lockAxis(-20, 5), 'x');
  assert.equal(lockAxis(5, 20), 'y');
  assert.equal(lockAxis(15, 12), 'y');   // diagonal-ish: scrolling wins
});

test('release: distance threshold or fast flick, else spring back', () => {
  assert.equal(swipeThreshold(390), 117);
  assert.equal(swipeThreshold(1000), 120);
  assert.equal(swipeThreshold(100), 60);
  assert.equal(releaseDecision(130, 800, 390), 'right');
  assert.equal(releaseDecision(-130, 800, 390), 'left');
  assert.equal(releaseDecision(80, 800, 390), null);       // slow and short
  assert.equal(releaseDecision(80, 100, 390), 'right');    // flick
  assert.equal(releaseDecision(30, 20, 390), null);        // too short even if fast
});

test('stamp and tilt follow the drag, capped', () => {
  assert.equal(stampOpacity(0, 390), 0);
  assert.equal(stampOpacity(500, 390), 1);
  assert.equal(dragRotation(900), 15);
  assert.equal(dragRotation(-900), -15);
  assert.equal(dragRotation(36), 2);
});

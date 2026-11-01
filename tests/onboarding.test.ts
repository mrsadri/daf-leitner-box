import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swipeStep, keyStep, clampSlide, trackOffset, dragResistance } from '../src/services/onboarding.ts';

test('swipe direction follows the language', () => {
  assert.equal(swipeStep('left', false), 1);   // English: swipe left → next
  assert.equal(swipeStep('right', false), -1);
  assert.equal(swipeStep('right', true), 1);   // Persian: swipe right → next
  assert.equal(swipeStep('left', true), -1);
});

test('arrow keys follow the reading direction', () => {
  assert.equal(keyStep('ArrowRight', false), 1);
  assert.equal(keyStep('ArrowLeft', false), -1);
  assert.equal(keyStep('ArrowLeft', true), 1);
  assert.equal(keyStep('ArrowRight', true), -1);
  assert.equal(keyStep('Enter', true), null);
});

test('slide index stays in range; track offset per direction', () => {
  assert.equal(clampSlide(-1, 3), 0);
  assert.equal(clampSlide(3, 3), 2);
  assert.equal(clampSlide(1, 3), 1);
  assert.equal(trackOffset(2, false), -200);
  assert.equal(trackOffset(2, true), 200);
  assert.equal(trackOffset(0, true), 0);
});

test('rubber band only past the ends', () => {
  assert.equal(dragResistance(100, 0, 3, false), 30);    // English, first slide, dragging back
  assert.equal(dragResistance(-100, 0, 3, false), -100); // forward is free
  assert.equal(dragResistance(-100, 2, 3, false), -30);  // last slide, forward
  assert.equal(dragResistance(100, 2, 3, true), 30);     // Persian, last slide, forward
  assert.equal(dragResistance(-100, 0, 3, true), -30);   // Persian, first slide, back
  assert.equal(dragResistance(100, 1, 3, true), 100);
});

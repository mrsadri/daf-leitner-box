import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessonProgress } from '../src/services/lessonProgress.ts';

const catalog = [
  { id: 'daf_01_1', lektion: '01', niveau: 'A1' }, { id: 'daf_01_2', lektion: '01', niveau: 'A1' },
  { id: 'daf_02_1', lektion: '02', niveau: 'A1' }, { id: 'daf_02_2', lektion: '02', niveau: 'A1' }, { id: 'daf_02_3', lektion: '02', niveau: 'A1' },
  { id: 'daf_10_1', lektion: '10', niveau: 'A2' },
  { id: 'x', lektion: '' }
];

test('stations in lesson order with status and percent', () => {
  const { stations, current } = lessonProgress(catalog, ['daf_01_1', 'daf_01_2', 'daf_02_1', 'custom_card']);
  assert.deepEqual(stations.map(s => s.lektion), ['01', '02', '10']);
  assert.deepEqual(stations.map(s => s.status), ['done', 'partial', 'none']);
  assert.deepEqual(stations.map(s => s.percent), [100, 33, 0]);
  assert.equal(stations[2].niveau, 'A2');
  assert.equal(current, '02');
});

test('current: first incomplete lesson; null when the book is done', () => {
  assert.equal(lessonProgress(catalog, []).current, '01');
  assert.equal(lessonProgress(catalog, catalog.map(w => w.id)).current, null);
  // a gap: lesson 01 skipped, 02 done → still "here" at 01
  assert.equal(lessonProgress(catalog, ['daf_02_1', 'daf_02_2', 'daf_02_3']).current, '01');
});

test('percent never shows 100 before the last word', () => {
  const big = Array.from({ length: 200 }, (_, i) => ({ id: `w${i}`, lektion: '03', niveau: 'A1' }));
  const s = lessonProgress(big, big.slice(0, 199).map(w => w.id)).stations[0];
  assert.deepEqual([s.status, s.percent], ['partial', 99]);
});

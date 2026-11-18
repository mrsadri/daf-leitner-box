import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sendReviewBatch } from '../src/core/reviewBatch.ts';
test('isolates stale reviews without discarding valid neighbours', async () => {
  const sent: number[] = [], rejected: number[] = [];
  await sendReviewBatch([1, 2, 3], async rows => {
    if (rows.includes(2)) return { code: 'P0001', message: 'review_day 2020-01-01 is out of range' };
    sent.push(...rows); return null;
  }, row => rejected.push(row));
  assert.deepEqual(sent, [1, 3]); assert.deepEqual(rejected, [2]);
});
test('unrelated errors propagate without rejecting progress', async () => {
  const rejected: number[] = [];
  await assert.rejects(sendReviewBatch([1], async () => ({ code: '42501', message: 'permission denied' }), x => rejected.push(x)));
  assert.deepEqual(rejected, []);
});

test('acknowledges committed sub-batches before a later retryable failure', async () => {
  const acknowledged: number[] = [];
  await assert.rejects(sendReviewBatch([1,2], async rows => {
    if(rows.length===2)return {code:'P0001',message:'review_day old is out of range'};
    if(rows[0]===1)return null;
    return {code:'08006',message:'connection failed'};
  },()=>{},rows=>acknowledged.push(...rows)));
  assert.deepEqual(acknowledged,[1]);
});

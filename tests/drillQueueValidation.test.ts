import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePendingFinishes } from '../src/features/adjective/queue.ts';
test('persisted drill requests reject corrupt counts, duplicates, and unknown protocols',()=>{
 const entry={id:'run',score:1,answered:2,queuedAt:100,protocol:'verified'};
 assert.deepEqual(parsePendingFinishes([entry]),[entry]);
 for(const bad of [[entry,entry],[{...entry,score:3}],[{...entry,answered:151}],[{...entry,protocol:'future'}],{},null]) assert.throws(()=>parsePendingFinishes(bad));
});

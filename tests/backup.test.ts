import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStoryBackup } from '../src/core/backup.ts';
test('story backups accept legacy absence and bounded progress, reject malformed data', () => {
 assert.deepEqual(parseStoryBackup(undefined), {});
 const p={storyId:'S01-Q1',page:1,totalPages:3,completedAt:null,updatedAt:'2026-11-18T10:00:00Z'};
 assert.deepEqual(parseStoryBackup({'S01-Q1':p}),{'S01-Q1':p});
 assert.throws(()=>parseStoryBackup({'S01-Q1':{...p,page:99}}));
 assert.throws(()=>parseStoryBackup({'S99-Q1':p}));
});

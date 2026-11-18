import { test } from 'node:test';
import assert from 'node:assert/strict';
import {validatePersistedQueue} from '../src/core/queueValidation.ts';
test('legacy and versioned queues validate, corrupted payloads cannot be replayed',()=>{
 const q={upserts:{},deletes:[],events:[],settings:null};
 assert.doesNotThrow(()=>validatePersistedQueue(q));
 assert.doesNotThrow(()=>validatePersistedQueue({...q,protocol:2,bases:{},versions:{},settingsVersion:0,inflight:null}));
 for(const broken of [null,{}, {...q,events:[{cardId:'x'}]}, {...q,deletes:[null]}, {...q,protocol:99}, {...q,inflight:{operation:'bad'}}])assert.throws(()=>validatePersistedQueue(broken));
});

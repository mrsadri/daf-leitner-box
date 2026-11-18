import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StoriesProgressStore } from '../src/features/stories/progressStore.ts';
import type { StoryProgressRow } from '../src/features/stories/progressRow.ts';

// No Supabase client or real network is created by these tests.
test('a newer save survives acknowledgement of an older in-flight save', async () => {
  const data = new Map<string, string>();
  const previous = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  } });
  let resolve!: (saved: boolean) => void;
  const writes: Partial<StoryProgressRow>[] = [];
  const store = new StoriesProgressStore('test-user', {
    async pull() { return []; },
    async save(row) {
      writes.push(row);
      if (writes.length === 1) return new Promise<boolean>(r => { resolve = r; });
      return true;
    },
  });
  try {
    await store.start();
    const progress = { storyId: 'S01-Q1', page: 1, totalPages: 5, completedAt: null, updatedAt: '2026-11-18T10:00:00Z' };
    store.save(progress, 'v1');
    const first = store.flush();
    assert.equal(store.flush(), first, 'concurrent flush calls share the same request');
    store.save({ ...progress, page: 3 }, 'v2');
    resolve(true);
    await first;
    assert.deepEqual(JSON.parse(data.get('daf_stories_pending_test-user')!), ['S01-Q1']);
    await store.flush();
    assert.equal(writes.length, 2);
    assert.equal(writes[1].finished_count, 4);
    assert.equal(writes[1].content_version, 'v2');
    assert.deepEqual(JSON.parse(data.get('daf_stories_pending_test-user')!), []);
  } finally {
    store.dispose();
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previous });
  }
});

test('failed writes retry only three times, remain persisted, and replay after reload', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  } });
  let attempts = 0;
  const store = new StoriesProgressStore('retry-user', {
    async pull() { return []; },
    async save() { attempts++; return false; },
  });
  const statuses: string[] = [];
  store.onStatus(s => statuses.push(s));
  try {
    await store.start();
    store.save({ storyId: 'S01-Q1', page: 3, totalPages: 5, completedAt: null, updatedAt: '2026-11-18T10:00:00Z' }, 'v1');
    await store.flush();
    for (const delay of [2000, 5000, 15000]) {
      t.mock.timers.tick(delay);
      await store.flush();
    }
    assert.equal(attempts, 4);
    t.mock.timers.tick(60000);
    assert.equal(attempts, 4, 'automatic attempts stop after the retry budget');
    assert.equal(statuses.at(-1), 'error');
    store.dispose();
    const rows: Partial<StoryProgressRow>[] = [];
    const reloaded = new StoriesProgressStore('retry-user', {
      async pull() { return []; },
      async save(row) { rows.push(row); return true; },
    });
    try {
      await reloaded.start();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].finished_count, 4);
      assert.deepEqual(JSON.parse(data.get('daf_stories_pending_retry-user')!), []);
    } finally { reloaded.dispose(); }
  } finally {
    store.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

test('disposing a store prevents new network requests', async () => {
  Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{getItem:()=>null,setItem:()=>{}} });
  let requests = 0;
  const store = new StoriesProgressStore('disposed', {
    async pull() { return []; },
    async save() { requests++; return true; },
  });
  store.dispose();
  await store.retry();
  assert.equal(requests, 0);
});

test('manual retry recovers from a failed pull before sending restored progress', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  } });
  let available = false;
  let writes = 0;
  const store = new StoriesProgressStore('pull-user', {
    async pull() { return available ? [] : null; },
    async save() { writes++; return true; },
  });
  const statuses: string[] = [];
  store.onStatus(s => statuses.push(s));
  try {
    store.save({ storyId: 'S01-Q1', page: 2, totalPages: 5, completedAt: null, updatedAt: '2026-11-18T10:00:00Z' }, 'v1');
    await store.flush();
    assert.equal(writes, 0, 'must pull successfully before writing');
    assert.equal(statuses.at(-1), 'error');
    available = true;
    await store.retry();
    assert.equal(writes, 1);
    assert.equal(statuses.at(-1), 'idle');
  } finally {
    store.dispose();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});


test('corrupt story queues are retained and rejected before any write', () => {
  const raw='{"unexpected":true}';
  let writes=0;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>key.includes('pending')?raw:null,setItem:()=>{writes++;}}});
  assert.throws(()=>new StoriesProgressStore('corrupt',null),/Invalid pending story data/);
  assert.equal(writes,0);
});

test('storage-full story saves report an error while keeping the in-memory progress',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{throw new Error('quota');}}});
  const store=new StoriesProgressStore('full',null);
  let status='idle';store.onStatus(s=>{status=s;});
  store.save({storyId:'S01-Q1',page:1,totalPages:3,completedAt:null,updatedAt:'2026-11-18T10:00:00Z'},'v1');
  assert.equal(status,'error');
  assert.equal(store.get()['S01-Q1'].page,1);
  store.dispose();
});


test('a disposed story pull cannot modify the previous account cache',async()=>{
 const data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v);}}});
 let resolve!: (rows:StoryProgressRow[])=>void;
 const store=new StoriesProgressStore('old-account',{pull:()=>new Promise<StoryProgressRow[]>(r=>{resolve=r;}),save:async()=>true});
 const start=store.start();store.dispose();resolve([]);await start;
 assert.equal(data.size,0);
});

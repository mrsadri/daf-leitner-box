import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function worker(windows: object[] = []) {
  const handlers = new Map<string, (event: any) => void>();
  const notifications: any[] = [], opened: string[] = [];
  const self = {
    location: { origin: 'https://app.example' },
    addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler),
    registration: { showNotification: async (...args: any[]) => { notifications.push(args); } },
    clients: { matchAll: async () => windows, openWindow: async (url: string) => { opened.push(url); } },
  };
  vm.runInNewContext(fs.readFileSync('public/sw.js', 'utf8'), { self, URL });
  async function dispatch(name: string, fields: object) {
    let pending: Promise<unknown> | undefined;
    handlers.get(name)!({ ...fields, waitUntil: (value: Promise<unknown>) => { pending = value; } });
    await pending;
  }
  const click = (url: unknown) => dispatch('notificationclick', { notification: { data: { url }, close() {} } });
  return { dispatch, click, notifications, opened };
}

test('worker renders localized push payloads and tolerates non-JSON data', async () => {
  const w = worker();
  await w.dispatch('push', { data: { json: () => ({ title: 'Review', body: 'Ready', lang: 'en', url: '/?go=stories' }) } });
  assert.equal(w.notifications[0][0], 'Review');
  assert.equal(w.notifications[0][1].dir, 'ltr');
  assert.equal(w.notifications[0][1].data.url, '/?go=stories');
  await w.dispatch('push', { data: { json() { throw new Error('invalid JSON'); }, text: () => 'Plain reminder' } });
  assert.equal(w.notifications[1][1].body, 'Plain reminder');
  assert.equal(w.notifications[1][1].dir, 'rtl');
});

test('worker opens only same-origin notification links, including malformed payloads', async () => {
  for (const url of ['https://evil.example/', '//evil.example', 'javascript:alert(1)', 'data:text/html,hello', 'https://user:pass@app.example/', 'http://[', {}]) {
    const w = worker(); await w.click(url);
    assert.equal(w.opened[0], 'https://app.example/');
  }
  const w = worker(); await w.click('/?go=stories&book=1');
  assert.equal(w.opened[0], 'https://app.example/?go=stories&book=1');
});

test('worker reuses an app window and ignores unrelated clients', async () => {
  const navigated: string[] = []; let focused = false;
  const app = { url: 'https://app.example/?old', focus: async () => { focused = true; }, navigate: async (url: string) => { navigated.push(url); return app; } };
  const other = { url: 'https://elsewhere.example/', focus: () => { throw new Error('wrong client'); } };
  const w = worker([other, app]); await w.click('/?go=stories');
  assert.deepEqual(navigated, ['https://app.example/?go=stories']);
  assert.equal(focused, true); assert.equal(w.opened.length, 0);
});

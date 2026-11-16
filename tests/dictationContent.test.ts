import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import type { Story, StoryIndex } from '../src/types/dictation.ts';

const ROOT = new URL('../', import.meta.url).pathname;
const read = (p: string) => readFileSync(ROOT + p, 'utf8');
const index: StoryIndex = JSON.parse(read('public/data/stories/index.json'));
const cast: { characters: { id: string }[] } = JSON.parse(read('content/dictation/cast.json'));
const castIds = new Set(cast.characters.map(c => c.id));
const cards = new Set(
  read('public/data/wortschatz-daf-kompakt.csv')
    .split('\n').slice(1)
    .map(l => l.match(/^(?:"[^"]*"|[^,]*),(?:"[^"]*"|[^,]*),(?:"(?:[^"]|"")*"|[^,]*),(?:"[^"]*"|[^,]*),(?:"[^"]*"|[^,]*),(?:"(?:[^"]|"")*"|[^,]*),([^,]*),(?:"[^"]*"|[^,]*),([^,]*),/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map(m => `daf_${m[1]}_${m[2]}`),
);

const stories = index.stories.map(e => ({ entry: e, story: JSON.parse(read(`public/data/stories/${e.file}`)) as Story }));

test('index lists stories 1 and 2 with matching counts and versions', () => {
  assert.equal(index.version, 1);
  assert.ok(stories.length >= 2);
  for (const { entry, story } of stories) {
    assert.equal(entry.id, story.id);
    assert.equal(entry.contentVersion, story.contentVersion);
    assert.equal(entry.sequences, story.sequences.length);
    assert.equal(entry.sentences, story.sequences.reduce((n, q) => n + q.sentences.length, 0));
    assert.equal(story.sequences.length, 6);
  }
});

test('sentence ids are unique and have the expected shape', () => {
  const seen = new Set<string>();
  for (const { story } of stories) {
    for (const q of story.sequences) {
      assert.match(q.id, /^S\d\d-Q[1-6]$/);
      assert.ok(q.sentences.length > 0);
      for (const s of q.sentences) {
        assert.match(s.id, /^s\d\dq[1-6]n\d{4}$/);
        assert.ok(!seen.has(s.id), `duplicate id ${s.id}`);
        seen.add(s.id);
        assert.ok(s.text.length > 0);
        assert.match(s.hash, /^[0-9a-f]{12}$/);
        assert.equal(s.text, s.text.normalize('NFC'));
        assert.ok(!s.text.includes('**'), 'bold markers must be stripped');
      }
    }
  }
});

test('every speaker is a known cast member and none is UNKNOWN', () => {
  for (const { story } of stories) {
    for (const q of story.sequences) {
      for (const s of q.sentences) {
        assert.ok(castIds.has(s.speaker), `${s.id}: ${s.speaker}`);
        for (const g of s.segments ?? []) assert.ok(castIds.has(g.speaker), `${s.id}: ${g.speaker}`);
        if (s.segments) assert.ok(s.segments.length >= 2);
      }
    }
  }
});

test('endMark matches the text and quoteBalance counts the double quotes', () => {
  for (const { story } of stories) {
    for (const q of story.sequences) {
      for (const s of q.sentences) {
        const core = s.text.replace(/[“”‘’»)\s]+$/, '');
        assert.equal(core.slice(-1), s.endMark, s.id);
        const open = (s.text.match(/„/g) ?? []).length;
        const close = (s.text.match(/[“”]/g) ?? []).length;
        assert.equal(s.quoteBalance, open - close, s.id);
      }
    }
  }
});

test('every link range lies inside the text, on word boundaries, and points to a catalog card', () => {
  const word = /[\p{L}\p{N}’'-]/u;
  for (const { story } of stories) {
    for (const q of story.sequences) {
      for (const s of q.sentences) {
        for (const l of s.links) {
          assert.ok(l.s >= 0 && l.e > l.s && l.e <= s.text.length, `${s.id} range`);
          assert.ok(l.s === 0 || !word.test(s.text[l.s - 1]), `${s.id}: link starts inside a word`);
          assert.ok(l.e === s.text.length || !word.test(s.text[l.e]), `${s.id}: link ends inside a word`);
          assert.ok(l.cards.length >= 1);
          for (const c of l.cards) assert.ok(cards.has(c), `${s.id}: unknown card ${c}`);
        }
        const sorted = [...s.links].sort((a, b) => a.s - b.s);
        for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].s >= sorted[i - 1].e, `${s.id}: overlapping links`);
      }
    }
  }
});

test('segments cover the sentence text apart from spaces', () => {
  for (const { story } of stories) {
    for (const q of story.sequences) {
      for (const s of q.sentences) {
        if (!s.segments) continue;
        const joined = s.segments.map(g => g.text).join('').replace(/\s+/g, '');
        assert.equal(joined, s.text.replace(/\s+/g, ''), s.id);
      }
    }
  }
});

test('JSON text equals the Markdown text apart from the bold markers', () => {
  for (const { story } of stories) {
    const no = story.id.replace('story-', '');
    const md = read(`DaF-kompakt-work/DaF-kompakt/output/story-${no}.md`);
    const sections = md.split(/^## Sequenz \d+:.*$/m).slice(1);
    story.sequences.forEach((q, i) => {
      const m = sections[i].match(/\*\*Text\*\*\n([\s\S]*?)\n\*\*Fragen\*\*/);
      assert.ok(m, q.id);
      const want = m[1].replace(/\*\*/g, '').replace(/\s+/g, '');
      const got = q.sentences.map(s => s.text).join('').replace(/\s+/g, '');
      assert.equal(got, want, q.id);
    });
  }
});

test('the id lock file knows every published sentence id', () => {
  for (const { story } of stories) {
    const no = story.id.replace('story-', '');
    assert.ok(existsSync(ROOT + `content/dictation/story-${no}.ids.json`));
    const lock = JSON.parse(read(`content/dictation/story-${no}.ids.json`));
    const known = new Set(Object.values(lock.sequences).flat().map((e: any) => e.id));
    for (const q of story.sequences) for (const s of q.sentences) assert.ok(known.has(s.id), s.id);
  }
});

test('every sentence has an audio file key in the Piper (B) index, and the index has no stray ids', () => {
  for (const { story } of stories) {
    const idx = JSON.parse(read(`public/data/stories/${story.id}.audio.B.json`)) as { mode: string; sentences: Record<string, { key: string; ms: number; bytes: number; textHash: string }> };
    assert.equal(idx.mode, 'B');
    const ids = new Set<string>();
    for (const q of story.sequences) {
      for (const s of q.sentences) {
        ids.add(s.id);
        const e = idx.sentences[s.id];
        assert.ok(e, `${s.id}: no audio key`);
        assert.match(e.key, /^[0-9a-f]{16}$/);
        assert.ok(e.ms > 300 && e.bytes > 1000, `${s.id}: implausible file`);
        assert.equal(e.textHash, s.hash, `${s.id}: audio was made for other text, run gen_audio.py`);
      }
    }
    for (const id of Object.keys(idx.sentences)) assert.ok(ids.has(id), `index has retired id ${id}`);
  }
});

test('no API key, service-role key or provider secret appears in the committed content or code', () => {
  const files = ['src/config.ts', 'content/dictation/voices.json', 'scripts/dictation/gen_audio.py', 'scripts/dictation/upload_media.py'];
  for (const f of files) {
    const text = read(f);
    assert.ok(!/eyJ[A-Za-z0-9_-]{20,}/.test(text), `${f}: looks like a JWT`);
    assert.ok(!/sk_[a-z0-9]{20,}/i.test(text), `${f}: looks like an API key`);
  }
});

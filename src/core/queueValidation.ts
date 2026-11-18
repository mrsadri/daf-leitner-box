import { validSettings } from './settingsValidation.ts';
/** Persisted queues are untrusted input. Invalid payloads stay untouched for recovery. */
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const integer = (v: unknown, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;
const id = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 200;
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const card = (v: unknown) => record(v) && id(v.id) && ['vocab','reflection'].includes(String(v.type)) && integer(v.box,6)
  && typeof v.nextReviewDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.nextReviewDate)
  && integer(v.reviewCount) && integer(v.correctCount) && integer(v.wrongCount);
const event = (v: unknown) => record(v) && id(v.cardId) && ['vocab','reflection'].includes(String(v.cardType))
  && typeof v.correct === 'boolean' && integer(v.fromBox,6) && integer(v.toBox,6)
  && typeof v.reviewDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.reviewDay)
  && (v.operationId === undefined || uuid(v.operationId));
const settings = (v: unknown) => record(v) && Object.keys(v).length === Object.keys(validSettings(v)).length;
export function validatePersistedQueue(value: unknown): void {
  if (!record(value) || !record(value.upserts) || !Array.isArray(value.deletes) || !Array.isArray(value.events)
      || Object.keys(value.upserts).length > 10000 || value.deletes.length > 10000 || value.events.length > 20000
      || !Object.entries(value.upserts).every(([key,v])=>record(v) && v.id===key && card(v))
      || !value.deletes.every(id) || !value.events.every(event)
      || !(value.settings === null || settings(value.settings))) throw new Error('Stored sync queue is invalid; retained for recovery');
  if (value.protocol !== undefined && value.protocol !== 2) throw new Error('Unsupported sync queue version');
  if (value.bases !== undefined && (!record(value.bases) || !Object.entries(value.bases).every(([key,stamp])=>id(key) && (stamp===null||typeof stamp==='string')))) throw new Error('Invalid sync baselines');
  if (value.versions !== undefined && (!record(value.versions) || !Object.values(value.versions).every(v=>integer(v)))) throw new Error('Invalid sync revisions');
  if (value.settingsBase !== undefined && !settings(value.settingsBase)) throw new Error('Invalid settings baseline');
  if (value.settingsVersion !== undefined && !integer(value.settingsVersion)) throw new Error('Invalid settings revision');
  if (value.inflight !== undefined && value.inflight !== null) {
    const b=value.inflight;
    if (!record(b) || !uuid(b.operation) || !integer(b.revision) || !record(b.versions) || !Object.values(b.versions).every(v=>integer(v))
        || !integer(b.settingsVersion) || !Array.isArray(b.upserts) || b.upserts.length>500
        || !b.upserts.every(v=>record(v)&&id(v.id)&&integer(v.box,6)&&record(v.data)&&typeof v.next_review_date==='string')
        || !Array.isArray(b.deletes)||b.deletes.length>500||!b.deletes.every(id)
        || !Array.isArray(b.events)||b.events.length>20000||!b.events.every(event)
        || !(b.settings===null||settings(b.settings))) throw new Error('Stored in-flight batch is invalid; retained for recovery');
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAudit } from '../scripts/check-dependency-audit.ts';
const today = new Date('2026-11-18T00:00:00Z');
const known = { metadata: {}, vulnerabilities: { picomatch: { severity: 'high', via: [{ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }] } } };
test('audit records known outstanding finding without claiming a clean audit', () => {
  assert.equal(assessAudit(known, today).auditClean, false);
  assert.equal(assessAudit({ metadata: {}, vulnerabilities: {} }, today).auditClean, true);
});
test('audit fails closed for unavailable registry, unknown advisories and critical changes', () => {
  assert.throws(() => assessAudit({ error: 'network' }, today));
  assert.throws(() => assessAudit({ metadata: {}, vulnerabilities: { picomatch: { severity: 'high', via: [{ url: 'https://example.com/new-advisory' }] } } }, today));
  assert.throws(() => assessAudit({ metadata: {}, vulnerabilities: { picomatch: { severity: 'critical', via: known.vulnerabilities.picomatch.via } } }, today));
});
test('audit cannot carry the known exception past its review date', () => {
  assert.throws(() => assessAudit(known, new Date('2026-11-25T00:00:00Z')), /expired/);
});

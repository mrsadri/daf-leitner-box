/** Keep the dated build-only finding visible while rejecting new/expired exceptions. */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
type Finding = { severity: string; via: (string | { url: string })[] };
type Audit = { metadata?: unknown; vulnerabilities?: Record<string, Finding>; error?: unknown };
const allowedPackages = new Set(['picomatch', 'fdir', 'tinyglobby', 'vite', '@vitejs/plugin-react']);
const knownAdvisory = 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf';
export function assessAudit(audit: Audit, now = new Date()) {
  if (audit.error || !audit.metadata || !audit.vulnerabilities) throw new Error('No valid registry audit result; fail closed.');
  const findings = Object.entries(audit.vulnerabilities).filter(([, issue]) => ['moderate', 'high', 'critical'].includes(issue.severity));
  for (const [name, issue] of findings) {
    if (!allowedPackages.has(name) || issue.severity !== 'high' || issue.via.length === 0 || issue.via.some(cause => typeof cause === 'string' ? !allowedPackages.has(cause) : cause.url !== knownAdvisory)) {
      throw new Error(`Unreviewed dependency finding: ${name}`);
    }
  }
  if (findings.length && now >= new Date('2026-11-25T00:00:00Z')) throw new Error('Build advisory review expired on 25 November 2026; reassess upstream before renewing.');
  return { knownAffectedPackages: findings.map(([name]) => name), unresolvedAdvisory: findings.length ? knownAdvisory : null,
    reviewDue: findings.length ? '2026-11-25' : null, auditClean: findings.length === 0 };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = assessAudit(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
    console.log(JSON.stringify(report, null, 2));
    if (!report.auditClean) console.log('Known build-tool advisory remains unresolved; this is not a clean audit.');
  } catch (error) { console.error(error instanceof Error ? error.message : 'Audit check failed'); process.exitCode = 1; }
}

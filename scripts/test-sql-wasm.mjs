/** Isolated PostgreSQL assertions when native initdb is unavailable. No hosted credentials are used. */
import { applySchema } from './database-schema.mjs';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function read(file) {
  return fs.readFileSync(file, 'utf8')
    .replace(/^\\ir (.*)$/gm, (_, include) => read(path.resolve(path.dirname(file), include.trim())))
    .replace(/^\\.*$/gm, '');
}
const tests = fs.readdirSync(path.join(root, 'supabase/tests')).filter(f => f.endsWith('.test.sql')).sort();
for (const test of tests) {
  const db = new PGlite();
  try {
    const run = file => db.exec(read(path.join(root, file)));
    await applySchema(db, { replay: true });
    await run(`supabase/tests/${test}`);
    console.log(`PASS ${test} (schema + migration replay + assertions)`);
  } finally { await db.close(); }
}
// Prove the authorization regression detects a deliberately broken isolation rule.
{
 const db=new PGlite();
 try {
  await applySchema(db);
  await db.exec('alter table public.cards disable row level security');
  let detected=false;
  try { await db.exec(read(path.join(root,'supabase/tests/authorization.test.sql'))); }
  catch(error) { if(String(error.message).includes('FAILED:')) detected=true; else throw error; }
  if(!detected) throw new Error('Ownership mutation was not detected');
  console.log('PASS negative control: disabled card RLS is detected by authorization assertions');
 } finally { await db.close(); }
}
console.log('All isolated SQL assertions passed. Native multi-connection and hosted API checks remain separate.');

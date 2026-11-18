/** Canonical clean-install manifest shared by local verification and type generation. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const repositoryRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function schemaFiles(){return ['supabase/schema.sql',...fs.readdirSync(path.join(repositoryRoot,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort().map(f=>'supabase/migrations/'+f)];}
export async function applySchema(db,{replay=false}={}){
 await db.exec(fs.readFileSync(path.join(repositoryRoot,'supabase/tests/stub-supabase.sql'),'utf8'));
 const files=schemaFiles();
 for(const file of files)await db.exec(fs.readFileSync(path.join(repositoryRoot,file),'utf8'));
 if(replay)for(const file of files.slice(1))await db.exec(fs.readFileSync(path.join(repositoryRoot,file),'utf8'));
}

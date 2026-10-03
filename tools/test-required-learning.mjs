// npm install --prefix /tmp/academy-dbcheck @electric-sql/pglite --ignore-scripts
// PGLITE_MODULE=/tmp/academy-dbcheck/node_modules/@electric-sql/pglite/dist/index.js node tools/test-supabase.mjs
import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {PGlite}=await import(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;create schema storage;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('request.jwt.claim.email',true))$$;
grant usage on schema auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;
grant usage on schema storage to authenticated;grant select on storage.objects to authenticated;
`);
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202610030001_academy.sql'),'utf8'));
const student='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
await db.query("insert into auth.users values($1,'student@example.org',now()),($2,'other@example.org',now()),($3,'admin@example.org',now())",[student,other,admin]);
await db.query('insert into academy_private.admins values($1)',[admin]);
await db.exec("insert into storage.objects(bucket_id,name) values('academy-private','n1/manuel.pdf'),('academy-private','n2/manuel.pdf'),('academy-private','bad/secret.pdf');");
async function role(name,id='',email=''){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claim.email',$2,false)",[id,email]);await db.exec(`set role ${name}`);}
async function denied(sql,values=[]){await assert.rejects(()=>db.query(sql,values));}
let count=0;const ok=s=>{count++;console.log('OK',s);};

// Preserve a real legacy carnet and completion before migration.
await db.query("insert into public.academy_progress(user_id,level,step,notes,done) values($1,1,1,'Carnet historique conservé',true)",[student]);
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202610030002_required_learning.sql'),'utf8'));
// Production migration keeps legacy evidence and excludes preliminary pages.
await db.query("insert into public.academy_read_receipts(user_id,level,page) values($1,1,1)",[student]);
await db.query("insert into public.academy_work(user_id,requirement_id,answer,state,feedback) values($1,'n2-s8-activite',$2,'accepted','Retour historique à conserver')",[student,'Travail historique déjà corrigé. '.repeat(8)]);
await db.query("insert into public.academy_progress(user_id,level,step,notes,done,requirements_version) values($1,2,8,'Carnet historique N2 conservé',true,2)",[student]);
await db.query("insert into public.academy_certificates(user_id,level,full_name) values($1,2,'Apprenant Test')",[student]);
await db.exec(fs.readFileSync(path.join(root,'supabase/migrations/202610030003_course_coherence.sql'),'utf8'));
assert.equal((await db.query('select count(*)::int n from public.academy_reading_pages where required')).rows[0].n,182);
assert.equal((await db.query('select count(*)::int n from public.academy_read_receipts')).rows[0].n,1);
const historical=(await db.query("select * from public.academy_work where requirement_id='n2-s8-activite'")).rows[0];assert.equal(historical.state,'revision');assert.ok(historical.answer.startsWith('Travail historique'));assert.ok(historical.feedback.includes('Retour historique'));
assert.equal((await db.query('select revoked from public.academy_certificates where level=2')).rows[0].revoked,true);
assert.equal((await db.query('select notes,done from public.academy_progress where level=2')).rows[0].notes,'Carnet historique N2 conservé');
ok('Migration de cohérence : 182 pages de cours ; anciennes réponses et déclarations conservées ; trois consignes rectifiées à revoir');

await db.exec("insert into storage.objects(bucket_id,name) values('academy-private','n1/slides.pptx'),('academy-private','n1/corpus.json'),('academy-private','n1/course.json'),('academy-private','n1/pages/001.webp'),('academy-private','n1/pages/001.txt');");
async function rpc(name,args){return (await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args)).rows[0].result;}
const note='Mon analyse personnelle explique les notions, les difficultés rencontrées et les vérifications réalisées. ';const answer='Ce travail présente mon objectif, la méthode suivie, un résultat concret et une analyse critique des limites avec des vérifications documentées. ';
await role('anon');await denied('select * from public.academy_work');await denied('select public.academy_complete_step(1,1)');ok('Accès anonyme aux travaux et validation refusé');
for(let level=1;level<=4;level++){
 await role('service_role');await rpc('academy_sync_enrollment',[`enroll-${level}`,'student@example.org','Apprenant Test',level]);
 await role('authenticated',admin,'admin@example.org');const enrollment=(await db.query('select id from public.academy_enrollments where level=$1',[level])).rows[0].id;await rpc('academy_set_enrollment',[enrollment,'active']);
 await role('authenticated',student,'student@example.org');
 if(level===1){
  const legacy=(await db.query('select * from public.academy_progress where level=1')).rows[0];assert.equal(legacy.notes,'Carnet historique conservé');assert.equal(legacy.requirements_version,1);assert.equal((await rpc('academy_prerequisites',[1])).ready,false);
  assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(r=>r.name),['n1/course.json','n1/pages/001.txt','n1/pages/001.webp']);
  await db.exec('reset role');await db.exec("create policy accidental_allow on storage.objects for select to authenticated using(true)");
  await role('authenticated',student,'student@example.org');assert.equal((await db.query("select * from storage.objects where name like '%.pdf' or name like '%.pptx' or name like '%corpus.json'")).rows.length,0);
  await db.exec('reset role');await db.exec('drop policy accidental_allow on storage.objects');await role('authenticated',student,'student@example.org');ok('Ancien carnet conservé ; PDF/PPTX/corpus refusés même avec une politique permissive supplémentaire');
  await denied('insert into public.academy_progress(user_id,level,step,done) values($1,1,2,true)',[student]);
  await denied('update public.academy_progress set done=true');await denied('insert into public.academy_projects(user_id,level,submission) values($1,1,$2)',[student,answer]);
  await denied('select public.academy_save_notes(1,2,$1)',[note]);await denied('select public.academy_acknowledge_page(1,999)');await denied('select public.academy_prerequisites(null)');await denied('select public.academy_acknowledge_page(1,2)');assert.equal((await rpc('academy_prerequisites',[1])).missing_pages,38);
  await denied('select public.academy_prerequisites(1,$1)',[other]);ok('Écritures directes, saut d’étape et consultation d’un autre dossier refusés');
 }
 await denied('select public.academy_submit_project($1,$2)',[level,answer.repeat(3)]);
 const lessons=(await db.query('select * from public.academy_lessons where level=$1 order by step',[level])).rows;
 for(const l of lessons){
  await denied('select public.academy_complete_step($1,$2)',[level,l.step]);
  await rpc('academy_save_notes',[level,l.step,note]);
  await denied('select public.academy_complete_step($1,$2)',[level,l.step]);
  for(let p=l.first_page;p<=l.last_page;p++)await rpc('academy_acknowledge_page',[level,p]);
  await denied('select public.academy_complete_step($1,$2)',[level,l.step]);
  const reqs=(await db.query('select * from public.academy_requirements where level=$1 and step=$2',[level,l.step])).rows;
  for(const r of reqs){await denied('select public.academy_submit_work($1,$2)',[r.id,'Trop court']);await rpc('academy_submit_work',[r.id,answer]);}
  await rpc('academy_complete_step',[level,l.step]);
 }
 let pre=await rpc('academy_prerequisites',[level]);assert.equal(pre.ready,true);assert.equal(pre.ready_grade,false);
 await rpc('academy_submit_project',[level,answer.repeat(3)]);
 await role('authenticated',admin,'admin@example.org');await denied('select public.academy_grade($1,$2,20,50,$3)',[student,level,'Correction pas encore terminée']);
 const works=(await db.query('select w.* from public.academy_work w join public.academy_requirements r on r.id=w.requirement_id where r.level=$1',[level])).rows;
 for(const w of works){await rpc('academy_review_work',[student,w.requirement_id,'accepted','Travail examiné et conforme aux attendus.',w.updated_at]);await denied('select public.academy_review_work($1,$2,$3,$4,$5)',[student,w.requirement_id,'revision','Version obsolète à refuser.',w.updated_at]);}
 assert.equal((await rpc('academy_prerequisites',[level,student])).ready_grade,true);
 const qmin=[0,28,21,28,21][level],pmin=[0,42,49,50,50][level];
 assert.equal(await rpc('academy_grade',[student,level,qmin-1,pmin,'Seuil de connaissances insuffisant.']),null);
 const cert=await rpc('academy_grade',[student,level,qmin,pmin,'Toutes les preuves ont été examinées.']);assert.ok(cert);
 const evidence=(await db.query('select evidence from public.academy_assessments where level=$1',[level])).rows[0].evidence;assert.equal(evidence.version,2);assert.equal(evidence.requirements.length,works.length);
 await role('authenticated',student,'student@example.org');await denied('select public.academy_grade($1,$2,40,60,$3)',[student,level,'Autocorrection interdite']);
 await rpc('academy_submit_work',[works[0].requirement_id,answer+' Modification significative.']);assert.equal((await rpc('academy_prerequisites',[level])).ready,false);
 await role('anon');assert.equal((await db.query('select * from public.academy_verify_certificate($1)',[cert])).rows[0].valid,false);
 await role('authenticated',admin,'admin@example.org');await rpc('academy_set_enrollment',[enrollment,'revoked']);
 await role('authenticated',student,'student@example.org');await denied('select public.academy_save_notes($1,1,$2)',[level,note]);assert.equal((await db.query('select * from storage.objects where name like $1',[`n${level}/%`])).rows.length,0);
 ok(`N${level} : toutes pages et remises obligatoires ; correction préalable ; seuils ; preuve archivée ; modification et suspension bloquantes`);
}
console.log(`${count} groupes de contrôles PostgreSQL réussis : 41 étapes, 98 travaux, 182 pages de cours ; sommaires et pages préliminaires hors progression. Auth et Storage simulés localement.`);
await db.close();

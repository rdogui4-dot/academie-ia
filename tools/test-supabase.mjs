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
await role('service_role');await db.query('select public.academy_sync_enrollment($1,$2,$3,$4)',['event-1','student@example.org','Apprenant Test',1]);await db.query('select public.academy_sync_enrollment($1,$2,$3,$4)',['event-1','student@example.org','Apprenant Test',1]);
await role('authenticated',student,'student@example.org');
assert.equal((await db.query('select * from public.academy_enrollments')).rows.length,1);
assert.equal((await db.query('select public.academy_has_access(1) as yes')).rows[0].yes,false);
assert.equal((await db.query('select * from storage.objects')).rows.length,0);ok('Une inscription en attente ne donne accès à aucun document ; synchronisation idempotente');
await denied("insert into public.academy_enrollments(email,level,full_name,source_id,status) values('student@example.org',2,'Fake','fake','active')");
await denied('select public.academy_sync_enrollment($1,$2,$3,$4)',['fake','student@example.org','Fake',2]);
await denied('select public.academy_grade($1,1,40,60,$2)',[student,'Tentative non autorisée']);ok('Un apprenant ne peut ni s’inscrire en base, ni activer un niveau, ni se noter');
await role('authenticated',admin,'admin@example.org');const enrollment=(await db.query('select id from public.academy_enrollments')).rows[0].id;
await db.query('select public.academy_set_enrollment($1,$2)',[enrollment,'active']);
await role('authenticated',student,'student@example.org');assert.equal((await db.query('select * from storage.objects')).rows.length,1);
assert.equal((await db.query('select public.academy_has_access(2) as yes')).rows[0].yes,false);ok('Inscription N1 active : document N1 autorisé, N2 interdit');
await db.query('insert into public.academy_progress(user_id,level,step,notes,done) values($1,1,1,$2,true)',[student,'Mon carnet']);
await denied('insert into public.academy_progress(user_id,level,step) values($1,1,1)',[other]);
await role('authenticated',other,'other@example.org');assert.equal((await db.query('select * from public.academy_progress')).rows.length,0);ok('Carnets isolés par apprenant, y compris tentative d’écriture pour un autre compte');
await role('authenticated',admin,'admin@example.org');await denied('select public.academy_grade($1,1,40,60,$2)',[student,'Bon résultat sans projet remis']);ok('Certificat impossible sans projet remis');
await role('authenticated',student,'student@example.org');await db.query('insert into public.academy_projects(user_id,level,submission) values($1,1,$2)',[student,'Mon projet complet pour une évaluation supervisée.']);
await role('authenticated',admin,'admin@example.org');assert.equal((await db.query('select public.academy_grade($1,1,27,60,$2) as id',[student,'Le seuil de connaissances n’est pas atteint.'])).rows[0].id,null);
await denied('select public.academy_grade($1,1,41,60,$2)',[student,'Note au-delà du maximum']);
const cert=(await db.query('select public.academy_grade($1,1,28,42,$2) as id',[student,'QCM et projet vérifiés selon la grille.'])).rows[0].id;assert.ok(cert);ok('Seuils N1 et bornes des notes contrôlés côté serveur');
await role('anon');const publicRecord=(await db.query('select * from public.academy_verify_certificate($1)',[cert])).rows[0];assert.equal(publicRecord.valid,true);assert.deepEqual(Object.keys(publicRecord).sort(),['id','issued_at','level','valid']);await denied('select * from public.academy_certificates');ok('Vérification publique sans nom complet ni e-mail ; table privée interdite');
await role('authenticated',admin,'admin@example.org');await db.query('select public.academy_grade($1,1,20,30,$2)',[student,'Résultat corrigé après revue du dossier.']);
await role('anon');assert.equal((await db.query('select * from public.academy_verify_certificate($1)',[cert])).rows[0].valid,false);ok('Une correction invalidante révoque le certificat');
for(const [n,qmax,qmin,pmax,pmin] of [[2,30,21,70,49],[3,40,28,70,50],[4,30,21,70,50]]){
 await role('service_role');await db.query('select public.academy_sync_enrollment($1,$2,$3,$4)',[`event-${n}`,'student@example.org','Apprenant Test',n]);
 await role('authenticated',admin,'admin@example.org');const id=(await db.query('select id from public.academy_enrollments where level=$1',[n])).rows[0].id;await db.query('select public.academy_set_enrollment($1,$2)',[id,'active']);
 await role('authenticated',student,'student@example.org');await db.query('insert into public.academy_projects(user_id,level,submission) values($1,$2,$3)',[student,n,`Dossier détaillé de formation du niveau ${n}.`]);
 await role('authenticated',admin,'admin@example.org');assert.equal((await db.query('select public.academy_grade($1,$2,$3,$4,$5) as id',[student,n,qmin,pmin-1,'Projet sous le seuil requis.'])).rows[0].id,null);assert.ok((await db.query('select public.academy_grade($1,$2,$3,$4,$5) as id',[student,n,qmin,pmin,'QCM et projet vérifiés par le formateur.'])).rows[0].id);await denied('select public.academy_grade($1,$2,$3,$4,$5)',[student,n,qmax+1,pmax,'Note impossible.']);ok(`Seuils et bornes du N${n} vérifiés`);
}
await role('authenticated',student,'student@example.org');for(let i=0;i<30;i++)assert.equal((await db.query('select public.academy_tutor_quota(1) as yes')).rows[0].yes,true);assert.equal((await db.query('select public.academy_tutor_quota(1) as yes')).rows[0].yes,false);
await role('authenticated',other,'other@example.org');assert.equal((await db.query('select public.academy_tutor_quota(1) as yes')).rows[0].yes,false);ok('Quota IA réservé aux inscrits et limité par jour');
await role('authenticated',admin,'admin@example.org');await db.query('select public.academy_set_enrollment($1,$2)',[enrollment,'revoked']);
await role('service_role');await db.query('select public.academy_sync_enrollment($1,$2,$3,$4)',['new-event-1','student@example.org','Autre nom',1]);
await role('authenticated',student,'student@example.org');assert.equal((await db.query('select public.academy_has_access(1) as yes')).rows[0].yes,false);assert.equal((await db.query("select * from storage.objects where name='n1/manuel.pdf'")).rows.length,0);ok('Révocation effective et jamais annulée par une nouvelle soumission du formulaire');
console.log(`${count} scénarios PostgreSQL/RLS réussis (services Auth et Storage représentés localement).`);
await db.close();

// DOM integration: the real interface scripts run against simulated Auth/Storage data.
// UI_MODULE=/absolute/path/to/jsdom/lib/api.js COURSE_SOURCE=/path/to/private-content node tools/test-coherence-ui.mjs
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const {JSDOM}=await import(process.env.UI_MODULE||'jsdom');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'docs/exigences-pedagogiques.json')));
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor,user={id:'11111111-1111-4111-8111-111111111111'};
const source=process.env.COURSE_SOURCE||path.join(root,'private-content');
const tableData={academy_lessons:catalog.lessons,academy_requirements:catalog.requirements,academy_reading_pages:catalog.pages,academy_documents:catalog.documents,academy_work:[],academy_read_receipts:[]};
async function run(html,script,n,step=1,query=''){
 const dom=new JSDOM(fs.readFileSync(path.join(root,html),'utf8'),{url:`https://example.test/${html}?niveau=${n}&etape=${step}${query}`});const w=dom.window,calls=[];
 w.HTMLElement.prototype.scrollIntoView=()=>{};w.ACADEMY_CONFIG={tutorEnabled:false};
 const records=catalog.lessons.filter(l=>l.level===n&&l.step<step).map(l=>({user_id:user.id,level:n,step:l.step,done:true,requirements_version:2,notes:'Carnet test'}));
 function from(table){let rows=table==='academy_progress'?records:(tableData[table]||[]);const q={select(){return q;},eq(k,v){rows=rows.filter(r=>r[k]===v);return q;},single(){return Promise.resolve({data:rows[0],error:null});},then(f){return Promise.resolve({data:rows,error:null}).then(f);}};return q;}
 const db={from,rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};},storage:{from:()=>({download:async p=>{calls.push({path:p});return {data:new Blob([p]),error:null};}})}};
 const data=JSON.parse(fs.readFileSync(path.join(source,`n${n}/course.json`)));
 let i=0;class LocalURL extends URL{};LocalURL.createObjectURL=()=>`blob:test-${++i}`;LocalURL.revokeObjectURL=()=>{};
 const message=(id,text)=>w.document.getElementById(id).textContent=text;
 const body=fs.readFileSync(path.join(root,script),'utf8').replace(/^import .*\n/gm,'');
 await new AsyncFunction('window','document','location','URL','courseData','requireLevel','message','mountLearningShell','mountStepQuiz',body)(w,w.document,w.location,LocalURL,async()=>({db,user,course:data}),async()=>({db,user}),message,()=>{},async()=>{});
 await new Promise(resolve=>setImmediate(resolve));return {w,calls};
}
for(const l of catalog.lessons.filter(l=>fs.existsSync(path.join(source,`n${l.level}/course.json`)))){
 const {w,calls}=await run('cours/apprendre.html','cours/learning.js',l.level,l.step);
 assert.equal(w.document.getElementById('learning-content').hidden,false);
 assert.equal(w.document.getElementById('lesson-title').textContent,l.title);
 assert.equal(calls.find(c=>c.path?.endsWith('.webp')).path,`n${l.level}/pages/${String(l.first_page).padStart(3,'0')}.webp`);
 const pages=[...w.document.querySelectorAll('#manual-page option')].map(o=>Number(o.value));assert.deepEqual(pages,catalog.pages.filter(p=>p.level===l.level&&p.step===l.step&&p.required).map(p=>p.page));
 const forms=[...w.document.querySelectorAll('#mandatory-work form')],reqs=catalog.requirements.filter(r=>r.level===l.level&&r.step===l.step);assert.equal(forms.length,reqs.length);
 for(let i=0;i<forms.length;i++){
  forms[i].querySelector('button').click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(Number(w.document.getElementById('manual-page').value),reqs[i].page);
 }
 assert.equal(calls.some(c=>c.name==='academy_acknowledge_page'),false);w.close();
}
const levels=[1,2,3,4].filter(n=>fs.existsSync(path.join(source,`n${n}/course.json`)));
for(const n of levels){
 const {w,calls}=await run('cours/sommaire.html','cours/sommaire.js',n);assert.deepEqual([...w.document.querySelectorAll('#document-page option')].map(o=>+o.value),[2,3]);assert.equal(calls.some(c=>c.name),false);assert.ok(w.document.getElementById('begin-course').href.includes('etape=1'));w.close();
}
const tested=catalog.lessons.filter(l=>levels.includes(l.level)).length,links=catalog.requirements.filter(r=>levels.includes(r.level)).length;
console.log(`OK DOM : ${tested} étapes commencent sur le bon passage ; ${links} liens de référence ; sommaires séparés. Services simulés, sans vérification du rendu graphique.`);

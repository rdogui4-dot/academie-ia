const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/trainer-workspace.js'),'utf8').replace(/^import .*;\r?\n/gm,'');
const html=fs.readFileSync(path.join(root,'administration.html'),'utf8');
const wait=()=>new Promise(r=>setTimeout(r,30));
async function boot({admin=false,trainer=true,user=true,failReview=false}={}){
 const dom=new JSDOM(html,{url:'https://academy.test/administration.html',runScripts:'outside-only'}),w=dom.window,calls=[];
 const item={user_id:'learner',level:4,full_name:'<img src=x onerror=alert(1)>',iuid:'AIG-TEST-2026',specialty:'Autre spécialité : Agriculture',pending:1,revision:0,completed_steps:2,total_steps:10,updated_at:'2026-10-28'};
 const db={auth:{getUser:async()=>({data:{user:user?{id:'trainer'}:null}})},rpc:async(name,args)=>{calls.push([name,args]);switch(name){
 case 'academy_is_admin':return {data:admin};case 'academy_is_trainer':return {data:trainer};
 case 'academy_trainer_workspace':return {data:{stats:{learners:1,pending:1,dossiers:1,certified:0},items:[item],total:1,page:0,page_size:20}};
 case 'academy_trainer_dossier':return {data:{...item,specialty:{title:item.specialty},checks:{missing_steps:8,missing_pages:20,missing_work:2,unreviewed:3,ready_grade:false},notes:[],requirements:[{id:'n4-cas-autre',title:'Examen métier',instruction:'Produire une étude.',page:1,work:{answer:'Production <script>danger</script>',state:'submitted',feedback:'',updated_at:'2026-10-28T12:00:00Z'}}]}};
 case 'academy_review_work':return failReview?{error:{message:'Le travail a changé. Rechargez le dossier.'}}:{data:null};
 case 'academy_dossier_history':return {data:[]};default:throw Error('Unexpected RPC '+name);}}};
 w.client=async()=>db;w.showCorrectionGuide=async()=>{};w.showTrainerQuizzes=async()=>{throw Error('N4 must never load quizzes');};w.confirm=()=>true;
 await w.eval('(async()=>{'+source+'\n})()');return {w,dom,calls};
}
(async()=>{
 const {w,calls}=await boot();const d=w.document;
 assert.equal(d.getElementById('admin-content').hidden,false);assert.equal(d.getElementById('admin-navigation').hidden,true);
 assert.equal(d.querySelector('#work-dossiers h3').textContent,'<img src=x onerror=alert(1)>');assert.equal(d.querySelectorAll('#work-dossiers img').length,0);
 d.querySelector('#work-dossiers button').click();await wait();
 assert.equal(d.querySelector('[data-panel=dossier]').hidden,false);assert(!d.getElementById('tab-quizzes'));assert(d.getElementById('work-review').textContent.includes('Agriculture'));
 assert.equal(d.querySelectorAll('#dossier-works script').length,0);assert.equal(d.querySelectorAll('#dossier-works form').length,1);
 const form=d.querySelector('#dossier-works form');form.querySelector('textarea').value='Production vérifiée avec des preuves précises.';
 form.dispatchEvent(new w.SubmitEvent('submit',{bubbles:true,cancelable:true,submitter:form.querySelector('button[value=revision]')}));await wait();
 const review=calls.find(c=>c[0]==='academy_review_work');assert.equal(review[1].p_expected_updated,'2026-10-28T12:00:00Z');assert.equal(review[1].p_state,'revision');
 d.getElementById('dossier-filters').elements.search.value='Agriculture';d.getElementById('dossier-filters').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();assert(calls.some(c=>c[0]==='academy_trainer_workspace'&&c[1].p_search==='Agriculture'));
 const fail=await boot({failReview:true});fail.w.document.querySelector('#work-dossiers button').click();await wait();const f=fail.w.document.querySelector('#dossier-works form');f.querySelector('textarea').value='Une correction argumentée.';f.dispatchEvent(new fail.w.SubmitEvent('submit',{cancelable:true,submitter:f.querySelector('button')}));await wait();assert(f.textContent.includes('Le travail a changé'));assert(!f.querySelector('button').disabled);
 for(const opts of [{user:false},{trainer:false}]){const x=await boot(opts);assert(x.w.document.getElementById('admin-content').hidden);assert(!x.w.document.getElementById('access-help').hidden);assert(!x.calls.some(c=>c[0]==='academy_trainer_workspace'));x.dom.window.close();}
 domCleanup=[w,fail.w];for(const win of domCleanup)win.close();
 console.log('PASS: accès, filtrage, N4 sans QCM, rendu sécurisé, révision avec contrôle de version, erreur récupérable.');
})().catch(e=>{console.error(e);process.exitCode=1});

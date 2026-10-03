import {client,message} from './academy-api.js';
const $=id=>document.getElementById(id);
try{const db=await client();const {data:admin,error}=await db.rpc('academy_is_admin');if(error||!admin)throw Error('Connexion avec un compte formateur habilité requise.');$('admin-content').hidden=false;

 async function dossier(uid,level){
  const host=document.getElementById('work-review');host.replaceChildren();
  const [req,work,notes,check]=await Promise.all([
   db.from('academy_requirements').select('*').eq('level',level).order('step'),
   db.from('academy_work').select('*').eq('user_id',uid),
   db.from('academy_progress').select('*').eq('user_id',uid).eq('level',level).order('step'),
   db.rpc('academy_prerequisites',{p_level:level,p_user:uid})]);
  for(const r of [req,work,notes,check])if(r.error)throw r.error;
  const title=document.createElement('h3');title.textContent=`Dossier N${level} — ${uid}`;host.append(title);
  const summary=document.createElement('p');summary.textContent=`Étapes manquantes : ${check.data.missing_steps} ; pages non confirmées : ${check.data.missing_pages} ; travaux manquants ou à corriger : ${check.data.missing_work} ; travaux non acceptés : ${check.data.unreviewed}.`;host.append(summary);
  const notice=document.createElement('p');notice.textContent='Vérifiez la pertinence, les preuves et la compréhension. La longueur du texte et les déclarations de lecture ne suffisent pas à valider une compétence.';host.append(notice);
  for(const p of notes.data){const d=document.createElement('details'),t=document.createElement('summary'),text=document.createElement('p');t.textContent=`Carnet de l’étape ${p.step}`;text.textContent=p.notes;text.style.whiteSpace='pre-wrap';d.append(t,text);host.append(d);}
  const map=new Map(work.data.map(w=>[w.requirement_id,w]));
  for(const r of req.data){const w=map.get(r.id),box=document.createElement('details'),heading=document.createElement('summary'),instruction=document.createElement('p');heading.textContent=`Étape ${r.step} · ${r.kind} · ${r.title} — ${w?.state||'non remis'}`;instruction.textContent=r.instruction;box.append(heading,instruction);
   if(w){const answer=document.createElement('p'),label=document.createElement('label'),feedback=document.createElement('textarea'),status=document.createElement('p');answer.textContent=w.answer;answer.style.whiteSpace='pre-wrap';label.textContent='Retour au participant (10 caractères minimum)';feedback.value=w.feedback;feedback.rows=3;feedback.maxLength=5000;label.append(feedback);box.append(answer,label,status);
    for(const [state,text] of [['accepted','Accepter ce travail'],['revision','Demander une correction']]){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=async()=>{b.disabled=true;try{const {error}=await db.rpc('academy_review_work',{p_user:uid,p_requirement:r.id,p_state:state,p_feedback:feedback.value,p_expected_updated:w.updated_at});if(error)throw error;await dossier(uid,level);}catch(e){status.textContent=e.message;b.disabled=false;}};box.append(b);}
   }host.append(box);
  }
 }
 async function loadDossiers(){const {data:requirements,error:rErr}=await db.from('academy_requirements').select('id,level');if(rErr)throw rErr;const {data:works,error}=await db.from('academy_work').select('user_id,requirement_id');if(error)throw error;const levels=new Map(requirements.map(r=>[r.id,r.level])),pairs=new Map();for(const w of works)pairs.set(w.user_id+':'+levels.get(w.requirement_id),{uid:w.user_id,n:levels.get(w.requirement_id)});const h=document.getElementById('work-dossiers');h.replaceChildren();for(const {uid,n} of pairs.values()){const b=document.createElement('button');b.textContent=`Examiner N${n} · ${uid}`;b.onclick=()=>dossier(uid,n).catch(e=>message('admin-status',e.message));h.append(b);}}
 async function load(){const {data,error}=await db.from('academy_enrollments').select('*').order('created_at',{ascending:false});if(error)throw error;$('enrollment-list').replaceChildren(...data.map(e=>{const p=document.createElement('p');p.textContent=`${e.full_name} · ${e.email} · N${e.level} · ${e.status} `;for(const [state,label] of [['active','Valider'],['revoked','Suspendre']]){const b=document.createElement('button');b.textContent=label;b.onclick=async()=>{b.disabled=true;const {error}=await db.rpc('academy_set_enrollment',{p_id:e.id,p_status:state});if(error)message('admin-status',error.message);else await load();b.disabled=false;};p.append(b);}return p;}));
 const {data:projects,error:pError}=await db.from('academy_projects').select('*');if(pError)throw pError;$('project-list').replaceChildren(...projects.map(p=>{const a=document.createElement('article');const h=document.createElement('h3');h.textContent=`N${p.level} · apprenant ${p.user_id}`;const text=document.createElement('p');text.textContent=p.submission;a.append(h,text);return a;}));}
 await load();await loadDossiers();message('admin-status','Espace formateur ouvert. Les décisions sont journalisées.');
 $('grade-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.submitter;b.disabled=true;try{const {data,error}=await db.rpc('academy_grade',{p_user:f.get('user'),p_level:Number(f.get('level')),p_quiz:Number(f.get('quiz')),p_project:Number(f.get('project')),p_feedback:f.get('feedback')});if(error)throw error;message('admin-status',data?'Résultats enregistrés et certificat délivré.':'Résultats enregistrés. Les seuils ne permettent pas de délivrer un certificat.');}catch(e){message('admin-status',e.message);}finally{b.disabled=false;}};
}catch(e){message('admin-status',e.message);}

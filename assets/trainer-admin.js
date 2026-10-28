import {client} from './academy-api.js';
const status=document.getElementById('admin-status');
try{const db=await client();const {data:admin,error}=await db.rpc('academy_is_admin');if(error)throw error;if(admin){
 const assignment=document.getElementById('assignment-form'),assignmentStatus=document.getElementById('assignment-status');
 async function directory(){
  const {data,error}=await db.rpc('academy_assignment_directory');if(error)throw error;
  const trainer=assignment.elements.trainer,learner=assignment.elements.learner,level=assignment.elements.level;
  function learners(){const n=Number(level.value),t=data.trainers.find(t=>t.id===trainer.value);learner.replaceChildren(new Option('Choisir un apprenant',''));
   for(const l of data.learners.filter(l=>l.level===n&&l.id!==trainer.value&&(!t||assignment.elements.active.value==='false'||(t.levels.includes(n)&&(n!==4||t.specialties.includes(l.specialty))))))learner.append(new Option(`${l.name} · ${l.iuid||'IUID en attente'}`,l.id));}
  trainer.replaceChildren(new Option('Choisir un formateur',''));for(const t of data.trainers)trainer.append(new Option(t.name,t.id));
  trainer.onchange=learners;level.onchange=learners;assignment.elements.active.onchange=learners;learners();
  if(!data.trainers.length)assignmentStatus.textContent='Aucun formateur habilité : examinez les candidatures ci-dessous.';
 }
 await directory();
 async function load(){const {data,error}=await db.from('academy_trainer_applications').select('*').order('submitted_at');if(error)throw error;const host=document.getElementById('trainer-applications');host.replaceChildren();
 for(const item of data){const article=document.createElement('article'),title=document.createElement('h3'),body=document.createElement('p'),feedback=document.createElement('textarea'),label=document.createElement('label');title.textContent=`${item.full_name} — ${{submitted:'À examiner',approved:'Habilité',needs_info:'Complément demandé',rejected:'Refusé',suspended:'Suspendu'}[item.state]||item.state}`;body.textContent=`Niveaux : ${item.levels.join(', ')}. Spécialités : ${item.specialties.join(', ')}. Expérience : ${item.experience}. Exemple : ${item.sample_url}. Disponibilité : ${item.availability}`;label.textContent='Motif de la décision (10 caractères minimum)';feedback.minLength=10;feedback.maxLength=2000;feedback.value=item.decision_feedback;label.append(feedback);article.append(title,body,label);
 for(const [state,caption] of [['approved','Habiliter'],['needs_info','Demander un complément'],['rejected','Refuser'],['suspended','Suspendre']]){const b=document.createElement('button');b.textContent=caption;b.onclick=async()=>{b.disabled=true;try{const {error}=await db.rpc('academy_decide_trainer',{p_user:item.user_id,p_state:state,p_feedback:feedback.value,p_expected_updated:item.updated_at});if(error)throw error;await load();await directory();status.textContent='Décision enregistrée.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};article.append(b);}host.append(article);}}
 await load();document.getElementById('assignment-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.submitter;b.disabled=true;try{const {error}=await db.rpc('academy_set_trainer_assignment',{p_trainer:f.get('trainer').trim(),p_learner:f.get('learner').trim(),p_level:Number(f.get('level')),p_active:f.get('active')==='true'});if(error)throw error;assignmentStatus.textContent='Affectation enregistrée.';status.textContent='Affectation enregistrée. Actualisez la vue d’ensemble pour mettre à jour les dossiers.';}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};
}}catch(e){status.textContent=e.message;}

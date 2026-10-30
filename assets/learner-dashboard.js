import {client,titles} from './academy-api.js';
import './learner-profile.js?v=20261028-n4';
const $=id=>document.getElementById(id),node=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
function link(text,url){const a=node('a',text);a.href=url;a.className='button';return a;}
try{
 const db=await client(),{data:{user},error}=await db.auth.getUser();if(error||!user){$('dashboard-login').hidden=false;throw Error('Connexion requise pour retrouver vos formations.');}
 const tables=[['academy_enrollments','level,status,specialty_code,specialty_other'],['academy_progress','level,step,done,requirements_version,updated_at'],['academy_lessons','level,step,title'],['academy_work','requirement_id,state,feedback,updated_at'],['academy_requirements','id,level,step,title'],['academy_certificates','level,id,revoked']];
 const results=await Promise.all(tables.map(([table,fields])=>{let q=db.from(table).select(fields);if(table==='academy_enrollments')q=q.eq('email',user.email.toLowerCase());if(['academy_progress','academy_work','academy_certificates'].includes(table))q=q.eq('user_id',user.id);return q;}));for(const r of results)if(r.error)throw r.error;
 const [enrollments,progress,lessons,works,requirements,certs]=results.map(r=>r.data),courseHost=$('learner-courses');
 for(const e of enrollments.sort((a,b)=>a.level-b.level)){
  const n=e.level,route=lessons.filter(l=>l.level===n).sort((a,b)=>a.step-b.step),done=new Set(progress.filter(p=>p.level===n&&p.done&&p.requirements_version===2).map(p=>p.step)),first=route.find(l=>!done.has(l.step))?.step||route.at(-1)?.step||1;
  let resume=first;try{const saved=JSON.parse(localStorage.getItem(`academy-resume:${user.id}:${n}`)||'null');if(saved?.step)resume=Math.max(1,Math.min(saved.step,first));}catch{}
  const card=node('article');card.className='learner-card';const badge=node('span',`NIVEAU ${n} · ${e.status==='active'?'ACTIF':'ACCÈS SUSPENDU'}`);badge.className='badge';card.append(badge,node('h2',titles[n]));
  if(n===4)card.append(node('p',e.specialty_code==='autre'?`Votre métier : ${e.specialty_other}`:'Examens pratiques et fil rouge selon votre spécialité.'));
  const bar=node('progress');bar.max=Math.max(1,route.length);bar.value=done.size;bar.setAttribute('aria-label',`Progression N${n}`);card.append(bar,node('p',`${done.size}/${route.length} étapes terminées`));
  if(e.status==='active'){const actions=node('div');actions.className='action-row';const start=link('Reprendre ma formation ',`cours/apprendre.html?niveau=${n}&etape=${resume}`);start.classList.add('primary');actions.append(start,link('Évaluations et résultats',`cours/evaluation.html?niveau=${n}`));card.append(node('p',`Prochaine étape à valider : ${route.find(l=>l.step===first)?.title||'consulter le parcours'}`),actions);if(certs.some(c=>c.level===n&&!c.revoked))card.append(link('Mon certificat',`cours/certificat.html?niveau=${n}`));}else card.append(node('p','Contactez l’Académie pour vérifier votre inscription. Vos travaux sont conservés.'));
  courseHost.append(card);
 }
 if(!enrollments.length)courseHost.append(node('p','Aucune inscription associée à cette adresse. Retrouvez le formulaire dans le catalogue des formations.'));
 const feedback=works.filter(w=>w.feedback).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
 for(const w of feedback.slice(0,20)){const r=requirements.find(r=>r.id===w.requirement_id);if(!r)continue;const c=node('article');c.append(node('h3',`N${r.level} · ${r.title}`),node('span',w.state==='revision'?'À reprendre':w.state==='accepted'?'Travail accepté':'Retour du formateur'),node('p',w.feedback),link('Ouvrir le travail',r.level===4||['cas','fil_rouge'].includes(r.kind)?`cours/evaluation.html?niveau=${r.level}`:`cours/apprendre.html?niveau=${r.level}&etape=${r.step}#mandatory-work`));$('feedback-list').append(c);}
 if(!feedback.length)$('feedback-list').append(node('p','Les retours de votre formateur apparaîtront ici après correction.'));
 $('dashboard-content').hidden=false;$('dashboard-status').textContent='Votre progression et vos remises sont enregistrées dans votre espace personnel.';$('learner-signout').hidden=false;$('learner-signout').onclick=async()=>{await db.auth.signOut();location.reload();};

}catch(e){$('dashboard-status').textContent=e.message;}

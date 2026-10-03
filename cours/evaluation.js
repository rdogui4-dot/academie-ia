import {requireLevel,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),n=Number(new URLSearchParams(location.search).get('niveau'))||1;
const rules={1:'QCM : 40 questions, minimum 28/40. Projet : minimum 42/60. Total : au moins 70/100.',2:'QCM : 30 questions, minimum 21/30. Projet : minimum 49/70. Total : au moins 70/100.',3:'QCM : 40 items, minimum 28/40, ramené à /30 pour le total. Projet : minimum 50/70. Total : au moins 70/100.',4:'QCM : 30 items, minimum 21/30. Projet : minimum 50/70. Total : au moins 70/100.'};
try{const {db,user}=await requireLevel(n);$('evaluation-content').hidden=false;$('rules').textContent=rules[n];$('back-course').href=`apprendre.html?niveau=${n}`;
 const {data:project,error:pError}=await db.from('academy_projects').select('submission').eq('user_id',user.id).eq('level',n).maybeSingle();if(pError)throw pError;if(project)$('submission').value=project.submission;
 $('project-form').onsubmit=async e=>{e.preventDefault();const {error}=await db.from('academy_projects').upsert({user_id:user.id,level:n,submission:$('submission').value,updated_at:new Date().toISOString()});message('evaluation-status',error?'Remise non enregistrée. Réessayez.':'Projet remis. Le formateur doit maintenant l’évaluer.');};
 const {data:a,error:aError}=await db.from('academy_assessments').select('*').eq('user_id',user.id).eq('level',n).maybeSingle();if(aError)throw aError;
 if(a)$('assessment').textContent=`QCM : ${a.quiz_score}/${[1,3].includes(n)?40:30} ; projet : ${a.project_score}/${n===1?60:70}. Retour du formateur : ${a.feedback}`;
 const {data:c,error:cError}=await db.from('academy_certificates').select('id,revoked').eq('user_id',user.id).eq('level',n).maybeSingle();if(cError)throw cError;if(c&&!c.revoked){$('certificate-link').hidden=false;$('certificate-link').href=`certificat.html?niveau=${n}`;}
 message('evaluation-status','Votre espace d’évaluation est ouvert.');
}catch(e){message('evaluation-status',e.message);}

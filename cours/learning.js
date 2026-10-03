import {courseData,downloadResource,enrollmentLink,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),level=Number(params.get('niveau'))||1;
const urls=[];window.addEventListener('pagehide',()=>urls.forEach(URL.revokeObjectURL));
try{
 const {db,user,course}=await courseData(level);
 const {data:progress,error}=await db.from('academy_progress').select('*').eq('user_id',user.id).eq('level',level);if(error)throw error;
 const records=new Map(progress.map(p=>[p.step,p]));
 const first=()=>{const i=course.lessons.findIndex((_,i)=>!records.get(i+1)?.done);return i<0?course.lessons.length-1:i;};
 let step=Math.max(0,Math.min((Number(params.get('etape'))||first()+1)-1,first(),course.lessons.length-1));
 const lesson=course.lessons[step],url=i=>`apprendre.html?niveau=${level}&etape=${i+1}`;
 $('learning-content').hidden=false;$('access-message').hidden=true;
 document.querySelector('.header-enroll').href=enrollmentLink(level);
 $('course-title').textContent=course.title;$('course-label').textContent=`Niveau ${level}`;$('course-duration').textContent=course.duration;
 $('step-label').textContent=`Étape ${step+1} sur ${course.lessons.length}`;$('lesson-title').textContent=lesson.title;$('page-range').textContent=`Manuel : pages ${lesson.start} à ${lesson.end}`;
 document.title=`N${level} · ${lesson.title} | Académie IA Générative`;
 const list=(id,values)=>$(id).replaceChildren(...values.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 list('lesson-objectives',lesson.objectives);list('review-prompts',lesson.review);$('exercise-prompt').textContent=lesson.exercise;$('deliverable').textContent=lesson.deliverable;
 $('learning-notes').value=records.get(step+1)?.notes||'';
 let oldNotes='';try{oldNotes=localStorage.getItem(`academy-2026-n${level}-notes-${step}`)||'';}catch{}
 if(oldNotes&&!$('learning-notes').value){$('import-notes').hidden=false;$('import-notes').onclick=()=>{$('learning-notes').value=oldNotes;$('import-notes').hidden=true;message('notes-status','Brouillon récupéré. Vérifiez qu’il vous appartient puis enregistrez-le.');};}
 async function save(done=records.get(step+1)?.done||false){const row={user_id:user.id,level,step:step+1,notes:$('learning-notes').value,done,updated_at:new Date().toISOString()};const {error}=await db.from('academy_progress').upsert(row);if(error)throw error;records.set(step+1,row);message('notes-status','Carnet enregistré dans votre espace personnel.');}
 $('save-notes').addEventListener('click',async()=>{try{await save();}catch{message('notes-status','Enregistrement impossible. Téléchargez votre carnet avant de quitter.');}});
 $('learning-notes').addEventListener('input',()=>message('notes-status','Modifications non enregistrées. Cliquez sur Enregistrer mon carnet.'));
 const done=()=>records.get(step+1)?.done||false;
 function refresh(){const count=course.lessons.filter((_,i)=>records.get(i+1)?.done).length;$('course-progress').textContent=`${count}/${course.lessons.length} étapes terminées`;$('course-progressbar').value=Math.round(count/course.lessons.length*100);$('lesson-list').replaceChildren(...course.lessons.map((l,i)=>{const a=document.createElement('a');a.href=url(i);a.textContent=`${records.get(i+1)?.done?'✓':i>first()?'🔒':'○'} ${i+1}. ${l.title}`;if(i===step)a.setAttribute('aria-current','step');a.setAttribute('aria-disabled',String(i>first()));a.addEventListener('click',e=>{if(i>first())e.preventDefault();});return a;}));$('complete-step').disabled=done();$('review-done').checked=done();$('next-step').hidden=step===course.lessons.length-1;$('next-step').setAttribute('aria-disabled',String(!done()));}
 refresh();$('previous-step').hidden=step===0;$('previous-step').href=url(Math.max(0,step-1));$('next-step').href=url(Math.min(course.lessons.length-1,step+1));$('evaluation-link').href=`evaluation.html?niveau=${level}`;
 $('complete-step').addEventListener('click',async()=>{if(!$('review-done').checked)return message('step-status','Confirmez la réalisation de l’activité.');try{await save(true);refresh();message('step-status','Étape enregistrée. La certification nécessite une évaluation distincte.');}catch{message('step-status','Validation non enregistrée. Réessayez.');}});
 $('next-step').addEventListener('click',e=>{if(!done()){e.preventDefault();message('step-status','Terminez cette étape pour continuer.');}});
 $('export-notes').addEventListener('click',()=>{const text=course.lessons.map((l,i)=>`${i+1}. ${l.title}\n${i===step?$('learning-notes').value:records.get(i+1)?.notes||''}`).join('\n\n');const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));urls.push(u);const a=document.createElement('a');a.href=u;a.download=`carnet-n${level}.txt`;a.click();});
 const slideUrl=`slides.html?niveau=${level}&etape=${step+1}`;$('open-slides').href=slideUrl;
 $('show-slides').addEventListener('click',()=>{const f=document.createElement('iframe');f.src=slideUrl;f.title=`Slides N${level}`;$('slides-reader').replaceChildren(f);});
 async function resource(name,container){try{const u=await downloadResource(level,name);urls.push(u);if(container){const f=document.createElement('iframe');f.src=u+`#page=${lesson.start}`;f.title='Manuel de formation';$(container).replaceChildren(f);}else{const a=document.createElement('a');a.href=u;a.download=name;a.click();}}catch(e){message('resource-status',e.message);}}
 $('show-pdf').addEventListener('click',()=>resource('manuel.pdf','reader'));
 $('open-pdf').addEventListener('click',()=>resource('manuel.pdf'));
 $('download-slides-pdf').addEventListener('click',()=>resource('slides.pdf'));
 $('download-slides-pptx').addEventListener('click',()=>resource('slides.pptx'));
 if(window.ACADEMY_CONFIG.tutorEnabled){$('tutor-form').hidden=false;message('tutor-status','Posez une question sur ce niveau. Vérifiez les sources proposées.');}
 else message('tutor-status','Le tuteur IA est en cours de configuration. Utilisez votre carnet et contactez votre formateur.');
 $('tutor-form').addEventListener('submit',async e=>{e.preventDefault();$('ask-tutor').disabled=true;try{const {data,error}=await db.functions.invoke('tutor',{body:{level,question:$('tutor-question').value,page:lesson.start}});if(error)throw error;if(data.error)throw Error(data.error);$('tutor-answer').textContent=data.answer;list('tutor-sources',(data.sources||[]).map(p=>`N${level}, page ${p}`));message('tutor-status','Réponse fournie. Vérifiez les passages cités.');}catch{message('tutor-status','Tuteur indisponible ou limite atteinte. Réessayez plus tard.');}finally{$('ask-tutor').disabled=false;}});
}catch(e){message('access-message',e.message);}

'use strict';
(() => {
 const $=id=>document.getElementById(id), params=new URLSearchParams(location.search);
 const course=window.ACADEMY_COURSES.find(c=>c.id===Number(params.get('niveau')))||window.ACADEMY_COURSES[0];
 const prefix=`academy-2026-n${course.id}-`,get=k=>{try{return localStorage.getItem(prefix+k)||'';}catch{return'';}},set=(k,v)=>{try{localStorage.setItem(prefix+k,v);return true;}catch{return false;}};
 const done=i=>get(`done-${i}`)==='true';
 const first=()=>{const i=course.lessons.findIndex((_,i)=>!done(i));return i<0?course.lessons.length-1:i;};
 const requested=Number(params.get('etape'));let step=Number.isInteger(requested)&&requested>=1&&requested<=course.lessons.length?requested-1:first();
 if(step>first())step=first();
 const lesson=course.lessons[step],url=i=>`apprendre.html?niveau=${course.id}&etape=${i+1}`;
 $('course-title').textContent=course.title;$('course-label').textContent=`Niveau ${course.id}`;$('course-duration').textContent=course.duration;
 document.title=`N${course.id} · ${lesson.title} | Académie IA Générative`;
 $('step-label').textContent=`Étape ${step+1} sur ${course.lessons.length}`;$('lesson-title').textContent=lesson.title;$('page-range').textContent=`Support original : pages ${lesson.start} à ${lesson.end}`;
 function list(id,values){$(id).replaceChildren(...values.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));}
 list('lesson-objectives',lesson.objectives);list('review-prompts',lesson.review);$('exercise-prompt').textContent=lesson.exercise;
 const pdf=`${course.pdf}#page=${lesson.start}`;$('open-pdf').href=pdf;
 function reader(src,title){const frame=document.createElement('iframe');frame.src=src;frame.title=title;frame.loading='lazy';frame.referrerPolicy='no-referrer';$('reader').replaceChildren(frame);}
 $('show-pdf').addEventListener('click',()=>reader(pdf,`Support N${course.id}, page ${lesson.start}`));
 const config=window.ACADEMY_INTEGRATION||{},canva=config.canvaEmbeds?.[course.id];
 if(canva){try{const u=new URL(canva);if(u.protocol==='https:'&&u.hostname==='www.canva.com'&&u.pathname.startsWith('/design/')){$('show-canva').hidden=false;$('show-canva').addEventListener('click',()=>reader(u.href,`Présentation Canva du niveau ${course.id}`));}}catch{}}
 $('learning-notes').value=get(`notes-${step}`);$('notes-status').textContent='Votre carnet reste sur cet appareil.';
 $('learning-notes').addEventListener('input',()=>{$('notes-status').textContent=set(`notes-${step}`,$('learning-notes').value)?'Brouillon enregistré.':'Stockage indisponible : téléchargez votre carnet avant de quitter.';});
 function refresh(){
  const count=course.lessons.filter((_,i)=>done(i)).length,p=Math.round(count/course.lessons.length*100);
  $('course-progress').textContent=`${count} / ${course.lessons.length} étapes validées · ${p} %`;$('course-progressbar').value=p;
  $('lesson-list').replaceChildren(...course.lessons.map((l,i)=>{const a=document.createElement('a');a.href=url(i);a.textContent=`${done(i)?'✓':i>first()?'🔒':'○'} ${i+1}. ${l.title}`;a.dataset.done=String(done(i));if(i===step)a.setAttribute('aria-current','step');a.setAttribute('aria-disabled',String(i>first()));a.addEventListener('click',e=>{if(i>first()){e.preventDefault();$('step-status').textContent='Validez les étapes précédentes pour continuer.';}});return a;}));
  $('complete-step').disabled=done(step);$('complete-step').textContent=done(step)?'✓ Étape validée':'Valider cette étape';$('review-done').checked=done(step);
  $('previous-step').hidden=step===0;$('previous-step').href=url(Math.max(0,step-1));$('next-step').href=url(Math.min(course.lessons.length-1,step+1));$('next-step').hidden=step===course.lessons.length-1;$('next-step').setAttribute('aria-disabled',String(!done(step)));
 }
 refresh();
 $('complete-step').addEventListener('click',()=>{if(!$('review-done').checked){$('step-status').textContent='Confirmez d’abord avoir réalisé la lecture et l’activité.';return;}if(!set(`done-${step}`,'true')){$('step-status').textContent='Validation non enregistrée : le stockage du navigateur est indisponible.';return;}refresh();$('step-status').textContent=step===course.lessons.length-1?'Parcours de lecture terminé. Faites évaluer votre QCM et votre projet par votre formateur.':'Étape validée. Vous pouvez passer à la suivante.';});
 $('next-step').addEventListener('click',e=>{if(!done(step)){e.preventDefault();$('step-status').textContent='Validez cette étape pour continuer.';}});
 $('export-notes').addEventListener('click',()=>{const text=`Carnet N${course.id} — ${course.title}\n\n`+course.lessons.map((l,i)=>`${i+1}. ${l.title}\nPages ${l.start}-${l.end}\n${i===step?$('learning-notes').value:get(`notes-${i}`)}\n`).join('\n');const href=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=href;a.download=`carnet-niveau-${course.id}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);});
 let base;try{const u=new URL(config.tutorApiBase);if(u.protocol==='https:'||(u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)))base=u.href.replace(/\/$/,'');}catch{}
 if(!base){$('tutor-status').textContent='Le tuteur IA n’est pas encore activé. Vous pouvez suivre le cours et noter vos questions dans votre carnet.';return;}
 $('tutor-status').textContent='Posez une question sur le support. Le tuteur utilise les passages du niveau choisi et indique les pages consultées.';$('tutor-form').hidden=false;
 const history=[];
 $('tutor-form').addEventListener('submit',async event=>{
  event.preventDefault();const question=$('tutor-question').value.trim(),access=$('tutor-access').value.trim();if(!question||!access){$('tutor-status').textContent='Saisissez votre question et votre code d’accès.';return;}
  $('ask-tutor').disabled=true;$('tutor-status').textContent='Recherche dans votre cours…';
  try{const response=await fetch(`${base}/api/tutor`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${access}`},body:JSON.stringify({level:course.id,page:lesson.start,question,history:history.slice(-6)}),signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw Error(data.error||'Le service est indisponible. Réessayez plus tard.');$('tutor-answer').textContent=data.answer;$('tutor-sources').replaceChildren(...(data.sources||[]).map(s=>{const li=document.createElement('li'),a=document.createElement('a');a.textContent=`Passage consulté : N${course.id}, page ${s.page}`;a.href=`${course.pdf}#page=${Number(s.page)}`;a.target='_blank';a.rel='noopener';li.append(a);return li;}));history.push({role:'user',content:question},{role:'assistant',content:data.answer});$('tutor-status').textContent='Réponse pédagogique : vérifiez les passages cités. Le tuteur ne valide pas votre certification.';}
  catch(error){$('tutor-status').textContent=error.name==='TimeoutError'?'Le service met trop de temps à répondre. Réessayez.':error.message;}
  finally{$('ask-tutor').disabled=false;}
 });
})();

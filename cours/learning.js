import {courseData,enrollmentLink,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),level=Number(params.get('niveau'))||1;
let imageUrl;window.addEventListener('pagehide',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);});
try {
 const {db,user,course}=await courseData(level);
 async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;return data;}
 async function rows(table){const {data,error}=await db.from(table).select('*').eq('level',level);if(error)throw error;return data;}
 const [progress,lessons,requirements,receipts,pageRows]=await Promise.all([db.from('academy_progress').select('*').eq('user_id',user.id).eq('level',level).then(r=>{if(r.error)throw r.error;return r.data;}),rows('academy_lessons'),rows('academy_requirements'),db.from('academy_read_receipts').select('*').eq('user_id',user.id).eq('level',level).then(r=>{if(r.error)throw r.error;return r.data;}),rows('academy_reading_pages')]);
 const coursePages=pageRows.filter(p=>p.required);
 if(!coursePages.length)throw Error('La pagination du parcours doit être mise à jour par l’Académie.');
 if(!lessons.length)throw Error('Le nouveau suivi pédagogique doit être activé par l’Académie.');
 lessons.sort((a,b)=>a.step-b.step);
 const {data:works,error:wError}=await db.from('academy_work').select('*').eq('user_id',user.id);if(wError)throw wError;
 const records=new Map(progress.map(p=>[p.step,p]));const done=i=>records.get(i)?.done&&records.get(i)?.requirements_version===2;
 const first=lessons.find(l=>!done(l.step))?.step||lessons.length;
 const step=Math.max(1,Math.min(Number(params.get('etape'))||first,first,lessons.length));
 const meta=lessons.find(l=>l.step===step),lesson=course.lessons[step-1];
 const go=i=>`apprendre.html?niveau=${level}&etape=${i}`;
 $('learning-content').hidden=false;$('access-message').hidden=true;
 $('course-title').textContent=course.title;$('course-label').textContent=`Niveau ${level}`;$('course-duration').textContent=course.duration;
 $('step-label').textContent=`Étape ${step} sur ${lessons.length}`;$('lesson-title').textContent=meta.title;$('page-range').textContent=`Lecture obligatoire : pages ${meta.first_page} à ${meta.last_page} du manuel. Présentation et sommaire consultables séparément.`;
 const list=(id,values)=>$(id).replaceChildren(...values.map(t=>{const li=document.createElement('li');li.textContent=t;return li;}));
 list('lesson-objectives',meta.objectives||lesson.objectives);list('review-prompts',[`Ai-je démontré l’objectif suivant : ${(meta.objectives||lesson.objectives)[0]} ?`,...lesson.review.slice(1)]);
 $('exercise-prompt').textContent='Consignez votre compréhension, vos essais, les difficultés et les vérifications effectuées. Votre carnet est obligatoire et consultable par le formateur pour l’évaluation.';
 $('deliverable').textContent='Au moins 80 caractères utiles par étape. La longueur seule ne prouve pas la qualité du travail.';
 $('learning-notes').value=records.get(step)?.notes||'';
 if(progress.some(p=>p.done&&p.requirements_version!==2))message('notes-status','Votre ancien carnet est conservé. Les nouvelles obligations restent à compléter ; les anciennes cases cochées ne constituent pas des preuves de remise.');
 $('save-notes').onclick=async()=>{try{await rpc('academy_save_notes',{p_level:level,p_step:step,p_notes:$('learning-notes').value});message('notes-status','Carnet enregistré. Toute modification d’une étape terminée impose sa revalidation et celle des suivantes.');}catch(e){message('notes-status',e.message);}};
 $('learning-notes').oninput=()=>message('notes-status','Brouillon non enregistré.');
 const count=lessons.filter(l=>done(l.step)).length;$('course-progress').textContent=`${count}/${lessons.length} étapes complètes selon les nouvelles obligations`;$('course-progressbar').value=Math.round(count/lessons.length*100);
 $('lesson-list').replaceChildren(...lessons.map(l=>{const a=document.createElement('a');a.href=go(l.step);a.textContent=`${done(l.step)?'✓':l.step>first?'🔒':'○'} ${l.step}. ${l.title}`;if(l.step===step)a.setAttribute('aria-current','step');if(l.step>first)a.onclick=e=>e.preventDefault();return a;}));
 $('previous-step').hidden=step===1;$('previous-step').href=go(step-1);$('next-step').hidden=step===lessons.length;$('next-step').href=go(step+1);$('next-step').onclick=e=>{if(!done(step)){e.preventDefault();message('step-status','Complétez puis validez cette étape.');}};
 $('open-summary').href=`sommaire.html?niveau=${level}`;
 $('evaluation-link').href=`evaluation.html?niveau=${level}`;
 $('complete-step').onclick=async()=>{if(!$('review-done').checked)return message('step-status','Confirmez votre travail personnel.');$('complete-step').disabled=true;try{await rpc('academy_save_notes',{p_level:level,p_step:step,p_notes:$('learning-notes').value});await rpc('academy_complete_step',{p_level:level,p_step:step});location.href=go(step);}catch(e){message('step-status',e.message);$('complete-step').disabled=false;}};
 $('export-notes').onclick=()=>{const text=lessons.map((l,i)=>`${i+1}. ${l.title}\n${i+1===step?$('learning-notes').value:records.get(i+1)?.notes||''}`).join('\n\n');const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download=`mon-carnet-n${level}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const workMap=new Map(works.map(w=>[w.requirement_id,w]));
 for(const r of requirements.filter(r=>r.step===step)){
  const jump=document.createElement('button');jump.type='button';jump.textContent=r.source_kind==='supplement'?'Lire le contexte du chapitre':'Lire le passage de référence';jump.onclick=()=>{page=r.page;showPage();$('manual-image').scrollIntoView({behavior:'smooth',block:'center'});};
  const form=document.createElement('form'),h=document.createElement('h3'),p=document.createElement('p'),label=document.createElement('label'),input=document.createElement('textarea'),button=document.createElement('button'),status=document.createElement('p');
  h.textContent=`${r.kind.replace('_',' ')} — ${r.title}`;const span=r.last_page&&r.last_page!==r.page?`pages ${r.page} à ${r.last_page}`:`page ${r.page}`;
  const source=r.source_kind==='activity'?`Activité d’application du chapitre « ${r.source_title} » ; support : ${span} du manuel.`:r.source_kind==='supplement'?'Consigne complémentaire du parcours, distincte du texte du manuel.':`Consigne du manuel : ${span}.`;
  p.textContent=`${source} ${r.instruction}`;label.textContent='Votre remise obligatoire (120 caractères minimum)';input.required=true;input.minLength=120;input.maxLength=30000;input.rows=6;input.className='answer-box';input.value=workMap.get(r.id)?.answer||'';label.append(input);button.textContent='Enregistrer ma remise';button.className='nav-button';status.setAttribute('role','status');
  const w=workMap.get(r.id);status.textContent=w?`${{submitted:'Remis, en attente de correction',accepted:'Accepté par le formateur',revision:'À corriger'}[w.state]}. ${w.feedback}`:'Travail non remis.';
  form.className='mandatory-work';form.append(h,p,jump,label,button,status);form.onsubmit=async e=>{e.preventDefault();button.disabled=true;try{await rpc('academy_submit_work',{p_requirement:r.id,p_answer:input.value});status.textContent='Travail enregistré. Une modification impose une nouvelle correction et la revalidation de l’étape.';}catch(err){status.textContent=err.message;}finally{button.disabled=false;}};$('mandatory-work').append(form);
 }
 const stepPages=coursePages.filter(p=>p.step===step).map(p=>p.page).sort((a,b)=>a-b);
 if(!stepPages.length)throw Error('Aucune page de cours affectée à cette étape.');
 let page=stepPages[0],requestId=0;const read=new Set(receipts.map(r=>r.page));
 const picker=$('manual-page');for(const p of stepPages){const o=document.createElement('option');o.value=p;o.textContent=`Page ${p} du manuel`;picker.append(o);}
 async function showPage(){if(!stepPages.includes(page))return message('reading-status','Ce passage appartient à une autre étape.');const id=++requestId,p=page;$('confirm-page').disabled=true;$('page-read').checked=read.has(p);$('manual-image').hidden=true;$('manual-text').textContent='';picker.value=p;$('reading-status').textContent=`Chargement de la page ${p}…`;
  try {await rpc('academy_has_access',{p_level:level}).then(ok=>{if(!ok)throw Error('Accès suspendu.');});
   const [img,txt]=await Promise.all([db.storage.from('academy-private').download(`n${level}/pages/${String(p).padStart(3,'0')}.webp`),db.storage.from('academy-private').download(`n${level}/pages/${String(p).padStart(3,'0')}.txt`)]);
   if(id!==requestId)return;if(img.error||txt.error)throw Error('Page indisponible : les pages privées doivent être importées.');
   const text=await txt.data.text();if(id!==requestId)return;if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(img.data);
   $('manual-image').onload=()=>{if(id!==requestId)return;$('confirm-page').disabled=false;$('reading-status').textContent=`Page ${p} du manuel · ${stepPages.indexOf(p)+1}/${stepPages.length} pages de cette étape — ${read.has(p)?'lecture déjà déclarée':'lecture à confirmer'}`;};
   $('manual-image').onerror=()=>message('reading-status','Affichage impossible. Réessayez.');$('manual-image').src=imageUrl;$('manual-image').alt=`Page ${p} du manuel N${level}`;$('manual-image').hidden=false;$('manual-text').textContent=text;
  }catch(e){if(id===requestId)message('reading-status',e.message);}
 }
 picker.onchange=()=>{page=Number(picker.value);showPage();};$('page-prev').onclick=()=>{page=stepPages[Math.max(0,stepPages.indexOf(page)-1)];showPage();};$('page-next').onclick=()=>{page=stepPages[Math.min(stepPages.length-1,stepPages.indexOf(page)+1)];showPage();};
 $('confirm-page').onclick=async()=>{if(!$('page-read').checked)return message('reading-status','Cochez la déclaration après lecture.');const confirmedPage=page,confirmedRequest=requestId;$('confirm-page').disabled=true;try{await rpc('academy_acknowledge_page',{p_level:level,p_page:confirmedPage});read.add(confirmedPage);if(confirmedRequest!==requestId)return;message('reading-status',`Lecture déclarée pour la page ${confirmedPage}. Cette déclaration ne constitue pas une preuve de compréhension.`);}catch(e){message('reading-status',e.message);}finally{if(confirmedRequest===requestId)$('confirm-page').disabled=false;}};
 await showPage();
 const slideUrl=`slides.html?niveau=${level}&etape=${step}`;$('open-slides').href=slideUrl;$('show-slides').onclick=()=>{const f=document.createElement('iframe');f.src=slideUrl;f.title=`Diaporama N${level}`;$('slides-reader').replaceChildren(f);};
 if(window.ACADEMY_CONFIG.tutorEnabled){$('tutor-form').hidden=false;message('tutor-status','Posez une question sur ce niveau.');}else message('tutor-status','Tuteur en cours de configuration. Contactez votre formateur.');
 $('tutor-form').onsubmit=async e=>{e.preventDefault();$('ask-tutor').disabled=true;try{const {data,error}=await db.functions.invoke('tutor',{body:{level,question:$('tutor-question').value,page:meta.first_page}});if(error||data.error)throw error||Error(data.error);$('tutor-answer').textContent=data.answer;list('tutor-sources',(data.sources||[]).map(p=>`Page ${p}`));}catch(e){message('tutor-status','Tuteur indisponible.');}finally{$('ask-tutor').disabled=false;}};
}catch(e){$('access-message').hidden=false;message('access-message',e.message);}

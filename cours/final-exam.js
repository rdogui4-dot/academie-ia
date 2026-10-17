export async function mountFinalExam(db,level,host){
 host.replaceChildren();host.hidden=true;
 async function rpc(name,args){const {data,error}=await db.rpc(name,args);if(error)throw error;return data;}
 const state=await rpc('academy_exam_status',{p_level:level});if(!state.enabled)return;host.hidden=false;
 const title=document.createElement('h2'),info=document.createElement('p'),status=document.createElement('p');title.textContent='Examen final de connaissances';status.setAttribute('role','status');info.textContent=`${state.maximum/2} QCM à 2 points · minimum ${state.minimum}/${state.maximum}. Une tentative initiale ; rattrapage après remédiation autorisée. Le corrigé détaillé reste réservé à l’équipe pédagogique. Vos sélections ne sont enregistrées qu’à la soumission ; après rechargement, elles doivent être ressaisies.`;host.append(title,info,status);
 for(const a of state.attempts){const p=document.createElement('p');p.textContent=`Tentative ${a.number} : ${a.submitted_at?a.score+'/'+state.maximum:'en cours'}`;host.append(p);}
 if(state.best!==null&&state.best>=state.minimum){status.textContent='Examen réussi. Les productions pratiques doivent encore être évaluées par le formateur.';return;}
 if(!state.ready){status.textContent='Terminez les étapes et les quiz pour ouvrir cet examen.';return;}
 if(!state.open_id&&state.used>=state.limit){status.textContent='Contactez votre formateur pour une remédiation et une autorisation de rattrapage.';return;}
 const start=document.createElement('button');start.type='button';start.textContent=state.open_id?'Reprendre l’examen':'Commencer l’examen';host.append(start);
 start.onclick=async()=>{start.disabled=true;try{const attempt=await rpc('academy_start_exam',{p_level:level});const form=document.createElement('form');start.hidden=true;
 attempt.questions.forEach((q,i)=>{const field=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`${i+1}. ${q.prompt} — 2 points`;field.append(legend);const hint=document.createElement('p');hint.textContent='Sélectionnez toutes les bonnes réponses ; une sélection incomplète ou supplémentaire vaut zéro.';field.append(hint);q.options.forEach((o,j)=>{const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.name='q'+i;input.value=String(j);label.append(input,document.createTextNode(o));field.append(label);});form.append(field);});
 const submit=document.createElement('button');submit.textContent='Soumettre définitivement mes réponses';form.append(submit);host.append(form);
 form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{const data=new FormData(form),answers=attempt.questions.map((_,i)=>data.getAll('q'+i).map(Number));await rpc('academy_submit_exam',{p_attempt:attempt.id,p_answers:answers});await mountFinalExam(db,level,host);}catch(e){status.textContent=e.message;submit.disabled=false;}};
 }catch(e){status.textContent=e.message;start.disabled=false;}};
}

import {client} from './academy-api.js';
export async function mountProfile(host){
 const db=await client();const {data:{user}}=await db.auth.getUser();if(!user)return;
 const {data:profile,error}=await db.rpc('academy_ensure_profile');if(error)throw error;
 host.replaceChildren();const identity=document.createElement('p');identity.textContent=`IUID : ${profile.iuid}`;host.append(identity);
 const {data:enrollment,error:e}=await db.from('academy_enrollments').select('level,status,specialty_code,specialty_other').eq('level',4).eq('email',user.email.toLowerCase()).maybeSingle();if(e)throw e;if(!enrollment||enrollment.status!=='active')return;
 const {data:specialties,error:s}=await db.from('academy_specialties').select('code,title,brief').order('title');if(s)throw s;
 const label=document.createElement('label');label.textContent='Ma spécialité N4';const select=document.createElement('select');select.append(new Option('Choisir une spécialité',''));for(const item of specialties)select.append(new Option(item.title,item.code));select.value=enrollment.specialty_code||'';label.append(select);
 const otherLabel=document.createElement('label'),other=document.createElement('input');otherLabel.textContent='Autre spécialité : précisez votre métier';other.type='text';other.minLength=2;other.maxLength=120;other.value=enrollment.specialty_other||'';otherLabel.append(other);
 const brief=document.createElement('p'),status=document.createElement('p'),button=document.createElement('button');button.type='button';button.textContent='Enregistrer ma spécialité';status.setAttribute('role','status');
 const describe=()=>{otherLabel.hidden=select.value!=='autre';other.required=select.value==='autre';brief.textContent=specialties.find(s=>s.code===select.value)?.brief||'Choisissez la spécialité de votre fil rouge. Les cas communs restent obligatoires.';button.disabled=!select.value||(select.value==='autre'&&other.value.trim().length<2);};select.onchange=describe;other.oninput=describe;describe();
 button.onclick=async()=>{button.disabled=true;try{const {error}=await db.rpc('academy_choose_specialty_details',{p_code:select.value,p_other:select.value==='autre'?other.value.trim():null});if(error)throw error;status.textContent='Spécialité enregistrée. Elle sera reprise sur votre prochain certificat N4.';}catch(e){status.textContent=e.message;}finally{button.disabled=!select.value||(select.value==='autre'&&other.value.trim().length<2);}};host.append(label,otherLabel,brief,button,status);
}
const host=document.getElementById('learner-profile');if(host)mountProfile(host).catch(e=>{host.textContent=e.message;});

import {mountProfile} from './learner-profile.js';
import {client,enrollmentLink} from './academy-api.js';
const $=id=>document.getElementById(id),n=new URLSearchParams(location.search).get('niveau');
const allowedReturns=['comptabilite.html','administration.html'];
let returnTo=new URLSearchParams(location.search).get('next');
if(!allowedReturns.includes(returnTo))returnTo=null;
try {
 if(returnTo)localStorage.setItem('academy-login-return',JSON.stringify({page:returnTo,expires:Date.now()+3600000}));
 else {const saved=JSON.parse(localStorage.getItem('academy-login-return')||'null');if(saved?.expires>Date.now()&&allowedReturns.includes(saved.page))returnTo=saved.page;}
}catch{}
function callbackUrl(){const url=new URL('connexion.html',location.href);url.searchParams.set('niveau',$('enrollment-level').value);if(returnTo)url.searchParams.set('next',returnTo);return url.href;}
if(returnTo){document.querySelector('h1').textContent='Connexion à l’administration';document.querySelector('h1 + p').textContent='Connectez-vous avec votre adresse administrateur pour retrouver votre espace.';$('enrollment-level').closest('label').hidden=true;$('registration-link').hidden=true;}
if(['1','2','3','4'].includes(n))$('enrollment-level').value=n;
function link(){$('registration-link').href=enrollmentLink($('enrollment-level').value);}
link();$('enrollment-level').addEventListener('change',link);
$('login-form').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const db=await client();const {error}=await db.auth.signInWithOtp({email:$('email').value.trim(),options:{emailRedirectTo:callbackUrl()}});if(error)throw error;$('enrollment-status').textContent='Consultez votre e-mail pour vous connecter. Si un code vous est fourni, saisissez-le ci-dessous.';}catch(e){$('enrollment-status').textContent=e.message;}finally{b.disabled=false;}});
$('otp-form').addEventListener('submit',async e=>{e.preventDefault();try{const db=await client();const {error}=await db.auth.verifyOtp({email:$('email').value.trim(),token:$('otp').value.trim(),type:'email'});if(error)throw error;await showSession();}catch(e){$('enrollment-status').textContent=e.message;}});
async function showSession(){try{const db=await client();const {data:{user}}=await db.auth.getUser();if(!user)return;$('email').value=user.email;
const {data:isAdmin,error:adminError}=await db.rpc('academy_is_admin');
if(adminError)throw adminError;
if(isAdmin===true){try{localStorage.removeItem('academy-login-return');}catch{}location.replace(new URL(returnTo||'administration.html',location.href).href);return;}
if(returnTo){$('enrollment-status').textContent='Ce compte ne dispose pas des droits administrateur. Déconnectez-vous puis utilisez votre compte administrateur.';return;}
await mountProfile($('learner-profile'));const {data,error}=await db.from('academy_enrollments').select('level,status');if(error)throw error;$('enrollments').replaceChildren();for(const e of data){const p=document.createElement('p');p.textContent=`N${e.level} : ${e.status==='active'?'inscription validée':e.status==='pending'?'validation en attente':'accès suspendu'}. `;if(e.status==='active'){const a=document.createElement('a');a.href=`cours/apprendre.html?niveau=${e.level}`;a.textContent='Ouvrir mon parcours';p.append(a);}$('enrollments').append(p);}$('enrollment-status').textContent=data.length?'Vous êtes connecté.':'Aucune inscription liée à cette adresse. Complétez le formulaire Google.';}catch(e){$('enrollment-status').textContent=e.message;}}
$('logout').addEventListener('click',async()=>{const db=await client();await db.auth.signOut();location.reload();});
showSession();

client().then(db=>db.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN')setTimeout(()=>showSession(),0);})).catch(e=>{$('enrollment-status').textContent=e.message;});

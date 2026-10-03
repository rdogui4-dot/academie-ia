import {requireLevel,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),n=Number(new URLSearchParams(location.search).get('niveau'))||1;
let imageUrl,requestId=0;window.addEventListener('pagehide',()=>{if(imageUrl)URL.revokeObjectURL(imageUrl);});
try{
 const {db}=await requireLevel(n);const {data:d,error}=await db.from('academy_documents').select('*').eq('level',n).single();if(error)throw error;
 $('document-content').hidden=false;$('access-message').hidden=true;$('begin-course').href=`apprendre.html?niveau=${n}&etape=1`;$('overview-slides').href=`slides.html?niveau=${n}&presentation=1`;
 const picker=$('document-page');
 async function show(){const id=++requestId,p=Number(picker.value);$('document-image').hidden=true;message('document-status',`Chargement de la page ${p}…`);
  try{const [image,text]=await Promise.all([db.storage.from('academy-private').download(`n${n}/pages/${String(p).padStart(3,'0')}.webp`),db.storage.from('academy-private').download(`n${n}/pages/${String(p).padStart(3,'0')}.txt`)]);if(image.error||text.error)throw Error('Page indisponible.');if(id!==requestId)return;const t=await text.data.text();if(id!==requestId)return;
   if(imageUrl)URL.revokeObjectURL(imageUrl);imageUrl=URL.createObjectURL(image.data);$('document-image').src=imageUrl;$('document-image').alt=`Page ${p} du manuel N${n} — hors progression`;$('document-image').hidden=false;$('document-text').textContent=t;message('document-status',`Page ${p} du manuel — hors progression du cours.`);
  }catch(e){if(id===requestId)message('document-status',e.message);}
 }
 function section(){const pages=$('document-section').value==='summary'?d.summary_pages:d.presentation_pages;picker.replaceChildren(...pages.map(p=>{const o=document.createElement('option');o.value=p;o.textContent=`Page ${p}`;return o;}));show();}
 $('document-section').onchange=section;picker.onchange=show;section();
}catch(e){$('access-message').hidden=false;message('access-message',e.message);}

import {courseData,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),n=Number(params.get('niveau'))||1,step=Number(params.get('etape'))||1,overview=params.get('presentation')==='1';
try{
 const {db,deck}=await courseData(n);let positions,sources=new Map();
 if(overview){positions=Array.from({length:n===3?4:3},(_,i)=>i+1);}
 else{
  const [route,refs]=await Promise.all([db.from('academy_slide_routes').select('positions').eq('level',n).eq('step',step).single(),db.from('academy_slide_sources').select('*').eq('level',n)]);
  if(route.error||refs.error)throw route.error||refs.error;positions=route.data.positions;sources=new Map(refs.data.map(s=>[s.position,s]));
 }
 if(!positions.length||positions.some(p=>!deck.slides[p-1]))throw Error('Diaporama du chapitre indisponible.');
 const requested=Number(params.get('slide')),slides=positions.map(p=>({...deck.slides[p-1],originalPosition:p}));let i=Math.max(0,positions.indexOf(requested));
 $('presentation').hidden=false;$('controls').hidden=false;$('access-message').hidden=true;$('back-course').href=overview?`sommaire.html?niveau=${n}`:`apprendre.html?niveau=${n}&etape=${step}`;
 const option=(v,t)=>{const x=document.createElement('option');x.value=v;x.textContent=t;return x;};
 $('level').replaceChildren(option(n,`Niveau ${n}`));$('level').disabled=true;
 $('slide-picker').replaceChildren(...slides.map((s,k)=>option(k,`${k+1}. ${s.title}`)));
 function render(){const s=slides[i];for(const [id,key] of [['title','title'],['lead','lead'],['paragraph-a','a'],['paragraph-b','b'],['aside','aside']])$(id).textContent=s[key].replaceAll('\\n','\n');$('level-label').textContent=`Niveau ${n} — ${overview?'Présentation, hors progression':`Étape ${step}`}`;
  const ref=sources.get(s.originalPosition);$('source').textContent=overview?'Présentation générale, distincte du cours.':`Support du chapitre : manuel N${n}, ${ref.first_page===ref.last_page?`page ${ref.first_page}`:`pages ${ref.first_page} à ${ref.last_page}`}.`;
  $('position').textContent=`${i+1}/${slides.length}`;$('slide-picker').value=i;$('previous').disabled=i===0;$('next').disabled=i===slides.length-1;
 }
 function move(d){i=Math.max(0,Math.min(slides.length-1,i+d));render();}
 $('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('slide-picker').onchange=()=>{i=Number($('slide-picker').value);render();};
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();move(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();move(-1);}});
 $('fullscreen').hidden=!document.fullscreenEnabled;$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('fullscreen-status','Plein écran indisponible.');}};
 render();
}catch(e){$('access-message').hidden=false;message('access-message',e.message);}

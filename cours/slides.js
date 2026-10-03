import {courseData,message} from '../assets/academy-api.js';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search),n=Number(params.get('niveau'))||1,urls=[];
try{
 const {deck}=await courseData(n);let i=Math.max(0,Math.min(deck.slides.length-1,(Number(params.get('slide'))||deck.lessonStarts[(Number(params.get('etape'))||1)-1]||1)-1));
 $('presentation').hidden=false;$('controls').hidden=false;$('access-message').hidden=true;$('back-course').href=`apprendre.html?niveau=${n}`;
 const option=(v,t)=>{const x=document.createElement('option');x.value=v;x.textContent=t;return x;};
 $('level').replaceChildren(option(n,`Niveau ${n}`));$('level').disabled=true;
 $('slide-picker').replaceChildren(...deck.slides.map((s,k)=>option(k,`${k+1}. ${s.title}`)));
 function render(){const s=deck.slides[i];for(const [id,key] of [['title','title'],['lead','lead'],['paragraph-a','a'],['paragraph-b','b'],['aside','aside']])$(id).textContent=s[key].replaceAll('\\n','\n');$('level-label').textContent=`Niveau ${n}`;$('source').textContent=`Manuel N${n}, pages ${s.pages}`;$('position').textContent=`${i+1}/${deck.slides.length}`;$('slide-picker').value=i;$('previous').disabled=i===0;$('next').disabled=i===deck.slides.length-1;}
 function move(d){i=Math.max(0,Math.min(deck.slides.length-1,i+d));render();}
 $('previous').onclick=()=>move(-1);$('next').onclick=()=>move(1);$('slide-picker').onchange=()=>{i=Number($('slide-picker').value);render();};
 document.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();move(1);}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();move(-1);}});
 $('fullscreen').hidden=!document.fullscreenEnabled;$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{message('fullscreen-status','Plein écran indisponible.');}};
 render();
}catch(e){message('access-message',e.message);}
window.addEventListener('pagehide',()=>urls.forEach(URL.revokeObjectURL));

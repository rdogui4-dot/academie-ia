'use strict';
(() => {
 const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
 const decks=window.ACADEMY_SLIDES;
 let deck=decks.find(d=>d.level===Number(params.get('niveau')))||decks[0];
 const number=Number(params.get('slide'));
 let index=Number.isInteger(number)&&number>=1&&number<=deck.slides.length?number-1:0;
 const step=Number(params.get('etape'));
 let lesson=Number.isInteger(step)&&step>=1&&step<=deck.lessonStarts.length?step:null;
 const option=(value,label)=>{const o=document.createElement('option');o.value=String(value);o.textContent=label;return o;};
 $('level').replaceChildren(...decks.map(d=>option(d.level,`N${d.level} — ${d.slides[0].title}`)));
 function populate(){
  $('level').value=String(deck.level);
  $('slide-picker').replaceChildren(...deck.slides.map((s,i)=>option(i,`${i+1}. ${s.title}`)));
 }
 function render(focus=false){
  const s=deck.slides[index],exercise=s.title.startsWith('Atelier');
  for(const [id,key] of [['title','title'],['lead','lead'],['paragraph-a','a'],['paragraph-b','b'],['aside','aside']])$(id).textContent=s[key].replaceAll('\\n','\n');
  document.querySelector('.slide').className=`slide${index===0?' cover':''}${exercise?' exercise':''}`;
  $('level-label').textContent=exercise?`Niveau ${deck.level} · Mise en pratique`:`Niveau ${deck.level}`;
  $('aside-title').textContent=index===0?'Votre formation':exercise?'Livrable et critères':'Point de repère';
  $('source').textContent=`Manuel du niveau ${deck.level}, pages ${s.pages}. Cette présentation accompagne le cours détaillé.`;
  const page=Number(s.pages.split(/[–-]/)[0]);
  $('manual').href=`../ressources/niveau-${deck.level}.pdf#page=${page}`;
  $('pdf').href=`../ressources/slides/niveau-${deck.level}.pdf`;
  $('pptx').href=`../ressources/slides/niveau-${deck.level}.pptx`;
  $('back-course').href=`apprendre.html?niveau=${deck.level}${lesson?`&etape=${lesson}`:''}`;
  $('position').textContent=`${index+1} / ${deck.slides.length}`;
  $('slide-picker').value=String(index);$('previous').disabled=index===0;$('next').disabled=index===deck.slides.length-1;
  document.title=`N${deck.level} · ${s.title} | Académie IA Générative`;
  try{history.replaceState(null,'',`?niveau=${deck.level}&slide=${index+1}${lesson?`&etape=${lesson}`:''}`);}catch{}
  if(focus)$('title').focus({preventScroll:true});
 }
 function move(delta){const next=Math.max(0,Math.min(deck.slides.length-1,index+delta));if(next!==index){index=next;render(true);}}
 $('previous').addEventListener('click',()=>move(-1));$('next').addEventListener('click',()=>move(1));
 $('slide-picker').addEventListener('change',()=>{index=Number($('slide-picker').value);render(true);});
 $('level').addEventListener('change',()=>{deck=decks.find(d=>d.level===Number($('level').value));index=0;lesson=null;populate();render(true);});
 document.addEventListener('keydown',e=>{if(/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)||e.altKey||e.ctrlKey||e.metaKey)return;if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();move(1);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();move(-1);}});
 $('fullscreen').hidden=!document.fullscreenEnabled;
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();$('fullscreen-status').textContent='';}catch{$('fullscreen-status').textContent='Le plein écran est indisponible ici. Ouvrez le diaporama dans un nouvel onglet.';}});
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'Quitter le plein écran':'Plein écran';});
 populate();render();
})();

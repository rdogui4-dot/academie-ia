const fs=require('fs'),path=require('path'),assert=require('assert/strict');const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
for(const level of [1,2,3,4]){
 const dom=new JSDOM(fs.readFileSync(path.join(root,'cours/apprendre.html'),'utf8'),{url:'https://academy.test/cours/apprendre.html?niveau='+level,runScripts:'outside-only'}),w=dom.window;
 w.matchMedia=()=>({matches:false,addEventListener(){}});w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.eval(fs.readFileSync(path.join(root,'cours/learner-shell.js'),'utf8').replace('export function mountLearningShell','window.mountLearningShell=function'));
 w.mountLearningShell({course:{version:'test',updated_at:'2026-10-28',lessons:[{exercise:'Un essai comparé'}],updates:[{title:'Révision',text:'Source vérifiée',url:'https://ai.google.dev/'}]},level,step:1,user:{id:'user-test'},finalModule:{specialty:level===4?{title:'Autre spécialité : Agriculture'}:null}});
 const d=w.document;assert.equal(d.querySelectorAll('[role=tab]').length,4);assert.equal(d.querySelectorAll('[role=tabpanel]').length,4);assert(d.querySelector('#pane-course #manual-image'));assert(d.querySelector('#pane-practice #learning-notes'));assert(d.querySelector('#pane-resources #slides-reader'));assert(d.querySelector('#pane-tutor #tutor-form'));
 d.querySelector('[data-pane=practice]').click();assert(!d.getElementById('pane-practice').hidden);assert(d.getElementById('pane-course').hidden);assert.equal(d.querySelector('[data-pane=practice]').getAttribute('aria-selected'),'true');
 assert.equal(JSON.parse(w.localStorage.getItem('academy-resume:user-test:'+level)).step,1);assert(!w.localStorage.getItem('academy-resume:other-user:'+level));dom.window.close();
}
console.log('PASS: onglets N1–N4, lecteur/carnet/ressources/tuteur, reprise isolée par utilisateur.');

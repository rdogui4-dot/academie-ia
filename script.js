/* Stockage compatible avec les anciennes clés N1. Aucune donnée envoyée. */
const TOTAL_MODULES = 5;
const AcademyProgress = (() => {
    let available = true;
    function read(key) { try { return localStorage.getItem(key); } catch (_) { available = false; return null; } }
    function write(key,value) { try { localStorage.setItem(key,value); return true; } catch (_) { available = false; return false; } }
    const complete = n => read(`n1-module-${n}-complete`) === 'true';
    const firstIncomplete = () => Array.from({length:5},(_,i)=>i+1).find(n=>!complete(n)) ?? 6;
    return {read,write,complete,firstIncomplete,accessible:n=>n<=firstIncomplete(),available:()=>available};
})();
function getProgress() { return Array.from({length:5},(_,i)=>i+1).filter(AcademyProgress.complete).length*20; }
function coursePrefix() { return /\/(modules|formations)\/[^/]+\.html$/.test(window.location.pathname) ? '../' : ''; }
function updateModuleMenu() {
    document.querySelectorAll('.course-menu [data-module]').forEach(item=>{
        const n=Number(item.dataset.module),done=AcademyProgress.complete(n),open=AcademyProgress.accessible(n);
        item.classList.toggle('completed',done);item.classList.toggle('locked',!open);
        const link=item.querySelector('a'),state=item.querySelector('.module-state');
        if(state)state.textContent=done?'✓':open?'○':'🔒';
        if(link){link.setAttribute('aria-disabled',String(!open));link.title=!open?'Terminez les modules précédents pour continuer.':done?'Module terminé — relire':'Ouvrir le module';}
    });
    document.querySelectorAll('[data-quiz] a').forEach(a=>a.setAttribute('aria-disabled',String(getProgress()!==100)));
}
function updateProgress() {
    const p=getProgress(),prefix=coursePrefix();
    document.querySelectorAll('.progress-fill').forEach(e=>{e.style.width=`${p}%`;});
    document.querySelectorAll('.progress-bar').forEach(e=>e.setAttribute('aria-valuenow',String(p)));
    document.querySelectorAll('.progress-text').forEach(e=>{e.textContent=`Progression : ${p} % · ${p/20} / 5 modules terminés`;});
    const resume=document.getElementById('resume-course');
    if(resume){const n=AcademyProgress.firstIncomplete(),passed=AcademyProgress.read('n1-quiz-passed')==='true';resume.href=n<=5?`${prefix}modules/n1-module-${n}.html`:passed?`${prefix}formations/n1-terminee.html`:`${prefix}modules/quiz-n1.html`;resume.textContent=n<=5?`${p?'Reprendre':'Commencer'} le module ${n} →`:passed?'Voir mon résultat et mon certificat →':'Passer le quiz final →';}
    updateModuleMenu();
    document.querySelectorAll('[data-complete]').forEach(b=>{const done=AcademyProgress.complete(Number(b.dataset.complete));b.disabled=done;b.textContent=done?'✓ Module terminé':'Marquer le module comme terminé';});
    const module=document.querySelector('[data-current-module]');
    if(module)document.querySelector('[data-next]')?.setAttribute('aria-disabled',String(!AcademyProgress.complete(Number(module.dataset.currentModule))));
}
function completeModule(n) {
    if(!Number.isInteger(n)||n<1||n>5||!AcademyProgress.accessible(n))return;
    const saved=AcademyProgress.write(`n1-module-${n}-complete`,'true');updateProgress();
    const status=document.getElementById('completion-status');
    if(status)status.textContent=saved?`Module ${n} terminé. Vous pouvez continuer ${n===5?'vers le quiz final':'vers le module suivant'}.`:'Validation non enregistrée : autorisez le stockage dans votre navigateur puis réessayez.';
}
function checkModuleAccess() {
    const path=window.location.pathname,match=path.match(/n1-module-(\d+)\.html$/),first=AcademyProgress.firstIncomplete();
    if((match&&!AcademyProgress.accessible(Number(match[1])))||(path.endsWith('quiz-n1.html')&&first<=5)){window.location.replace(`n1-module-${first}.html`);return false;}return true;
}
document.addEventListener('DOMContentLoaded',()=>{
    if(!checkModuleAccess())return;updateProgress();
    document.querySelectorAll('[data-complete]').forEach(b=>b.addEventListener('click',()=>completeModule(Number(b.dataset.complete))));
    document.querySelectorAll('.course-menu a,[data-next]').forEach(link=>link.addEventListener('click',event=>{if(link.getAttribute('aria-disabled')==='true'){event.preventDefault();const s=document.getElementById('completion-status')||document.querySelector('.progress-text');if(s)s.textContent='Terminez et validez les modules précédents pour continuer.';}}));
    const module=document.querySelector('[data-current-module]'),answer=document.getElementById('module-answer'),status=document.getElementById('answer-status');
    if(module&&answer){const key=`n1-module-${module.dataset.currentModule}-answer`;answer.value=AcademyProgress.read(key)||'';answer.addEventListener('input',()=>{status.textContent=AcademyProgress.write(key,answer.value)?'Brouillon enregistré dans ce navigateur.':'Brouillon non enregistré : stockage indisponible. Copiez votre réponse avant de quitter cette page.';});}
    if(!AcademyProgress.available()){const note=document.querySelector('.storage-note');if(note){note.classList.add('storage-warning');note.textContent='Stockage local indisponible : progression et réponses ne pourront pas être conservées. Autorisez le stockage pour suivre le parcours.';}}
});
window.addEventListener('storage',updateProgress);

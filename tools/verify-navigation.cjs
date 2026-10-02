const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path');
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'script.js'),'utf8');
const completed=n=>Object.fromEntries(Array.from({length:n},(_,i)=>[`n1-module-${i+1}-complete`,'true']));
function run(url,storage={},blocked=false){
 const events={},elements={};
 for(const id of ['resume-course','completion-status','answer-status'])elements[id]={textContent:'',style:{},setAttribute(){}};
 const location={pathname:url,replace(target){this.redirect=target;}};
 const context=vm.createContext({localStorage:{getItem(k){if(blocked)throw Error('blocked');return storage[k]??null;},setItem(k,v){if(blocked)throw Error('blocked');storage[k]=v;}},window:{location,addEventListener(){}},document:{querySelector(){return null;},querySelectorAll(){return[];},getElementById:id=>elements[id]||null,addEventListener:(event,fn)=>{events[event]=fn;}}});
 vm.runInContext(source,context);events.DOMContentLoaded();return {context,location,storage,elements};
}
let count=0;function test(name,fn){fn();count++;console.log('OK',name);}
test('Nouveau visiteur : module 1',()=>{let r=run('/academie-ia/formations.html');assert.equal(r.elements['resume-course'].href,'modules/n1-module-1.html');});
test('Ancienne progression conservée : reprise module 3',()=>{let r=run('/academie-ia/formations.html',completed(2));assert.equal(r.elements['resume-course'].href,'modules/n1-module-3.html');assert.equal(vm.runInContext('getProgress()',r.context),40);});
test('Accès direct module 5 refusé sans prérequis',()=>{let r=run('/academie-ia/modules/n1-module-5.html',completed(2));assert.equal(r.location.redirect,'n1-module-3.html');});
test('Trou dans la progression : premier module manquant',()=>{let r=run('/academie-ia/modules/n1-module-5.html',{'n1-module-4-complete':'true'});assert.equal(r.location.redirect,'n1-module-1.html');});
test('Modules terminés consultables',()=>{let r=run('/academie-ia/modules/n1-module-2.html',completed(4));assert.equal(r.location.redirect,undefined);});
test('Validation et reprise : passage de 0 à 20 %',()=>{let r=run('/academie-ia/modules/n1-module-1.html');vm.runInContext('completeModule(1)',r.context);assert.equal(r.storage['n1-module-1-complete'],'true');assert.equal(vm.runInContext('getProgress()',r.context),20);assert.equal(run('/academie-ia/formations.html',r.storage).elements['resume-course'].href,'modules/n1-module-2.html');});
test('Validation hors ordre refusée',()=>{let r=run('/academie-ia/modules/n1-module-1.html');vm.runInContext('completeModule(5)',r.context);assert.equal(r.storage['n1-module-5-complete'],undefined);});
test('Quiz bloqué après quatre modules',()=>assert.equal(run('/academie-ia/modules/quiz-n1.html',completed(4)).location.redirect,'n1-module-5.html'));
test('Quiz ouvert après cinq modules',()=>assert.equal(run('/academie-ia/modules/quiz-n1.html',completed(5)).location.redirect,undefined));
test('Reprise vers quiz puis résultat',()=>{assert.equal(run('/academie-ia/formations.html',completed(5)).elements['resume-course'].href,'modules/quiz-n1.html');assert.equal(run('/academie-ia/formations.html',{...completed(5),'n1-quiz-passed':'true'}).elements['resume-course'].href,'formations/n1-terminee.html');});
test('Stockage indisponible : aucune fausse validation',()=>{let r=run('/academie-ia/modules/n1-module-1.html',{},true);vm.runInContext('completeModule(1)',r.context);assert.equal(vm.runInContext('getProgress()',r.context),0);assert.match(r.elements['completion-status'].textContent,/non enregistrée/);});
test('Brouillon relu à l’identique',()=>{let r=run('/academie-ia/modules/n1-module-1.html');vm.runInContext("AcademyProgress.write('n1-module-1-answer', 'Mon objectif : écrire mieux.')",r.context);assert.equal(vm.runInContext("AcademyProgress.read('n1-module-1-answer')",r.context),'Mon objectif : écrire mieux.');});
for(const folder of ['.','assets','apps-script','modules','formations'])for(const file of fs.readdirSync(path.join(root,folder))){const p=path.join(root,folder,file);if(file.endsWith('.js'))new vm.Script(fs.readFileSync(p,'utf8'),{filename:p});if(file.endsWith('.html'))for(const m of fs.readFileSync(p,'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/\bsrc\s*=/.test(m[1]))new vm.Script(m[2],{filename:p});}
console.log(`${count} scénarios réussis ; syntaxe JavaScript valide.`);

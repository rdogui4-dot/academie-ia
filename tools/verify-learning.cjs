const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),page=fs.readFileSync(path.join(root,'cours/apprendre.html'),'utf8');
const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
class Element{constructor(){this.events={};this.attrs={};this.children=[];this.value='';this.checked=false;this.hidden=false;}addEventListener(name,fn){this.events[name]=fn;}setAttribute(k,v){this.attrs[k]=v;}replaceChildren(...nodes){this.children=nodes;}append(node){this.children.push(node);}dataset={};}
function setup(level,step=1,storage={},unavailable=false){
 const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
 const context=vm.createContext({window:{},location:{search:`?niveau=${level}&etape=${step}`},URL,URLSearchParams,document:{getElementById:id=>{assert.ok(elements[id],id);return elements[id];},createElement:()=>new Element()},localStorage:{getItem(k){if(unavailable)throw Error('blocked');return storage[k]||null;},setItem(k,v){if(unavailable)throw Error('blocked');storage[k]=v;}},Blob,setTimeout});
 for(const file of ['programmes.js','integration.js','learning.js'])vm.runInContext(fs.readFileSync(path.join(root,'cours',file),'utf8'),context);
 return {elements,context,storage};
}
let scenarios=0;function test(name,fn){fn();scenarios++;console.log('OK',name);}
test('Les quatre niveaux ont des pages sources valides',()=>{let r=setup(1);let total=0;for(const c of r.context.window.ACADEMY_COURSES){total+=c.lessons.length;assert.ok(fs.existsSync(path.join(root,'cours',c.pdf)));for(const l of c.lessons){assert.ok(l.start>=1&&l.end<=c.pages&&l.start<=l.end);}}assert.equal(total,41);});
test('Les quatre niveaux se chargent et le tuteur reste inactif',()=>{for(let n=1;n<=4;n++){let r=setup(n);assert.equal(r.elements['course-label'].textContent,`Niveau ${n}`);assert.match(r.elements['open-pdf'].href,new RegExp(`niveau-${n}\\.pdf#page=`));assert.match(r.elements['tutor-status'].textContent,/pas encore activé/);}});
test('La validation nécessite une confirmation',()=>{let r=setup(1);r.elements['complete-step'].events.click();assert.equal(r.storage['academy-2026-n1-done-0'],undefined);r.elements['review-done'].checked=true;r.elements['complete-step'].events.click();assert.equal(r.storage['academy-2026-n1-done-0'],'true');assert.equal(r.elements['next-step'].attrs['aria-disabled'],'false');});
test('Pas de saut des prérequis',()=>assert.match(setup(3,8).elements['step-label'].textContent,/Étape 1 sur/));
test('Reprise et brouillon après rechargement',()=>{let r=setup(2);r.elements['learning-notes'].value='Mon essai';r.elements['learning-notes'].events.input();r.elements['review-done'].checked=true;r.elements['complete-step'].events.click();let next=setup(2,2,r.storage);assert.match(next.elements['step-label'].textContent,/Étape 2 sur/);assert.equal(setup(2,1,r.storage).elements['learning-notes'].value,'Mon essai');});
test('Les niveaux et la progression historique sont indépendants',()=>{const store={'n1-module-1-complete':'true','academy-2026-n2-notes-0':'Privé N2'};assert.equal(setup(1,1,store).elements['learning-notes'].value,'');assert.equal(store['n1-module-1-complete'],'true');});
test('Stockage bloqué : aucun succès fictif',()=>{let r=setup(4,1,{},true);r.elements['review-done'].checked=true;r.elements['complete-step'].events.click();assert.match(r.elements['step-status'].textContent,/non enregistrée/);assert.equal(r.elements['complete-step'].disabled,false);});
test('Inscription présente dans chaque en-tête',()=>{function walk(p){for(const f of fs.readdirSync(p,{withFileTypes:true})){if(f.name.startsWith('.'))continue;const name=path.join(p,f.name);if(f.isDirectory())walk(name);else if(name.endsWith('.html')){const text=fs.readFileSync(name,'utf8');assert.match(text,/<a class="header-enroll" href="https:\/\/forms.gle\/a2er9w8P3pEbZtwM7"/);}}}walk(root);});
test('Les quatre liens Canva pointent vers le bon niveau',()=>{
 const expected={1:'https://www.canva.com/d/bifpo5swV9ap-bC',2:'https://www.canva.com/d/Tkfl_sH8Il1A465',3:'https://www.canva.com/d/CFNMr1t1HlFD8gx',4:'https://www.canva.com/d/l-aK0lcE7XrTIif'};
 for(let n=1;n<=4;n++){const r=setup(n);assert.equal(r.elements['open-canva'].href,expected[n]);assert.equal(r.elements['open-canva'].hidden,false);assert.equal(r.elements['show-canva'].events.click,undefined);}
});
console.log(`${scenarios} scénarios LMS réussis.`);

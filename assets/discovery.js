'use strict';
document.getElementById('discovery-exercise').addEventListener('submit',event=>{
 event.preventDefault();
 const answer=new FormData(event.currentTarget).get('answer');
 const feedback=document.getElementById('discovery-feedback');
 const messages={a:'À revoir : A invente un lieu et un lien absents de la fiche. Demandez ces informations au lieu de les compléter vous-même.',b:'Bonne réponse : B conserve les faits et demande le lieu et le lien manquants. Avant diffusion, une personne doit encore vérifier et compléter ces informations.',c:'À revoir : C modifie la date et le public. Comparez chaque fait à la fiche : 12 novembre 2026, 10 h, débutants.'};
 feedback.textContent=messages[answer]||'Choisissez une réponse pour voir son explication.';
 feedback.className='public-callout';
});

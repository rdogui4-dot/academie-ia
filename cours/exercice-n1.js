import {requireLevel,message} from '../assets/academy-api.js';
const ARTICLE='n1/exercice/exercice-apprenant.html';
try{
 const {db}=await requireLevel(1);
 const {data,error}=await db.storage.from('academy-private').download(ARTICLE);
 if(error||!data)throw Error('Exercice indisponible.');
 const document2=new DOMParser().parseFromString(await data.text(),'text/html');
 document2.querySelectorAll('script,style,link').forEach(n=>n.remove());
 document.getElementById('exercice').replaceChildren(...document2.body.childNodes);
 document.title=document2.title||document.title;
}catch(erreur){
 message('exercise-status','Exercice indisponible. Contactez l’Académie.');
}

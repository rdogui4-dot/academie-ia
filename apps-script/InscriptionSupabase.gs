/** Ajouter ce fichier au projet Apps Script LIÉ AU FORMULAIRE, sans remplacer les autres fichiers.
 * Propriétés du script : SUPABASE_URL et ENROLLMENT_WEBHOOK_SECRET (secret >=32 caractères).
 * Le script n'envoie aucun e-mail. Les déclencheurs existants restent en place.
 */
const ACADEMY_LEVELS = [
 'N1 — Fondamentaux de l’IA générative',
 'N2 — Prompts structurés et productivité augmentée',
 'N3 — IA générative avancée : RAG, agents et fine-tuning',
 'N4 — IA générative appliquée par métier'
];
function academyConfigurerFormulaire() {
 const form=FormApp.getActiveForm();
 if(!form)throw new Error('Ouvrez Apps Script depuis le formulaire existant.');
 const props=PropertiesService.getScriptProperties();
 if(!props.getProperty('ACADEMY_FORM_BACKUP')) {
  const backup=DriveApp.getFileById(form.getId()).makeCopy('Sauvegarde avant niveaux N1-N4 — '+new Date().toISOString());
  props.setProperty('ACADEMY_FORM_BACKUP',backup.getId());
 }
 let question=form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).map(i=>i.asMultipleChoiceItem()).find(i=>/QUELLES FORMATIONS|^FORMATION CHOISIE$/.test(i.getTitle()));
 if(!question)throw new Error('Question de formation introuvable : aucun changement effectué.');
 // On conserve le titre historique pour ne pas casser les e.namedValues des automatisations existantes.
 question.setChoiceValues(ACADEMY_LEVELS).setRequired(true).setHelpText('Choisissez le parcours auquel vous vous inscrivez. Votre niveau actuel sera renseigné séparément.');
 props.setProperty('ACADEMY_LEVEL_ITEM_ID',String(question.getId()));
 const links={};
 ACADEMY_LEVELS.forEach((value,i)=>{links[i+1]=form.createResponse().withItemResponse(question.createResponse(value)).toPrefilledUrl();});
 props.setProperty('ACADEMY_PREFILLED_LINKS',JSON.stringify(links));
 console.log(JSON.stringify(links,null,2));
}
function academyInstallerSynchronisation() {
 const props=PropertiesService.getScriptProperties();
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(props.getProperty('SUPABASE_URL')||''))throw new Error('SUPABASE_URL absente ou invalide.');
 if((props.getProperty('ENROLLMENT_WEBHOOK_SECRET')||'').length<32)throw new Error('Secret absent ou trop court.');
 if(!props.getProperty('ACADEMY_LEVEL_ITEM_ID'))throw new Error('Exécutez academyConfigurerFormulaire.');
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='academyOnFormSubmit'))
  ScriptApp.newTrigger('academyOnFormSubmit').forForm(FormApp.getActiveForm()).onFormSubmit().create();
 if(!ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()==='academyReessayer'))
  ScriptApp.newTrigger('academyReessayer').timeBased().everyMinutes(10).create();
}
function academyOnFormSubmit(e) {
 if(!e||!e.response)throw new Error('Déclencheur lié au formulaire requis.');
 academyEnvoyer(e.response);
}
function academyEnvoyer(response) {
 const props=PropertiesService.getScriptProperties(),fields=response.getItemResponses();
 const find=pattern=>{const r=fields.find(r=>pattern.test(r.getItem().getTitle().normalize('NFC').replace(/\s+/g,' ').trim()));return r?String(r.getResponse()).replace(/\s+/g,' ').trim():'';};
 const answer=fields.find(r=>String(r.getItem().getId())===props.getProperty('ACADEMY_LEVEL_ITEM_ID'));
 const choice=answer?String(answer.getResponse()):'';
 const match=/^N([1-4])\s/.exec(choice);
 if(!match)throw new Error('Inscription historique sans niveau explicite : vérification manuelle requise.');
 const email=(find(/^Email$/i)||response.getRespondentEmail()||'').trim().toLowerCase();
 const name=find(/^Noms? et pr[ée]noms?$/i)||[find(/^Nom$/i),find(/^Pr[ée]noms?$/i)].filter(Boolean).join(' ');
 const event=FormApp.getActiveForm().getId()+':'+response.getId();
 const payload={event,email,name,level:Number(match[1])};
 const key='ACADEMY_RETRY_'+response.getId();
 // Seul l'identifiant est conservé pour réessai, aucune donnée personnelle dans les propriétés.
 props.setProperty(key,new Date().toISOString());
 const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
 const signature=Utilities.computeHmacSha256Signature(timestamp+'.'+body,props.getProperty('ENROLLMENT_WEBHOOK_SECRET'),Utilities.Charset.UTF_8).map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('');
 const result=UrlFetchApp.fetch(props.getProperty('SUPABASE_URL')+'/functions/v1/enrollment-sync',{
  method:'post',contentType:'application/json',payload:body,muteHttpExceptions:true,
  headers:{'x-academy-timestamp':timestamp,'x-academy-signature':signature}
 });
 if(result.getResponseCode()!==200){
  let diagnostic='DIAGNOSTIC_ABSENT';
  try {
   const data=JSON.parse(result.getContentText());
   if(typeof data.diagnostic==='string'&&/^[A-Z0-9_]{1,64}$/.test(data.diagnostic))diagnostic=data.diagnostic;
  }catch(ignore){}
  throw new Error('Synchronisation différée. HTTP '+result.getResponseCode()+' | '+diagnostic+'. Ne pas supprimer la réponse Google Forms.');
 }
 props.deleteProperty(key);
}
function academyReessayer() {
 const props=PropertiesService.getScriptProperties(),form=FormApp.getActiveForm();
 Object.keys(props.getProperties()).filter(k=>k.indexOf('ACADEMY_RETRY_')===0).slice(0,20).forEach(k=>{
  try{academyEnvoyer(form.getResponse(k.replace('ACADEMY_RETRY_','')));}catch(e){console.warn('Réessai différé : '+e.message);}
 });
}

'use strict';
const config=window.ACADEMY_CONFIG||{};
let singleton;
export const titles={1:'Fondamentaux de l’IA générative',2:'Prompts structurés et productivité augmentée',3:'IA générative avancée : RAG, agents et fine-tuning',4:'IA générative appliquée par métier'};
export function enrollmentLink(level){return config.formLinks?.[level]||config.formUrl;}
export async function client(){
 if(!config.supabaseUrl||!config.supabasePublishableKey)throw Error('La connexion apprenant est en cours de configuration. Utilisez le formulaire Google pour vous inscrire.');
 if(!singleton){const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.117.2');singleton=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
 return singleton;
}
export async function requireLevel(level){
 const db=await client();const {data:{user},error}=await db.auth.getUser();
 if(error||!user)throw Error('Connectez-vous avec l’adresse e-mail utilisée dans le formulaire Google.');
 const {data,error:accessError}=await db.rpc('academy_has_access',{p_level:level});
 if(accessError||!data)throw Error(`Votre inscription N${level} doit être validée par l’Académie avant l’ouverture du parcours.`);
 return {db,user};
}
export async function courseData(level){const {db,user}=await requireLevel(level);const {data,error}=await db.storage.from('academy-private').download(`n${level}/course.json`);if(error)throw Error('Support indisponible. Contactez l’Académie.');return {db,user,...JSON.parse(await data.text())};}
export async function downloadResource(level,name){const {db}=await requireLevel(level);const {data,error}=await db.storage.from('academy-private').download(`n${level}/${name}`);if(error)throw Error('Document indisponible.');return URL.createObjectURL(data);}
export function message(id,text){document.getElementById(id).textContent=text;}

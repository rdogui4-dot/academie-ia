import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {renderCertificate} from './render.ts';
Deno.serve(async req=>{
 const origin=Deno.env.get('SITE_ORIGIN')||'';
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const fail=(status:number,error:string)=>Response.json({error},{status,headers});
 if(!origin||req.headers.get('origin')!==origin)return fail(403,'Origine refusée');
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return fail(405,'Méthode refusée');
 try{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:req.headers.get('authorization')||''}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await db.auth.getUser();if(authError||!user)return fail(401,'Connexion requise');
  const raw=await req.text();if(raw.length>200)return fail(400,'Données invalides');
  let level:number;try{level=JSON.parse(raw).level;}catch{return fail(400,'Données invalides');}
  if(!Number.isInteger(level)||level<1||level>4)return fail(400,'Niveau invalide');
  const {data:c,error}=await db.rpc('academy_certificate_document',{p_level:level});if(error||!c)return fail(403,'Certificat valide et inscription active requis');
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');const site=Deno.env.get('CERTIFICATE_SITE_URL');
  if(!key||!site||new URL(site).origin!==origin||!site.endsWith('/'))return fail(503,'Certificats PDF non configurés');
  const server=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false,autoRefreshToken:false}}),bucket=server.storage.from('academy-certificates');
  const path=c.id+'/v'+c.document_version+'.pdf';
  let file:Blob;
  if(c.document_path){
   const result=await bucket.download(path);if(result.error||!result.data)return fail(503,'Archive indisponible');file=result.data;
  }else{
   const bytes=await renderCertificate(c,site);
   await bucket.upload(path,bytes,{contentType:'application/pdf',upsert:false});
   // Un concurrent a pu créer la même édition. Toujours relire les octets archivés.
   const result=await bucket.download(path);if(result.error||!result.data)return fail(503,'Archivage indisponible');file=result.data;
  }
  const bytes=await file.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(c.sha256&&c.sha256!==sha)return fail(503,'Intégrité de l’archive à vérifier');
  const archived=await server.rpc('academy_archive_certificate',{p_id:c.id,p_user:user.id,p_version:c.document_version,p_sha256:sha});if(archived.error)return fail(409,'Certificat modifié : rechargez la page');
  const current=await db.rpc('academy_certificate_document',{p_level:level});
  if(current.error||!current.data||current.data.id!==c.id||current.data.document_version!==c.document_version)return fail(409,'Certificat modifié : rechargez la page');
  return new Response(bytes,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="certificat-N'+level+'-v'+c.document_version+'.pdf"'}});
 }catch{return fail(503,'PDF indisponible. Réessayez ou contactez l’Académie.');}
});

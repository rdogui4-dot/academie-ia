import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
Deno.serve(async req => {
 if(req.method!=='POST')return new Response('Méthode refusée',{status:405});
 const secret=Deno.env.get('ENROLLMENT_WEBHOOK_SECRET');
 if(!secret||secret.length<32)return Response.json({diagnostic:'WEBHOOK_SECRET_MISSING_OR_SHORT'},{status:503});
 const body=await req.text();if(body.length>16000)return new Response('Trop long',{status:413});
 const timestamp=req.headers.get('x-academy-timestamp')||'';
 if(!/^\d+$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return new Response('Expiré',{status:401});
 const hex=req.headers.get('x-academy-signature')||'';
 if(!/^[a-f0-9]{64}$/.test(hex))return new Response('Signature invalide',{status:401});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const signature=Uint8Array.from(hex.match(/../g)!,s=>parseInt(s,16));
 if(!await crypto.subtle.verify('HMAC',key,signature,new TextEncoder().encode(timestamp+'.'+body)))return new Response('Signature invalide',{status:401});
 try {
  const d=JSON.parse(body);
  if(typeof d.event!=='string'||d.event.length>300||typeof d.email!=='string'||!/^\S+@\S+\.\S+$/.test(d.email)||typeof d.name!=='string'||!Number.isInteger(d.level)||d.level<1||d.level>4)throw Error();
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {error}=await db.rpc('academy_sync_enrollment',{p_event:d.event,p_email:d.email,p_name:d.name,p_level:d.level});
  if(error){
   // Ne pas journaliser le corps, l'adresse e-mail, les clés ou les détails SQL.
   const code=typeof error.code==='string'&&/^[A-Z0-9_]{1,32}$/.test(error.code)?error.code:'UNKNOWN';
   console.error('ACADEMY_SYNC_RPC_ERROR code='+code);
   return Response.json({diagnostic:'RPC_'+code},{status:503});
  }
  return Response.json({ok:true});
 }catch{return new Response('Données invalides',{status:400});}
});

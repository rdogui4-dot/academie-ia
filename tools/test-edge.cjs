// Tests locaux des handlers Edge, sans réseau ni envoi d'e-mail.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compiled=process.env.EDGE_BUILD;if(!compiled)throw Error('EDGE_BUILD doit indiquer le dossier des fonctions compilées par TypeScript.');
const root=path.resolve(__dirname,'..');
function handler(name,env,db){let fn;const js=fs.readFileSync(path.join(compiled,name+'.js'),'utf8').replace(/^import.*\n/,'').replace(/^export \{\};?$/m,'');new Function('createClient','Deno',js)(()=>db,{env:{get:k=>env[k]},serve:f=>fn=f});return fn;}
(async()=>{
 const secret='test-only-secret-'.repeat(4),env={ENROLLMENT_WEBHOOK_SECRET:secret,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test-server-key'};
 let call;const sync=handler('enrollment-sync',env,{rpc:async(name,args)=>{call={name,args};return {error:null};}});
 const body=JSON.stringify({event:'form:event1',email:'test@example.org',name:'Test User',level:2});
 const timestamp=String(Math.floor(Date.now()/1000));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+body))).toString('hex');
 const req=(sig=signature,stamp=timestamp,payload=body)=>new Request('https://example.supabase.co/functions/v1/enrollment-sync',{method:'POST',body:payload,headers:{'x-academy-timestamp':stamp,'x-academy-signature':sig}});
 assert.equal((await sync(req())).status,200);assert.equal(call.args.p_level,2);assert.equal(call.args.p_email,'test@example.org');
 assert.equal((await sync(req('0'.repeat(64)))).status,401);
 assert.equal((await sync(req(signature,String(Number(timestamp)-600)))).status,401);
 assert.equal((await sync(req(signature,timestamp,body.replace('level":2','level":4')))).status,401);
 assert.equal((await sync(new Request('https://example.test'))).status,405);
 console.log('OK Webhook : signature valide, signature fausse, rejeu expiré, corps altéré et méthode refusée');
 const tenv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SITE_ORIGIN:'https://site.test',OPENAI_API_KEY:'test-private-key',TUTOR_MODEL:'test-model'};
 let active=true,quota=true,logged=true,downloadPath='';
 const tdb={auth:{getUser:async()=>({data:{user:logged?{id:'user'}:null},error:null})},rpc:async name=>({data:name==='academy_has_access'?active:quota,error:null}),storage:{from:()=>({download:async p=>{downloadPath=p;return {data:new Blob([JSON.stringify([{page:4,text:'Un prompt est une consigne donnée au modèle.'}])]),error:null};}})}};
 const tutor=handler('tutor',tenv,tdb);
 const treq=(origin='https://site.test',data={level:1,question:'Explique le prompt'})=>new Request('https://example.supabase.co/functions/v1/tutor',{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-user','Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await tutor(treq('https://wrong.test'))).status,403);
 logged=false;assert.equal((await tutor(treq())).status,401);logged=true;
 active=false;assert.equal((await tutor(treq())).status,403);active=true;
 assert.equal((await tutor(treq('https://site.test',{level:5,question:'Prompt'}))).status,400);
 quota=false;assert.equal((await tutor(treq())).status,429);quota=true;
 const originalFetch=global.fetch;let sent;
 global.fetch=async(url,args)=>{assert.equal(url,'https://api.openai.com/v1/responses');sent=JSON.parse(args.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:'Explication sourcée [N1 p.4].'}]}]});};
 try{const response=await tutor(treq());assert.equal(response.status,200);const d=await response.json();assert.deepEqual(d.sources,[4]);assert.equal(downloadPath,'n1/corpus.json');assert.equal(sent.store,false);assert.equal(sent.model,'test-model');assert.ok(!sent.input.includes('test-private-key'));}finally{global.fetch=originalFetch;}
 console.log('OK Tuteur : origine, identité, niveau, paramètres, quota, corpus isolé et réponse simulée');
})().catch(e=>{console.error(e);process.exitCode=1;});

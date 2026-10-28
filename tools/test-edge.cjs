// Tests locaux des handlers Edge, sans réseau ni envoi d'e-mail.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const compiled=process.env.EDGE_BUILD;if(!compiled)throw Error('EDGE_BUILD doit indiquer le dossier des fonctions compilées par TypeScript.');
const root=path.resolve(__dirname,'..');
function handler(name,env,db){let fn;const js=fs.readFileSync(path.join(compiled,name+'.js'),'utf8').replace(/^import.*\n/gm,'').replace(/^export \{\};?$/m,'');new Function('createClient','Deno','renderCertificate',js)(typeof db==='function'?db:()=>db,{env:{get:k=>env[k]},serve:f=>fn=f},async()=>new Uint8Array([37,80,68,70]));return fn;}
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
 const signed=async payload=>{const raw=JSON.stringify(payload);const sig=Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(timestamp+'.'+raw))).toString('hex');return req(sig,timestamp,raw);};
 assert.equal((await sync(await signed({event:'f:n4',email:'a@b.org',name:'Test N4',level:4,specialty:'immobilier'}))).status,200);assert.equal(call.args.p_specialty,'immobilier');
 assert.equal((await sync(await signed({event:'f:n2',email:'a@b.org',name:'Test N2',level:2,specialty:'immobilier'}))).status,400);
 assert.equal((await sync(await signed({event:'f:n4',email:'a@b.org',name:'Test N4',level:4,specialty:'inconnue'}))).status,400);
 assert.equal((await sync(await signed({event:'f:other',email:'a@b.org',name:'Test N4',level:4,specialty:'autre',specialty_other:'Agriculture'}))).status,200);assert.equal(call.args.p_specialty,'autre');assert.equal(call.args.p_other,'Agriculture');
 assert.equal((await sync(await signed({event:'f:other-empty',email:'a@b.org',name:'Test N4',level:4,specialty:'autre'}))).status,400);
 for(const invalid of [null,{event:'',email:'a@b.org',name:'Test',level:1},{event:'test',email:'a@b.org',name:'X',level:1},{event:'test',email:'a@b.org',name:'X'.repeat(121),level:1},{event:'test',email:'x'.repeat(250)+'@b.org',name:'Test',level:1}]){
  const previousCall=call;assert.equal((await sync(await signed(invalid))).status,400);assert.equal(call,previousCall);
 }
 console.log('OK Webhook : signature valide, signature fausse, rejeu expiré, corps altéré et méthode refusée');
 const tenv={SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'test-server-key',SITE_ORIGIN:'https://site.test',GEMINI_API_KEY:'test-private-key',GEMINI_MODEL:'test-model'};
 let active=true,quota=true,logged=true,downloadPath='';
 const tdb={auth:{getUser:async()=>({data:{user:logged?{id:'user'}:null},error:null})},rpc:async name=>({data:name==='academy_has_access'?active:quota,error:null}),storage:{from:()=>({download:async p=>{downloadPath=p;return {data:new Blob([JSON.stringify([{page:4,text:'Un prompt est une consigne donnée au modèle.'}])]),error:null};}})}};
 const clients=[];const tutor=handler('tutor',tenv,(url,key,options)=>{clients.push({key,options});if(key==='test-server-key')return {storage:tdb.storage};return {auth:tdb.auth,rpc:tdb.rpc};});
 const treq=(origin='https://site.test',data={level:1,question:'Explique le prompt'})=>new Request('https://example.supabase.co/functions/v1/tutor',{method:'POST',headers:{Origin:origin,Authorization:'Bearer test-user','Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await tutor(treq('https://wrong.test'))).status,403);
 logged=false;assert.equal((await tutor(treq())).status,401);logged=true;
 active=false;assert.equal((await tutor(treq())).status,403);assert.ok(!clients.some(c=>c.key==='test-server-key'));active=true;
 assert.equal((await tutor(treq('https://site.test',{level:5,question:'Prompt'}))).status,400);
 assert.equal((await tutor(treq('https://site.test',{level:1,question:'Prompt',page:0}))).status,400);
 assert.equal((await tutor(treq('https://site.test',{level:1,question:'Prompt',page:501}))).status,400);
 quota=false;assert.equal((await tutor(treq())).status,429);quota=true;
 const originalFetch=global.fetch;let sent;
 global.fetch=async(url,args)=>{assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent');assert.equal(args.headers['x-goog-api-key'],'test-private-key');sent=JSON.parse(args.body);return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'INTERNAL'},{text:'Explication sourcée [N1 p.4].'}]}}]});};
 try{
  const response=await tutor(treq());assert.equal(response.status,200);const d=await response.json();assert.deepEqual(d.sources,[4]);assert.equal(d.answer,'Explication sourcée [N1 p.4].');assert.equal(downloadPath,'n1/corpus.json');assert.equal(sent.generationConfig.maxOutputTokens,1800);assert.ok(sent.systemInstruction.parts[0].text.includes('tuteur francophone'));assert.ok(clients.some(c=>c.key==='test-server-key'&&c.options.auth.persistSession===false));assert.ok(!JSON.stringify(sent).includes('test-private-key'));
  global.fetch=async()=>Response.json({error:{message:'secret upstream error'}},{status:429});assert.equal((await tutor(treq())).status,429);
  global.fetch=async()=>Response.json({promptFeedback:{blockReason:'SAFETY'}});assert.equal((await tutor(treq())).status,502);
  global.fetch=async()=>Response.json({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'incomplete'}]}}]});assert.equal((await tutor(treq())).status,502);
  delete tenv.GEMINI_API_KEY;assert.equal((await tutor(treq())).status,503);tenv.GEMINI_API_KEY='test-private-key';
 }finally{global.fetch=originalFetch;}
 console.log('OK Tuteur : origine, identité, niveau, paramètres, quota, corpus isolé et réponse simulée');
 let pdfLogged=true,pdfAllowed=true,changed=false,reads=0,uploads=0,stored=null,recorded=false,failArchive=false;
 const cert={id:'11111111-1111-4111-8111-111111111111',document_version:1,document_path:null,sha256:null};
 const pdfDb={auth:{getUser:async()=>({data:{user:pdfLogged?{id:'student'}:null}})},rpc:async()=>{reads++;return {data:pdfAllowed?{...cert,document_version:changed&&reads>1?2:1}:null,error:null};}};
 const pdfServer={storage:{from:bucket=>{assert.equal(bucket,'academy-certificates');return {upload:async(p,b,o)=>{uploads++;assert.equal(o.upsert,false);stored=new Blob([b],{type:'application/pdf'});return {error:null};},download:async()=>({data:stored,error:stored?null:{}})};}},rpc:async(name,args)=>{assert.equal(name,'academy_archive_certificate');assert.equal(args.p_user,'student');recorded=true;return {error:failArchive?{}:null};}};
 const pdfHandler=handler('certificate-pdf',{...tenv,CERTIFICATE_SITE_URL:'https://site.test/academie-ia/'},(url,key)=>key==='test-server-key'?pdfServer:pdfDb);
 const pdfReq=(origin='https://site.test',body={level:4})=>new Request('https://example.test',{method:'POST',headers:{Origin:origin,Authorization:'Bearer session'},body:JSON.stringify(body)});
 assert.equal((await pdfHandler(pdfReq('https://wrong.test'))).status,403);pdfLogged=false;assert.equal((await pdfHandler(pdfReq())).status,401);pdfLogged=true;
 pdfAllowed=false;assert.equal((await pdfHandler(pdfReq())).status,403);assert.equal(uploads,0);pdfAllowed=true;
 assert.equal((await pdfHandler(pdfReq('https://site.test',{level:5}))).status,400);
 reads=0;let pdfResponse=await pdfHandler(pdfReq());assert.equal(pdfResponse.status,200);assert.equal(pdfResponse.headers.get('content-type'),'application/pdf');assert.equal(pdfResponse.headers.get('cache-control'),'no-store');assert.equal(recorded,true);
 cert.document_path=cert.id+'/v1.pdf';cert.sha256=Buffer.from(await crypto.subtle.digest('SHA-256',await stored.arrayBuffer())).toString('hex');const beforeUploads=uploads;reads=0;assert.equal((await pdfHandler(pdfReq())).status,200);assert.equal(uploads,beforeUploads);
 cert.sha256='0'.repeat(64);assert.equal((await pdfHandler(pdfReq())).status,503);cert.sha256=null;
 reads=0;changed=true;assert.equal((await pdfHandler(pdfReq())).status,409);changed=false;
 failArchive=true;assert.equal((await pdfHandler(pdfReq())).status,409);
 console.log('OK PDF Edge : session, origine, niveau, archive privée sans écrasement, empreinte, relecture et conflit de réédition');
})().catch(e=>{console.error(e);process.exitCode=1;});

// Public storefront metadata only. The project publishable key is not a user credential.
const PUBLIC_KEY='sb_publishable_TgRft-8KH50SZI0dtqvXcA_MAzeIgwg';
const STORE='https://academie-ia-shop.mychariow.online/';
type Result={status:number,body:Record<string,unknown>};
let cached:{until:number,result:Result}|undefined;
let pending:Promise<Result>|undefined;
async function readStore():Promise<Result>{
 const key=Deno.env.get('CHARIOW_API_KEY');
 if(!key)return {status:503,body:{error:'Boutique non configurée'}};
 try{
  const response=await fetch('https://api.chariow.com/v1/store',{headers:{Authorization:'Bearer '+key,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(10000)});
  if(!response.ok)return {status:503,body:{error:'Boutique temporairement indisponible',code:response.status===401?'CHARIOW_AUTH':response.status===403?'CHARIOW_SCOPE':'CHARIOW_UNAVAILABLE'}};
  const {data}=await response.json();
  if(!data||typeof data.name!=='string'||typeof data.url!=='string')return {status:502,body:{error:'Réponse boutique invalide'}};
  const url=new URL(data.url);
  if(url.origin!==new URL(STORE).origin||url.username||url.password)return {status:502,body:{error:'Boutique différente de celle de l’Académie'}};
  if(data.status!=='active')return {status:503,body:{error:'Boutique actuellement indisponible'}};
  return {status:200,body:{name:data.name.slice(0,160),description:typeof data.description==='string'?data.description.slice(0,1000):'',url:STORE}};
 }catch{return {status:503,body:{error:'Boutique temporairement indisponible'}};}
}
Deno.serve(async req=>{
 const origin=Deno.env.get('SITE_ORIGIN')||'https://rdogui4-dot.github.io';
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'apikey, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const reply=(body:unknown,status:number)=>Response.json(body,{status,headers});
 if(req.headers.get('origin')&&req.headers.get('origin')!==origin)return reply({error:'Origine refusée'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='GET')return reply({error:'Méthode refusée'},405);
 if(req.headers.get('apikey')!==PUBLIC_KEY)return reply({error:'Clé publique du projet requise'},401);
 // Only allowlisted public fields leave this endpoint; no sales, clients or statistics.
 if(cached&&cached.until>Date.now())return reply(cached.result.body,cached.result.status);
 pending??=readStore();
 const result=await pending;pending=undefined;
 cached={until:Date.now()+(result.status===200?300000:30000),result};
 return reply(result.body,result.status);
});

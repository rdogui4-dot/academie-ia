(async()=>{
 const panel=document.getElementById('academy-shop'),status=document.getElementById('shop-status');
 if(!panel||!status)return;
 const config=window.ACADEMY_CONFIG;
 try{
  const response=await fetch(config.supabaseUrl+'/functions/v1/chariow-store',{headers:{apikey:config.supabasePublishableKey},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('unavailable');
  const store=await response.json();
  if(store.url!=='https://academie-ia-shop.mychariow.online/'||typeof store.name!=='string')throw Error('invalid');
  const name=document.getElementById('shop-name');
  if(name)name.textContent=store.name;
  const description=document.getElementById('shop-description');
  if(description&&store.description)description.textContent=store.description;
  status.textContent='Informations de la boutique actualisées.';
 }catch{status.textContent='Consultez les offres directement dans la boutique.';}
})();
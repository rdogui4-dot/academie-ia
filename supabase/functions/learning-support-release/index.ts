// Maintenance terminée : aucune lecture ni écriture de données.
Deno.serve(()=>new Response('Release completed',{status:410}));

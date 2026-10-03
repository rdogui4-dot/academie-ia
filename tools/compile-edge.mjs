import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const tools=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(tools),folder=path.join(tools,'.edge-check');
fs.mkdirSync(folder,{recursive:true});
for(const name of ['enrollment-sync','tutor']){
 const source=fs.readFileSync(path.join(root,'supabase/functions',name,'index.ts'),'utf8').replace(/npm:@supabase\/supabase-js@[0-9.]+/g,'@supabase/supabase-js');
 fs.writeFileSync(path.join(folder,name+'.ts'),source);
}
fs.writeFileSync(path.join(folder,'deno.d.ts'),'declare const Deno: {env:{get(key:string):string|undefined}; serve(handler:(req:Request)=>Response|Promise<Response>):void};');
fs.writeFileSync(path.join(folder,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'ESNext',moduleResolution:'Bundler',lib:['ES2022','DOM'],strict:true,skipLibCheck:true,outDir:'compiled'},include:['*.ts']}));
execFileSync(process.execPath,[path.join(tools,'node_modules/typescript/bin/tsc'),'-p',path.join(folder,'tsconfig.json')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(tools,'test-edge.cjs')],{stdio:'inherit',env:{...process.env,EDGE_BUILD:path.join(folder,'compiled')}});

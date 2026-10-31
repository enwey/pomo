import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),src=path.join(root,'src'),out=path.join(root,'public');
await mkdir(out,{recursive:true});await cp(src,out,{recursive:true});
const data=JSON.parse(await readFile(path.join(src,'data.json'),'utf8'));await writeFile(path.join(out,'data.js'),'globalThis.POMO_DATA='+JSON.stringify(data)+';\n');
async function files(dir,prefix=''){const result=[];for(const entry of await readdir(dir,{withFileTypes:true})){const name=prefix+'/'+entry.name;if(entry.name==='sw.js')continue;if(entry.isDirectory())result.push(...await files(path.join(dir,entry.name),name));else result.push(name)}return result}
const paths=await files(out),hash=createHash('sha256');for(const p of paths.sort())hash.update(await readFile(path.join(out,p)));
const version='pomo-'+hash.digest('hex').slice(0,12);
await writeFile(path.join(out,'sw.js'),`const VERSION=${JSON.stringify(version)},FILES=${JSON.stringify(['/',...paths])};
self.addEventListener('install',e=>e.waitUntil(caches.open(VERSION).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pomo-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',e=>{if(e.data==='ACTIVATE_UPDATE')self.skipWaiting()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(u.pathname.startsWith('/api/'))return;e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(VERSION).then(c=>c.put(e.request,copy))}return r}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('/'):Response.error()))))});
`);
console.log(`Built pomo web: ${paths.length} files, ${version}`);

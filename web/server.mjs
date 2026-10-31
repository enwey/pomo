import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveProviders,filterOffers,parseApple} from './catalog.mjs';
import {createUniversalSearch} from './universal-search.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),publicRoot=path.join(root,'public');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
const cache=new Map(),inflight=new Map();
async function fetchOffers(provider,fetcher=fetch){
 const key=provider.url,prior=cache.get(key);if(prior&&Date.now()-prior.at<300000)return prior.offers;
 if(inflight.has(key))return inflight.get(key);
 const job=(async()=>{const response=await fetcher(key,{signal:AbortSignal.timeout(9000),redirect:'error',headers:{'User-Agent':'pomo-web/0.1 (+public product price lookup)','Accept-Language':'zh-CN'}});if(!response.ok)throw Error('upstream');const html=await response.text();if(html.length>3000000)throw Error('too_large');const offers=parseApple(html,provider);if(!offers.length)throw Error('no_verified_price');cache.set(key,{at:Date.now(),offers});return offers})();
 inflight.set(key,job);try{return await job}finally{inflight.delete(key)}
}
export function createApp({fetcher=fetch,searcher,env=process.env,pageLoader}={}){
 const universal=searcher||createUniversalSearch({fetcher,env,pageLoader});
 return http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':types['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  try{
   if(!['GET','HEAD'].includes(req.method)){res.setHeader('Allow','GET, HEAD');return json(405,{error:'method_not_allowed'})}
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/health')return json(200,{ok:true,version:'0.2.0',search:'universal',searchProvider:env.TAVILY_API_KEY?'tavily':env.BRAVE_SEARCH_API_KEY?'brave':'public-search'});
   if(url.pathname==='/api/baseline'){
    const data=JSON.parse(await readFile(path.join(publicRoot,'data.json'),'utf8'));
    const duo=data.references.find(g=>g[0]==='iPhone Duo');
    if(duo)try{
     const rows=await fetchOffers({url:'https://www.apple.com.cn/shop/buy-iphone/iphone-duo'},fetcher);
     const quote=rows.filter(o=>/^iPhone Duo\b/i.test(o.title)).sort((a,b)=>a.price-b.price)[0];
     if(quote){duo[2]=quote.price;duo[3]=quote.spec;duo[5]={...duo[5],url:quote.url,checkedAt:quote.checkedAt}}
    }catch{}
    return json(200,data);
   }
   if(url.pathname==='/api/search'){
    const query=(url.searchParams.get('q')||'').trim(),city=(url.searchParams.get('city')||'').trim();
    if(query.length<1||query.length>120||city.length>40)return json(400,{error:'invalid_query',offers:[]});
    const genericJob=universal(query,city).catch(()=>({offers:[],sources:[],searchStatus:'unavailable',message:'搜索暂时不可用，可手动填写价格继续。'}));
    const officialJob=(async()=>{const selected=await resolveProviders(query,fetcher);const results=await Promise.allSettled(selected.map(p=>fetchOffers(p,fetcher)));return filterOffers(query,results.flatMap(r=>r.status==='fulfilled'?r.value:[]))})();
    const [general,official]=await Promise.all([genericJob,officialJob]);
    const rank={official:5,web_page:3,search_snippet:1},offers=[...new Map([...official,...general.offers].map(o=>[o.url+'|'+o.price+'|'+o.title,o])).values()].sort((a,b)=>(rank[b.kind]||0)-(rank[a.kind]||0)||a.price-b.price).slice(0,48);
    const family=/^(?:iphone|苹果)\s*18$/i.test(query.trim());
    return json(200,{...general,offers,message:offers.length?(family&&official.length?'官网当前可查到的18系列为Pro／Pro Max，其他网页报价请核对型号。':general.message||'已查到公开报价，请核对具体规格和来源。'):general.message});
   }
   if(url.pathname.startsWith('/api/'))return json(404,{error:'not_found'});
   let relative;try{relative=decodeURIComponent(url.pathname)}catch{return json(400,{error:'bad_path'})}
   if(relative.includes('\0')||relative.includes('\\'))return json(400,{error:'bad_path'});
   const target=path.resolve(publicRoot,'.'+(relative==='/'?'/index.html':relative));
   if(target!==publicRoot&&!target.startsWith(publicRoot+path.sep))return json(403,{error:'forbidden'});
   let info;try{info=await stat(target)}catch{return json(404,{error:'not_found'})}if(!info.isFile())return json(404,{error:'not_found'});
   const ext=path.extname(target);res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':ext==='.html'||relative==='/sw.js'?'no-cache':'public, max-age=300'});
   res.end(req.method==='HEAD'?undefined:await readFile(target));
  }catch{if(!res.headersSent)json(500,{error:'request_failed'});else res.end()}
 });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4317),host=process.env.HOST||'127.0.0.1';
 const app=createApp();app.listen(port,host,()=>console.log(`pomo web: http://${host}:${port}`));app.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Port already in use. Set PORT to an available port.':e.code);process.exitCode=1});
}

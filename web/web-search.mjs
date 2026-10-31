import {publicURL} from './safe-fetch.mjs';
export function decodeHTML(value){return String(value||'').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):''}).replace(/&(amp|lt|gt|quot|apos|nbsp|yen);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',yen:'¥'}[n]))}
export function textOnly(value){return decodeHTML(String(value||'').replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<\/?(?:div|p|li|tr|h[1-6]|br)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t\r]+/g,' ').replace(/\n\s*\n/g,'\n').trim()}
function normalizeResult(title,url,snippet,engine){
 const u=publicURL(decodeHTML(url));if(!u)return null;
 for(const k of [...u.searchParams.keys()])if(/^utm_|^fbclid$|^gclid$/i.test(k))u.searchParams.delete(k);
 return {title:textOnly(title).slice(0,240),url:u.href,snippet:textOnly(snippet).slice(0,1200),engine};
}
export function parseDuckDuckGo(html){
 const rows=[];const anchors=[...html.matchAll(/<a\b[^>]*class=["'][^"']*\bresult__a\b[^"']*["'][^>]*>[\s\S]*?<\/a>/gi)];
 for(let i=0;i<anchors.length;i++){
  const a=anchors[i],href=a[0].match(/href=["']([^"']+)["']/i)?.[1];if(!href)continue;
  let url;try{const wrapper=new URL(decodeHTML(href),'https://duckduckgo.com');url=wrapper.searchParams.get('uddg')||wrapper.href}catch{continue}
  const rest=html.slice(a.index+a[0].length,anchors[i+1]?.index||html.length),snippet=rest.match(/<(?:a|div|span)\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/(?:a|div|span)>/i)?.[1]||'';
  const row=normalizeResult(a[0],url,snippet,'DuckDuckGo');if(row)rows.push(row);
 }
 return rows;
}
export function parseBingRSS(xml){return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(m=>normalizeResult(m[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1],m[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1],m[1].match(/<description>([\s\S]*?)<\/description>/i)?.[1],'Bing')).filter(Boolean)}
export function relevant(query,text){
 const clean=query.normalize('NFKC').toLowerCase().replace(/https?:\/\/\S+/g,'').replace(/价格|多少钱|报价|官网|购买|人民币/g,' '),hay=text.normalize('NFKC').toLowerCase();
 const terms=[...new Intl.Segmenter('zh',{granularity:'word'}).segment(clean)].filter(s=>s.isWordLike&&s.segment.trim().length>=2).map(s=>s.segment);
 if(!terms.length)return true;
 const matches=terms.filter(t=>hay.includes(t));return matches.length>=Math.max(1,Math.ceil(terms.length*.5));
}
async function searchFetch(url,options,fetcher){const r=await fetcher(url,{...options,signal:AbortSignal.timeout(6500)});if(!r.ok)throw Error('search_unavailable');const body=await r.text();if(body.length>2500000)throw Error('search_too_large');if(/id=["']challenge-form|id=["']anomaly-modal/i.test(body))throw Error('search_challenge');return body}
export async function searchWeb(query,city='',{fetcher=fetch,env=process.env}={}){
 const direct=publicURL(query);if(direct)return {sources:[{title:direct.hostname,url:direct.href,snippet:'',engine:'direct'}],status:'ok',engine:'direct'};
 const phrase=[query,city,'价格 人民币'].filter(Boolean).join(' '),sources=[],errors=[];
 if(env.TAVILY_API_KEY){try{
  const json=JSON.parse(await searchFetch('https://api.tavily.com/search',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+env.TAVILY_API_KEY},body:JSON.stringify({query:phrase,search_depth:'basic',max_results:10,include_answer:false,include_raw_content:false})},fetcher));
  sources.push(...(json.results||[]).map(r=>normalizeResult(r.title,r.url,r.content,'Tavily')).filter(Boolean));
 }catch{errors.push('tavily')}}
 if(!sources.length&&env.BRAVE_SEARCH_API_KEY){try{
  const u=new URL('https://api.search.brave.com/res/v1/web/search');u.searchParams.set('q',phrase);u.searchParams.set('count','10');u.searchParams.set('search_lang','zh-hans');u.searchParams.set('country','CN');
  const json=JSON.parse(await searchFetch(u,{headers:{'X-Subscription-Token':env.BRAVE_SEARCH_API_KEY}},fetcher));sources.push(...(json.web?.results||[]).map(r=>normalizeResult(r.title,r.url,r.description,'Brave')).filter(Boolean));
 }catch{errors.push('brave')}}
 if(!sources.length){
  const results=await Promise.allSettled([
   searchFetch('https://html.duckduckgo.com/html/?q='+encodeURIComponent(phrase),{},fetcher).then(parseDuckDuckGo),
   searchFetch('https://www.bing.com/search?format=rss&q='+encodeURIComponent(phrase),{},fetcher).then(parseBingRSS)
  ]);
  for(const r of results)if(r.status==='fulfilled')sources.push(...r.value);else errors.push('public_search');
 }
 const unique=[...new Map(sources.filter(r=>relevant(query,r.title+' '+r.snippet)).map(r=>[r.url,r])).values()].slice(0,10);
 return {sources:unique,status:unique.length?'ok':errors.length?'unavailable':'empty',engine:[...new Set(unique.map(r=>r.engine))].join(',')};
}

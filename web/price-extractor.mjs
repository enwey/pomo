import {createHash} from 'node:crypto';
import {textOnly,decodeHTML,relevant} from './web-search.mjs';
import {publicURL} from './safe-fetch.mjs';
function attrs(tag){const out={};for(const m of tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g))out[m[1].toLowerCase()]=decodeHTML(m[2]);return out}
function metaValues(html){const out={};for(const m of html.matchAll(/<meta\b[^>]*>/gi)){const a=attrs(m[0]),key=a.property||a.name||a.itemprop;if(key&&a.content)out[key.toLowerCase()]=a.content}return out}
function amount(value){if(typeof value==='number')return Number.isFinite(value)&&value>=.01&&value<=1e9?value:null;const s=String(value??'').trim().replace(/,/g,'');return /^\d+(?:\.\d{1,2})?$/.test(s)&&Number(s)>=.01&&Number(s)<=1e9?Number(s):null}
function sameModel(query,text){
 const q=query.normalize('NFKC').toLowerCase(),hay=text.normalize('NFKC').toLowerCase().replace(/[\s-]/g,'');
 const models=[...q.matchAll(/[a-z]{1,10}[\s-]*\d{1,5}[a-z]*/gi)].map(m=>m[0].replace(/[\s-]/g,''));
 if(models.length)return models.every(m=>new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![0-9])').test(hay));
 const numbers=[...q.matchAll(/\d+/g)].map(m=>m[0]);if(numbers.length)return numbers.every(n=>new RegExp('(?:^|[^0-9])'+n+'(?:[^0-9]|$)').test(hay));
 return relevant(query,text);
}
function nearestPriceLabel(before){const lines=before.split('\n').map(s=>s.trim()).filter(Boolean).filter(s=>!/^对比$|^参考报价$|^价格$|^京东$|^天猫$|^全网比价$|^支持$/.test(s));return lines.at(-1)||before}
function offer(fields){const price=amount(fields.price);if(price===null||!publicURL(fields.url))return null;const title=textOnly(fields.title).slice(0,200);return {id:createHash('sha256').update(fields.url+'|'+title+'|'+price+'|'+(fields.sku||'')).digest('hex').slice(0,20),currency:'CNY',region:'中国大陆',...fields,title,price,spec:textOnly(fields.spec||fields.evidence||title).slice(0,260),evidence:textOnly(fields.evidence||'').slice(0,400)}}
export function extractTextPrices(text){
 const normalized=text.normalize('NFKC'),found=[];
 const pattern=/(?:人民币\s*|RMB\s*|CNY\s*|[¥￥]\s*)(\d[\d,]*(?:\.\d{1,2})?)|(\d[\d,]*(?:\.\d{1,2})?)\s*(?:元|人民币)/gi;
 for(const m of normalized.matchAll(pattern)){
  const price=amount(m[1]||m[2]);if(price===null)continue;
  const before=normalized.slice(Math.max(0,m.index-24),m.index),after=normalized.slice(m.index+m[0].length,m.index+m[0].length+24);
  const clause=before.split(/[，,。；;\n]/).at(-1)||'';
  if(/港币|港元|日元|美元|HK\$|HKD|USD|JPY|澳元|台币/i.test(before+after.slice(0,4)))continue;
  if(/(?:月供|每月|每期|立减|优惠|折扣|补贴|直降|省|券|运费|定金|订金|首付|折抵|旧机|节省|返现)[^。；;\n]{0,12}$/.test(clause)||/^\s*(?:[\/／]\s*(?:月|期)|每月|\/month|x\s*\d+期)/i.test(after))continue;
  if(/(?:首发时|首发价|原价|此前|原为|曾为|历史|调整前|原售价)[^。；;\n]{0,18}$/.test(clause))continue;
  if(/\d[\d,.]*(?:元|人民币)?\s*[-~～至—–]\s*[¥￥]?\s*$/.test(before)||/^\s*[-~～至—–]\s*[¥￥]?\s*\d/.test(after)||/^\d|^\.\d/.test(after))continue;
  const contextBefore=normalized.slice(Math.max(0,m.index-90),m.index),evidence=normalized.slice(Math.max(0,m.index-65),m.index+m[0].length+65).trim();
  if(/(?:低至|起步|起售|起价)[^。；;\n]{0,12}$/.test(before)||/^\s*起/.test(after))found.push({price,priceType:'starting',evidence,contextBefore});
  else found.push({price,priceType:'exact',evidence,contextBefore});
 }
 return found.slice(0,100);
}
export function extractPageQuotes({html,url,checkedAt},query,city=''){
 const meta=metaValues(html),pageTitle=textOnly(meta['og:title']||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||query),site=meta['og:site_name']||new URL(url).hostname;
 const pageText=textOnly(html).slice(0,200000),base={url,checkedAt,source:site,kind:'web_page',region:city||'中国大陆'},offers=[];
 if(city&&!pageText.includes(city)&&!pageTitle.includes(city))return [];
 function add(product,o){
  if(!o||typeof o!=='object'||!relevant(query,(product.name||'')+' '+pageTitle)||!sameModel(query,product.name||pageTitle))return;
  if(/OutOfStock|Discontinued/i.test(o.availability||'')||o.billingDuration||o.priceSpecification?.billingDuration)return;
  const spec=o.priceSpecification||{},currency=String(o.priceCurrency||spec.priceCurrency||'').toUpperCase();if(currency!=='CNY')return;
  const price=amount(o.price??spec.price??(o.lowPrice===o.highPrice?o.lowPrice:null));if(price===null)return;
  const title=product.name||o.name||pageTitle;
  const row=offer({...base,title,price,sku:product.sku||o.sku||'',spec:[title,product.model,product.sku,o.name!==title?o.name:''].filter(Boolean).join(' · '),evidence:`${title} · 页面结构化价格 CNY ${price}`,priceType:'exact',extraction:'structured'});if(row)offers.push(row);
 }
 let visited=0;function visit(node,depth=0){if(!node||typeof node!=='object'||depth>10||++visited>2000)return;if(Array.isArray(node)){node.forEach(n=>visit(n,depth+1));return}const types=[node['@type']].flat().filter(Boolean).join('|');if(/Product|Service/.test(types)&&node.offers){for(const o of [node.offers].flat())add(node,o)}for(const [key,value] of Object.entries(node))if(key!=='offers')visit(value,depth+1)}
 for(const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(m[1]))}catch{}}
 if(!offers.length&&relevant(query,pageTitle)&&String(meta['product:price:currency']||meta.pricecurrency).toUpperCase()==='CNY'){
  const row=offer({...base,title:pageTitle,price:meta['product:price:amount']||meta.price,priceType:'exact',extraction:'metadata',evidence:'页面人民币价格标签'});if(row)offers.push(row);
 }
 if(!offers.length){for(const p of extractTextPrices(pageText)){
  const label=nearestPriceLabel(p.contextBefore);
  if(!sameModel(query,label)||!relevant(query,label)||city&&!p.evidence.includes(city)&&!pageTitle.includes(city))continue;
  const row=offer({...base,...p,title:pageTitle,extraction:'visible_text'});if(row)offers.push(row);
 }}
 return [...new Map(offers.map(o=>[o.id,o])).values()].slice(0,4);
}
export function extractSnippetQuotes(result,query,city='',now=new Date().toISOString()){
 if(city&&!(result.title+' '+result.snippet).includes(city))return [];
 return extractTextPrices(result.snippet).filter(p=>sameModel(query,p.contextBefore)&&relevant(query,result.title+' '+p.evidence)).slice(0,2).map(p=>offer({...p,title:result.title,url:result.url,checkedAt:now,source:new URL(result.url).hostname,kind:'search_snippet',extraction:'indexed_snippet',region:city||'中国大陆'})).filter(Boolean);
}

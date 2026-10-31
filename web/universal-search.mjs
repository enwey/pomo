import {searchWeb} from './web-search.mjs';import {readPublicPage} from './safe-fetch.mjs';import {extractPageQuotes,extractSnippetQuotes} from './price-extractor.mjs';
export function createUniversalSearch({fetcher=fetch,env=process.env,pageLoader=readPublicPage}={}){
 const cache=new Map();
 return async function universalSearch(query,city=''){
  const key=query+'|'+city,old=cache.get(key);if(old&&Date.now()-old.at<60000)return {...old.result,cached:true};
  const search=await searchWeb(query,city,{fetcher,env}),sources=search.sources;let pagesRead=0;
  const groups=await Promise.all(sources.slice(0,4).map(async source=>{
   try{const page=await pageLoader(source.url);pagesRead++;const rows=extractPageQuotes(page,query,city);if(rows.length)return rows}catch{}
   return extractSnippetQuotes(source,query,city);
  }));
  const rank={web_page:3,search_snippet:1},offers=[...new Map(groups.flat().map(o=>[o.url+'|'+o.price+'|'+o.title,o])).values()].sort((a,b)=>(rank[b.kind]||0)-(rank[a.kind]||0)||a.price-b.price).slice(0,16);
  const result={offers,sources,searchStatus:search.status,engine:search.engine,pagesRead,checkedAt:new Date().toISOString(),message:offers.length?'已联网查找报价。请核对具体型号、规格、地区及适用条件；摘要参考价可能滞后于网页。':search.status==='unavailable'?'搜索服务暂时不可用，请稍后重试或手动填写价格。':sources.length?'找到相关网页，但没有可明确提取的人民币单价。可查看来源后手动填写。':'已联网搜索，暂未找到可核验的相关报价。你可以换个名称或手动填写。'};
  if(search.status==='ok'){cache.set(key,{at:Date.now(),result});if(cache.size>60)cache.delete(cache.keys().next().value)}return result;
 };
}

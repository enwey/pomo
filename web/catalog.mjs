export const providers=[
  {name:'iPhone Duo',aliases:['iphoneduo','苹果duo','duo'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-duo'},
  {name:'iPhone 18 Pro',aliases:['iphone18pro','苹果18pro'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-18-pro'},
  {name:'iPhone 17',aliases:['iphone17','苹果17'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-17'},
  {name:'iPhone 16',aliases:['iphone16','苹果16'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-16'},
  {name:'iPhone 17e',aliases:['iphone17e','苹果17e'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-17e'},
  {name:'iPhone Air',aliases:['iphoneair','苹果air'],url:'https://www.apple.com.cn/shop/buy-iphone/iphone-air'},
  {name:'iPad',aliases:['ipad','平板','苹果平板'],url:'https://www.apple.com.cn/shop/buy-ipad/ipad'}
];
export function parseAppleIndex(html){
  const found=new Map();
  for(const m of html.matchAll(/href=["']([^"']*\/shop\/buy-iphone\/(iphone-[a-z0-9-]+))["']/gi)){
    let u;try{u=new URL(m[1],'https://www.apple.com.cn')}catch{continue}
    if(u.origin!=='https://www.apple.com.cn'||u.pathname!==`/shop/buy-iphone/${m[2]}`)continue;
    const tail=m[2].slice(7),compact=tail.replace(/-/g,''),name='iPhone '+tail.split('-').map(w=>/^\d/.test(w)?w:w[0].toUpperCase()+w.slice(1)).join(' ');
    found.set(u.href,{name,aliases:['iphone'+compact,'苹果'+compact],url:u.href});
  }
  return [...found.values()];
}
export function chooseProviders(query,available=providers){
  const q=query.normalize('NFKC').toLowerCase().replace(/\d+\s*(?:gb|tb)/g,'').replace(/[\s-]+/g,'');
  if(['手机','苹果手机','iphone','苹果'].includes(q))return available.filter(p=>p.url.includes('/buy-iphone/')).slice(0,3);
  const exact=available.filter(p=>p.aliases.includes(q));if(exact.length)return exact;
  const generation=q.match(/(?:iphone|苹果)(\d+)/)?.[1];
  const related=available.filter(p=>{const g=p.aliases.join('|').match(/(?:iphone|苹果)(\d+)/)?.[1];return (!generation||!g||g===generation)&&p.aliases.some(a=>q.includes(a))}).sort((a,b)=>b.name.length-a.name.length);
  if(related.length)return related.slice(0,1);
  if(generation)return available.filter(p=>p.aliases.some(a=>new RegExp('^(?:iphone|苹果)'+generation+'(?:[^0-9]|$)').test(a)));
  return [];
}
export function filterOffers(query,offers){
  const q=query.normalize('NFKC').toLowerCase(),capacity=q.match(/(\d+)\s*(gb|tb)/),max=/pro\s*max/.test(q),pro=/pro/.test(q),standard=/标准版|standard/.test(q);
  return offers.filter(o=>{const name=o.title.normalize('NFKC').toLowerCase();return (!max||/pro\s*max/.test(name))&&(!pro||max||!/pro\s*max/.test(name))&&(!standard||!/\bpro\b|\bair\b|\bduo\b/.test(name))&&(!capacity||new RegExp('(?:^|\\s)'+capacity[1]+'\\s*'+capacity[2]+'(?:\\s|$)').test(name))}).sort((a,b)=>a.price-b.price||a.title.localeCompare(b.title));
}
let indexCache=null,indexJob=null;
export async function resolveProviders(query,fetcher=fetch){
  if(!/iphone|苹果|手机/i.test(query))return chooseProviders(query);
  if(!indexCache||Date.now()-indexCache.at>300000){
    if(!indexJob)indexJob=(async()=>{try{const r=await fetcher('https://www.apple.com.cn/shop/buy-iphone',{signal:AbortSignal.timeout(5000),redirect:'error'});if(!r.ok)throw Error();const discovered=parseAppleIndex(await r.text());if(discovered.length)indexCache={at:Date.now(),providers:[...discovered,...providers.filter(p=>!discovered.some(d=>d.url===p.url))]}}catch{}finally{indexJob=null}})();
    await indexJob;
  }
  return chooseProviders(query,indexCache?.providers||providers);
}
export function parseApple(html,provider,now=new Date().toISOString()){
  const matches=html.matchAll(/\{"sku":"([^"\\]+)","partNumber":"([^"\\]+)","price":\{"fullPrice":([0-9.]+)\},"category":"([^"\\]+)","name":"([^"\\]+)"\}/g);
  const seen=new Set(),offers=[];
  for(const m of matches){const amount=Number(m[3]),name=m[5];if(!Number.isFinite(amount)||amount<1||amount>1e7||seen.has(m[2]))continue;seen.add(m[2]);offers.push({id:m[2],title:name,price:amount,currency:'CNY',spec:name,source:'Apple 中国大陆官网',url:provider.url,checkedAt:now,region:'中国大陆',kind:'official',sku:m[2]})}
  return offers.slice(0,64);
}

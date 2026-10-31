import {lookup as dnsLookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import http from 'node:http';import https from 'node:https';
import {gunzipSync,inflateSync,brotliDecompressSync} from 'node:zlib';

export function isPublicAddress(address){
 const ip=address.toLowerCase();
 if(isIP(ip)===4){const [a,b,c]=ip.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113)}
 if(isIP(ip)===6){const first=parseInt(ip.split(':')[0],16);return first>=0x2000&&first<=0x3fff&&!ip.startsWith('2001:db8:')&&!ip.startsWith('2001:0:')}
 return false;
}
export function publicURL(value){
 let u;try{u=new URL(value)}catch{return null}
 const host=u.hostname.replace(/^\[|\]$/g,'').toLowerCase().replace(/\.$/,'');
 if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>3000||u.port&&!['80','443'].includes(u.port)||!host.includes('.')&&isIP(host)!==6||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host.endsWith('.internal')||isIP(host)&&!isPublicAddress(host))return null;
 u.hash='';return u;
}
export async function resolvePublic(value,resolver=dnsLookup){
 const u=publicURL(value);if(!u)throw Error('private_url');
 const host=u.hostname.replace(/^\[|\]$/g,'');
 let timer;let addresses=isIP(host)?[{address:host,family:isIP(host)}]:await Promise.race([resolver(host,{all:true,verbatim:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('dns_timeout')),2200)})]).finally(()=>clearTimeout(timer));
 // Some local network clients synthesize 198.18/15 DNS answers. Do NOT allow
 // those addresses: obtain real public A records and pin the HTTPS connection.
 if(resolver===dnsLookup&&!isIP(host)&&addresses.length&&addresses.every(a=>/^198\.(?:18|19)\./.test(a.address))){
  const r=await fetch('https://dns.google/resolve?name='+encodeURIComponent(host)+'&type=A',{redirect:'error',signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('dns_unavailable');const d=await r.json();addresses=(d.Answer||[]).filter(a=>a.type===1).map(a=>({address:a.data,family:4}));
 }
 if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw Error('private_address');
 return {url:u,address:addresses[0]};
}
export async function readPublicPage(value,{timeout=5500,maxBytes=1800000,resolver=dnsLookup,redirects=2,deadline=Date.now()+timeout}={}){
 const {url,address}=await resolvePublic(value,resolver),requester=url.protocol==='https:'?https:http;
 return new Promise((resolve,reject)=>{
  const request=requester.get(url,{agent:false,headers:{'User-Agent':'pomo/0.2 (public price source verification)','Accept':'text/html,application/xhtml+xml,application/json','Accept-Encoding':'identity','Accept-Language':'zh-CN,zh;q=0.9,en;q=0.5'},lookup:(_host,options,cb)=>options?.all?cb(null,[address]):cb(null,address.address,address.family)},response=>{
   if([301,302,303,307,308].includes(response.statusCode)){
    response.resume();if(redirects<=0||!response.headers.location){reject(Error('redirect_limit'));return}
    readPublicPage(new URL(response.headers.location,url).href,{timeout,maxBytes,resolver,redirects:redirects-1,deadline}).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.resume();reject(Error('page_unavailable'));return}
   const type=response.headers['content-type']||'';
   if(!/text\/(?:html|plain)|application\/(?:xhtml\+xml|json)/i.test(type)){response.resume();reject(Error('not_text'));return}
   let size=0;const chunks=[];
   response.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){request.destroy(Error('page_too_large'));return}chunks.push(chunk)});
   response.on('error',reject);response.on('end',()=>{try{
    let buffer=Buffer.concat(chunks);const encoding=response.headers['content-encoding'];
    if(encoding==='gzip')buffer=gunzipSync(buffer,{maxOutputLength:maxBytes});else if(encoding==='deflate')buffer=inflateSync(buffer,{maxOutputLength:maxBytes});else if(encoding==='br')buffer=brotliDecompressSync(buffer,{maxOutputLength:maxBytes});
    let charset=type.match(/charset=["']?([^;"'\s]+)/i)?.[1]||'utf-8';if(/gb2312|gbk/i.test(charset))charset='gb18030';
    let html;try{html=new TextDecoder(charset).decode(buffer)}catch{html=buffer.toString('utf8')}
    resolve({html,url:url.href,checkedAt:new Date().toISOString()});
   }catch{reject(Error('invalid_page'))}});
  });
  const timer=setTimeout(()=>request.destroy(Error('page_timeout')),Math.max(1,deadline-Date.now()));request.on('close',()=>clearTimeout(timer));request.on('error',reject);
 });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {parseDuckDuckGo,parseBingRSS} from '../web-search.mjs';
import {extractTextPrices,extractPageQuotes} from '../price-extractor.mjs';
import {publicURL,resolvePublic} from '../safe-fetch.mjs';
import {createUniversalSearch} from '../universal-search.mjs';

test('搜索结果解码真实来源并拒绝内部地址',()=>{
 const rows=parseDuckDuckGo('<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fp">商品 &amp; 服务</a><a class="result__snippet">售价 299 元</a>');
 assert.equal(rows[0].url,'https://example.com/p');assert.equal(rows[0].snippet,'售价 299 元');
 assert.equal(parseBingRSS('<item><title>商品</title><link>http://127.0.0.1/</link></item>').length,0);
});
test('排除月供、原价、运费、外币和价格区间',()=>{
 assert.deepEqual(extractTextPrices('月供 99元；原价2999元，现价2499元；运费20元；美元100元；售价100-200元').map(p=>p.price),[2499]);
});
test('结构化报价要求人民币、对应型号和可售状态',()=>{
 const page=(offer)=>({html:'<title>戴森 HD16 吹风机</title><script type="application/ld+json">'+JSON.stringify({'@type':'Product',name:'戴森 HD16 吹风机',offers:offer})+'</script>',url:'https://example.com/product',checkedAt:'2026-10-31T00:00:00Z'});
 assert.equal(extractPageQuotes(page({price:2499,priceCurrency:'CNY'}),'戴森 HD16')[0].price,2499);
 for(const o of [{price:99,priceCurrency:'USD'},{price:99,priceCurrency:'CNY',availability:'OutOfStock'},{lowPrice:99,highPrice:299,priceCurrency:'CNY'}])assert.equal(extractPageQuotes(page(o),'戴森 HD16').length,0);
 assert.equal(extractPageQuotes(page({price:2499,priceCurrency:'CNY'}),'戴森 HD08').length,0);
});
test('不把相邻推荐商品的价格算作目标商品',()=>{
 const rows=extractPageQuotes({html:'<title>戴森 HD16 吹风机</title><div>戴森 HD16 吹风机 售价 2499元</div><div>其他品牌吹风机 售价 69元</div>',url:'https://example.com/p'},'戴森 HD16');
 assert.deepEqual(rows.map(p=>p.price),[2499]);
});
test('任意商品经搜索后读取网页，缓存保留原始抓取日期',async()=>{
 const search=createUniversalSearch({env:{TAVILY_API_KEY:'test'},fetcher:async()=>new Response(JSON.stringify({results:[{title:'陌生品牌 ABC77 电水壶',url:'https://example.com/p',content:'陌生品牌 ABC77 电水壶'}]})),pageLoader:async url=>({url,checkedAt:'2026-10-30T01:02:00Z',html:'<title>陌生品牌 ABC77 电水壶</title><p>陌生品牌 ABC77 电水壶 售价 299元</p>'})});
 const first=await search('陌生品牌 ABC77 电水壶');assert.equal(first.offers[0].price,299);assert.equal(first.offers[0].kind,'web_page');
 const next=await search('陌生品牌 ABC77 电水壶');assert.equal(next.cached,true);assert.equal(next.offers[0].checkedAt,'2026-10-30T01:02:00Z');
});
test('无明确报价仅返回来源，搜索故障不伪造价格',async()=>{
 const search=createUniversalSearch({env:{TAVILY_API_KEY:'test'},fetcher:async()=>new Response(JSON.stringify({results:[{title:'测试服务',url:'https://example.com/p',content:'请咨询门店'}]})),pageLoader:async()=>{throw Error('unavailable')}});
 const result=await search('测试服务');assert.equal(result.sources.length,1);assert.equal(result.offers.length,0);
 const failed=await createUniversalSearch({env:{},fetcher:async()=>{throw Error('offline')}})('测试服务');assert.equal(failed.searchStatus,'unavailable');assert.equal(failed.offers.length,0);
});
test('防止内部网络访问及混合DNS地址',async()=>{
 for(const url of ['file:///etc/passwd','http://localhost/','http://127.1/','http://169.254.169.254/','http://[::1]/','https://example.com:444/'])assert.equal(publicURL(url),null,url);
 await assert.rejects(resolvePublic('https://example.com',async()=>[{address:'8.8.8.8',family:4},{address:'10.0.0.1',family:4}]),/private_address/);
});

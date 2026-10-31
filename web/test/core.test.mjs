import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const context=vm.createContext({Intl,URL});vm.runInContext(await readFile(new URL('../src/core.js',import.meta.url),'utf8'),context);const c=context.PomoCore;
const data=JSON.parse(await readFile(new URL('../src/data.json',import.meta.url),'utf8'));
test('人民币写法、全角字符和小数精度',()=>{for(const [input,want] of [['10000',10000],['1万',10000],['100万元',1000000],['￥1,000.50',1000.5],['人民币 ２９９',299],['0.01',.01],['1亿',1e8]])assert.equal(c.amount(input),want)});
test('非法金额不会落入计算',()=>{for(const input of ['',0,'-1','NaN','Infinity','1e5','0.001','1000000000001','299.999','iPhone17'])assert.equal(c.amount(input),null)});
test('官方工资与居民结余口径分开，年转月不提前取整',()=>{const r=c.financial(10000,data.baseline);assert.equal(r.income,71590/12);assert.equal(r.savingIncome,43377/12);assert.equal(r.expense,29476/12);assert.ok(Math.abs(r.surplus-13901/12)<1e-8);assert.ok(Math.abs(r.earningMonths-120000/71590)<1e-10)});
test('个人收支、零收入、零结余和负结余',()=>{assert.equal(c.financial(10000,data.baseline,{income:6000,expense:3500}).savingMonths,4);assert.equal(c.financial(10000,data.baseline,{income:6000,expense:6000}).savingMonths,null);assert.equal(c.financial(10000,data.baseline,{income:0,expense:1000}).earningMonths,null);assert.equal(c.financial(10000,data.baseline,{income:6000,expense:7000}).savingMonths,null)});
test('小数价格按分计算，没有浮点少买一件',()=>{assert.equal(c.quantity(.3,.1),3);assert.equal(c.quantity(10000,15),666);assert.equal(c.quantity(.01,65),0);assert.equal(c.quantity(100,0),0);assert.equal(c.quantity(100,.001),0)});

test('消费频率按包装份量换算天数，电影按365天转成年',()=>{
 const basis=type=>data.references.find(g=>g[4]===type)[5];
 assert.equal(c.usage(4000,basis('movie')).days,4000);assert.match(c.usage(4000,basis('movie')).text,/每天看1场电影.*约11年/);
 assert.equal(c.usage(3,basis('rice')).days,50);assert.match(c.usage(3,basis('rice')).text,/每天三顿.*50天/);
 assert.equal(c.usage(2,basis('egg')).days,10);assert.equal(c.usage(10,basis('bus')).days,5);
 assert.equal(c.usage(0,basis('movie')),null);assert.equal(c.usage(2,{}),null);assert.match(c.usage(2,basis('phone')).text,/每天换1个.*2天不重复/);
 assert.match(c.usage(1,{usage:{usesPerUnit:1,perDay:3,frequency:'每天用3次',action:'连续用'}}).text,/不足1天/);
});

test('随机比较跨品类、无重复且优先可负担物品',()=>{
 for(let i=0;i<80;i++){
  const goods=c.selectGoods(10000,data.references);
  assert.equal(goods.length,8);assert.equal(new Set(goods.map(g=>g[0])).size,8);
  assert.ok(goods.every(g=>g[2]<=10000));assert.ok(goods.filter(g=>g[5].category==='daily').length<=2);
  assert.ok(new Set(goods.map(g=>g[5].category)).size>=6);
 }
});

test('耐用品按每天换用一件展示不重复时长，保留消耗品表达',()=>{
 for(const [type,frequency] of [['bicycle','每天骑1辆'],['shoes','每天穿1双'],['racket','每天用1支']]){
  const basis=data.references.find(g=>g[4]===type)[5];
  assert.equal(c.usage(30,basis).days,30);assert.match(c.usage(30,basis).text,new RegExp(frequency+'.*30天不重复'));
  assert.match(c.usage(730,basis).text,/约2年不重复/);assert.equal(c.usage(0,basis),null);
 }
 assert.doesNotMatch(c.usage(30,data.references.find(g=>g[4]==='movie')[5]).text,/不重复/);
});
test('达到Duo价格必含台数比较，低于报价不抽中',()=>{
 const duo=data.references.find(g=>g[0]==='iPhone Duo');
 for(const value of [.01,duo[2]-.01,duo[2],duo[2]*2]){
  const goods=c.selectGoods(value,data.references);assert.equal(goods.some(g=>g[0]==='iPhone Duo'),value>=duo[2]);
  if(value>=duo[2])assert.equal(c.quantity(value,duo[2]),value===duo[2]?1:2);
 }
});
test('新比较改变组合且不修改历史快照',()=>{
 const before=c.selectGoods(100000,data.references,[],()=>.5),snapshot=JSON.stringify(before);
 const next=c.selectGoods(100000,data.references,before,()=>.5);
 assert.notDeepEqual([...next.map(g=>g[0])].sort(),[...before.map(g=>g[0])].sort());
 next[0][2]=1;assert.equal(JSON.stringify(before),snapshot);
});
test('时间单位和无法计算状态',()=>{assert.equal(c.duration(24).unit,'年');assert.equal(c.duration(24).num,'2');assert.equal(c.duration(.001).num,'少于0.1');assert.equal(c.duration(Infinity).value,null)});
test('个人资料校验和链接协议限制',()=>{assert.equal(c.validPersonal({income:0,expense:0}),true);assert.equal(c.validPersonal({income:NaN,expense:0}),false);assert.equal(c.safeLink('javascript:alert(1)'),null);assert.equal(c.safeLink('file:///etc/passwd'),null);assert.ok(c.safeLink('https://www.stats.gov.cn/'))});
test('损坏的历史和基准不进入界面',()=>{assert.equal(c.cleanRecords(null).length,0);assert.equal(c.cleanRecords([{},null,{id:'x',amount:100,label:'test',date:'2026',baseline:{income:1},goods:data.references}]).length,0);assert.equal(c.validBaseline(data.baseline),true)});


const $=s=>document.querySelector(s), money=n=>new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(n), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const STORE='pomo-web-v1';let saved;try{saved=JSON.parse(localStorage.getItem(STORE)||'{}')||{}}catch{saved={}}let records=PomoCore.cleanRecords(saved.records),personal=PomoCore.validPersonal(saved.personal)?saved.personal:null,current=null,mode='national',index=0;
// Shared interaction state for the high-fidelity UI.
let screen='home', draftQuery='', searchState=null, returnScreen=null, modalFocus=null, queryTimer=0;
let exportAll=false, activeCardCount=10, lastHistoryMode=false;


// Browser functions integrated into src/app.js during initial implementation.
let appData=structuredClone(POMO_DATA),lookupController=null,lookupSerial=0,routeReady=false,restoringRoute=false;
let priceCache={};try{priceCache=JSON.parse(localStorage.getItem('pomo-price-cache')||'{}')}catch{}
try{const cached=JSON.parse(localStorage.getItem('pomo-data-cache')||'null');if(validDataset(cached)&&cached.version>=POMO_DATA.version)appData=cached}catch{}


function persist(){try{localStorage.setItem(STORE,JSON.stringify({records,personal}))}catch{toast('暂时无法保存，请检查设备剩余空间')}}

function toast(message){clearTimeout(queryTimer);$('#toast').textContent=message;$('#toast').hidden=false;queryTimer=setTimeout(()=>$('#toast').hidden=true,3500)}

function art(type='home'){const safe=['home','work','save','rice','milk','egg','apple','noodles','water','laundry','tissue','phone','headphones','keyboard','powerbank','shoes','shirt','bag','cap','movie','book','game','ticket','bus','hotel','suitcase','bicycle','racket','rope','mat'].includes(type)?type:'home';return `<img class="${type==='home'?'scene':'art'}" src="/assets/scenes/${safe}.svg" alt="" draggable="false">`;}

function home(){clearTimeout(queryTimer);lookupSerial++;lookupController?.abort();mount(`<section class="home"><div class="eyebrow">把数字，放回生活里</div><h1>看看这笔钱，<br>是不是你认识的样子。</h1><p class="sub">当它变成上班的日子、餐桌上的饭菜，<br>你会不会，对它有不一样的感觉？</p>${art()}<form class="search" id="search"><input id="query" aria-label="金额、商品或服务" placeholder="输入金额、商品或服务" autocomplete="off" enterkeyhint="go" value="${esc(draftQuery)}"><button class="go" aria-label="开始比较">看看 ${uiIcon('arrow')}</button></form><div id="input-error" class="inline-error" role="alert"></div><div class="examples"><button class="chip" onclick="submitQuery('1万元')">¥ 1万元</button><button class="chip" onclick="submitQuery('手机')">一部手机</button><button class="chip" onclick="submitQuery('按摩')">一次按摩</button></div><div class="bottom-note">${uiIcon('shield')} 无需登录 · 历史记录保存在当前设备</div></section>`,'home');$('#search').onsubmit=e=>{e.preventDefault();submitQuery($('#query').value)};$('#query').oninput=()=>{draftQuery=$('#query').value;$('#input-error').textContent='';rememberRoute()};}

function parseAmount(q){return PomoCore.amount(q)}

function submitQuery(q){q=q.trim();draftQuery=q;if(!q){$('#input-error').textContent='输入一笔金额，或你想了解的商品 / 服务';$('#query').focus();return}if(q.length>120){$('#input-error').textContent='请把名称缩短到120个字以内';return}const amount=parseAmount(q);if(amount!==null){start(amount,q,'用户输入金额');return}if(/^[¥￥+\-\d.,，\s万元亿人民币]+$/.test(q.normalize('NFKC'))){$('#input-error').textContent='请输入0.01元至1万亿元的金额，最多保留两位小数';return}offers(q)}

function modal(title,body){modalFocus=document.activeElement;$('#overlay').innerHTML=`<div class="sheet-bg"><section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1"><div class="sheet-head"><h2>${esc(title)}</h2><button class="close" onclick="closeModal()" aria-label="关闭">×</button></div>${body}</section></div>`;$('#overlay .sheet-bg').onclick=e=>{if(e.target.classList.contains('sheet-bg'))closeModal()};$('.phone').inert=true;$('#overlay .close').focus();}

function closeModal(){const had=!!$('#overlay').firstElementChild;$('#overlay').innerHTML='';$('.phone').inert=false;if(had&&modalFocus?.isConnected)modalFocus.focus();modalFocus=null;}

async function offers(q,city='',chosen=-1){
 const service=/按摩|理发|美容|服务|健身|课程|保洁|酒店|住宿|旅游/.test(q);searchState={q,city,chosen,service};
 if(service&&!city){cityForm(q);return}
 lookupController?.abort();lookupController=new AbortController();const sequence=++lookupSerial,controller=lookupController;
 mount(`<section class="flow"><button class="back" onclick="cancelLookup()">${uiIcon('back')} 返回输入</button><h1>找一找，<br>有依据的价格。</h1><div class="query-summary"><span>${esc(q)}${city?' · '+esc(city):''}</span></div><div class="lookup-state" role="status"><span class="lookup-spinner"></span>正在查询公开报价…</div><button class="link wide" onclick="manual(searchState.q)">已经知道价格？直接填写</button></section>`,'offers');
 const key=q+'|'+city,timer=setTimeout(()=>controller.abort(),22000);
 try{
  if(!navigator.onLine)throw Error('offline');
  const response=await fetch('/api/search?q='+encodeURIComponent(q)+'&city='+encodeURIComponent(city),{signal:controller.signal});if(!response.ok)throw Error('lookup');const payload=await response.json();
  if(sequence!==lookupSerial||screen!=='offers')return;
  const rows=(payload.offers||[]).filter(o=>o&&typeof o.title==='string'&&Number.isFinite(o.price)&&o.price>0&&PomoCore.safeLink(o.url)).slice(0,24);
  priceCache[key]={offers:rows,sources:payload.sources||[],at:new Date().toISOString()};const keys=Object.keys(priceCache);for(const k of keys.slice(0,Math.max(0,keys.length-10)))delete priceCache[k];try{localStorage.setItem('pomo-price-cache',JSON.stringify(priceCache))}catch{}
  quoteList(q,city,rows,payload.message||'',false,chosen,payload.sources||[]);
 }catch{
  if(sequence!==lookupSerial||screen!=='offers')return;const prior=priceCache[key];quoteList(q,city,prior?.offers||[],prior?.offers?.length?'使用上次保存的报价，请注意价格日期。':'暂时无法获取可靠报价，可以手动填写价格继续比较。',true,chosen,prior?.sources||[]);
 }finally{clearTimeout(timer)}
}

function manual(q){lookupSerial++;lookupController?.abort();const city=searchState?.city||'';mount(`<section class="flow"><button class="back" onclick="offers(searchState.q,searchState.city)">${uiIcon('back')} 返回选择报价</button><h1>用你知道的价格，<br>继续看看。</h1><p class="sub">${esc(q)}${city?' · '+esc(city):''}</p><form id="manual-form"><label class="field">人民币价格<input id="price" inputmode="decimal" placeholder="例如 299 或 1万元"></label><div class="inline-error" id="manual-error" role="alert"></div><button class="primary wide">看看这笔钱 →</button></form></section>`,'manual');$('#manual-form').onsubmit=e=>{e.preventDefault();const amount=parseAmount($('#price').value);if(amount===null){$('#manual-error').textContent='请填写有效的人民币金额';return}start(amount,q+(city?' · '+city:''),'用户输入价格',{query:{q,city,kind:'manual'}})}}

function start(amount,label,source,metadata={}){
 if(!Number.isFinite(amount)||amount<.01||amount>1e12)return toast('请输入有效金额');
 clearTimeout(queryTimer);lastHistoryMode=false;mode='national';index=0;
 current={id:crypto.randomUUID(),amount:Math.round(amount*100)/100,label:String(label).slice(0,180),source:String(source).slice(0,180),date:new Date().toISOString(),baseline:structuredClone(appData.baseline),goods:PomoCore.selectGoods(amount,appData.references,current?.goods||[]),personal:personal?{...personal}:null,mode:'national',datasetVersion:appData.version,...metadata};
 records.unshift(structuredClone(current));records=records.slice(0,100);persist();renderResult();if(!navigator.onLine)toast(`当前离线，使用已保存的${current.baseline.year}年数据`);
}

function cards(){
 const f=PomoCore.financial(current.amount,current.baseline,mode==='personal'?current.personal:null);
 const t=f.earningMonths===null?{num:'无法估算',unit:''}:PomoCore.duration(f.earningMonths),s=f.savingMonths===null?{num:'暂无结余',unit:''}:PomoCore.duration(f.savingMonths);
 const phrase=d=>d.num.startsWith('少于')?'不足'+d.num.slice(2):'约 '+d.num;
 return [{title:'赚取这笔钱',num:t.num,unit:t.unit,type:'work',caption:f.earningMonths!==null?`按${mode==='personal'?'你填写的每月到手收入':'城镇私营单位就业人员平均工资'}计算，你需要不吃不喝工作${phrase(t)} ${t.unit}来赚取这笔钱。`:'月收入为0，无法按收入估算赚取时间。'},
 {title:'存下这笔钱',num:s.num,unit:s.unit,type:'save',caption:f.savingMonths!==null?`按${mode==='personal'?'每月收入扣除生活开支后的结余':'全国居民人均收入与消费差额'}计算，你需要积累${phrase(s)} ${s.unit}才能存下这笔钱。`:'按当前收支，暂无可用于储蓄的结余。'},
 ...current.goods.map(([name,unit,price,spec,type,basis],i)=>{const quantity=PomoCore.quantity(current.amount,price);return {title:`可以买到 ${money(quantity)} ${unit}${name}`,num:money(quantity),unit,type,style:['rice','milk','egg','apple','noodles','water','laundry','tissue'][i%8],caption:`按${spec}、${basis?.kind==='official'?'官网报价':'参考单价'} ¥${money(price)}计算，${quantity<1?'这笔钱还不足以购买一个完整单位的'+name+'。':'这笔钱约可以买到 '+money(quantity)+' '+unit+name+'。'}`}})];
}

function renderResult(){
  const data=cards();activeCardCount=data.length;index=Math.max(0,Math.min(index,data.length-1));
  mount(`<section class="result-minimal"><header class="minimal-toolbar"><button class="minimal-icon" onclick="flowBack()" aria-label="返回输入">${uiIcon('back')}</button><button class="minimal-amount" onclick="editAmount()" aria-label="修改金额">¥ ${money(current.amount)} ${uiIcon('edit')}</button><button class="minimal-icon" onclick="exportMenu()" aria-label="保存或分享">${uiIcon('share')}</button></header><div class="rail" tabindex="0" aria-label="比较卡片，左右滑动或使用方向键切换">${data.map((x,i)=>`<article class="card story-${esc(x.style||x.type)}" data-story="${esc(x.style||x.type)}" aria-label="第${i+1}张：${esc(x.title)}"><div class="card-top"><span>${i<2?'时间的刻度':'换个角度看价值'}</span><span>${String(i+1).padStart(2,'0')} / ${data.length}</span></div><div class="card-context"><button onclick="modeMenu()" aria-label="切换比较基准">${mode==='national'?'全国参照':'个人情况'} ⌄</button></div><div class="number ${x.num.length>10?'is-long':x.num==='暂无结余'||x.num==='无法估算'||x.num.startsWith('少于')?'is-state':''}">${x.num}<small>${x.unit}</small></div><h2>${x.title}</h2>${art(x.type)}<div class="caption">${x.caption}</div><button class="source" onclick="details(${i})">${i<2&&mode==='national'?current.baseline.year+'年数据 · ':''}查看计算依据 ↗</button>${lastHistoryMode?'<div class="minimal-history"><span>历史结果</span><button onclick="recalculate()">重新计算</button></div>':''}</article>`).join('')}</div><footer class="minimal-footer"><div class="dots">${data.map((_,i)=>`<button aria-label="查看第${i+1}张：${esc(data[i].title)}" class="dot ${index===i?'on':''}" onclick="goCard(${i})"></button>`).join('')}</div><span id="pos" class="sr-only" role="status" aria-live="polite"></span></footer></section>`,'result');initDeck(data);
}

function modeMenu(){modal('比较基准',`<div class="mode-options"><button class="${mode==='national'?'selected':''}" onclick="closeModal();setMode('national')"><span>全国参照</span><small>${mode==='national'?'当前使用':''}</small></button><button class="${mode==='personal'?'selected':''}" onclick="closeModal();setMode('personal')"><span>个人情况</span><small>${mode==='personal'?'当前使用':'按你的收入与开支'}</small></button></div>${personal||current.personal?'<button class="link wide" onclick="closeModal();editPersonal()">调整收入与开支</button>':''}`);}

function goCard(i){deckGo(i);}

function setMode(m){if(m===mode)return;if(m==='personal'&&!current.personal){if(personal)current.personal={...personal};else{editPersonal();return}}mode=m;commitSnapshot();renderResult()}

function editPersonal(){const p=current?.personal||personal;mount(`<section class="flow"><button class="back" onclick="renderResult()">${uiIcon('back')} 返回比较</button><h1>换成你的生活节奏。</h1><p class="sub flow-lead">只保存在当前设备。</p><form id="personal-form"><label class="field">每月到手收入（元）<input id="income" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${p?.income??''}" placeholder="例如 6000"></label><label class="field">每月生活开支（元）<input id="expense" type="number" inputmode="decimal" min="0" max="1000000000000" step="0.01" value="${p?.expense??''}" placeholder="例如 3500"></label><div class="preview-box" id="surplus-preview">填写两项，看看每月可以留下多少。</div><div class="inline-error" id="personal-error" role="alert"></div><button class="primary wide">查看个人情况 →</button></form><button class="link wide" onclick="confirmClearPersonal()">清除已保存的收支信息</button></section>`,'personal');
 const preview=()=>{const a=$('#income').value,b=$('#expense').value;if(a===''||b==='')return;const net=Number(a)-Number(b);$('#surplus-preview').textContent=net>0?'按当前收支，每月结余 ¥'+money(net):'按当前收支，暂无可用于储蓄的结余。'};$('#income').oninput=preview;$('#expense').oninput=preview;preview();
 $('#personal-form').onsubmit=e=>{e.preventDefault();const a=$('#income').value,b=$('#expense').value,p={income:Number(a),expense:Number(b)};if(a===''||b===''||!PomoCore.validPersonal(p)){$('#personal-error').textContent='请填写有效的非负收入和开支';return}personal=p;current.personal={...p};mode='personal';persist();commitSnapshot();renderResult()};
}

function clearPersonal(){personal=null;if(current)current.personal=null;persist();mode='national';closeModal();if(current)renderResult();toast('已清除收支信息');}

function details(i){
 let body,extra='';
 if(i<2){const b=current.baseline,f=PomoCore.financial(current.amount,b,mode==='personal'?current.personal:null);body=i===0?`每月收入参照：¥${money(f.income)}\n赚取时间（月）= 金额 ÷ 每月收入`:`每月收入参照：¥${money(f.savingIncome)}\n每月生活开支：¥${money(f.expense)}\n每月结余：¥${money(f.surplus)}\n储蓄时间（月）= 金额 ÷ 每月结余`;
  if(mode==='national'){const source=i===0?b.wageSource:b.householdSource;body=`${b.year}年 · ${i===0?b.incomeLabel:b.savingsLabel}\n\n`+body+`\n\n${i===0?'工资为税前劳动报酬，不等同于到手收入，也不代表所有年轻人的收入水平。':'采用同一年度全国居民人均可支配收入和消费支出之差进行估算，不是统计得到的个人实际存款。与工资卡对应的人群不同，不混用为同一个人的收支。'}`;extra=sourceLink(source.url,source.title)}
  else body='根据你填写的每月到手收入与生活开支计算。\n\n'+body;
  body+='\n\n按收支不变估算，不包含投资收益、通胀或未来变化。结余不大于0时不计算储蓄年限。';
 }else{const g=current.goods[i-2],basis=g[5]||{};body=`参照商品：${g[0]}\n规格：${g[3]}\n参考单价：¥${money(g[2])}\n\n可购买数量 = 金额 ÷ 单价，按完整单位向下取整。\n\n${basis.title||'生活预算参照'}\n${basis.note||'用于比较，不是全国均价或实时报价。'}`;extra=(basis.url?sourceLink(basis.url,basis.title||'查看商品价格来源'):'')+(basis.checkedAt?'<p class="quiet">报价抓取于 '+esc(formatQuoteTime(basis.checkedAt))+'</p>':'')+`<button class="secondary wide" onclick="editReference(${i-2})">按本地价格调整单价</button>`}
 if(current.quote)extra+=`<div class="divider"></div><p class="quiet">本次商品价格：${esc(current.quote.source)} · ${esc(formatQuoteTime(current.quote.checkedAt))}${current.quote.kind==='search_snippet'?' · 搜索摘要参考价，可能滞后于原网页。':''}${current.quote.priceType==='starting'?' · 起售价，具体规格可能更高。':''}</p>${current.quote.evidence?'<div class="details">'+esc(current.quote.evidence)+'</div>':''}${sourceLink(current.quote.url,'本次报价来源')}`;
 modal('这张卡片如何计算',`<div class="details">${esc(body)}</div>${extra}`);
}

function historyView(){if(screen!=='history')returnScreen=screen==='result'?'result':'home';mount(`<section class="flow"><button class="back" onclick="flowBack()">${uiIcon('back')} 返回${returnScreen==='result'?'比较':'首页'}</button><h1>再看看，曾经的比较。</h1><div class="history-toolbar"><span class="count">本机记录 · ${records.length} 条</span>${records.length?'<button class="link" onclick="confirmClearHistory()">清空记录</button>':''}</div><div id="history-list"></div></section>`,'history');if(!records.length){$('#history-list').innerHTML=`<div class="empty">${art('save')}<p class="sub">还没有比较记录。</p><button class="primary wide" onclick="home()">去看看一笔钱</button></div>`;return}records.forEach(r=>{const row=document.createElement('div');row.className='history-row';const open=document.createElement('button');open.innerHTML=`<strong>¥ ${money(r.amount)}</strong><small>${esc(r.label)}<br>${esc(formatDate(r.date))} · ${r.baseline.year}年参照</small>`;open.onclick=()=>{current=structuredClone(r);mode=r.mode==='personal'&&PomoCore.validPersonal(r.personal)?'personal':'national';index=0;lastHistoryMode=true;renderResult()};const del=document.createElement('button');del.className='delete-record';del.textContent='删除';del.setAttribute('aria-label','删除 '+r.label+' 的记录');del.onclick=()=>{const i=records.indexOf(r);records=records.filter(x=>x.id!==r.id);persist();historyView();undoToast(r,i)};row.append(open,del);$('#history-list').append(row)})}

function exportMenu(){exportAll=false;modal('把这个视角，留下来',`<div class="export-choice" role="group" aria-label="导出范围"><button class="selected" id="single-export" aria-pressed="true" onclick="chooseExport(false)">当前这一张</button><button id="all-export" aria-pressed="false" onclick="chooseExport(true)">全部 ${cards().length} 张</button></div><div id="export-preview"></div><div class="export-actions"><button class="secondary" id="save-image" onclick="exportImage(exportAll,false)">保存图片</button><button class="primary" id="share-image" onclick="exportImage(exportAll,true)">分享图片 ↗</button></div><div class="inline-error" id="export-status" role="status"></div>`);chooseExport(false)}

async function exportImage(all,share){
 const status=$('#export-status'),buttons=[...document.querySelectorAll('.export-actions button')];buttons.forEach(b=>b.disabled=true);if(status)status.textContent='正在生成图片…';
 try{
  const data=cards(),selected=all?data.map((d,i)=>({d,i})):[{d:data[index],i:index}],w=750,cardHeight=1080,header=120,h=header+selected.length*cardHeight+65;
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#faf7ef';ctx.fillRect(0,0,w,h);ctx.fillStyle='#171717';ctx.font='italic 900 38px Arial';ctx.fillText('pomo',30,53);ctx.font='20px sans-serif';ctx.fillText('¥ '+money(current.amount)+' · '+(mode==='personal'?'个人情况':current.baseline.year+'年全国参照'),30,90);
  const wrap=(text,x,y,maxWidth,lineHeight)=>{let line='';for(const c of String(text)){if(ctx.measureText(line+c).width>maxWidth&&line){ctx.fillText(line,x,y);y+=lineHeight;line=c}else line+=c}if(line){ctx.fillText(line,x,y);y+=lineHeight}return y};
  for(let n=0;n<selected.length;n++){
   const {d,i}=selected[n],y=header+n*cardHeight,el=document.querySelectorAll('.card')[i],color=getComputedStyle(el).backgroundColor;
   ctx.fillStyle='#171717';ctx.fillRect(28,y+5,w-55,cardHeight-25);ctx.fillStyle=color;ctx.fillRect(23,y,w-55,cardHeight-25);ctx.strokeStyle='#171717';ctx.lineWidth=3;ctx.strokeRect(23,y,w-55,cardHeight-25);ctx.fillStyle='#171717';ctx.font='18px sans-serif';ctx.fillText(String(i+1).padStart(2,'0')+' / '+data.length,55,y+45);
   ctx.fillStyle=(d.style||d.type)==='laundry'?'#171717':'#fffdf6';ctx.fillRect(55,y+77,w-130,152);ctx.strokeRect(55,y+77,w-130,152);ctx.fillStyle=(d.style||d.type)==='laundry'?'#fffdf6':'#171717';ctx.font='italic 900 '+(d.num.length>10?'45':'76')+'px Arial';ctx.fillText(d.num+' '+d.unit,78,y+181,w-175);
   ctx.fillStyle='#171717';ctx.font='bold 25px sans-serif';wrap(d.title,55,y+284,w-120,36);
   const img=new Image();img.src='/assets/scenes/'+d.type+'.svg';await img.decode();ctx.drawImage(img,55,y+350,w-120,340);
   ctx.fillStyle='#fffdf6';ctx.fillRect(55,y+740,w-120,185);ctx.strokeRect(55,y+740,w-120,185);ctx.fillStyle='#171717';ctx.font='21px sans-serif';wrap(d.caption,72,y+778,w-155,32);
   ctx.font='16px sans-serif';const f=PomoCore.financial(current.amount,current.baseline,mode==='personal'?current.personal:null);const note=mode==='personal'?`到手收入 ¥${money(f.income)} / 月 · 开支 ¥${money(f.expense)} / 月`:`${current.baseline.year}年国家统计局 · 工资与居民收支分口径换算`;
   wrap(i<2?note:current.goods[i-2][5]?.kind==='official'?'商品官网公开报价 · '+formatQuoteTime(current.goods[i-2][5].checkedAt):'商品预算参考单价；不是全国均价或实时报价。',55,y+969,w-120,23);
  }
  ctx.font='16px sans-serif';ctx.fillStyle='#171717';ctx.fillText('生成于 '+formatDate(current.date),30,h-22);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('export');const file=new File([blob],all?'pomo-全部卡片.png':'pomo-当前卡片.png',{type:'image/png'});
  if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'pomo · 价值比较'});if(status)status.textContent='已分享'}else{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);if(status)status.textContent=share?'图片已保存，可通过系统分享。':'图片已生成，请查看下载。'}
 }catch(e){if(status)status.textContent=e.name==='AbortError'?'已取消分享':'图片生成失败，请重试。'}finally{buttons.forEach(b=>b.disabled=false)}
}

function mount(html,name){
 const changed=screen!==name;closeModal();screen=name;$('#view').innerHTML=html;$('#view').classList.remove('screen-enter');void $('#view').offsetWidth;$('#view').classList.add('screen-enter');window.scrollTo({top:0,behavior:'instant'});
 if(!restoringRoute){if(routeReady&&changed)history.pushState(routeSnapshot(),'','#'+name);else history.replaceState(routeSnapshot(),'','#'+name);routeReady=true}
}

function flowBack(){if(screen==='result'){draftQuery=current.label;home()}else if(screen==='history'){returnScreen==='result'&&current?renderResult():home()}else if(screen==='manual'){searchState?offers(searchState.q,searchState.city):home()}else if(screen==='offers'){home()}else if(screen==='personal'){renderResult()}else home();}

function openOverview(){modal('这笔钱的10种表达',`<p class="quiet">点击任意一项，直接跳到对应卡片。</p>${cards().map((c,i)=>`<button class="offer" onclick="closeModal();goCard(${i})"><strong>${String(i+1).padStart(2,'0')} · ${esc(c.title)}</strong><span class="quiet">${c.num} ${c.unit}</span></button>`).join('')}`);}

function editAmount(){modal('换一笔金额看看',`<form id="amount-form"><label class="field">人民币金额<input id="new-amount" inputmode="decimal" value="${current.amount}" enterkeyhint="go"></label><div class="inline-error" id="amount-error" role="alert"></div><button class="primary wide">更新比较</button><button class="link wide" type="button" onclick="home()">改为查找商品或服务</button></form>`);$('#new-amount').focus();$('#new-amount').select();$('#amount-form').onsubmit=e=>{e.preventDefault();const amount=parseAmount($('#new-amount').value.trim());if(!(amount>0&&amount<=1e12)){$('#amount-error').textContent='请填写有效金额，例如“1万元”';return}start(amount,money(amount)+'元','用户输入金额')};}

function confirmClearPersonal(){modal('清除收支信息？','<p class="sub">清除后恢复全国参照，已有历史结果保持原样。</p><button class="primary wide" onclick="clearPersonal()">清除并返回全国参照</button><button class="secondary wide" onclick="closeModal()">保留收支信息</button>');}

function undoToast(record,position){clearTimeout(queryTimer);$('#toast').innerHTML='已删除记录 <button id="undo-delete" class="undo">撤销</button>';$('#toast').hidden=false;$('#undo-delete').onclick=()=>{records.splice(position,0,record);persist();historyView();$('#toast').hidden=true};queryTimer=setTimeout(()=>$('#toast').hidden=true,5000)}

function confirmClearHistory(){modal('清空全部历史？','<p class="sub">清空后无法恢复。个人参数将保留。</p><button class="primary wide" id="confirm-clear">确认清空</button><button class="secondary wide" onclick="closeModal()">保留记录</button>');$('#confirm-clear').onclick=()=>{records=[];persist();closeModal();historyView();};}

async function recalculate(){await refreshDataset();if(current.query?.kind==='product'){offers(current.query.q,current.query.city);return}const previous=current;start(previous.amount,previous.label,previous.source,{query:previous.query||null});toast('已按当前数据生成新记录，原记录保留')}

function chooseExport(all){exportAll=all;$('#single-export').classList.toggle('selected',!all);$('#all-export').classList.toggle('selected',all);$('#single-export').setAttribute('aria-pressed',String(!all));$('#all-export').setAttribute('aria-pressed',String(all));const c=cards()[index];$('#export-preview').innerHTML=all?`<div class="export-preview"><div class="eyebrow">POMO · 全部比较合集</div><h3>¥ ${money(current.amount)} 的 ${cards().length} 种表达</h3><p class="quiet">赚取时间 · 储蓄时间 · 多种日常购买力</p><p class="quiet">全部比较，保存为一张长图</p></div>`:`<div class="export-preview"><div class="eyebrow">POMO · ${index+1} / ${cards().length}</div><h3>${c.title}</h3><b>${c.num} <small>${c.unit}</small></b><p class="quiet">${c.caption}</p><p class="quiet">包含比较结果与计算依据</p></div>`;}

function validDataset(d){return !!d&&typeof d.version==='string'&&PomoCore.validBaseline(d.baseline)&&Array.isArray(d.references)&&d.references.length>=8&&d.references.every(g=>Array.isArray(g)&&typeof g[0]==='string'&&typeof g[1]==='string'&&typeof g[3]==='string'&&typeof g[4]==='string'&&Number.isFinite(g[2])&&g[2]>=.01)}

function sourceLink(url,title='查看来源'){const safe=PomoCore.safeLink(url);return safe?`<a class="source-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(title)} ↗</a>`:''}

function routeSnapshot(){return {screen,current:current?structuredClone(current):null,mode,index,draftQuery,searchState:searchState?structuredClone(searchState):null,returnScreen,lastHistoryMode}}

function rememberRoute(){if(routeReady&&!restoringRoute)history.replaceState(routeSnapshot(),'','#'+screen)}

function editReference(i){const g=current.goods[i];modal('按本地价格比较',`<p class="sub">${esc(g[0])} · ${esc(g[3])}</p><form id="reference-form"><label class="field">每${esc(g[1])}价格（元）<input id="reference-price" inputmode="decimal" value="${g[2]}"></label><div id="reference-error" class="inline-error" role="alert"></div><button class="primary wide">更新这张卡片</button></form>`);$('#reference-form').onsubmit=e=>{e.preventDefault();const amount=parseAmount($('#reference-price').value);if(amount===null||amount>1e7){$('#reference-error').textContent='请填写有效单价';return}current.goods[i][2]=amount;current.goods[i][5]={kind:'user',title:'用户填写的参考单价',note:'按用户填写的本地价格比较。'};commitSnapshot();closeModal();renderResult()}}

function commitSnapshot(){current.mode=mode;if(!lastHistoryMode){records=records.map(r=>r.id===current.id?structuredClone(current):r);persist()}rememberRoute()}

function cancelLookup(){lookupSerial++;lookupController?.abort();home()}

function cityForm(q){mount(`<section class="flow"><button class="back" onclick="home()">${uiIcon('back')} 返回输入</button><h1>这次服务，<br>发生在哪座城市？</h1><div class="query-summary"><span>${esc(q)}</span></div><form id="city-form"><label class="field">城市<input id="city" placeholder="例如：上海" autocomplete="address-level2" maxlength="40"></label><div id="city-error" class="inline-error" role="alert"></div><button class="primary wide">继续选择报价 →</button></form><button class="link wide" onclick="manual(searchState.q)">已经知道价格？直接填写</button></section>`,'offers');$('#city-form').onsubmit=e=>{e.preventDefault();const city=$('#city').value.trim();if(!city){$('#city-error').textContent='请填写城市';return}offers(q,city)}}

function quoteList(q,city,rows,message,cached,chosen=-1,sources=[]){
 searchState={...searchState,q,city,rows,chosen:chosen>=0&&chosen<rows.length?chosen:-1};
 mount(`<section class="flow"><button class="back" onclick="cancelLookup()">${uiIcon('back')} 返回输入</button><h1>${rows.length?'选一个，<br>你想了解的价格。':'这次，先用你知道的价格。'}</h1><div class="query-summary"><span>${esc(q)}${city?' · '+esc(city):''}</span>${searchState.service?'<button class="link" onclick="offers(searchState.q)">更改城市</button>':''}</div><p class="quiet quote-message">${esc(message)}</p><div id="offers" role="group" aria-label="商品或服务报价"></div>${webSourceList(sources,!rows.length)}<div class="flow-footer">${rows.length?'<button class="primary wide" id="offer-next" disabled>先选择一个报价</button>':''}<button class="${rows.length?'link':'primary'} wide" id="manual">手动填写价格继续</button></div></section>`,'offers');
 rows.forEach((o,i)=>{const row=document.createElement('article');row.className='quote-option';const b=document.createElement('button');b.className='offer';b.setAttribute('aria-pressed','false');b.innerHTML=`<strong>${esc(o.title)}</strong><span class="tag">${esc(o.source)}</span><span class="quote-kind">${o.kind==='search_snippet'?'搜索摘要参考价':o.kind==='official'?'官网报价':'网页参考价'}${o.priceType==='starting'?' · 起售价':''}</span><span class="quiet">${cached?'上次记录 · ':'抓取于 '}${esc(formatQuoteTime(o.checkedAt))}</span><div class="price">¥ ${money(o.price)}${o.priceType==='starting'?' 起':''}</div>${o.evidence?'<span class="quote-evidence">'+esc(o.evidence)+'</span>':''}`;b.onclick=()=>{searchState.chosen=i;document.querySelectorAll('.offer').forEach((el,j)=>{el.classList.toggle('selected',i===j);el.setAttribute('aria-pressed',String(i===j))});$('#offer-next').disabled=false;$('#offer-next').textContent='用 ¥'+money(o.price)+' 开始比较 →'};row.append(b);const a=document.createElement('div');a.className='quote-link';a.innerHTML=sourceLink(o.url,'查看报价来源');row.append(a);$('#offers').append(row);if(i===searchState.chosen)b.click()});
 if(rows.length)$('#offer-next').onclick=()=>{const quote=rows[searchState.chosen];if(!quote)return;start(quote.price,quote.title,quote.source,{quote:structuredClone(quote),query:{q,city,kind:'product'}})};
 $('#manual').onclick=()=>manual(q);
}

function formatDate(value){const d=new Date(value);return Number.isNaN(d.valueOf())?'日期未提供':new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',timeZone:'Asia/Shanghai'}).format(d)}

async function refreshDataset(){try{const response=await fetch('/api/baseline',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const d=await response.json();if(!validDataset(d))return;appData=d;try{localStorage.setItem('pomo-data-cache',JSON.stringify(d))}catch{}}catch{}}

async function bootstrap(){
 home();refreshDataset();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
 window.addEventListener('online',refreshDataset);
 window.addEventListener('popstate',e=>{const state=e.state;if(!state)return;lookupSerial++;lookupController?.abort();restoringRoute=true;current=state.current;mode=state.mode||'national';index=Number.isInteger(state.index)?state.index:0;draftQuery=state.draftQuery||'';searchState=state.searchState;returnScreen=state.returnScreen;lastHistoryMode=!!state.lastHistoryMode;try{if(state.screen==='result'&&current)renderResult();else if(state.screen==='history')historyView();else if(state.screen==='personal'&&current)editPersonal();else if(state.screen==='manual'&&searchState)manual(searchState.q);else if(state.screen==='offers'&&searchState)offers(searchState.q,searchState.city);else home()}finally{restoringRoute=false}});
}
function displaySource(value){return String(value||'')}
function onCardChange(){rememberRoute()}
document.addEventListener('keydown',e=>{const sheet=$('#overlay .sheet');if(e.key==='Escape'&&sheet){e.preventDefault();closeModal();return}if(e.key==='Tab'&&sheet){const items=[...sheet.querySelectorAll('button:not(:disabled),input,a[href],[tabindex="0"]')],first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
$('.top .icon').innerHTML=uiIcon('history')+' 历史';
bootstrap();

function formatQuoteTime(value){const d=new Date(value);return Number.isNaN(d.valueOf())?'日期未提供':new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}).format(d)}
function webSourceList(sources,open){const rows=(sources||[]).filter(r=>r&&typeof r.title==='string'&&PomoCore.safeLink(r.url)).slice(0,6);return rows.length?`<details class="web-sources" ${open?'open':''}><summary>查看找到的网页（${rows.length}）</summary>${rows.map(r=>`<article><strong>${sourceLink(r.url,r.title)}</strong><p>${esc(String(r.snippet||'').slice(0,230))}</p></article>`).join('')}</details>`:''}

const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.qa');fs.mkdirSync(path.join(out,'tmp'),{recursive:true});process.env.TEMP=path.join(out,'tmp');process.env.TMP=process.env.TEMP;
let runtime;try{runtime=require.resolve('playwright')}catch{runtime='C:/Users/7410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'}
const {chromium}=require(runtime),base=process.env.POMO_TEST_URL||'http://127.0.0.1:4317';
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(out,'browser-profile'),{executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,acceptDownloads:true,downloadsPath:out});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.evaluate(()=>{localStorage.clear();location.reload()});await page.waitForSelector('#query');
  await page.locator('#query').fill('10000');await page.locator('#query').press('Enter');await page.waitForSelector('.is-front');
  assert.equal(await page.locator('.card').count(),10);assert.equal(await page.evaluate(()=>current.baseline.year),2025);
  assert.ok(Math.abs(await page.evaluate(()=>current.baseline.income)-71590/12)<1e-8);
  assert.match(await page.locator('.is-front .source').textContent(),/2025年数据/);
  await page.emulateMedia({reducedMotion:'reduce'});await page.screenshot({path:path.join(out,'web-home-result.png')});
  for(const viewport of [{width:360,height:740},{width:430,height:932},{width:1440,height:1000}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const ratio=await page.locator('.is-front').evaluate(el=>el.getBoundingClientRect().height/Math.min(innerHeight,920));assert.ok(ratio>.8)}
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
  const cdp=await context.newCDPSession(page);
  async function swipe(a,z){const b=await page.locator('.rail').boundingBox(),y=b.y+250;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:a,y}]});for(let i=1;i<=7;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a+(z-a)*i/7,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
  await swipe(60,310);await page.waitForFunction(()=>index===1&&!deckState.busy);await swipe(310,60);await page.waitForFunction(()=>index===0&&!deckState.busy);
  await page.locator('.rail').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>index===9&&!deckState.busy);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>index===0&&!deckState.busy);
  const colors=await page.locator('.card').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));colors.forEach((c,i)=>assert.notEqual(c,colors[(i+1)%colors.length]));
  await page.locator('.is-front').getByRole('button',{name:'切换比较基准',exact:true}).click();await page.getByRole('button',{name:/个人情况/}).click();await page.locator('#income').fill('6000');await page.locator('#expense').fill('6000');await page.getByRole('button',{name:'查看个人情况 →',exact:true}).click();
  await page.getByRole('button',{name:'查看第2张：存下这笔钱',exact:true}).click();await page.waitForFunction(()=>index===1&&!deckState.busy);assert.match(await page.locator('.is-front .number').textContent(),/暂无结余/);
  await page.locator('.is-front .source').click();assert.match(await page.locator('.details').textContent(),/每月生活开支/);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.getByRole('button',{name:'历史记录',exact:true}).click();await page.locator('.history-row').first().locator('button').first().click();assert.equal(await page.evaluate(()=>mode),'personal');
  await page.locator('.is-front .source').click();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'修改金额',exact:true}).click();await page.locator('#new-amount').fill('2万元');await page.locator('#new-amount').press('Enter');assert.equal(await page.evaluate(()=>current.amount),20000);
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.goBack();await page.waitForSelector('.result-minimal');assert.equal(await page.evaluate(()=>current.amount),20000);
  // Browser history, current calculations and existing stored history are independent.
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.locator('#query').fill('iPhone 17');await page.locator('#query').press('Enter');await page.waitForSelector('.quote-option',{timeout:20000});
  assert.ok(await page.locator('.quote-option').count()>=2);assert.match(await page.locator('.quote-option').first().textContent(),/Apple 中国大陆官网/);
  const officialLink=await page.locator('.quote-option a').first().getAttribute('href');assert.ok(officialLink.startsWith('https://www.apple.com.cn/'));await page.locator('.offer').first().click();await page.locator('#offer-next').click();assert.equal(await page.evaluate(()=>current.quote.kind),'official');
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.locator('#query').fill('<img src=x onerror=alert(1)>');await page.locator('#query').press('Enter');await page.waitForSelector('#manual');assert.equal(await page.locator('#offers img').count(),0);await page.locator('#manual').click();await page.locator('#price').fill('299');await page.locator('#price').press('Enter');assert.equal(await page.evaluate(()=>current.amount),299);
  await page.getByRole('button',{name:'保存或分享',exact:true}).click();await page.locator('#all-export').click();const pending=page.waitForEvent('download');await page.locator('#save-image').click();const download=await pending;await download.saveAs(path.join(out,'pomo-all.png'));const png=fs.readFileSync(path.join(out,'pomo-all.png'));assert.equal(png.readUInt32BE(16),750);assert.ok(png.readUInt32BE(20)>10000);await page.keyboard.press('Escape');
  // Full app shell remains usable after an offline reload, not just the open DOM.
  await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('#query');await page.locator('#query').fill('1万元');await page.locator('#query').press('Enter');assert.equal(await page.locator('.card').count(),10);assert.match(await page.locator('.is-front .source').textContent(),/2025/);
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.locator('#query').fill('按摩');await page.locator('#query').press('Enter');await page.locator('#city').fill('上海');await page.locator('#city').press('Enter');await page.waitForSelector('#manual');await page.locator('#manual').click();await page.locator('#price').fill('199');await page.locator('#price').press('Enter');assert.equal(await page.evaluate(()=>current.query.city),'上海');await context.setOffline(false);
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.getByRole('button',{name:'历史记录',exact:true}).click();const before=await page.locator('.history-row').count();await page.locator('.delete-record').first().click();assert.equal(await page.locator('.history-row').count(),before-1);await page.locator('#undo-delete').click();assert.equal(await page.locator('.history-row').count(),before);
  await page.getByRole('button',{name:'清空记录',exact:true}).click();await page.locator('#confirm-clear').click();assert.equal(await page.locator('.history-row').count(),0);
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const viewport of [{width:390,height:844},{width:360,height:740}]){await page.setViewportSize(viewport);for(const amount of [.01,10000,1e12]){
   await page.evaluate(amount=>start(amount,String(amount),'用户输入金额'),amount);
   for(let i=0;i<10;i++){await page.evaluate(i=>goCard(i),i);await page.waitForFunction(i=>index===i&&!deckState.busy,i);await page.locator('.is-front img').evaluate(el=>el.decode());const overflow=await page.locator('.is-front').evaluate(el=>{const b=el.getBoundingClientRect();return el.scrollHeight>el.clientHeight+3||[...el.children].some(c=>{const r=c.getBoundingClientRect();return r.left<b.left+1||r.right>b.right-1})});assert.equal(overflow,false,JSON.stringify({viewport,amount,i}))}
  }}
  await page.evaluate(()=>{localStorage.setItem('pomo-web-v1','{"records":[{},null],"personal":{"income":"x"}}');localStorage.setItem('pomo-data-cache','null')});await page.reload();await page.waitForSelector('#query');assert.equal(await page.evaluate(()=>records.length),0);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'browser-report.json'),JSON.stringify({ok:true,testedAt:new Date().toISOString(),ui:'comic',checks:['official statistics','live Apple SKU quotes','touch/keyboard circular deck','personal snapshots','browser back','XSS text escaping','full-resolution PNG','service worker offline reload','manual city price offline','history delete/undo/clear','invalid storage recovery'],pageErrors:errors},null,2));
  console.log('PASS: browser end-to-end, live official quotes, offline reload, data provenance, personal history, PNG export, responsive layout and circular gestures.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

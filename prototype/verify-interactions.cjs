const fs=require('fs'),path=require('path'),assert=require('assert');
const root=__dirname,out=path.join(root,'.qa');fs.mkdirSync(path.join(out,'tmp'),{recursive:true});
process.env.TEMP=path.join(out,'tmp');process.env.TMP=process.env.TEMP;
const {chromium}=require('C:/Users/7410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(out,'profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:390,height:844},hasTouch:true,acceptDownloads:true,downloadsPath:out});
 try{
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('file:///'+root.replaceAll('\\','/')+'/index.html');
  await page.evaluate(()=>{localStorage.clear();location.reload()});await page.waitForSelector('#query');
  await page.locator('#query').fill('1万元');await page.locator('#query').press('Enter');
  assert.equal(await page.locator('.card').count(),10);
  assert.equal(await page.locator('.jump-tabs,.nav-arrow,.actions,.result-head,.deck-hint').count(),0);
  for(const viewport of [{width:390,height:844},{width:360,height:740},{width:430,height:932}]){
   await page.setViewportSize(viewport);
   const m=await page.evaluate(()=>({ratio:document.querySelector('.is-front').getBoundingClientRect().height/innerHeight,horizontal:document.documentElement.scrollWidth<=innerWidth,vertical:document.documentElement.scrollHeight<=innerHeight+2}));
   assert.ok(m.ratio>.8,'Card should occupy >80% screen height');assert.ok(m.horizontal);assert.ok(m.vertical,'Result must fit on one screen');
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.join(out,'minimal-result.png'),animations:'disabled'});
  const cdp=await context.newCDPSession(page);
  async function swipe(from,to){const b=await page.locator('.rail').boundingBox(),y=b.y+160;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:from,y}]});for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:from+(to-from)*i/8,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
  await swipe(60,310);await page.waitForFunction(()=>index===1&&!deckState.busy);
  await swipe(310,60);await page.waitForFunction(()=>index===0&&!deckState.busy);
  await swipe(80,260);await page.waitForFunction(()=>index===1&&!deckState.busy);
  await page.getByRole('button',{name:'查看第10张：可以买到 2,000 包抽纸',exact:true}).click();await page.waitForFunction(()=>index===9&&!deckState.busy);
  assert.equal(await page.locator('.card.is-behind').count(),2);
  await page.locator('.rail').focus();await page.keyboard.press('ArrowLeft');await page.waitForFunction(()=>index===8&&!deckState.busy);
  await page.getByRole('button',{name:'查看第1张：赚取这笔钱',exact:true}).click();await page.waitForFunction(()=>index===0&&!deckState.busy);
  const b=await page.locator('.rail').boundingBox();await page.mouse.move(b.x+300,b.y+230);await page.mouse.down();await page.mouse.move(b.x+60,b.y+230,{steps:10});await page.mouse.up();await page.waitForFunction(()=>index===9&&!deckState.busy);await page.getByRole('button',{name:'查看第2张：存下这笔钱',exact:true}).click();await page.waitForFunction(()=>index===1&&!deckState.busy);
  await page.locator('.is-front').getByRole('button',{name:'切换比较基准',exact:true}).click();await page.getByRole('button',{name:/个人情况/}).click();await page.waitForSelector('#personal-form');
  await page.locator('#income').fill('6000');await page.locator('#expense').fill('6000');await page.getByRole('button',{name:'查看个人情况 →',exact:true}).click();
  assert.match(await page.locator('.is-front .number').textContent(),/暂无结余/);
  await page.locator('.is-front').getByRole('button',{name:'查看计算依据 ↗',exact:true}).click();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'修改金额',exact:true}).click();await page.locator('#new-amount').fill('2万元');await page.locator('#new-amount').press('Enter');
  assert.match(await page.locator('.minimal-amount').textContent(),/20,000/);
  await page.getByRole('button',{name:'保存或分享',exact:true}).click();await page.locator('#all-export').click();
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'保存图片',exact:true}).click();const download=await pending;await download.saveAs(path.join(out,'export-all.png'));assert.ok(fs.statSync(path.join(out,'export-all.png')).size>1000);await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.getByRole('button',{name:'历史记录',exact:true}).click();assert.equal(await page.locator('.history-row').count(),2);await page.locator('.history-row').first().locator('button').first().click();assert.match(await page.locator('.is-front').textContent(),/历史结果/);
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.locator('#query').fill('手机');await page.locator('#query').press('Enter');await page.locator('.offer').nth(1).click();await page.locator('#offer-next').click();assert.match(await page.locator('.minimal-amount').textContent(),/4,999/);
  await page.getByRole('button',{name:'返回输入',exact:true}).click();await page.locator('#query').fill('按摩');await page.locator('#query').press('Enter');await page.locator('#city').fill('上海');await page.locator('#city').press('Enter');await page.locator('#manual').click();await page.locator('#price').fill('299');await page.locator('#price').press('Enter');assert.match(await page.locator('.minimal-amount').textContent(),/299/);
  assert.deepEqual(errors,[]);console.log('PASS: >80% viewport card height, no page overflow at 3 sizes, stacked touch/mouse/keyboard/dots, boundaries, baseline menu, personal calculation, source, amount edit, image export, history, offers, service manual price.');
  fs.writeFileSync(path.join(out,'verification.txt'),'PASS: fullscreen minimal deck, 390x844 / 360x740 / 430x932, interaction regression.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

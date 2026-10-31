const fs=require('fs'),path=require('path'),assert=require('assert');
const root=__dirname,out=path.join(root,'.qa');fs.mkdirSync(path.join(out,'tmp'),{recursive:true});process.env.TEMP=path.join(out,'tmp');process.env.TMP=process.env.TEMP;
const {chromium}=require('C:/Users/7410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const context=await chromium.launchPersistentContext(path.join(out,'direction-profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:390,height:844},hasTouch:true});
 try{
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto('file:///'+root.replaceAll('\\','/')+'/index.html');await p.evaluate(()=>start(10000,'1万元','用户输入金额'));
  const cdp=await context.newCDPSession(p),b=await p.locator('.rail').boundingBox(),y=b.y+260;
  const begin=async x=>cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  const move=async x=>cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
  const end=async cancel=>cdp.send('Input.dispatchTouchEvent',{type:cancel?'touchCancel':'touchEnd',touchPoints:[]});
  const settled=async i=>p.waitForFunction(i=>index===i&&!deckState.busy,i);
  const swipe=async(a,z)=>{await begin(a);for(let i=1;i<=7;i++)await move(a+(z-a)*i/7);await end(false)};
  await swipe(60,310);await p.waitForFunction(()=>deckState.phase==='under');
  assert.equal(await p.locator('.card').nth(0).evaluate(el=>el.style.zIndex), '0');
  assert.equal(await p.locator('.card').nth(0).evaluate(el=>el.inert),true);
  await settled(1);
  await begin(60);await move(240);await p.waitForFunction(()=>deckState.drag?.dx>100);
  assert.ok(await p.locator('.card').nth(1).evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)>0);
  assert.equal(await p.locator('.is-returning').count(),0);
  await end(false);await settled(2);
  const seen=new Set([0,1,2]);let expected=2;
  for(let i=0;i<24;i++){
    const right=i<12;await swipe(...(right?[65,310]:[310,65]));expected=(expected+(right?1:-1)+10)%10;await settled(expected);seen.add(expected);
    assert.equal(await p.locator('.card').count(),10);assert.equal(await p.locator('.is-front').count(),1);assert.equal(await p.locator('.is-behind').count(),2);
    assert.equal(await p.locator('.is-recycling,.is-returning,.is-leaving').count(),0);
  }
  assert.equal(seen.size,10);
  await begin(70);await move(230);await end(true);await settled(expected);
  await begin(160);await move(180);await end(false);await settled(expected);
  await begin(130);await move(260);await move(55);await p.waitForFunction(()=>deckState.drag?.dx<0);await end(false);expected=(expected+9)%10;await settled(expected);
  await p.evaluate(()=>goCard(9));await settled(9);await swipe(65,310);await settled(0);
  await p.evaluate(()=>{deckStep(-1);deckStep(1)});await settled(0);
  await p.emulateMedia({reducedMotion:'reduce'});await p.evaluate(()=>{for(let i=0;i<30;i++)deckStep(i%2?1:-1)});await settled(0);
  const colors=await p.locator('.card').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));for(let i=0;i<colors.length;i++)assert.notEqual(colors[i],colors[(i+1)%colors.length],'Adjacent colors including wrap must differ');
  assert.equal(await p.evaluate(()=>document.getAnimations().length),0);assert.deepEqual(errors,[]);
  console.log('PASS: right-next / left-previous with circular colors, under-stack z-order, 24 directional touch swipes across wraparound, no missing/duplicate cards, cancellation, short drag, reversal, wraparound, queued steps, reduced motion.');
 }finally{await context.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

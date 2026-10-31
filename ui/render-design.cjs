const fs=require('fs'),path=require('path');
const root=__dirname;
fs.mkdirSync(path.join(root,'screens'),{recursive:true});
fs.mkdirSync(path.join(root,'.render-tmp'),{recursive:true});
process.env.TEMP=path.join(root,'.render-tmp');process.env.TMP=process.env.TEMP;
const {chromium}=require('C:/Users/7410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
  const browser=await chromium.launchPersistentContext(path.join(root,'.render-profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:390,height:844},deviceScaleFactor:2});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.goto('file:///'+path.join(root,'../prototype/index.html').replaceAll('\\','/'));
    await page.evaluate(()=>{localStorage.clear();location.reload()});
    await page.waitForSelector('#query');
    async function shot(name){await page.evaluate(()=>{document.activeElement?.blur();return document.fonts.ready});const copy=await page.locator('body').innerText();if(/演示|模拟|虚拟|原型|预设|未选定|未核验|接入|浏览器/.test(copy))throw new Error('Developer copy found on '+name);await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));await page.screenshot({path:path.join(root,'screens',name+'.png'),animations:'disabled'});}
    await shot('01-home');
    await page.evaluate(()=>offers('手机'));
    await page.locator('.offer').nth(1).click();
    await shot('02-offers');
    await page.evaluate(()=>start(10000,'1万元','用户输入金额'));
    await shot('03-earning');
    await page.evaluate(()=>goCard(2));
    await page.waitForFunction(()=>index===2);
    await shot('04-purchasing');
    await page.evaluate(()=>goCard(1));
    await page.waitForFunction(()=>index===1);
    await shot('05-saving');
    await page.evaluate(()=>editPersonal());
    await page.locator('#income').fill('6000');await page.locator('#expense').fill('3500');
    await shot('06-personal');
    await page.getByRole('button',{name:'查看个人情况 →',exact:true}).click();
    await page.evaluate(()=>{mode='national';renderResult();details(0)});
    await shot('07-source');
    await page.evaluate(()=>{closeModal();exportMenu()});
    await shot('08-share');
    await page.evaluate(()=>{closeModal();start(300000,'30万元','用户输入金额');start(299,'按摩 · 上海','用户输入价格');historyView()});
    await shot('09-history');
    await page.evaluate(()=>start(10000,'1万元','用户输入金额'));
    for(let i=0;i<10;i++){
      await page.evaluate(i=>goCard(i),i);await page.waitForFunction(i=>index===i&&!deckState.busy,i);
      const type=await page.locator('.is-front').getAttribute('data-story');
      await shot('card-'+String(i+1).padStart(2,'0')+'-'+type);
    }
    await page.setViewportSize({width:1440,height:1100});
    await page.goto('file:///'+path.join(root,'index.html').replaceAll('\\','/'));
    await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode().catch(()=>{}))));
    await page.screenshot({path:path.join(root,'UI总览.png'),fullPage:true,animations:'disabled'});
    await page.locator('.device').first().click();
    if(!await page.locator('#viewer').isVisible())throw new Error('Design preview did not open');
    await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>window.scrollTo(0,0));
    if(!await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw new Error('Design board overflows mobile width');
    await page.setViewportSize({width:1920,height:1100});
    await page.goto('file:///'+path.join(root,'卡片分镜.html').replaceAll('\\','/'));
    await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    await page.screenshot({path:path.join(root,'卡片分镜总览.png'),fullPage:true,animations:'disabled'});
    if(errors.length)throw new Error(errors.join('\n'));
    console.log('Rendered 9 UI screens at 390×844, 2× resolution; no page errors.');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});

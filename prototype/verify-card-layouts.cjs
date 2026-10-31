const fs=require('fs'),path=require('path'),assert=require('assert'),root=__dirname;
fs.mkdirSync(path.join(root,'.qa/tmp'),{recursive:true});process.env.TEMP=path.join(root,'.qa/tmp');process.env.TMP=process.env.TEMP;
const {chromium}=require('C:/Users/7410/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const context=await chromium.launchPersistentContext(path.join(root,'.qa/layout-profile'),{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,viewport:{width:390,height:844}});try{
 const p=await context.newPage();await p.emulateMedia({reducedMotion:'reduce'});await p.goto('file:///'+root.replaceAll('\\','/')+'/index.html');
 for(const size of [{width:390,height:844},{width:360,height:740}]){await p.setViewportSize(size);for(const amount of [.01,10000,1e12]){
  await p.evaluate(amount=>start(amount,String(amount),'用户输入金额'),amount);
  assert.equal(await p.locator('[data-story]').evaluateAll(els=>new Set(els.map(el=>el.dataset.story)).size),10);
  for(let i=0;i<10;i++){
   await p.evaluate(i=>goCard(i),i);await p.waitForFunction(i=>index===i&&!deckState.busy,i);
   await p.locator('.is-front img').evaluate(el=>el.decode());
   const m=await p.locator('.is-front').evaluate(el=>{const b=el.getBoundingClientRect();return {type:el.dataset.story,overflowY:el.scrollHeight-el.clientHeight,contentOverflow:[...el.children].some(c=>{const r=c.getBoundingClientRect();return r.left<b.left+1||r.right>b.right-1})}});
   assert.ok(m.overflowY<=3&&!m.contentOverflow,JSON.stringify({size,amount,...m}));
  }
 }}console.log('PASS: 10 distinct card styles and images; 60 small/large-value layouts at 390x844 and 360x740 without content overflow.');
}finally{await context.close()}})().catch(e=>{console.error(e);process.exitCode=1});

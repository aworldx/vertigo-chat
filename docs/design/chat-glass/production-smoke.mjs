import {chromium,expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import {mkdir} from 'node:fs/promises';
const output='/app/docs/design/chat-glass/production';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
const page=await context.newPage();
page.on('requestfailed', request=>console.log('Request failed',new URL(request.url()).pathname,request.failure()?.errorText));
page.on('websocket',socket=>{socket.on('socketerror',error=>console.log('WebSocket error',error));});
try {
 await page.goto('https://vertigo-chat.ru/chat',{waitUntil:'domcontentloaded'});
 await page.locator('#chat-login-link').click();
 await page.locator('#entrance-nickname').fill('Проверка-темы');
 await page.locator('#enter-chat').click();
 await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true',{timeout:20000});
 await page.locator('#toggle-settings').click();
 await page.locator('#theme-id').selectOption('vertigo_glass');
 await page.locator('#message-frame').selectOption('true');
 await page.locator('#save-preferences').click();
 await page.reload({waitUntil:'domcontentloaded'});
 await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-theme','vertigo_glass');
 await expect(page.locator('#message-body')).toBeEnabled();
 await page.evaluate(async()=>{
   await Promise.all(['/images/vertigo-glass-evening-v2.png','/images/karmik-black-concept-v1.png'].map(src=>new Promise((resolve,reject)=>{
     const image=new Image(); image.onload=()=>resolve(true); image.onerror=()=>reject(new Error('Image load failed: '+src)); image.src=src;
   })));
 });
 await expect(page.locator('#dialogue-frame')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
 const reflections=await page.locator('#chat-room').evaluate(el=>getComputedStyle(el).getPropertyValue('--glass-reflections'));
 if(!reflections.includes('radial-gradient'))throw Error('Reflection CSS missing');
 await expect(page.locator('#karmik-sprite')).toBeVisible();
 for(const [width,height] of [[1440,900],[390,844]]) {
  await page.setViewportSize({width,height});
  for(const state of ['top','viewport','bottom']) {
   await page.locator('#messages').evaluate((el,state)=>{el.scrollTop=state==='top'?0:state==='viewport'?el.clientHeight:el.scrollHeight;},state);
   await page.screenshot({path:`${output}/${width}-${state}.png`});
  }
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Overflow');
 }
 await page.setViewportSize({width:1440,height:900});
 await page.locator('#toggle-settings').click();
 await page.locator('#message-frame').selectOption('false');
 await page.locator('#save-preferences').click();
 await expect(page.locator('#messages')).toHaveAttribute('data-message-frame','false');
 await page.screenshot({path:`${output}/1440-plain.png`});
 console.log('Production theme: login, saved preference/reload, both frame modes, reflected CSS, Karmik, desktop/mobile and scroll states OK. No public test messages sent.');
} catch(error) {
 console.log('Failure:',error.message);
 console.log((await page.locator('[role="alert"]').allTextContents()).join('\n'));
 await page.screenshot({path:`${output}/failure.png`});
 console.log((await page.locator('[role="alert"]').allTextContents()).join('\n'));
 throw error;
} finally {
 if(await page.locator('#leave-chat').count())await page.locator('#leave-chat').click();
 await browser.close();
}

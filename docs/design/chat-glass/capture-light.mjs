import { chromium, expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = '/app/docs/design/chat-glass';
const mode = process.argv[2] || 'mock-light-framed';
const framed = !mode.endsWith('plain');
const origin = process.env.GLASS_ORIGIN || 'http://127.0.0.1:4063';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1440,height:900},locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
const page = await context.newPage();
await mkdir(`${root}/${mode}`,{recursive:true});
const visual = mode !== 'baseline';
if (visual) {
  await page.route('**/api/v1/polls/notices', route=>route.fulfill({json:{polls:[{id:88001,question:'В чате нужны боты?',status:'open',options:[],totalVotes:0,selectedOptionID:0,createdAt:'2026-10-04T18:00:00Z',closedAt:null}]}}));
  await page.routeWebSocket('**/api/v1/chat/socket', socket=>{
    const server=socket.connectToServer();
    server.onMessage(raw=>{
      const frame=JSON.parse(String(raw));
      if(frame.snapshot) {
        const snapshot=frame.snapshot;
        const appearance={dark:{nickname_color:'#f6bbc7',text_color:'#f5f0df'},light:{nickname_color:'#9a3412',text_color:'#1f2937'}};
        const texts=['Ты когда-нибудь дочитывал книгу только ради финала?','Да. Иногда именно финал оставляет послевкусие на весь вечер.','А иногда он объясняет, зачем была нужна вся эта история.','Вечером хочу пройтись по набережной. Кто составит компанию?','Я за. Можно по дороге заглянуть в маленькую книжную.','Договорились! Встретимся после семи.'];
        snapshot.messages=Array.from({length:6},(_,i)=>({id:90000+i,client_id:`glass-fixture-${i}`,kind:'text',author:['Клэр','glass-designer','moon'][i%3],recipient:'',body:texts[i%texts.length],sent_at:`2026-10-04T18:${String(i).padStart(2,'0')}:00Z`,appearance,font_id:'sans',font_style:'normal',reactions:{},reacted:[]}));
        snapshot.peers=['glass-designer','Клэр','moon'].map((nickname,i)=>({id:`glass-peer-${i}`,nickname,registered:false,self:i===0,bot:false,rank:null,status:'active',preferences:{...snapshot.preferences,font_id:'sans',appearance:{...snapshot.preferences.appearance,...appearance}}}));
        snapshot.messages.splice(0,0,{...snapshot.messages[0],id:89999,client_id:'glass-system',kind:'system',author:'',body:'Клэр и moon присоединились к разговору',sent_at:'2026-10-04T17:59:00Z'});
        snapshot.typing=[];
      }
      socket.send(JSON.stringify(frame));
    });
  });
}
if(mode.startsWith('mock')) {
  const css=await readFile(`${root}/mock-app.css`,'utf8')+await readFile(`${root}/proposal-reading.css`,'utf8')+await readFile(`${root}/proposal-black-cat.css`,'utf8')+await readFile(`${root}/proposal-narrow.css`,'utf8')+await readFile(`${root}/proposal-polish.css`,'utf8')+await readFile(`${root}/proposal-modes.css`,'utf8')+await readFile(`${root}/proposal-light.css`,'utf8');
  await page.route('**/assets/app.css', route=>route.fulfill({body:css,contentType:'text/css'}));
  await page.route('**/images/vertigo-glass-evening-v2.png', route=>route.fulfill({path:'/app/apps/web/public/images/vertigo-glass-evening-v2.png',contentType:'image/png'}));
}
if(mode.startsWith('mock')) await page.route('**/images/karmik-black-concept-v1.png', route=>route.fulfill({path:'/app/apps/web/public/images/karmik-black-concept-v1.png',contentType:'image/png'}));
try {
  await page.goto(origin);
  await page.locator('#entrance-nickname').fill('glass-designer');
  await page.locator('#enter-chat').click();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  await page.locator('#toggle-settings').click();
  await page.locator('#theme-id').selectOption('vertigo_glass');
  await page.locator('#message-frame').selectOption(String(framed));
  await page.locator('#save-preferences').click();
  await expect(page.locator('#settings-modal')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-theme','vertigo_glass');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(700);
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[320,568]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(300);
    for(const state of ['top','viewport','bottom']) {
      await page.locator('#messages').evaluate((el,state)=>{el.scrollTop=state==='top'?0:state==='viewport'?el.clientHeight:el.scrollHeight;},state);
      await page.evaluate(state=>window.scrollTo(0,state==='top'?0:state==='viewport'?innerHeight:document.documentElement.scrollHeight),state);
      await page.waitForTimeout(150);
      await page.screenshot({path:`${root}/${mode}/${width}-${state}.png`,animations:'disabled'});
    }
    await page.locator('#show-command-menu').click();
    await expect(page.locator('#command-autocomplete-menu')).toBeVisible();
    await page.screenshot({path:`${root}/${mode}/${width}-commands.png`,animations:'disabled'});
    await page.locator('[data-command="/настройки"]').click();
    await page.locator('#send-message').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.screenshot({path:`${root}/${mode}/${width}-settings.png`,animations:'disabled'});
    await page.locator('#close-settings').click();
  }
  console.log(`${mode}: desktop and mobile reading-first proposal`);
  await page.locator('#leave-chat').click();
} finally {await browser.close();}

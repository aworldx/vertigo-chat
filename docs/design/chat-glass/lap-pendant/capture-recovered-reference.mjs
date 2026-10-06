import { chromium, expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = '/app/docs/design/chat-glass';
const mode = 'lap-pendant/recovered-reference-player';
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
await page.route('**/images/vertigo-glass-evening-v2.png', route=>route.fulfill({path:`${root}/lap-pendant/scene-partial-glass.png`,contentType:'image/png'}));
await page.route('**/music-chart/tracks/*', route=>route.fulfill({path:'/app/apps/web/browser/fixtures/player.webm',contentType:'audio/webm'}));
await page.route('**/assets/**', route=>route.fulfill({path:'/tmp/glass-frozen-web'+new URL(route.request().url()).pathname}));
await page.route('**/assets/app.css', route=>route.fulfill({path:`${root}/lap-pendant/prechange-app.css`,contentType:'text/css'}));
try {
  await page.goto(origin);
  await page.locator('#entrance-nickname').fill('glass-designer');
  await page.locator('#enter-chat').click();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  await page.locator('#toggle-settings').click();
  await page.locator('#theme-id').selectOption('vertigo_glass');
  await page.locator('#message-frame').selectOption(String(framed));
  await page.locator('#use-player').check();
  await page.locator('#save-preferences').click();
  await expect(page.locator('#settings-modal')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-theme','vertigo_glass');
  await page.addStyleTag({content: '.chat-shell[data-chat-theme="vertigo_glass"] .karmik-sprite { background-image:none !important; } .chat-shell[data-chat-theme="vertigo_glass"] #chat-online-sidebar {backdrop-filter:none;-webkit-backdrop-filter:none;} @media(min-width:768px) and (min-height:481px){.chat-shell[data-chat-theme="vertigo_glass"] {background-position:center,center,center,center,center,right -70px bottom;}}'});
  await page.addStyleTag({content:await readFile(`${root}/lap-pendant/player-glass.css`,'utf8')});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(700);
  await page.evaluate(()=>new Promise(resolve=>{
    const channel=new BroadcastChannel('vertigo-chart-queue');
    channel.onmessage=()=>{channel.close();resolve();};
    channel.postMessage({type:'enqueue',id:'glass-player-mock',nickname:'glass-designer',tracks:[{id:99001,title:'Чатлане — Ночной трамвай',author:'Клэр'},{id:99002,title:'Тёплый вечер',author:'moon'},{id:99003,title:'Огни города',author:'Клэр'}]});
  }));
  await page.locator('#chat-tv-mini-play').click();
  await expect(page.locator('#chat-tv-mini-play')).toHaveAttribute('aria-label','Пауза');
  await page.locator('#chat-tv-mini-play').click();
  for(const [width,height] of [[844,390]]) {
    await page.setViewportSize({width,height});
    for(const state of ['expanded','compact']) {
      if(state==='expanded') await page.locator('#chat-tv-expand').click();
      else await page.locator('#chat-tv-collapse').click();
      await expect(page.locator('#chat-tv')).toHaveAttribute('data-mode',state);
      await page.waitForTimeout(250);
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)) throw new Error('Horizontal overflow');
      for(const scroll of ['top','viewport','bottom']) {
        await page.locator('#messages').evaluate((el,s)=>{el.scrollTop=s==='top'?0:s==='viewport'?el.clientHeight:el.scrollHeight;},scroll);
        await page.evaluate(s=>window.scrollTo(0,s==='top'?0:s==='viewport'?innerHeight:document.documentElement.scrollHeight),scroll);
        await page.waitForTimeout(300);
        await page.screenshot({path:`${root}/${mode}/${width}-${state}-${scroll}.png`,animations:'disabled'});
      }
    }
  }
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('#chat-tv-toggle')).toHaveCount(0);
  await page.screenshot({path:`${root}/${mode}/390-inline-only.png`,animations:'disabled'});
  console.log(`${mode}: desktop and mobile reading-first proposal`);
  await page.locator('#leave-chat').click();
} finally {await browser.close();}

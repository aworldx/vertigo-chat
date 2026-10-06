import { chromium, expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const root = '/app/docs/design/nice';
const mode = process.argv[2] || 'baseline';
const framed = !mode.endsWith('plain');
const origin = process.env.GLASS_ORIGIN || 'http://127.0.0.1:4063';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1440,height:900},locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
const page = await context.newPage();
await mkdir(`${root}/${mode}`,{recursive:true});
const visual = true;
if (visual) {
  await page.route('**/api/v1/polls/notices', route=>route.fulfill({json:{polls:[{id:88001,question:'В чате нужны боты?',status:'open',options:[],totalVotes:0,selectedOptionID:0,createdAt:'2026-10-04T18:00:00Z',closedAt:null}]}}));
  await page.routeWebSocket('**/api/v1/chat/socket', socket=>{
    const server=socket.connectToServer();
    server.onMessage(raw=>{
      const frame=JSON.parse(String(raw));
      if(frame.snapshot) {
        const snapshot=frame.snapshot;
        const appearance={dark:{nickname_color:'#f6bbc7',text_color:'#f5f0df'},light:{nickname_color:'#155b89',text_color:'#203e50'}};
        const texts=['Ты когда-нибудь дочитывал книгу только ради финала?','Да. Иногда именно финал оставляет послевкусие на весь вечер.','А иногда он объясняет, зачем была нужна вся эта история.','Вечером хочу пройтись по набережной. Кто составит компанию?','Я за. Можно по дороге заглянуть в маленькую книжную.','Договорились! Встретимся после семи.'];
        snapshot.messages=Array.from({length:6},(_,i)=>({id:90000+i,client_id:`glass-fixture-${i}`,kind:'text',author:['Клэр','nice-designer','moon'][i%3],recipient:'',body:texts[i%texts.length],sent_at:`2026-10-04T18:${String(i).padStart(2,'0')}:00Z`,appearance,font_id:'sans',font_style:'normal',reactions:{},reacted:[]}));
        snapshot.peers=['nice-designer','Клэр','moon'].map((nickname,i)=>({id:`glass-peer-${i}`,nickname,registered:false,self:i===0,bot:false,rank:null,status:'active',preferences:{...snapshot.preferences,font_id:'sans',appearance:{...snapshot.preferences.appearance,...appearance}}}));
        snapshot.peers[1]={...snapshot.peers[1],id:'bot-claire',bot:true,registered:true};
        snapshot.peers[2]={...snapshot.peers[2],registered:true,rank:{title:'Звезда',icon_url:'/images/ranks/star.svg'}};
        snapshot.messages.splice(0,0,{...snapshot.messages[0],id:89999,client_id:'glass-system',kind:'system',author:'',body:'Клэр и moon присоединились к разговору',sent_at:'2026-10-04T17:59:00Z'});
        snapshot.typing=[];
      }
      socket.send(JSON.stringify(frame));
    });
  });
}
try {
  await page.goto(origin);
  await page.locator('#entrance-nickname').fill('nice-designer');
  await page.locator('#enter-chat').click();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  await page.locator('#toggle-settings').click();
  await page.locator('#theme-id').selectOption('vertigo_glass');
  await page.locator('#message-frame').selectOption(String(framed));
  if(mode.endsWith('hidden')) await page.locator('#hide-karmik').check();
  await page.locator('#save-preferences').click();
  await expect(page.locator('#settings-modal')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-theme','vertigo_glass');
  if(mode.startsWith('mock-')) {
    await page.route('**/nice-promenade.png', r=>r.fulfill({path:root+(mode.endsWith('hidden')?'/assets/promenade-empty-v1.png':'/assets/promenade-white-karmik-v2.png'),contentType:'image/png'}));
    await page.addStyleTag({content:await readFile(root+'/proposal.css','utf8')+await readFile(root+'/extension.css','utf8')});
  }
  await page.evaluate(()=>{const select=document.querySelector('#theme-id');if(select){} });
  await page.mouse.move(0,0);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(700);
  for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[320,568]]) {
    await page.setViewportSize({width,height});
    await page.waitForTimeout(300);
    if(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth)) throw new Error('Horizontal overflow '+width);
    for(const state of ['top','viewport','bottom']) {
      await page.locator('#messages').evaluate((el,state)=>{el.scrollTop=state==='top'?0:state==='viewport'?el.clientHeight:el.scrollHeight;},state);
      await page.evaluate(state=>window.scrollTo(0,state==='top'?0:state==='viewport'?innerHeight:document.documentElement.scrollHeight),state);
      await page.waitForTimeout(150);
      await page.screenshot({path:`${root}/${mode}/${width}-${state}.png`,animations:'disabled'});
      if(width===1440 && state==='top') await page.screenshot({path:`${root}/${mode}/nickname-icons.png`,clip:{x:1120,y:86,width:304,height:190},animations:'disabled'});
    }

    await page.locator('#show-command-menu').click();
    await page.screenshot({path:`${root}/${mode}/${width}-commands.png`,animations:'disabled'});
    await page.locator('[data-command="/настройки"]').click();
    await page.locator('#send-message').click();
    await expect(page.locator('#settings-panel')).toBeVisible();
    await page.locator('#theme-id option[value="vertigo_glass"]').evaluate(el=>el.textContent='Ницца · Светлая');
    await page.screenshot({path:`${root}/${mode}/${width}-settings.png`,animations:'disabled'});
    await page.locator('#close-settings').click();
  }
  console.log(`${mode}: desktop and mobile reading-first proposal`);
  await page.locator('#leave-chat').click();
} catch(e) { console.log(await page.locator('body').innerText()); await page.screenshot({path:root+'/error.png'}); throw e; } finally {await browser.close();}

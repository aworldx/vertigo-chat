import {render} from './render.mjs';
import { chromium, expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const theme = process.env.GEO_DESIGN_THEME || 'vertigo_glass';
const root = '/app/docs/design/geo-chat/'+(process.env.GEO_ACTUAL?'verification/v9':'design-v9')+'/'+theme+(process.env.GEO_RECAPTURE?'/stable-reference':'');
const mode = process.argv[2] || 'baseline';
const framed = !mode.endsWith('plain');
const origin = process.env.GLASS_ORIGIN || 'http://127.0.0.1:4094';
const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1440,height:900},locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
const page = await context.newPage();
if(!process.env.GEO_ACTUAL)await page.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=q=>original(q==='(min-width: 768px)'?'(min-width: 768px) and (min-height: 481px)':q)});
await page.route('**/api/v1/geo',r=>r.fulfill({json:{phase:'idle',configured:false,leaders:[],round:0,total:5,server_time:new Date().toISOString(),cooldown:new Date().toISOString(),deadline:new Date().toISOString(),own_answer:'',answered:0,id:''}}));
await mkdir(`${root}/${mode}`,{recursive:true});
const audio=Buffer.alloc(44+8000*2*600);audio.write('RIFF',0);audio.writeUInt32LE(audio.length-8,4);audio.write('WAVEfmt ',8);audio.writeUInt32LE(16,16);audio.writeUInt16LE(1,20);audio.writeUInt16LE(1,22);audio.writeUInt32LE(8000,24);audio.writeUInt32LE(16000,28);audio.writeUInt16LE(2,32);audio.writeUInt16LE(16,34);audio.write('data',36);audio.writeUInt32LE(audio.length-44,40);
await page.route('**/music-proxy?*',r=>r.fulfill({contentType:'audio/wav',body:audio}));
await page.route('https://maps.googleapis.com/maps/api/js?**',r=>r.fulfill({contentType:'text/javascript',body:`window.google={maps:{StreetViewPanorama:class {constructor(el,o){this.id=o.pano;el.innerHTML='<img alt="Тестовая панорама" src="/geo-test-location" style="width:100%;height:100%;object-fit:cover">'}addListener(n,fn){const t=setTimeout(fn,0);return {remove(){clearTimeout(t)}}}getStatus(){return 'OK'}getLinks(){return []}setPano(id){this.id=id}setPov(){}setZoom(){}setVisible(){}},event:{trigger(){}}}};`}));
await page.route('**/geo-test-location',r=>r.fulfill({path:'/app/docs/design/geo-chat/reference-v1/assets/location.jpg'}));
const visual = true;
if (visual) {
  await page.route('**/api/v1/polls/notices', route=>route.fulfill({json:{polls:[{id:88001,question:'В чате нужны боты?',status:'open',options:[],totalVotes:0,selectedOptionID:0,createdAt:'2026-10-04T18:00:00Z',closedAt:null}]}}));
  await page.routeWebSocket('**/api/v1/chat/socket', socket=>{
    const server=socket.connectToServer();
    server.onMessage(raw=>{
      const frame=JSON.parse(String(raw));
      if(frame.snapshot) {
        const snapshot=frame.snapshot; snapshot.preferences={...snapshot.preferences,appearance:{...snapshot.preferences.appearance,use_player:true}};
        const appearance={dark:{nickname_color:'#f6bbc7',text_color:'#f5f0df'},light:{nickname_color:'#9a3412',text_color:'#1f2937'}};
        const texts=['Ты когда-нибудь дочитывал книгу только ради финала?','Да. Иногда именно финал оставляет послевкусие на весь вечер.','А иногда он объясняет, зачем была нужна вся эта история.','Вечером хочу пройтись по набережной. Кто составит компанию?','Я за. Можно по дороге заглянуть в маленькую книжную.','Договорились! Встретимся после семи.'];
        snapshot.messages=Array.from({length:6},(_,i)=>({id:90000+i,client_id:`glass-fixture-${i}`,kind:'text',author:['Клэр','geo-designer','moon'][i%3],recipient:'',body:texts[i%texts.length],sent_at:`2026-10-04T18:${String(i).padStart(2,'0')}:00Z`,appearance,font_id:'sans',font_style:'normal',reactions:{},reacted:[]}));
        snapshot.peers=['geo-designer','Клэр','moon'].map((nickname,i)=>({id:`glass-peer-${i}`,nickname,registered:false,self:i===0,bot:false,rank:null,status:'active',preferences:{...snapshot.preferences,font_id:'sans',appearance:{...snapshot.preferences.appearance,...appearance}}}));
        snapshot.messages.splice(0,0,{...snapshot.messages[0],id:89999,client_id:'glass-system',kind:'system',author:'',body:'Клэр и moon присоединились к разговору',sent_at:'2026-10-04T17:59:00Z'});
        snapshot.messages.push({...snapshot.messages[1],id:90010,client_id:'fixture-music',kind:'music',body:'Ночной трамвай',artist:'Чатлане',duration:'10:00',media_url:'https://sunproxy.net/file/geo-fixture'});snapshot.typing=[];
      }
      socket.send(JSON.stringify(frame));
    });
  });
}
try {
  await page.goto(origin);
  await page.locator('#entrance-nickname').fill('geo-'+Date.now().toString().slice(-7));
  await page.locator('#enter-chat').click();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  await page.locator('#toggle-settings').click();
  await page.locator('#theme-id').selectOption(theme);
  await page.locator('#message-frame').selectOption(String(framed));
  await page.locator('#save-preferences').click();
  await expect(page.locator('#settings-modal')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-theme',theme);
  await page.mouse.move(0,0);
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(700);
  await render(page,root);
} catch(e) { console.log(await page.locator('body').innerText()); await page.screenshot({path:root+'/error.png'}); throw e; } finally {await browser.close();}

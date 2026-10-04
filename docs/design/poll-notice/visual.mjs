// Deterministic visual fixture; functional checks use real Go/PostgreSQL separately.
import { chromium, expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs'
import { defaultPreferences } from '/app/apps/web/src/features/chat/api/preferences.ts'
const mode=process.argv[2] ?? 'mock'
const dir='/app/docs/design/poll-notice'
const browser=await chromium.launch({headless:true})
const prefs=structuredClone(defaultPreferences)
prefs.appearance.hide_karmik=true
const message=(id)=>({id,client_id:'',kind:'text',author:'Собеседник',recipient:'',body:'Сообщение '+id+'. Обсуждаем новости чата.',sent_at:'2026-10-04T09:00:00Z',reactions:{},reacted:[],appearance:prefs.appearance,font_id:'theme',font_style:'normal'})
const snapshot={messages:[1,2,3].map(message),peers:[{id:'fixture',nickname:'Участник',registered:false,self:true,bot:false,rank:null,status:'active',preferences:prefs}],preferences:prefs,admin:false,typing:[]}
const poll={id:1,question:'Какой сценарий проверить?',status:'open',options:[],totalVotes:0,selectedOptionID:0,createdAt:'2026-10-04T09:00:00Z',closedAt:null}
for(const viewport of [{width:1440,height:900},{width:768,height:1024},{width:390,height:844}]){
 const context=await browser.newContext({viewport,deviceScaleFactor:1,locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'})
 await context.addInitScript(()=>sessionStorage.setItem('vertigo.go-chat',JSON.stringify({nickname:'Участник',resume_token:'visual-fixture-only'})))
 const page=await context.newPage()
 let socket
 await page.routeWebSocket('**/api/v1/chat/socket',ws=>{socket=ws;ws.onMessage(raw=>{if(JSON.parse(String(raw)).type==='resume')ws.send(JSON.stringify({type:'ready',connection_id:'visual',generation:1,snapshot}))})})
 await page.route('**/api/v1/polls/notices',r=>r.fulfill({json:{polls:[poll]}}))
 await page.goto('http://127.0.0.1:4073/chat')
 await page.locator('#poll-system-notice-1').waitFor()
 await page.evaluate(()=>document.fonts.ready)
 if(mode==='mock'){
 await page.screenshot({path:dir+'/'+viewport.width+'-fixture-baseline.png'})
 await page.evaluate(()=>{
 const old=document.querySelector('#poll-system-notice-1')
 const block=old
 block.className=''
 block.parentElement.style.marginTop='0'
 block.id='poll-system-notice-1'
 block.style.cssText='display:flex;align-items:center;gap:12px;margin:12px 0 0;padding:12px;border:1px solid #3f3f46;border-radius:8px;background:#18181b;font-size:12px;line-height:20px;color:#d4d4d8;flex-shrink:0'
 block.innerHTML='<span style="color:#fcd34d" aria-hidden="true">✦</span><div style="min-width:0;flex:1;overflow-wrap:anywhere"><span>Новый опрос: Какой сценарий проверить?</span> <a href="/polls" style="color:#fde68a;font-weight:600;text-decoration:underline;text-underline-offset:2px">Открыть</a></div><button type="button" aria-label="Закрыть приглашение" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:4px;color:#a1a1aa;font-size:20px">×</button><span class="sr-only">Видно только вам.</span>'

 })
 }
 await page.screenshot({path:dir+'/'+viewport.width+'-'+mode+'.png'})
 socket.send(JSON.stringify({type:'snapshot',snapshot:{...snapshot,messages:Array.from({length:40},(_,i)=>message(i+1))}}))
 await expect(page.locator('#messages')).toContainText('Сообщение 40.')
 if(mode==='mock') await page.evaluate(()=>document.querySelector('#message-3').after(document.querySelector('#poll-system-notices')))
 for(const state of ['top','middle','bottom']){
 await page.locator('#messages').evaluate((el,state)=>{el.scrollTop=state==='top'?0:state==='middle'?el.clientHeight:el.scrollHeight},state)
 await page.screenshot({path:dir+'/'+viewport.width+'-'+mode+'-'+state+'.png'})
 }
 await expect(page.locator('body')).toHaveJSProperty('scrollWidth',viewport.width)
 await context.close()
}
await browser.close()

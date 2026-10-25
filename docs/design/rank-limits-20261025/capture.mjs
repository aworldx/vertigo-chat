import { chromium } from '/app/apps/web/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, access } from 'node:fs/promises'
const root='/workspace/docs/design/rank-limits-20261025'
const mode=process.env.CAPTURE_MODE||'mock'
if(mode==='mock'){try{await access(`${root}/FROZEN`);throw Error('Frozen original mockups must not be overwritten')}catch(e){if(e.code!=='ENOENT')throw e}}
const origin=process.env.ORIGIN||'http://host.docker.internal:4063'
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const records=[]
await mkdir(`${root}/${mode}`,{recursive:true})
for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'ru-RU',colorScheme:'dark'})
 await context.route('**/api/v1/auth/session',r=>r.fulfill({json:{data:{csrf_token:'design-fixture',principal:{user_id:1,nickname:'fixture01',roles:[]}}}}))
 await context.route('**/api/v1/library*',r=>r.fulfill({json:{data:[],series:[],can_publish:true}}))
 await context.route('**/api/v1/gallery',r=>r.fulfill({json:{data:[],can_upload:true}}))
 await context.route('**/api/v1/music-chart',r=>r.fulfill({json:{data:[]}}))
 const page=await context.newPage()
 const shot=async(name,state='top')=>{
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
  await page.mouse.move(0,0)
  await page.screenshot({path:`${root}/${mode}/${name}-${width}-${state}.png`,animations:'disabled'})
  records.push({name,state,width,height,route:new URL(page.url()).pathname,auth:'fixture01 registered; user_id=1; roles=[]',fixture:'empty collections; can_publish=true; can_upload=true; live ranks thresholds/icons; mock limits [1,2,3,5,8,12,18,25,35,50]',scroll:await page.evaluate(()=>({window:scrollY,editor:document.querySelector('#library-editor')?.scrollTop??null})),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})
 }
 await page.goto(origin+'/help');await page.locator('#rank-10').waitFor()
 if(mode==='mock')await page.evaluate(()=>{
  document.querySelectorAll('#ranks-list > li').forEach((card,i)=>{
   const limit=[1,2,3,5,8,12,18,25,35,50][i]
   card.querySelector('.text-emerald-300')?.remove()
   const p=document.createElement('p');p.className='mt-4 text-xs leading-5 text-zinc-400';p.textContent=`Общие лимиты: хит-парад — ${limit}, статьи — ${limit}, фото — ${limit}.`;card.querySelector('h2').parentElement.append(p)
  })
 })
 await page.locator('#ranks-title').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-24));await shot('ranks','start')
 await page.locator('#rank-9').evaluate(e=>window.scrollTo(0,e.getBoundingClientRect().top+scrollY-24));await shot('ranks','end')
 await page.goto(origin+'/music-chart');await page.locator('#music-chart-upload-form').waitFor()
 if(mode==='mock')await page.locator('aside > p').evaluate(e=>e.textContent='Общий лимит треков зависит от звания. Подробности — в помощи.')
 await shot('chart')
 await page.locator('#music-chart-upload-form').evaluate(e=>window.scrollTo(0,Math.max(0,e.parentElement.getBoundingClientRect().top+scrollY-24)));await shot('chart','form')
 await page.goto(origin+'/gallery');await page.locator('#gallery-upload-form').waitFor()
 if(mode==='mock')await page.locator('#gallery-page main h1 + p').evaluate(e=>e.textContent='Общая коллекция снимков чатлан. Общий лимит фотографий зависит от звания. Подробности — в помощи.')
 await shot('gallery')
 await page.goto(origin+'/library');await page.locator('#new-library-article').click();await page.locator('#library-editor').waitFor()
 if(mode==='mock')await page.locator('.library-editor-preview p').filter({hasText:'До 10 новых'}).evaluate(e=>e.textContent='Общий лимит статей зависит от звания. Подробности — в помощи.')
 if(width<1024)await page.locator('#library-preview-tab').click()
 await page.locator('#library-editor').evaluate(e=>e.scrollTop=0);await shot('editor','top')
 await page.locator('#library-editor').evaluate(e=>e.scrollTop=innerHeight);await shot('editor','viewport')
 await page.locator('#library-editor').evaluate(e=>e.scrollTop=e.scrollHeight);await shot('editor','bottom')
 await context.close()
}
await writeFile(`${root}/${mode}/manifest.json`,JSON.stringify(records,null,2))
await browser.close()

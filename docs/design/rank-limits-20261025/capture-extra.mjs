import { chromium } from '/app/apps/web/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile, access } from 'node:fs/promises'
const root='/workspace/docs/design/rank-limits-20261025'
const mode=process.env.CAPTURE_MODE||'mock-extra'
if(mode==='mock-extra'){try{await access(`${root}/FROZEN-extra`);throw Error('Frozen original mockups must not be overwritten')}catch(e){if(e.code!=='ENOENT')throw e}}
const mock=mode==='mock-extra'
const origin=process.env.ORIGIN||'http://host.docker.internal:4063'
const browser=await chromium.launch({headless:true,args:['--no-sandbox']})
const records=[]
await mkdir(`${root}/${mode}`,{recursive:true})
for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'ru-RU',colorScheme:'dark'})
 await context.route('**/api/v1/auth/session',r=>r.fulfill({json:{data:{csrf_token:'design-fixture',principal:{user_id:1,nickname:'fixture01',roles:[]}}}}))
 await context.route('**/api/v1/library*',r=>r.fulfill({json:{data:[],series:[],can_publish:false}}))
 await context.route('**/api/v1/gallery',r=>r.fulfill({json:{data:[],can_upload:false}}))
 const page=await context.newPage()
 const shot=async(name)=>{
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))})
  await page.mouse.move(0,0)
  await page.screenshot({path:`${root}/${mode}/${name}-${width}.png`,animations:'disabled'})
  records.push({name,width,height,route:new URL(page.url()).pathname,auth:'fixture01 registered; user_id=1; roles=[]',fixture:'empty collections; can_publish=false; can_upload=false; denied fallback retained defensively; no chat session',scroll:await page.evaluate(()=>scrollY),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)})
 }
 await page.goto(origin+'/gallery');await page.locator('#gallery-rank-hint').waitFor()
 if(mock)await page.evaluate(()=>{document.querySelector('#gallery-page main h1 + p').textContent='Общая коллекция снимков чатлан. Общий лимит фотографий зависит от звания. Подробности — в помощи.';document.querySelector('#gallery-rank-hint').textContent='Добавлять фото могут зарегистрированные чатлане.'})
 await shot('gallery-denied')
 await page.goto(origin+'/library');await page.locator('#library-rank-hint').waitFor()
 if(mock)await page.locator('#library-rank-hint').evaluate(e=>e.textContent='Добавлять статьи могут зарегистрированные чатлане.')
 await shot('library-denied')
 await page.goto(origin+'/');await page.locator('#landing-registration').waitFor()
 if(mock)await page.evaluate(()=>{
  document.querySelectorAll('.landing-benefit-list p')[1].textContent='Копи публичные фразы и часы в чате: звания увеличивают лимиты материалов, а результаты игр остаются в рейтингах.'
  document.querySelectorAll('.landing-benefit-list p')[2].textContent='Оформи анкету, отправляй фото и аудио, оставляй записки. После регистрации добавляй фото в альбом и статьи в библиотеку; общий лимит зависит от звания.'
  document.querySelector('#landing-section-library > p').textContent='Статьи и серии от участников. Читай, ставь лайки и сохраняй закладки после входа. Публикуй свои тексты после регистрации; общий лимит зависит от звания.'
  document.querySelector('#landing-section-gallery > p').textContent='Смотри и оценивай фотографии чатлан. Загружай свои снимки после регистрации; общий лимит зависит от звания.'
  document.querySelector('#landing-section-music-chart > p').textContent='Слушай, оценивай и обсуждай треки. После входа добавляй свои записи; общий лимит зависит от звания. На компьютере отправляй весь топ в очередь плеера чата.'
 })
 await page.locator('#landing-registration').evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-24));await shot('landing-benefits')
 for(const id of ['library','gallery','music-chart']){
  await page.locator(`#landing-section-${id}`).evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-24));await shot(`landing-${id}`)
 }
 await context.close()
}
await writeFile(`${root}/${mode}/manifest.json`,JSON.stringify(records,null,2));await browser.close()

import {createRequire} from 'node:module'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const require=createRequire('/app/apps/web/package.json')
const {chromium}=require('@playwright/test')
const base='/app/docs/design/landing-copy-20261010'
const mode=process.argv[2] || 'baseline'
const output=`${base}/${mode}`
await mkdir(output,{recursive:true})
const proposal=mode==='mock' ? JSON.parse(await readFile(`${base}/copy.json`,'utf8')) : null
const browser=await chromium.launch({headless:true})
const manifest=[]
try {
for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'})
 const page=await context.newPage()
 await page.goto('http://127.0.0.1:4097/',{waitUntil:'networkidle'})
 await page.evaluate(()=>document.fonts.ready)
 if(proposal) await page.evaluate((data)=>{
  document.querySelector('.landing-hero-description').textContent=data.hero
  document.querySelector('.landing-benefits > .landing-section-description').textContent=data.benefitsDescription
  document.querySelectorAll('.landing-benefit-list p').forEach((p,i)=>p.textContent=data.benefits[i])
  document.querySelector('#landing-section-chat > p').textContent=data.chat
  document.querySelector('#landing-section-games h3').textContent=data.gamesTitle
  document.querySelector('#landing-section-games > p').textContent=data.games
  document.querySelector('.landing-game-links').replaceChildren(...data.gameLinks.map(link=>{
   const a=document.createElement('a');a.href=link.href;a.textContent=link.text;return a
  }))
  const gamesAction=document.querySelector('#landing-open-games')
  gamesAction.href=data.gamesAction.href
  gamesAction.firstChild.textContent=data.gamesAction.text+' '
  const grid=document.querySelector('.landing-directory')
  const template=grid.firstElementChild.cloneNode(true)
  const icons=Object.fromEntries([...document.querySelectorAll('svg[data-icon]')].map(icon=>[icon.dataset.icon,icon.cloneNode(true)]))
  grid.replaceChildren(...data.cards.map((card,index)=>{
   const item=template.cloneNode(true)
   item.id='landing-section-'+card.id
   item.href=card.href
   item.querySelector('.landing-section-number').textContent=String(index+3).padStart(2,'0')
   const icon=icons['hero-'+card.icon].cloneNode(true)
   icon.setAttribute('class','inline-block shrink-0 align-middle size-6')
   item.querySelector('.landing-feature-top svg').replaceWith(icon)
   item.querySelector('h3').textContent=card.title
   item.querySelector('p').textContent=card.body
   item.querySelector('.landing-feature-link').firstChild.textContent=card.action+' '
   return item
  }))
 },proposal)
 await page.mouse.move(0,0)
 await page.screenshot({path:`${output}/${width}x${height}-full.png`,fullPage:true})
 const metrics=await page.evaluate(()=>({scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:innerWidth,assets:[...document.images].map(i=>i.getAttribute('src'))}))
 for(const [state,y] of [['top',0],['middle',height],['bottom',metrics.scrollHeight-height]]) {
  await page.evaluate(y=>window.scrollTo(0,y),y)
  await page.screenshot({path:`${output}/${width}x${height}-${state}.png`})
 }
 manifest.push({viewport:{width,height},route:'/',origin:'http://127.0.0.1:4097',state:'fresh guest; no stored session; untouched entrance form',deviceScaleFactor:1,zoom:1,reducedMotion:'reduce',metrics})
 await context.close()
}
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2))
} finally {await browser.close()}

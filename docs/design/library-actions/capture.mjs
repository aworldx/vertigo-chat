import { chromium } from '/app/apps/web/node_modules/playwright-core/index.mjs'
import fs from 'node:fs/promises'
const dir=process.env.LIBRARY_ACTIONS_DESIGN_ROOT || '/workspace/docs/design/library-actions', origin=process.env.LIBRARY_ACTIONS_ORIGIN || 'http://127.0.0.1:4078'
const mode=process.argv[2]||'baseline'
if(mode==='mock') {try{await fs.stat(dir+'/FROZEN');throw new Error('Frozen mockups')}catch(e){if(e.code!=='ENOENT')throw e}}
await fs.mkdir(dir+'/'+mode,{recursive:true})
const base={author_id:1,author:'fixture01',date:'04.10.2026',own:true,work_author:'',source_url:'',cover_image:'',series:'Хроники Vertigo',part_number:1,likes:3,liked:false,bookmarked:false}
const articles=[{...base,id:1,title:'Осенний вечер',body:'Тихий вечер в читальном зале. За окном горят огни, а на столе ждёт раскрытая книга.'},{...base,id:2,title:'Дорога домой',part_number:2,body:'Новая глава нашей истории.',likes:1,liked:true,bookmarked:true}]
const group={author_id:1,author:'fixture01',name:'Хроники Vertigo',count:2,description:'Истории о городе, встречах и возвращении домой.',own:true}
const browser=await chromium.launch({headless:true})
for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1})
 await page.route('**/api/v1/auth/session',r=>r.fulfill({json:{data:{csrf_token:'fixture-csrf',principal:{user_id:1,nickname:'fixture01',roles:[]}}}}))
 let currentState=''
 await page.route('**/api/v1/library*',r=>r.fulfill({json:{data:r.request().url().includes('bookmarks=1')?[articles[1]]:currentState==='reader'?articles.map(a=>a.id===1?{...a,body:'<!-- vertigo:markdown -->\n'+a.body+'\n\n![Вечер у окна](/images/library-cover-window.png)'}:a):articles,series:[group],can_publish:true}}))
 const states=mode==='baseline'?['list','editor']:['list','bookmarks','series','series-editor','editor','reader']
 for(const state of states) {
  currentState=state
  console.log(mode,width,state)
  const query=['series','series-editor'].includes(state)?'?author=1&series='+encodeURIComponent(group.name):state==='bookmarks'?'?bookmarks=1':''
  await page.goto(origin+'/library'+query)
  await page.locator('#site-account-nickname').waitFor()
  await page.locator('#articles-'+(state==='bookmarks'?2:1)).waitFor()
  if(state==='editor') {await page.locator('#new-library-article').click();await page.locator('#article_body').waitFor()}
  if(state==='reader') await page.locator('#read-article-1').click()
  if(mode==='mock') {
   await page.addStyleTag({content:await fs.readFile(dir+'/design.css','utf8')})
   await page.evaluate(({state,group})=>{
    const el=(html)=>{const t=document.createElement('template');t.innerHTML=html;return t.content.firstElementChild}
    const all=document.querySelector('#all-library-articles')
    all.after(el('<a id="library-bookmarks" class="library-all" href="/library?bookmarks=1">Мои закладки <span aria-hidden="true">↗</span></a>'))
    if(state==='bookmarks'){all.removeAttribute('aria-current');all.dataset.selected='false';document.querySelector('#library-bookmarks').setAttribute('aria-current','page');document.querySelector('#library-bookmarks').dataset.selected='true';document.querySelector('.library-section-heading h2').textContent='Мои закладки';document.querySelector('.library-section-heading span').outerHTML='<a href="/library">Показать всё</a>'}
    document.querySelectorAll('.library-card-copy').forEach((copy,i)=>{const active=copy.closest('article').id==='articles-2';copy.append(el(`<div class="library-reading-actions"><button class="library-action" aria-pressed="${active}">${active?'♥':'♡'} ${active?'1':'3'}</button><button class="library-action" aria-pressed="${active}">${active?'В закладках':'В закладки'}</button></div>`))})
    if(['series','series-editor'].includes(state)){document.querySelector('.library-section-heading').after(el(`<div class="library-section-description"><p>${group.description}</p><button id="edit-library-series" class="library-action">Редактировать серию</button></div>`))}
    if(state==='series-editor'){document.querySelector('#library-page').append(el(`<div id="library-series-editor" role="dialog" class="library-series-modal"><div class="library-series-dialog"><h2 id="library-series-editor-title">Редактирование серии</h2><form><label>Название серии<input value="${group.name}" maxlength="120"></label><label>Описание серии<textarea maxlength="2000">${group.description}</textarea></label><div class="library-reading-actions"><button type="button" class="library-action">Отмена</button><button type="submit" class="library-action">Сохранить серию</button></div></form></div></div>`))}
    if(state==='editor'){
      document.querySelector('.library-editor-series').before(el('<div><p class="mb-2 text-sm font-medium text-zinc-200">Обложка — необязательно</p><div class="library-cover-field"><div><div class="library-reading-actions"><button type="button" class="library-action">Загрузить обложку</button></div><p>JPEG или PNG, до 2 МБ.</p></div></div></div>'))
      document.querySelector('#article-format-link').after(el('<button type="button" class="library-format-button" id="article-format-image">Картинка</button>'))
    }
    if(state==='reader')document.querySelector('#article-text-1 .library-prose').append(el('<img src="/images/library-cover-window.png" alt="Вечер у окна">'))
   },{state,group})
  }
  if(mode==='actual'&&state==='series-editor')await page.locator('#edit-library-series').click()
  await page.evaluate(()=>{for(const image of document.images)image.loading='eager'})
  await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0))
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode()));if(document.activeElement instanceof HTMLElement)document.activeElement.blur()})
  await page.mouse.move(0,0)
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
  for(const position of (['list','editor'].includes(state)?['top','viewport','bottom']:['top'])) {
   await page.evaluate(({state,position})=>{const e=state==='editor'?document.querySelector('#library-editor'):document.scrollingElement;e.scrollTop=position==='top'?0:position==='viewport'?innerHeight:e.scrollHeight},{state,position})
   await page.screenshot({path:`${dir}/${mode}/${width}-${state}-${position}.png`,animations:'disabled'})
  }
 }
 await page.close()
}
await browser.close()
console.log(mode+' captured')

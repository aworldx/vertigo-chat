import { chromium } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
await page.route('**/api/v1/tetris/leaderboard*',r=>r.fulfill({json:[{nickname:'Клэр',rating:1180,matches:12,wins:8,score:12500,lines:42,level:5,achieved_at:'2026-10-06T12:00:00Z'},{nickname:'moon',rating:1095,matches:8,wins:4,score:9800,lines:31,level:4,achieved_at:'2026-10-05T12:00:00Z'}]}));
const root='/app/docs/design/geo-chat/design-v4/rankings';await mkdir(root,{recursive:true});const rows=[];
await page.goto('http://127.0.0.1:4094/games/tetris/leaderboard');await page.waitForSelector('tbody tr');
const original=await page.locator('#tetris-leaderboard').innerHTML();
for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390]]){
 await page.setViewportSize({width,height});
 for(const game of ['geo','tetris']){
  await page.evaluate(({game,original})=>{const section=document.querySelector('#tetris-leaderboard');section.innerHTML=original;section.querySelector('.tetris-eyebrow').textContent='VERTIGO / ИГРЫ';section.querySelector('h1').textContent='Рейтинги';const tabs=document.createElement('div');tabs.className='tetris-toolbar';tabs.innerHTML='<div role="group" aria-label="Игра"><button aria-pressed="'+(game==='geo')+'">Где мы?</button><button aria-pressed="'+(game==='tetris')+'">Тетрис</button></div>';section.querySelector('header').after(tabs);
   if(game==='geo'){for(const e of [...section.children].slice(2))e.remove();section.insertAdjacentHTML('beforeend','<p class="tetris-muted">Сумма очков за все завершённые раунды. Только зарегистрированные игроки. Страна — 1 балл, город — 3.</p><div class="tetris-table-wrap"><table><thead><tr><th>Место</th><th>Игрок</th><th>Очки</th><th>Раунды</th></tr></thead><tbody><tr><td>1</td><td>Клэр</td><td>128</td><td>64</td></tr><tr><td>2</td><td>moon</td><td>95</td><td>52</td></tr></tbody></table></div>');}
  },{game,original});
  await page.evaluate(()=>document.fonts.ready);
  for(const scroll of ['top','viewport','bottom']){await page.evaluate(s=>window.scrollTo(0,s==='top'?0:s==='viewport'?innerHeight:document.body.scrollHeight),scroll);const file=`${width}x${height}-${game}-${scroll}.png`;await page.screenshot({path:root+'/'+file});rows.push({file,viewport:{width,height},game,scroll,route:'/rankings',auth:'public',fixture:'Клэр, moon as declared in rankings.mjs'});}
 }
}
await writeFile(root+'/artifacts.json',JSON.stringify(rows,null,2));await browser.close();console.log('24 rankings pre-implementation mocks saved');

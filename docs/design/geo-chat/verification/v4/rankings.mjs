import { chromium,expect } from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import { mkdir,writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({locale:'ru-RU',timezoneId:'Europe/Moscow',reducedMotion:'reduce'});
const errors=[];page.on('pageerror',e=>errors.push(e.message));let scenario='rows';const queries=[];
await page.route('**/api/v1/tetris/leaderboard*',r=>{queries.push(new URL(r.request().url()).search);return r.fulfill({json:[{nickname:'Клэр',rating:1180,matches:12,wins:8,score:12500,lines:42,level:5,achieved_at:'2026-10-06T12:00:00Z'},{nickname:'moon',rating:1095,matches:8,wins:4,score:9800,lines:31,level:4,achieved_at:'2026-10-05T12:00:00Z'}]})});
await page.route('**/api/v1/geo/leaderboard',r=>scenario==='error'?r.fulfill({status:503,body:'unavailable'}):r.fulfill({json:scenario==='empty'?[]:[{nickname:'Клэр',points:128,rounds:64},{nickname:'moon',points:95,rounds:52}]}));
const root='/app/docs/design/geo-chat/verification/v4/rankings';await mkdir(root+'/actual',{recursive:true});const rows=[];
await page.goto('http://127.0.0.1:4094/rankings');await expect(page.locator('tbody tr')).toHaveCount(2);await page.reload();await expect(page.locator('h1')).toHaveText('Рейтинги');
for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390]]){
 await page.setViewportSize({width,height});
 for(const game of ['geo','tetris']){
  await page.getByRole('button',{name:game==='geo'?'Где мы?':'Тетрис',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(2);await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);
  for(const scroll of ['top','viewport','bottom']){await page.evaluate(s=>window.scrollTo(0,s==='top'?0:s==='viewport'?innerHeight:document.body.scrollHeight),scroll);const file=`${width}x${height}-${game}-${scroll}.png`;await page.screenshot({path:root+'/actual/'+file});rows.push({file,viewport:{width,height},game,scroll,status:'CAPTURED'});}
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow');
 }
}
await page.getByRole('button',{name:'Одиночная игра',exact:true}).click();await expect(page.locator('table')).toContainText('12 500');await page.locator('#tetris-ranking-period').selectOption('month');await expect.poll(()=>queries.some(q=>q.includes('mode=solo')&&q.includes('period=month'))).toBe(true);
scenario='error';await page.getByRole('button',{name:'Где мы?',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Не удалось');scenario='empty';await page.getByRole('button',{name:'Повторить',exact:true}).click();await expect(page.locator('.tetris-empty-ranking')).toBeVisible();
if(errors.length)throw Error(errors.join('\n'));await writeFile(root+'/captures.json',JSON.stringify(rows,null,2));await browser.close();console.log('PASS rankings direct/refresh, geo/Tetris, solo/month, retry/empty; 24 screenshots');

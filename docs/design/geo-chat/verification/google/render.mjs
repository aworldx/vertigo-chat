import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
export async function render(page,root) {
 await mkdir(root+'/actual',{recursive:true});
 const {GEO_GOOGLE_BROWSER_KEY:key}=JSON.parse(await readFile('/tmp/geo-credentials.json','utf8'));
 const fixed=new Date('2026-10-06T12:00:00Z');await page.clock.setFixedTime(fixed);
 await page.unroute('**/api/v1/geo');
 await page.route('**/api/v1/geo',r=>r.fulfill({json:{id:'map-reference',phase:'active',round:2,total:5,deadline:new Date(fixed.getTime()+38000).toISOString(),server_time:fixed.toISOString(),cooldown:fixed.toISOString(),configured:true,browser_key:key,own_answer:'',answered:2,leaders:[],scene:{pano_id:'fixture',heading:0,pitch:0}}}));
 await page.route('https://maps.googleapis.com/maps/api/streetview?**',r=>r.fulfill({path:'/app/docs/design/geo-chat/reference-v1/assets/location.jpg'}));
 const rows=JSON.parse(await readFile('/app/docs/design/geo-chat/design-google/'+(process.env.GEO_DESIGN_THEME||'vertigo_glass')+'/artifacts.json','utf8'));
 for(const row of rows) {
  await page.setViewportSize(row.viewport);await page.reload();
  await expect(page.locator('#geo-game')).toBeVisible();
  await page.getByRole('button',{name:'Карта',exact:true}).click();
  if(row.state==='map-expanded')await page.getByRole('button',{name:'Увеличить игру',exact:true}).click();
  await expect(page.locator('.geo-google-map .gm-style')).toBeVisible({timeout:20000});
  await page.waitForTimeout(1000);
  const map=page.locator('.geo-google-map'),box=await map.boundingBox();
  await map.click({position:{x:box.width/2,y:box.height/2}});
  await expect(page.locator('#geo-answer')).toHaveValue('Мали',{timeout:15000});
  await page.locator('#geo-answer').evaluate(e=>e.blur());await page.mouse.move(0,0);
  await page.waitForTimeout(1000);
  await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,row.scroll);
  await page.screenshot({path:root+'/actual/'+row.file});
  row.status=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)?'OVERFLOW':'CAPTURED';
 }
 await writeFile(root+'/captures.json',JSON.stringify(rows,null,2));console.log('Captured Google states: '+rows.length);
}

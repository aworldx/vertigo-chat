import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
export async function render(page,root){
 await mkdir(root+'/actual',{recursive:true});
 const {GEO_GOOGLE_BROWSER_KEY:key}=JSON.parse(await readFile('/tmp/geo-credentials.json','utf8'));
 const fixed=new Date('2026-10-06T12:00:00Z');await page.clock.setFixedTime(fixed);
 const rows=JSON.parse(await readFile('/app/docs/design/geo-chat/design-v5/'+(process.env.GEO_DESIGN_THEME||'vertigo_glass')+'/artifacts.json','utf8'));
 let panoID='fixture-unused';
 await page.route('**/api/v1/geo',r=>r.fulfill({json:{id:'v4',phase:'active',round:2,total:5,deadline:new Date(fixed.getTime()+278000).toISOString(),server_time:fixed.toISOString(),cooldown:fixed.toISOString(),configured:true,browser_key:key,own_answer:'',answered:2,leaders:[],scene:{pano_id:panoID,heading:0,pitch:0}}}));
 const result=[];
 for(const row of rows){

  await page.setViewportSize(row.viewport);await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  await expect(page.locator('#geo-game')).toHaveClass(/collapsed/);await expect(page.locator('.geo-panorama')).toHaveCount(0);
  if(row.state==='expanded')await page.getByRole('button',{name:'Увеличить игру',exact:true}).click();

  await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(150);
  await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,row.scroll);
  await page.screenshot({path:root+'/actual/'+row.file});
  result.push({...row,status:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)?'OVERFLOW':'CAPTURED'});
 }
 await writeFile(root+'/captures.json',JSON.stringify(result,null,2));console.log('Captured '+result.length+' Docker Street View states');
}

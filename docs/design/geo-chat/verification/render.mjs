import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
export async function render(page,root){
 await mkdir(root+'/actual',{recursive:true});
 const fixed=new Date('2026-10-06T12:00:00Z');await page.clock.setFixedTime(fixed);
 let state='place';
 await page.route('https://maps.googleapis.com/maps/api/streetview?**',r=>r.fulfill({path:'/app/docs/design/geo-chat/reference-v1/assets/location.jpg'}));
 await page.route('**/api/v1/geo',r=>{
  const phase={idle:'idle',loading:'preparing',error:'unavailable',reveal:'reveal',finished:'finished'}[state]||'active';
  return r.fulfill({json:{id:state,phase,round:2,total:5,deadline:new Date(fixed.getTime()+(phase==='reveal'?10:38)*1000).toISOString(),server_time:fixed.toISOString(),cooldown:fixed.toISOString(),configured:state!=='error',browser_key:'test-public-key',own_answer:state==='answered'?'Италия, Манарола':'',answered:2,leaders:state==='finished'?[{nickname:'Клэр',points:9},{nickname:'geo-designer',points:6},{nickname:'moon',points:3}]:[],...(['active','reveal'].includes(phase)?{scene:{pano_id:'fixture',heading:0,pitch:0}}:{}),...(phase==='reveal'?{solution:{country:'Италия',city:'Манарола',points:3,position:{lat:44,lng:9},source:'TEST',author:'TEST'}}:{})}});
 });
 const rows=JSON.parse(await readFile('/app/docs/design/geo-chat/design-v3/'+(process.env.GEO_DESIGN_THEME || 'vertigo_glass')+'/artifacts.json','utf8'));
 const result=[];
 for(const row of rows){
  // Maps must ultimately be verified with a real Google key; no fake map is
  // substituted here to manufacture visual acceptance.
  if(row.state==='map'){result.push({...row,status:'UNVERIFIED_GOOGLE_KEY_REQUIRED'});continue;}
  state=row.state;
  await page.setViewportSize(row.viewport);
  await page.reload();
  await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
  if(['idle','error'].includes(state)){
   await page.locator('#message-body').fill('/гео');await page.locator('#send-message').click();
  }
  await expect(page.locator('#geo-game')).toBeVisible();
  if(state==='collapsed')await page.getByRole('button',{name:'Свернуть игру',exact:true}).click();
  if(state==='expanded')await page.getByRole('button',{name:'Увеличить игру',exact:true}).click();
  if(state==='people')await page.getByRole('button',{name:'В чате · 3',exact:true}).click();
  if(state==='keyboard')await page.locator('#geo-answer').focus();
  await page.mouse.move(0,0);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('#geo-game img')].map(i=>i.src ? i.decode() : new Promise(resolve=>i.addEventListener('load',resolve,{once:true}))));});
  await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,row.scroll);
  await page.screenshot({path:root+'/actual/'+row.file});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  result.push({...row,status:overflow?'OVERFLOW':'CAPTURED'});
 }
 await writeFile(root+'/captures.json',JSON.stringify(result,null,2));
 console.log('Captured real React UI; '+result.length+' reference states, map states explicitly unverified.');
}

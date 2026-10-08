import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
export async function render(page,root) {
 const actual=Boolean(process.env.GEO_ACTUAL);
 const folder=actual?'actual':'mock';await mkdir(root+'/'+folder,{recursive:true});
 const fixed=new Date('2026-10-06T12:00:00Z');await page.clock.setFixedTime(fixed);
 await page.route('**/api/v1/geo',r=>r.fulfill({json:{id:'v6',phase:'active',round:2,total:5,deadline:new Date(fixed.getTime()+278000).toISOString(),server_time:fixed.toISOString(),cooldown:fixed.toISOString(),configured:true,browser_key:'fixture',own_answer:'',answered:2,leaders:[],scene:{pano_id:'fixture',heading:0,pitch:0}}}));
 const rows=[];
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[390,544],[320,740]]) {
  for(const state of ['place','expanded',...(width>=768?['player-compact','player-expanded']:[])]) {
   await page.setViewportSize({width,height});await page.reload();
   await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
   if(state.startsWith('player')) {
    await page.locator('#media-message-90010-play').click();
    await expect.poll(()=>page.locator('#chat-tv-media').evaluate(e=>!e.paused&&e.currentTime>0)).toBe(true);
    await page.locator('#chat-tv-media').evaluate(e=>{e.loop=true;Object.defineProperty(e,'currentTime',{get:()=>2});e.dispatchEvent(new Event('timeupdate'))});
    if(state==='player-expanded')await page.locator('#chat-tv-toggle').click();
   }
   await page.locator('.geo-mini').click();await expect(page.locator('.geo-return')).toBeEnabled();
   if(state==='expanded')await page.getByRole('button',{name:'Увеличить игру',exact:true}).click();
   if(!actual) {
    if(state==='player-compact'&&width===1440)await page.screenshot({path:root+'/before-player.png'});
    await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v6/proposal.css','utf8')});
    await page.evaluate(()=>{const b=document.createElement('button');b.type='button';b.className='geo-icon';b.setAttribute('aria-label','Свернуть игру');b.title='Свернуть игру';b.textContent='−';const tools=document.querySelector('.geo-tools');tools.insertBefore(b,tools.querySelector('.geo-icon'));});
   }
   await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(100);
   for(const scroll of ['top','viewport','bottom']) {
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);
    const file=`${width}x${height}-${state}-${scroll}.png`;
    await page.screenshot({path:root+'/'+folder+'/'+file});
    rows.push({file,viewport:{width,height},state,scroll,route:'/chat',auth:'guest',theme:process.env.GEO_DESIGN_THEME||'vertigo_glass',fixture:'v6: fixed 3 peers + 7 chat rows + panorama fixture image + 2s playing audio',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   }
  }
 }
 await writeFile(root+'/'+(actual?'captures':'artifacts')+'.json',JSON.stringify(rows,null,2));
 console.log(`${folder}: ${rows.length} states`);
}

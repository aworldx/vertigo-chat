import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
export async function render(page,root) {
 const actual=Boolean(process.env.GEO_ACTUAL);
 const folder=actual?'actual':'mock';await mkdir(root+'/'+folder,{recursive:true});
 const fixed=new Date('2026-10-06T12:00:00Z');await page.clock.setFixedTime(fixed);
 let answered=false;
 await page.route('**/api/v1/geo',r=>r.fulfill({json:{id:'v6',phase:'active',round:2,total:5,deadline:new Date(fixed.getTime()+278000).toISOString(),server_time:fixed.toISOString(),cooldown:fixed.toISOString(),configured:true,browser_key:'fixture',own_answer:answered?'USA':'',answered:2,leaders:[],scene:{pano_id:'fixture',heading:0,pitch:0}}}));
 const rows=[];
 for(const [width,height] of [[1440,900],[1280,678],[1024,678],[768,1024],[844,390]]) {
  for(const state of ['place','answered','answered-expanded',...(width>=768?['player-compact','player-expanded']:[])]) {
   if(process.env.GEO_RECAPTURE && !((width===768)||(width===844&&['place','answered'].includes(state))))continue;
   if(width!==844&&state!=='player-expanded')continue;
   if(width===844&&state==='player-expanded')continue;
   if(process.env.GEO_NATIVE_STABLE&&!(width===844&&state==='player-compact'))continue;
   answered=state.startsWith('answered');
   await page.setViewportSize({width,height});await page.reload();
   await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true');
   if(state.startsWith('player')&&height>480) {
    await page.locator('#media-message-90010-play').click();
    await expect.poll(()=>page.locator('#chat-tv-media').evaluate(e=>!e.paused&&e.currentTime>0)).toBe(true);
    await page.locator('#chat-tv-media').evaluate(e=>{e.loop=true;Object.defineProperty(e,'currentTime',{get:()=>2});e.dispatchEvent(new Event('timeupdate'))});
    if(state==='player-expanded')await page.locator('#chat-tv-toggle').click();
   }
   if(state.startsWith('player')&&height<=480){const audio=page.locator('#media-message-90010-audio');await audio.evaluate(async e=>{await e.play();e.loop=true;Object.defineProperty(e,'currentTime',{get:()=>2});e.dispatchEvent(new Event('timeupdate'))});await expect(page.locator('#chat-tv')).toHaveCount(0);}
   await page.locator('.geo-mini').click();await expect(page.locator('.geo-return')).toBeEnabled();
   if(state==='answered-expanded')await page.getByRole('button',{name:'Увеличить игру',exact:true}).click();
   if(!actual) {
    if(state==='player-compact'&&width===1440)await page.screenshot({path:root+'/before-player.png'});
    await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v9/proposal.css','utf8')});
    await page.evaluate(()=>{const b=document.createElement('button');b.type='button';b.className='geo-icon';b.setAttribute('aria-label','Свернуть игру');b.title='Свернуть игру';b.textContent='−';const tools=document.querySelector('.geo-tools');tools.insertBefore(b,tools.querySelector('.geo-icon'));});
   }
   if(!actual)await page.evaluate(()=>{
    const head=document.querySelector('.geo-head'),tools=head.querySelector('.geo-tools'),tabs=document.querySelector('.geo-tabs');if(tabs)head.insertBefore(tabs,tools);
    head.querySelector('.geo-kicker').textContent='Раунд 2 из 5';
    const footer=document.querySelector('.geo-footer');footer.classList.add('geo-answer-footer');
    const saved=footer.querySelector('.geo-answer-saved');
    if(saved){const row=document.createElement('div');row.className='geo-answer-summary';saved.before(row);row.append(saved,footer.querySelector('.geo-edit'));saved.querySelector('span').remove();}
    const label=footer.querySelector('.geo-answer-label');if(label)label.classList.add('geo-visually-hidden');
    const input=footer.querySelector('input');if(input)input.placeholder='Страна или город…';
    footer.querySelector('.geo-private')?.remove();footer.querySelector('.geo-status')?.remove();
    const note=document.createElement('div');note.className='geo-answer-note';note.innerHTML='<span>Ответ скрыт до конца раунда</span><span>Ответили: 2</span>';footer.append(note);
   });
   await page.mouse.move(0,0);await page.evaluate(()=>document.fonts.ready);
   await page.waitForTimeout(100);
   for(const scroll of ['top','viewport','bottom']) {
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);
    if(width===844&&state==='player-compact')await page.locator('#media-message-90010-audio').evaluate(e=>new Promise(resolve=>{e.addEventListener('seeked',()=>resolve(),{once:true});Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype,'currentTime').set.call(e,2)}));
    await page.waitForTimeout(150);
    const file=`${width}x${height}-${state}-${scroll}.png`;
    await page.screenshot({path:root+'/'+folder+'/'+file});
    rows.push({file,viewport:{width,height},state,scroll,route:'/chat',auth:'guest',theme:process.env.GEO_DESIGN_THEME||'vertigo_glass',fixture:'v6: fixed 3 peers + 7 chat rows + panorama fixture image + 2s playing audio',overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   }
  }
 }
 await writeFile(root+'/'+(actual?'captures':'artifacts')+(process.env.GEO_NATIVE_STABLE?'-native':'')+'.json',JSON.stringify(rows,null,2));
 console.log(`${folder}: ${rows.length} states`);
}

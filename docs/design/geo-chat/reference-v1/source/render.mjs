import {readFile,mkdir} from 'node:fs/promises';
import {panel} from './panel.mjs';
export async function render(page,root){
 await mkdir(root+'/mock-final',{recursive:true});
 await page.route('**/geo-design-assets/*',r=>r.fulfill({path:root+'/assets/'+r.request().url().split('/').pop()}));
 const texts=['Похоже на Средиземное море. Кто что думает?','Дома стоят прямо на скале. А внизу маленькая гавань.','Я сначала подумал про Испанию…','Посмотрите на ставни и цвета фасадов 👀','Уже отправил свою версию. Жду результат!','У меня тоже версия есть. Сейчас отвечу!'];
 await page.evaluate(texts=>{
 document.querySelectorAll('.chat-message-body').forEach((e,i)=>e.textContent=texts[i%texts.length]);
 document.querySelectorAll('.chat-poll-notice').forEach(e=>e.remove());
 },texts);
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390]]) {
  await page.setViewportSize({width,height});
  await page.screenshot({path:`${root}/baseline/${width}x${height}.png`});
  const css=await page.addStyleTag({content:await readFile(root+'/proposal.css','utf8')});
  await page.evaluate(()=>{
   const main=document.querySelector('#dialogue-frame');
   const layout=document.createElement('div');layout.className='geo-layout';
   const conv=document.createElement('div');conv.className='geo-conversation';
   while(main.firstChild)conv.append(main.firstChild);
   layout.append(conv);main.append(layout);
   const pane=document.createElement('section');pane.className='geo-panel';layout.append(pane);
  });
  for(const state of ['place',...(width===390?['answered','collapsed']:['map','collapsed'])]){
   await page.evaluate(({state,html})=>{const p=document.querySelector('.geo-panel');p.className='geo-panel '+(['expanded','collapsed'].includes(state)?state:'');p.innerHTML=html},{state,html:panel(state)});
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.geo-panel img')].map(i=>i.decode()));});
   await page.locator('#messages').evaluate(el=>el.scrollTop=0);
   await page.screenshot({path:`${root}/mock-final/${width}x${height}-${state}.png`});
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+width);
   if(state==='place')for(const scroll of ['viewport','bottom']){
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:el.clientHeight,scroll);
    await page.screenshot({path:`${root}/mock-final/${width}x${height}-place-${scroll}.png`});
   }
  }
  await page.evaluate(()=>{const l=document.querySelector('.geo-layout');const m=l.parentNode;const c=l.querySelector('.geo-conversation');while(c.firstChild)m.append(c.firstChild);l.remove();});
  await css.evaluate(e=>e.remove());
 }
 console.log('Static mockups generated; application unchanged.');
}

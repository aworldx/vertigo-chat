import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { panel } from './source/panel.mjs';
export async function render(page,root) {
 await mkdir(root+'/mock',{recursive:true});
 await page.route('**/geo-design-assets/*',r=>r.fulfill({path:'/app/docs/design/geo-chat/reference-v1/assets/'+r.request().url().split('/').pop()}));
 const texts=['Похоже на Средиземное море. Кто что думает?','Дома стоят прямо на скале. А внизу маленькая гавань.','Я сначала подумал про Испанию…','Посмотрите на ставни и цвета фасадов 👀','Уже отправил свою версию. Жду результат!','У меня тоже версия есть. Сейчас отвечу!'];
 await page.evaluate(texts=>{document.querySelectorAll('.chat-message-body').forEach((e,i)=>e.textContent=texts[i%texts.length]);document.querySelectorAll('.chat-poll-notice').forEach(e=>e.remove());},texts);
 const artifacts=[];
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[390,544]]) {
  await page.setViewportSize({width,height});
  const css=await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v3/source/proposal.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/states.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/refinement.css','utf8')});
  await page.evaluate(()=>{const main=document.querySelector('#dialogue-frame');const layout=document.createElement('div');layout.className='geo-layout';const conv=document.createElement('div');conv.className='geo-conversation';while(main.firstChild)conv.append(main.firstChild);layout.append(conv);main.append(layout);const pane=document.createElement('section');pane.className='geo-panel';layout.append(pane);});
  const states=height===544?['keyboard']:['place','collapsed',...(width===1440||width===768?['map']:[]),...(width===1440||width===390?['answered','idle','loading','error','reveal','finished','expanded']:[]),...(width===1440?['people']:[])];
  for(const state of states) {
   await page.evaluate(({state,html})=>{const p=document.querySelector('.geo-panel');p.className='geo-panel '+(state==='collapsed'?'collapsed':state==='expanded'?'expanded':'');p.innerHTML=html;
    const head=p.querySelector('.geo-head');const scene=p.querySelector('.geo-scene');const foot=p.querySelector('.geo-footer');
    if(['idle','loading','error','finished'].includes(state)){
     p.querySelector('.geo-tabs').remove();head.querySelector('.geo-time').remove();head.querySelector('.geo-kicker').textContent='Отвечать может каждый';
     const content={idle:['Угадайте место вместе','5 раундов по 60 секунд. Страна — 1 балл, город — 3. Можно менять ответ до конца раунда.'],loading:['Подбираем места…','Проверяем снимки. Игра начнётся у всех одновременно.'],error:['Снимки пока недоступны','Игра ещё не подключена. Организатору нужно настроить источник панорам.'],finished:['Игра завершена','1. Клэр — 9 баллов\n2. geo-designer — 6 баллов\n3. moon — 3 балла']}[state];
     scene.innerHTML='<div class="geo-state"><h2>'+content[0]+'</h2><p>'+content[1]+'</p></div>';
     foot.innerHTML=state==='idle'?'<button class="geo-submit">Начать игру</button>':state==='finished'?'<button class="geo-submit">Сыграть ещё</button>':state==='error'?'<button class="geo-submit">Проверить снова</button>':'<p class="geo-status">Можно продолжать обсуждение в чате</p>';
    }
    if(state==='reveal') {p.querySelector('.geo-tabs').remove();foot.innerHTML='<div class="geo-reveal"><strong>Италия · Манарола</strong><span>Ваш результат: +3 балла</span><small>Следующий раунд через 00:10</small></div>';head.querySelector('.geo-time').textContent='00:10';}
    if(state==='people'){p.insertAdjacentHTML('beforeend','<div class="geo-popover" role="dialog" aria-label="В чате"><div><strong>В чате · 3</strong><button aria-label="Закрыть список">×</button></div><ul><li>geo-designer</li><li>Клэр</li><li>moon</li></ul></div>');}
   },{state,html:panel(state==='keyboard'?'place':state==='expanded'?'place':state)});
   if(state==='keyboard')await page.locator('#geo-answer').focus();else await page.locator('#geo-answer').evaluateAll(xs=>xs.forEach(x=>x.blur()));
   await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('.geo-panel img')].map(i=>i.decode()));});
   for(const scroll of (state==='place'||state==='expanded'?['top','viewport','bottom']:['top'])){
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);
    const file=`${width}x${height}-${state}-${scroll}.png`;await page.screenshot({path:root+'/mock/'+file});artifacts.push({file,viewport:{width,height},state,scroll});
   }
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('overflow '+width+' '+state);
  }
  await page.evaluate(()=>{const l=document.querySelector('.geo-layout');const m=l.parentNode;const c=l.querySelector('.geo-conversation');while(c.firstChild)m.append(c.firstChild);l.remove();});await css.evaluate(e=>e.remove());
 }
 await writeFile(root+'/artifacts.json',JSON.stringify(artifacts,null,2));
 console.log('Saved '+artifacts.length+' pre-implementation mock PNGs.');
}

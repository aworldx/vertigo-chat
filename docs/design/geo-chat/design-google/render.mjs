import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {panel} from '../design-v3/source/panel.mjs';
export async function render(page,root) {
 await mkdir(root+'/mock',{recursive:true});
 const {GEO_GOOGLE_BROWSER_KEY:key}=JSON.parse(await readFile('/tmp/geo-credentials.json','utf8'));
 await page.addScriptTag({url:'https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,v:'quarterly',language:'ru'})});
 await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v3/source/proposal.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/states.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/refinement.css','utf8')+'\n.geo-map-message{top:12px;bottom:auto;left:12px;right:12px;border-radius:7px;padding:7px 10px;width:fit-content;max-width:calc(100% - 24px)}'});
 const rows=[];
 for(const [width,height] of [[1440,900],[768,1024]]) {
  await page.setViewportSize({width,height});
  await page.evaluate(html=>{const main=document.querySelector('#dialogue-frame');const layout=document.createElement('div');layout.className='geo-layout';const conv=document.createElement('div');conv.className='geo-conversation';while(main.firstChild)conv.append(main.firstChild);layout.append(conv);main.append(layout);const pane=document.createElement('section');pane.className='geo-panel';pane.innerHTML=html;layout.append(pane);pane.querySelector('.geo-scene').innerHTML='<div class="geo-map-view"><div class="geo-google-map"></div><div class="geo-map-message">Метка перенесена в поле ответа. Нажмите «Ответить».</div></div>';pane.querySelectorAll('.geo-tabs button')[1].textContent='Карта';pane.querySelector('#geo-answer').value='Мали';},panel('map'));
  for(const state of ['map','map-expanded']) {
   await page.evaluate(state=>document.querySelector('.geo-panel').classList.toggle('expanded',state==='map-expanded'),state);
   await page.evaluate(async()=>{const root=document.querySelector('.geo-google-map');root.replaceChildren();const map=new google.maps.Map(root,{center:{lat:20,lng:0},zoom:2,disableDefaultUI:true,zoomControl:true,clickableIcons:false,gestureHandling:'greedy'});new google.maps.Marker({map,position:{lat:20,lng:0}});await new Promise(resolve=>google.maps.event.addListenerOnce(map,'tilesloaded',resolve));await document.fonts.ready;});
   await page.waitForTimeout(1000);
   for(const scroll of state==='map-expanded'?['top','viewport','bottom']:['top']) {
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);
    const file=`${width}x${height}-${state}-${scroll}.png`;await page.screenshot({path:root+'/mock/'+file});rows.push({file,viewport:{width,height},state,scroll});
   }
  }
  await page.evaluate(()=>{const l=document.querySelector('.geo-layout'),m=l.parentNode,c=l.querySelector('.geo-conversation');while(c.firstChild)m.append(c.firstChild);l.remove();});
 }
 await writeFile(root+'/artifacts.json',JSON.stringify(rows,null,2));
 console.log('Google map pre-change mocks: '+rows.length);
}

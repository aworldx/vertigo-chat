import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {panel} from '../design-v3/source/panel.mjs';
export async function render(page,root) {
 await mkdir(root+'/mock',{recursive:true});
 const {GEO_GOOGLE_BROWSER_KEY:key}=JSON.parse(await readFile('/tmp/geo-credentials.json','utf8'));
 await page.addScriptTag({url:'https://maps.googleapis.com/maps/api/js?'+new URLSearchParams({key,v:'quarterly',language:'ru'})});
 await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v3/source/proposal.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/states.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/refinement.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v4/refinement.css','utf8')});
 await page.evaluate(()=>{document.querySelector('#menu-rankings')?.remove();const nav=document.querySelector('.cinema-menu');const a=document.createElement('a');a.href='/rankings';a.textContent='Рейтинги';a.className='hidden whitespace-nowrap transition hover:text-amber-300 lg:inline';nav.insertBefore(a,nav.querySelector('#about-main-menu'));});
 const rows=[];
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[390,544]]) {
  await page.setViewportSize({width,height});
  await page.evaluate(html=>{const main=document.querySelector('#dialogue-frame');const layout=document.createElement('div');layout.className='geo-layout';const conv=document.createElement('div');conv.className='geo-conversation';while(main.firstChild)conv.append(main.firstChild);layout.append(conv);main.append(layout);const pane=document.createElement('section');pane.className='geo-panel';pane.innerHTML=html;layout.append(pane);pane.querySelector('.geo-scene').innerHTML='<div class="geo-place-view"><div class="geo-panorama"></div><button class="geo-return">К началу</button></div>';pane.querySelector('.geo-time').textContent='04:38';const close=pane.querySelector('.geo-tools').lastElementChild;close.classList.add('geo-close');close.textContent='Закрыть ×';},panel('place'));
  for(const state of ['place','expanded']) {
   await page.evaluate(state=>document.querySelector('.geo-panel').classList.toggle('expanded',state==='expanded'),state);
   const panoID=await page.evaluate(async()=>{const root=document.querySelector('.geo-panorama');root.replaceChildren();const pano=new google.maps.StreetViewPanorama(root,{position:{lat:42.345573,lng:-71.098326},pov:{heading:0,pitch:0},zoom:1,disableDefaultUI:true,linksControl:true,clickToGo:true,zoomControl:true,panControl:true,addressControl:false,showRoadLabels:false,motionTracking:false,motionTrackingControl:false,fullscreenControl:false,enableCloseButton:false});await new Promise(resolve=>google.maps.event.addListenerOnce(pano,'status_changed',resolve));await document.fonts.ready;return pano.getPano();});
   await page.waitForTimeout(8000);
   for(const scroll of ['top','viewport','bottom']) {
    await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);
    const file=`${width}x${height}-${state}-${scroll}.png`;await page.screenshot({path:root+'/mock/'+file});rows.push({file,viewport:{width,height},state,scroll,panoID});
   }
  }
  await page.evaluate(()=>{const l=document.querySelector('.geo-layout'),m=l.parentNode,c=l.querySelector('.geo-conversation');while(c.firstChild)m.append(c.firstChild);l.remove();});
 }
 await writeFile(root+'/artifacts.json',JSON.stringify(rows,null,2));
 console.log('Street View pre-implementation mocks: '+rows.length);
}

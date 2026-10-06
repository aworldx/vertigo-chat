import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {panel} from '../design-v3/source/panel.mjs';
export async function render(page,root){
 await mkdir(root+'/mock',{recursive:true});
 await page.addStyleTag({content:await readFile('/app/docs/design/geo-chat/design-v3/source/proposal.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/states.css','utf8')+'\n'+await readFile('/app/docs/design/geo-chat/design-v3/source/refinement.css','utf8')});
 const rows=[];
 for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[390,544]]){
  await page.setViewportSize({width,height});
  await page.evaluate(html=>{const main=document.querySelector('#dialogue-frame'),layout=document.createElement('div'),conv=document.createElement('div');layout.className='geo-layout';conv.className='geo-conversation';while(main.firstChild)conv.append(main.firstChild);layout.append(conv);main.append(layout);const p=document.createElement('section');p.className='geo-panel collapsed';p.innerHTML=html;layout.append(p)},panel('place').replaceAll('00:38','04:38'));
  await page.evaluate(()=>document.fonts.ready);
  for(const scroll of ['top','viewport','bottom']){await page.locator('#messages').evaluate((el,s)=>el.scrollTop=s==='bottom'?el.scrollHeight:s==='viewport'?el.clientHeight:0,scroll);const file=`${width}x${height}-collapsed-${scroll}.png`;await page.screenshot({path:root+'/mock/'+file});rows.push({file,viewport:{width,height},state:'collapsed',scroll});}
  await page.evaluate(()=>{const l=document.querySelector('.geo-layout'),m=l.parentNode,c=l.querySelector('.geo-conversation');while(c.firstChild)m.append(c.firstChild);l.remove()});
 }
 await writeFile(root+'/artifacts.json',JSON.stringify(rows,null,2));console.log('15 entry-collapsed pre-change mocks');
}

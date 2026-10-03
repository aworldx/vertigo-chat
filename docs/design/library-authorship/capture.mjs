// Run inside the pinned Docker quality image. This serves only the independent mockup.
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { chromium } from '/app/apps/web/node_modules/playwright/index.mjs';
const root='/design';
if (existsSync(`${root}/FROZEN.sha256`)) throw new Error('These mockups are frozen. Create a new design version, never overwrite the approved reference.');
const server=createServer(async (req,res)=>{
  const path=new URL(req.url,'http://localhost').pathname;
  const file=path.startsWith('/images/')||path.startsWith('/fonts/')?join('/public',path):join(root,path==='/'?'mockup.html':path);
  try {const data=await readFile(file);res.setHeader('content-type',({'.css':'text/css','.html':'text/html','.png':'image/png','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');res.end(data)}catch{res.writeHead(404);res.end()}
});
await new Promise(resolve=>server.listen(4088,'127.0.0.1',resolve));
await mkdir('/design/mock',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for (const [width,height] of [[1440,900],[1280,676],[768,1024],[390,844]]) {
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});
 await page.goto('http://127.0.0.1:4088/');
 await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode()));await new Promise(r=>{const i=new Image;i.onload=r;i.src='/images/library-room-v2.png'})});
 for(const state of ['top','viewport','bottom']) {
  await page.evaluate(state=>window.scrollTo(0,state==='top'?0:state==='viewport'?innerHeight:document.documentElement.scrollHeight),state);
  await page.screenshot({path:`/design/mock/${width}-${state}.png`});
 }
 await writeFile(`/design/mock/${width}-geometry.json`,JSON.stringify(await page.evaluate(()=>Object.fromEntries(['.library-intro','.library-feed','.library-series-panel'].map(s=>{const b=document.querySelector(s).getBoundingClientRect();return[s,{x:b.x,y:b.y+scrollY,width:b.width,height:b.height}]}))),null,2));
 await page.close();
}
await browser.close();server.close();


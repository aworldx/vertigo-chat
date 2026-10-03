import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
if (existsSync('/design/FROZEN.sha256')) throw new Error('These mockups are frozen. Create a new design version, never overwrite the approved reference.');
import { readFile, mkdir } from 'node:fs/promises';
import { join,extname } from 'node:path';
import { chromium } from '/app/apps/web/node_modules/playwright/index.mjs';
const server=createServer(async(req,res)=>{const path=new URL(req.url,'http://localhost').pathname;const file=path.startsWith('/images/')||path.startsWith('/fonts/')?join('/public',path):join('/design',path==='/'?'editor-mockup.html':path);try{res.setHeader('content-type',({'.css':'text/css','.html':'text/html','.png':'image/png','.ttf':'font/ttf'})[extname(file)]||'application/octet-stream');res.end(await readFile(file))}catch{res.writeHead(404);res.end()}});
await new Promise(resolve=>server.listen(4088,'127.0.0.1',resolve));
await mkdir('/design/mock-editor',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const [width,height]of [[1440,900],[1280,676],[768,1024],[390,844]]){
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1});await page.goto('http://127.0.0.1:4088/');
 await page.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>{const i=new Image;i.onload=resolve;i.src='/images/library-room-v2.png'})});
 await page.mouse.move(0,0);
 for(const state of ['top','viewport','bottom']){
  await page.locator('#library-editor').evaluate((e,state)=>{e.scrollTop=state==='top'?0:state==='viewport'?innerHeight:e.scrollHeight},state);
  await page.screenshot({path:`/design/mock-editor/${width}-${state}.png`});
 }
 await page.close();
}
await browser.close();server.close();

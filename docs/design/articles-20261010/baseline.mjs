import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
const require=createRequire('/app/apps/web/package.json');const {chromium}=require('@playwright/test')
const out='/tmp/articles-design/baseline';await mkdir(out,{recursive:true});const browser=await chromium.launch({headless:true});const manifest=[];
for(const [width,height] of [[1440,900],[768,1024],[390,844]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();
 for(const slug of ['', 'chats-vs-messengers','chat-platforms-russia','how-vertigo-chat-works']){
 const route='/articles'+(slug?'/'+slug:'');await page.goto('http://127.0.0.1:4097'+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);
 const name=`${slug||'index'}-${width}x${height}`;await page.screenshot({path:`${out}/${name}.png`,fullPage:true});manifest.push({name,route,viewport:{width,height},deviceScaleFactor:1,zoom:1,auth:'fresh anonymous',fixtures:'public editorial pages',assets:await page.locator('img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')))});
 }await context.close();
}await browser.close();await writeFile(out+'/manifest.json',JSON.stringify(manifest,null,2));

import {createRequire} from 'node:module'
import {mkdir} from 'node:fs/promises'
const require = createRequire('/app/apps/web/package.json')
const {chromium, expect} = require('@playwright/test')
const output = process.argv[2]
if (!output) throw new Error('Explicit artifact directory required')
await mkdir(output,{recursive:true})
const browser = await chromium.launch({headless:true})
const id = 'a'.repeat(32)
const cells=Array.from({length:20},()=>Array(10).fill(0))
cells[19]=[6,6,6,0,0,0,0,7,7,7]
const player={id:'self',nickname:'Игрок',registered:false,ready:true,connected:true,dead:false,place:0,score:120,lines:1,level:1,cells,active:{kind:3,rotation:0,x:3,y:4},ghost:{kind:3,rotation:0,x:3,y:18},next:[1,2,3,4,5,6],hold:0,can_hold:true,incoming:0,target:'',sequence:0,simulation:{piece_id:1,fall_ms:0,lock_ms:0,resets:0,combo:-1,random:123,bag:[7],pending:[]}}
const game={id,code:'ЛИСА-27',mode:'solo',status:'running',self:'self',host:'self',paused:true,countdown:0,elapsed_ms:1000,revision:1,players:[player]}
try {
for(const [width,height] of [[1440,900],[768,1024],[390,844],[844,390],[520,760]]) {
const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'})
const page=await context.newPage()
await page.route('**/api/v1/tetris/'+id,route=>route.fulfill({json:game}))
await page.routeWebSocket('**/api/v1/tetris/*/socket',route=>{route.onMessage(()=>route.send(JSON.stringify({type:'state',game})))})
await page.goto('http://127.0.0.1:4067/')
await page.locator('#entrance-nickname').fill('design-'+width+'-'+Date.now().toString().slice(-5))
await page.locator('#enter-chat').click()
await expect(page.locator('#chat-room')).toHaveAttribute('data-chat-joined','true')
await page.evaluate((id)=>sessionStorage.setItem('vertigo.tetris',JSON.stringify({id,join:false})),id)
await page.goto('http://127.0.0.1:4067/chat')
await expect(page.locator('.tetris-match-state')).toHaveText('Пауза', {timeout:15000})
await page.evaluate(()=>document.fonts.ready)
await page.addStyleTag({content:"#chat-room { visibility:hidden }"})
await page.screenshot({path:`${output}/${width}x${height}.png`})
await context.close()
}
} finally {await browser.close()}

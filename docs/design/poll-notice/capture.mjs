import { chromium } from '/app/apps/web/node_modules/playwright-core/index.mjs'
import fs from 'node:fs/promises'
const browser = await chromium.launch({headless:true})
const origin='http://127.0.0.1:4073'
const dir='/app/docs/design/poll-notice'
await fs.mkdir(dir,{recursive:true})
const admin=await browser.newPage()
await admin.goto(origin+'/account/login')
await admin.locator('#react-account-nickname').fill('fixture01')
await admin.locator('#react-account-password').fill('secret123')
await admin.locator('#react-account-submit').click()
await admin.locator('#site-account-nickname').waitFor()
await admin.goto(origin+'/admin?section=polls')
if(await admin.locator('#admin-poll-1').count()===0){
await admin.locator('#poll-question').fill('Какой сценарий проверить?')
await admin.locator('#poll-option-1').fill('Создание')
await admin.locator('#poll-option-2').fill('Голосование')
await admin.locator('#create-poll').click()
await admin.locator('#admin-poll-1').waitFor()
}
await admin.close()
for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
 const context=await browser.newContext({viewport})
 const page=await context.newPage()
 await page.goto(origin)
 // A previously opened named window has its own sessionStorage, initially empty.
 const popupPromise=context.waitForEvent('page')
 await page.evaluate(()=>window.open('/polls','vertigo-polls'))
 const popup=await popupPromise
 await popup.locator('#poll-1').waitFor()
 await page.locator('#entrance-nickname').fill('notice-'+viewport.width)
 await page.locator('#enter-chat').click()
 await page.locator('#poll-system-notice-1').waitFor()
 await page.locator('#poll-system-notice-1 a').click()
 await popup.waitForLoadState()
 console.log('reused popup',viewport.width,'disabled=',await popup.locator('#poll-1-option-1').isDisabled())
 await popup.screenshot({path:dir+'/'+viewport.width+'-disabled.png'})
 await page.screenshot({path:dir+'/'+viewport.width+'-baseline.png'})
 // Designer prototype on captured current UI. Changes only the requested notice.
 await page.evaluate(()=>{
 const old=document.querySelector('#poll-system-notice-1')
 const block=document.createElement('div')
 block.id='poll-system-notice-1'
 block.setAttribute('data-private-notice','true')
 block.style.cssText='display:flex;align-items:center;gap:12px;margin:12px 0 0;padding:12px;border:1px solid #3f3f46;border-radius:8px;background:#18181b;font-size:12px;line-height:20px;color:#d4d4d8;flex-shrink:0'
 block.innerHTML='<span style="color:#fcd34d" aria-hidden="true">✦</span><div style="min-width:0;flex:1;overflow-wrap:anywhere"><span>Новый опрос: Какой сценарий проверить?</span> <a href="/polls" style="color:#fde68a;font-weight:600;text-decoration:underline;text-underline-offset:2px">Открыть</a></div><button type="button" aria-label="Закрыть приглашение" style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;flex-shrink:0;border-radius:4px;color:#a1a1aa;font-size:20px">×</button><span class="sr-only">Видно только вам.</span>'
 old.replaceWith(block)
 })
 await page.screenshot({path:dir+'/'+viewport.width+'-mock.png'})
 await context.close()
}
await browser.close()

import {chromium,expect} from '/app/apps/web/node_modules/@playwright/test/index.mjs';
import {readFile,writeFile} from 'node:fs/promises';
const {GEO_GOOGLE_BROWSER_KEY:key}=JSON.parse(await readFile('/tmp/geo-credentials.json','utf8'));
const [{panoID}]=JSON.parse(await readFile('/app/docs/design/geo-chat/design-v4/vertigo_glass/artifacts.json','utf8'));
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.route('https://maps.googleapis.com/maps/api/js?**',async route=>{const response=await route.fetch();const body=await response.text();await route.fulfill({response,body:body+`;window.geoViews=[];google.maps.StreetViewPanorama=new Proxy(google.maps.StreetViewPanorama,{construct(target,args){const view=Reflect.construct(target,args);window.geoViews.push(view);return view}});`});});
await page.route('**/api/v1/geo',r=>r.fulfill({json:{id:'walking',phase:'active',round:1,total:5,deadline:new Date(Date.now()+300000).toISOString(),server_time:new Date().toISOString(),cooldown:new Date().toISOString(),configured:true,browser_key:key,own_answer:'',answered:0,leaders:[],scene:{pano_id:panoID,heading:0,pitch:0}}}));
try{
 await page.goto('http://127.0.0.1:4094');await page.locator('#entrance-nickname').fill('walk-'+Date.now().toString().slice(-7));await page.locator('#enter-chat').click();await page.locator('.geo-mini').click();await expect(page.locator('.geo-return')).toBeEnabled({timeout:25000});
 await expect.poll(()=>page.evaluate(()=>window.geoViews[0].getLinks().length)).toBeGreaterThan(0);
 const initial=await page.evaluate(()=>({pano:window.geoViews[0].getPano(),pov:window.geoViews[0].getPov()}));
 const box=await page.locator('.geo-panorama').boundingBox();
 await page.mouse.move(box.x+box.width*.45,box.y+box.height*.4);await page.mouse.down();await page.mouse.move(box.x+box.width*.65,box.y+box.height*.4,{steps:12});await page.mouse.up();
 await expect.poll(()=>page.evaluate(()=>window.geoViews[0].getPov().heading)).not.toBe(initial.pov.heading);
 await page.getByRole('button',{name:'К началу',exact:true}).click();
 // Face a real connected Google street, then use the native keyboard navigation.
 await page.evaluate(()=>{const p=window.geoViews[0];p.setPov({heading:p.getLinks()[0].heading,pitch:0})});
 await page.locator('.geo-panorama [tabindex="0"]').first().focus();await page.keyboard.press('ArrowUp');
 await expect.poll(()=>page.evaluate(()=>window.geoViews[0].getPano()),{timeout:10000}).not.toBe(initial.pano);
 const walked=await page.evaluate(()=>window.geoViews[0].getPano());
 await page.waitForTimeout(2500);if(await page.evaluate(()=>window.geoViews[0].getPano())!==walked)throw Error('poll reset walked panorama');
 await page.screenshot({path:'/app/docs/design/geo-chat/verification/v4/walked.png'});
 await page.getByRole('button',{name:'К началу',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.geoViews[0].getPano())).toBe(initial.pano);
 await page.getByRole('button',{name:'Закрыть игру',exact:true}).click();await expect(page.locator('#geo-game')).toHaveCount(0);await page.waitForTimeout(2500);await expect(page.locator('#geo-game')).toHaveCount(0);
 await page.locator('#message-body').fill('/гео');await page.locator('#send-message').click();await expect(page.locator('.geo-return')).toBeEnabled({timeout:25000});
 await writeFile('/app/docs/design/geo-chat/verification/v4/walking-result.json',JSON.stringify({nativeGoogle:true,initial:initial.pano,walked,drag:true,nativeKeyboardWalking:true,pollPreserved:true,returnToStart:true,closePersistsAcrossPolling:true,reopen:true},null,2));console.log('PASS real Google look/drag, native walking, polling preservation, return, close, reopen');
}finally{await browser.close()}

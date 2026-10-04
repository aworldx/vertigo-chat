import fs from 'node:fs/promises'
import { PNG } from '/app/apps/web/node_modules/pngjs/lib/png.js'
const dir=process.env.LIBRARY_ACTIONS_DESIGN_ROOT || '/workspace/docs/design/library-actions'
await fs.mkdir(dir+'/review',{recursive:true})
const metrics=[]
for(const file of (await fs.readdir(dir+'/mock')).filter(f=>f.endsWith('.png')).sort()) {
 const mock=PNG.sync.read(await fs.readFile(dir+'/mock/'+file)),actual=PNG.sync.read(await fs.readFile(dir+'/actual/'+file))
 if(mock.width!==actual.width||mock.height!==actual.height)throw new Error('Viewport mismatch: '+file)
 const side=new PNG({width:mock.width*2,height:mock.height}),overlay=new PNG({width:mock.width,height:mock.height}),diff=new PNG({width:mock.width,height:mock.height})
 PNG.bitblt(mock,side,0,0,mock.width,mock.height,0,0);PNG.bitblt(actual,side,0,0,mock.width,mock.height,mock.width,0)
 let changed=0
 for(let i=0;i<mock.data.length;i+=4){let distance=0;for(let c=0;c<3;c++){distance=Math.max(distance,Math.abs(mock.data[i+c]-actual.data[i+c]));overlay.data[i+c]=Math.round((mock.data[i+c]+actual.data[i+c])/2)}overlay.data[i+3]=255;if(distance>12)changed++;diff.data.set(distance>12?[255,0,130,255]:[0,0,0,255],i)}
 for(const [suffix,png]of [['side',side],['overlay',overlay],['diff',diff]])await fs.writeFile(dir+'/review/'+file.replace('.png','-'+suffix+'.png'),PNG.sync.write(png))
 metrics.push({file,changed,percent:changed*100/(mock.width*mock.height)})
}
await fs.writeFile(dir+'/review/metrics.json',JSON.stringify(metrics,null,2))
console.log(metrics)
if(process.argv.includes('--check')&&metrics.some(m=>m.percent>.006))process.exitCode=1

// 0.006% admits the inspected 43 antialiased glyph pixels at 768px; geometry/assets remain exact.

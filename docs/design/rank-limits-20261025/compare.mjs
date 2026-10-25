import { PNG } from '/app/apps/web/node_modules/pngjs/lib/png.js'
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
const root = '/workspace/docs/design/rank-limits-20261025'
const reports = []
await mkdir(`${root}/comparison`, {recursive: true})
for (const [before, after] of [['mock', 'current'], ['mock-extra', 'current-extra']]) {
 for (const file of (await readdir(`${root}/${before}`)).filter(f => f.endsWith('.png'))) {
  const a = PNG.sync.read(await readFile(`${root}/${before}/${file}`))
  const b = PNG.sync.read(await readFile(`${root}/${after}/${file}`))
  if (a.width !== b.width || a.height !== b.height) throw Error(`Viewport mismatch ${file}`)
  const side = new PNG({width:a.width*2, height:a.height})
  const overlay = new PNG({width:a.width, height:a.height})
  const diff = new PNG({width:a.width, height:a.height})
  let changed = 0, maximum = 0
  for (let y=0;y<a.height;y++) for (let x=0;x<a.width;x++) {
   const i = (y*a.width+x)*4
   let delta=0
   for (let c=0;c<4;c++) {
    side.data[(y*side.width+x)*4+c]=a.data[i+c]
    side.data[(y*side.width+x+a.width)*4+c]=b.data[i+c]
    overlay.data[i+c]=Math.round((a.data[i+c]+b.data[i+c])/2)
    if(c<3)delta=Math.max(delta, Math.abs(a.data[i+c]-b.data[i+c]))
   }
   if(delta)changed++
   maximum=Math.max(maximum,delta)
   diff.data.set(delta ? [255,0,180,255] : [0,0,0,255],i)
  }
  const stem=file.slice(0,-4)
  for (const [name,png] of [['side',side],['overlay',overlay],['diff',diff]]) await writeFile(`${root}/comparison/${stem}-${name}.png`,PNG.sync.write(png))
  reports.push({file,width:a.width,height:a.height,changed,maximum,mock:`${before}/${file}`,current:`${after}/${file}`,side:`comparison/${stem}-side.png`,overlay:`comparison/${stem}-overlay.png`,diff:`comparison/${stem}-diff.png`})
 }
}
await writeFile(`${root}/comparison/metrics.json`,JSON.stringify(reports,null,2))
console.log(JSON.stringify(reports.map(({file,changed,maximum})=>({file,changed,maximum})),null,2))

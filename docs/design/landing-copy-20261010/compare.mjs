import {createRequire} from 'node:module'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
const require=createRequire('/app/apps/web/package.json')
const {PNG}=require('pngjs')
const base='/app/docs/design/landing-copy-20261010'
mkdirSync(`${base}/comparison`,{recursive:true})
const rows=[]
for(const size of ['1440x900','768x1024','390x844'].flatMap(size=>['full','top','middle','bottom'].map(state=>size+'-'+state))) {
 const original=PNG.sync.read(readFileSync(`${base}/mock/${size}.png`))
 const current=PNG.sync.read(readFileSync(`${base}/current/${size}.png`))
 if(original.width!==current.width||original.height!==current.height) throw new Error('Viewport mismatch: '+size)
 const side=new PNG({width:original.width*2,height:original.height})
 const diff=new PNG({width:original.width,height:original.height})
 let changed=0,max=0
 for(let y=0;y<original.height;y++) for(let x=0;x<original.width;x++) {
  const i=(y*original.width+x)*4
  let difference=0
  for(let c=0;c<3;c++) difference=Math.max(difference,Math.abs(original.data[i+c]-current.data[i+c]))
  if(difference>12)changed++
  max=Math.max(max,difference)
  for(let c=0;c<4;c++) {
   side.data[(y*side.width+x)*4+c]=original.data[i+c]
   side.data[(y*side.width+x+original.width)*4+c]=current.data[i+c]
   diff.data[i+c]=c===3?255:difference>12?(c===0?255:0):Math.round(original.data[i+c]*0.25)
  }
 }
 writeFileSync(`${base}/comparison/${size}-side.png`,PNG.sync.write(side))
 writeFileSync(`${base}/comparison/${size}-diff.png`,PNG.sync.write(diff))
 rows.push({size,changed,max,pass:changed===0})
}
writeFileSync(`${base}/comparison/results.json`,JSON.stringify(rows,null,2))
console.log(rows)
if(rows.some(row=>!row.pass))process.exitCode=1

import { PNG } from '/app/apps/web/node_modules/pngjs/lib/png.js'
import fs from 'node:fs'
const root='/app/docs/design/poll-notice/'
for(const width of [1440,768,390])for(const suffix of ['', '-top','-middle','-bottom']){
 const a=PNG.sync.read(fs.readFileSync(root+width+'-mock'+suffix+'.png'))
 const b=PNG.sync.read(fs.readFileSync(root+width+'-actual'+suffix+'.png'))
 if(a.width!==b.width||a.height!==b.height)throw Error('dimension mismatch')
 const side=new PNG({width:a.width*2,height:a.height}),overlay=new PNG({width:a.width,height:a.height}),diff=new PNG({width:a.width,height:a.height})
 PNG.bitblt(a,side,0,0,a.width,a.height,0,0);PNG.bitblt(b,side,0,0,b.width,b.height,a.width,0)
 let changed=0
 for(let i=0;i<a.data.length;i+=4){
  let delta=0
  for(let c=0;c<3;c++){delta=Math.max(delta,Math.abs(a.data[i+c]-b.data[i+c]));overlay.data[i+c]=(a.data[i+c]+b.data[i+c])/2}
  overlay.data[i+3]=255
  if(delta>8)changed++
  diff.data[i]=delta>8?255:0;diff.data[i+1]=delta>8?60:0;diff.data[i+2]=delta>8?120:0;diff.data[i+3]=255
 }
 for(const [name,img]of [['side',side],['overlay',overlay],['diff',diff]])fs.writeFileSync(root+width+'-'+name+suffix+'.png',PNG.sync.write(img))
 console.log(width+suffix,changed,((100*changed)/(a.width*a.height)).toFixed(3)+'%')
}

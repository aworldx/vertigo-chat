import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {PNG} from '/app/apps/web/node_modules/pngjs/lib/png.js';
import {execFileSync} from 'node:child_process';
const root='/app/docs/design/chat-glass';
await mkdir(`${root}/comparison`,{recursive:true});
const results=[];
for(const width of [1440,768,390,844,320]) {
 const sheet=[];
 for(const state of ['top','viewport','bottom','commands','settings']) {
  const name=`${width}-${state}`;
  const mock=PNG.sync.read(await readFile(`${root}/mock/${name}.png`));
  const actual=PNG.sync.read(await readFile(`${root}/actual/${name}.png`));
  if(mock.width!==actual.width||mock.height!==actual.height)throw new Error(`Size mismatch: ${name}`);
  const overlay=new PNG({width:mock.width,height:mock.height});
  const diff=new PNG({width:mock.width,height:mock.height});
  const pair=new PNG({width:mock.width*2,height:mock.height});
  PNG.bitblt(mock,pair,0,0,mock.width,mock.height,0,0);
  PNG.bitblt(actual,pair,0,0,mock.width,mock.height,mock.width,0);
  let changed=0;
  for(let i=0;i<mock.data.length;i+=4) {
   let distance=0;
   for(let c=0;c<3;c++) {distance=Math.max(distance,Math.abs(mock.data[i+c]-actual.data[i+c]));overlay.data[i+c]=Math.round((mock.data[i+c]+actual.data[i+c])/2);}
   overlay.data[i+3]=255;
   if(distance>12)changed++;
   diff.data.set(distance>12?[255,65,135,255]:[Math.round(actual.data[i]*.3),Math.round(actual.data[i+1]*.3),Math.round(actual.data[i+2]*.3),255],i);
  }
  for(const [label,png]of [['side-by-side',pair],['overlay',overlay],['diff',diff]]) await writeFile(`${root}/comparison/${name}-${label}.png`,PNG.sync.write(png));
  sheet.push(`${root}/mock/${name}.png`,`${root}/actual/${name}.png`,`${root}/comparison/${name}-overlay.png`,`${root}/comparison/${name}-diff.png`);
  results.push({width,height:mock.height,state,changedPercent:100*changed/(mock.width*mock.height)});
 }
 execFileSync('montage',[...sheet,'-thumbnail','480x420','-tile','4x5','-geometry','+4+4','-background','#282828',`${root}/comparison/review-${width}.png`]);
}
await writeFile(`${root}/comparison/metrics.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
if(results.some(r=>r.changedPercent>.05))process.exitCode=1;

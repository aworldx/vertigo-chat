// Docker-only evidence generation; does not change either the mock or actual PNG.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { PNG } from '/app/apps/web/node_modules/pngjs/lib/png.js';
const root=process.env.LIBRARY_DESIGN_ROOT || '/design';
const actualRoot=process.env.LIBRARY_ACTUAL_DIR || `${root}/review/community`;
const reviewRoot=process.env.LIBRARY_REVIEW_DIR || `${root}/review`;
const editor=process.argv.includes('--editor');
const output=editor?'editor-comparison':'comparison';
await mkdir(`${reviewRoot}/${output}`,{recursive:true});
const metrics=[];
for (const width of [1440,1280,768,390]) for (const state of ['top','viewport','bottom']) {
 const mock=PNG.sync.read(await readFile(`${root}/${editor?'mock-editor':'mock'}/${width}-${state}.png`));
 const actual=PNG.sync.read(await readFile(`${actualRoot}/library-${editor?'editor':'list'}-${width}-${state}.png`));
 if(mock.width!==actual.width||mock.height!==actual.height)throw new Error('Different viewport dimensions');
 const overlay=new PNG({width:mock.width,height:mock.height});
 const diff=new PNG({width:mock.width,height:mock.height});
 const pair=new PNG({width:mock.width*2,height:mock.height});
 PNG.bitblt(mock,pair,0,0,mock.width,mock.height,0,0);
 PNG.bitblt(actual,pair,0,0,mock.width,mock.height,mock.width,0);
 let changed=0,totalError=0;
 for(let i=0;i<mock.data.length;i+=4){
  let distance=0;
  for(let c=0;c<3;c++){
   distance=Math.max(distance,Math.abs(mock.data[i+c]-actual.data[i+c]));
   overlay.data[i+c]=Math.round((mock.data[i+c]+actual.data[i+c])/2);
   totalError+=Math.abs(mock.data[i+c]-actual.data[i+c]);
  }
  const mismatched=distance>12;
  if(mismatched)changed++;
  diff.data.set(mismatched?[255,65,135,255]:[Math.round(actual.data[i]*.25),Math.round(actual.data[i+1]*.25),Math.round(actual.data[i+2]*.25),255],i);
  overlay.data[i+3]=255;
 }
 for(const [name,png]of [['side-by-side',pair],['overlay',overlay],['diff',diff]])await writeFile(`${reviewRoot}/${output}/${width}-${state}-${name}.png`,PNG.sync.write(png));
 metrics.push({width,height:mock.height,state,changedPixels:changed,changedPercent:100*changed/(mock.width*mock.height),meanChannelError:totalError/(mock.width*mock.height*3)});
}
await writeFile(`${reviewRoot}/${output}/metrics.json`,JSON.stringify(metrics,null,2));
console.log(JSON.stringify(metrics,null,2));
// This is a rejection gate, not an automatic design approval. Never update references here.
if(process.argv.includes('--check') && metrics.some(row=>row.changedPercent>0.005 || row.meanChannelError>0.12)) {
 console.error('Library differs from its frozen mockups. Design review is required; do not update baselines to silence this failure.');
 process.exitCode=1;
}


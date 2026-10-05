import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {PNG} from '/app/apps/web/node_modules/pngjs/lib/png.js';
import {execFileSync} from 'node:child_process';
const root='/app/docs/design/chat-glass/lap-pendant';
const results=[];
for(const [reference,actual,name] of [['mock-partial-glass','actual','scene'],['player-glass','player-actual','player'],['mock-hidden-v5','actual-hidden-v5','hidden']]) {
 const out=`${root}/comparison-${name}`; await mkdir(out,{recursive:true});
 const sheets={};
 for(const file of (await readdir(`${root}/${reference}`)).filter(f=>f.endsWith('.png')).sort()) {
  const referenceDir = name === "player" && ["844-expanded-bottom.png", "844-expanded-viewport.png"].includes(file) ? "recovered-reference-player" : reference;
  const a=PNG.sync.read(await readFile(`${root}/${referenceDir}/${file}`));
  const b=PNG.sync.read(await readFile(`${root}/${actual}/${file}`));
  if(a.width!==b.width||a.height!==b.height) throw new Error(`Dimensions: ${file}`);
  const overlay=new PNG({width:a.width,height:a.height}),diff=new PNG({width:a.width,height:a.height}),pair=new PNG({width:a.width*2,height:a.height});
  PNG.bitblt(a,pair,0,0,a.width,a.height,0,0);PNG.bitblt(b,pair,0,0,b.width,b.height,a.width,0);
  let changed=0;
  for(let i=0;i<a.data.length;i+=4){let d=0;for(let c=0;c<3;c++){d=Math.max(d,Math.abs(a.data[i+c]-b.data[i+c]));overlay.data[i+c]=Math.round((a.data[i+c]+b.data[i+c])/2);}overlay.data[i+3]=255;if(d>12)changed++;diff.data.set(d>12?[255,65,135,255]:[b.data[i]*.3,b.data[i+1]*.3,b.data[i+2]*.3,255],i);}
  const base=file.slice(0,-4);
  for(const [label,png] of [['side-by-side',pair],['overlay',overlay],['diff',diff]])await writeFile(`${out}/${base}-${label}.png`,PNG.sync.write(png));
  (sheets[a.width]??=[]).push(`${root}/${referenceDir}/${file}`,`${root}/${actual}/${file}`,`${out}/${base}-overlay.png`,`${out}/${base}-diff.png`);
  results.push({name,file,reference:referenceDir,width:a.width,height:a.height,changedPercent:100*changed/(a.width*a.height)});
 }
 for(const [width,paths]of Object.entries(sheets))execFileSync('montage',[...paths,'-thumbnail','360x380','-tile','4x','-geometry','+3+3','-background','#282828',`${out}/review-${width}.png`]);
}
await writeFile(`${root}/comparison.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify(results.filter(x=>x.changedPercent>0.01),null,2));
console.log(`Compared ${results.length} matching viewport states.`);

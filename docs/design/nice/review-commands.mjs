import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {PNG} from '/app/apps/web/node_modules/pngjs/lib/png.js';
const root='/app/docs/design/nice';
for(const suffix of ['', '-plain','-hidden','-player']) {
 const files=[];
 for(const w of [1440,768,390,844,320]) {
 files.push(`${root}/mock-ready${suffix}/${w}-commands.png`,`${root}/actual${suffix}/${w}-commands.png`,`${root}/comparison${suffix}/${w}-commands-side-by-side.png`,`${root}/comparison${suffix}/${w}-commands-overlay.png`,`${root}/comparison${suffix}/${w}-commands-diff.png`);
 }
 execFileSync('montage',[...files,'-thumbnail','500x390','-tile','5x5','-geometry','+4+4','-background','#282828',`${root}/comparison${suffix}/commands-review.png`]);
}
const a=PNG.sync.read(await readFile(`${root}/mock-ready/1440-top.png`));
const b=PNG.sync.read(await readFile(`${root}/actual/1440-top.png`));
let bounds=[1440,900,0,0],n=0;
for(let i=0;i<a.data.length;i+=4)if(Math.max(...[0,1,2].map(c=>Math.abs(a.data[i+c]-b.data[i+c])))>12){let x=i/4%1440,y=Math.floor(i/4/1440);bounds=[Math.min(bounds[0],x),Math.min(bounds[1],y),Math.max(bounds[2],x),Math.max(bounds[3],y)];n++;}
console.log({n,bounds});

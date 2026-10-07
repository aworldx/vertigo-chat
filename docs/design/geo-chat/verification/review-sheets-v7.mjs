import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root='/app/docs/design/geo-chat/verification/v7/vertigo_glass';
const rows=JSON.parse(await readFile(root+'/comparisons.json','utf8'));
await mkdir(root+'/sheets',{recursive:true});
const groups=new Map();
for(const r of rows){const key=r.file.replace(/-(top|viewport|bottom)\.png$/,'');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);}
for(const [key,items] of groups){if(process.env.GEO_REVIEW_ONLY&&!key.includes(process.env.GEO_REVIEW_ONLY))continue;const paths=[];for(const r of items){const path=root+'/sheets/'+r.file;const a=r.artifacts;execFileSync('magick',['(',a.reference,'-resize','240x',')','(',a.actual,'-resize','240x',')','(',a.side,'-resize','480x',')','(',a.overlay,'-resize','240x',')','+append',path]);paths.push(path)}execFileSync('magick',[...paths,'-append',root+'/sheets/'+key+'.png']);}
console.log('34 review sheets: each row original, Docker, side-by-side, overlay; rows top/viewport/bottom');

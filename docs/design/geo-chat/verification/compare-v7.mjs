import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
const theme=process.env.GEO_DESIGN_THEME || 'vertigo_glass';
const root='/app/docs/design/geo-chat/verification/v7/'+theme;
await mkdir(root+'/compare',{recursive:true});
const rows=JSON.parse(await readFile(root+'/captures.json','utf8'));
const previous=process.env.GEO_COMPARE_ONLY?JSON.parse(await readFile(root+'/comparisons.json','utf8')):[];
for(const row of rows){
 if(process.env.GEO_COMPARE_ONLY&&!row.file.includes(process.env.GEO_COMPARE_ONLY)){Object.assign(row,previous.find(r=>r.file===row.file));continue;}
 let reference='/app/docs/design/geo-chat/design-v7/'+theme+'/mock/'+row.file,actual=root+'/actual/'+row.file,base=root+'/compare/'+row.file.replace('.png','');
 const stable='/app/docs/design/geo-chat/design-v7/'+theme+'/stable-reference/mock/'+row.file;try{await access(stable);reference=stable}catch{}
 if(row.viewport.width===844||row.state==='player-expanded')reference='/app/docs/design/geo-chat/design-v9/'+theme+'/mock/'+row.file;
 execFileSync('magick',[reference,actual,'+append',base+'-side.png']);
 execFileSync('magick',[reference,actual,'-compose','blend','-define','compose:args=50,50','-composite',base+'-overlay.png']);
 const diff=spawnSync('magick',['compare','-metric','AE','-fuzz','3%',reference,actual,base+'-diff.png'],{encoding:'utf8'});
 row.changedPixels=Number(diff.stderr.trim().split(' ')[0]);row.changedPercent=row.changedPixels/(row.viewport.width*row.viewport.height)*100;
 row.artifacts={reference,actual,side:base+'-side.png',overlay:base+'-overlay.png',diff:base+'-diff.png'};
}
await writeFile(root+'/comparisons.json',JSON.stringify(rows,null,2));
console.log(rows.map(r=>r.file+': '+(r.changedPercent?.toFixed(3)??r.status)).join('\n'));

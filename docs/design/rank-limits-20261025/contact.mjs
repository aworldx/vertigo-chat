import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const root='/workspace/docs/design/rank-limits-20261025'
const rows=JSON.parse(await readFile(`${root}/comparison/metrics.json`,'utf8'))
for(const width of [1440,768,390]) {
 const entries=rows.filter(row=>row.width===width)
 for(let group=0;group<2;group++) {
  const selected=entries.slice(group*7,group*7+7)
  const unit=width===390?210:300
  const h=Math.round(selected[0].height*unit/width)
  const paths=[]
  for(const [i,row] of selected.entries()) {
   const args=[]
   for(const kind of ['mock','current','side','overlay','diff']) {
    args.push('(',`${root}/${row[kind]}`,'-resize',`${unit*(kind==='side'?2:1)}x${h}!`,')')
   }
   const out=`${root}/comparison/contact-row-${width}-${group}-${i}.png`
   args.push('+append','-background','#eee','-gravity','north','-splice','0x30','-font','DejaVu-Sans','-fill','black','-pointsize','12','-annotate','+0+5',`${row.file} | MOCK | CURRENT | SIDE (mock/current) | OVERLAY | DIFF`,out)
   execFileSync('convert',args)
   paths.push(out)
  }
  execFileSync('convert',[...paths,'-append',`${root}/comparison/contact-${width}-${group+1}.png`])
 }
}

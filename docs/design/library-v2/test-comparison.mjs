import assert from 'node:assert/strict';
import { mkdtemp,readFile,writeFile,mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PNG } from '/app/apps/web/node_modules/pngjs/lib/png.js';
const root=process.env.LIBRARY_DESIGN_ROOT || '/design';
const temporary=await mkdtemp(join(tmpdir(),'library-visual-gate-'));
const actual=join(temporary,'actual');await mkdir(actual);
for(const width of [1440,1280,768,390])for(const state of ['top','viewport','bottom']){
 await writeFile(join(actual,`library-list-${width}-${state}.png`),await readFile(`${root}/mock/${width}-${state}.png`));
}
const run=()=>spawnSync(process.execPath,[`${root}/compare.mjs`,'--check'],{encoding:'utf8',env:{...process.env,LIBRARY_DESIGN_ROOT:root,LIBRARY_ACTUAL_DIR:actual,LIBRARY_REVIEW_DIR:join(temporary,'review')}});
assert.equal(run().status,0,'identical images must pass');
const target=join(actual,'library-list-390-top.png');
const modified=PNG.sync.read(await readFile(target));
for(let y=200;y<240;y++)for(let x=40;x<100;x++)modified.data.set([255,0,255,255],(y*modified.width+x)*4);
await writeFile(target,PNG.sync.write(modified));
assert.equal(run().status,1,'visible drift must stop the gate');
await writeFile(target,PNG.sync.write(new PNG({width:1,height:1})));
assert.notEqual(run().status,0,'different viewport dimensions must stop the gate');
console.log('Visual gate self-test: identical PASS, changed region REJECTED, viewport mismatch REJECTED. Temporary evidence:',temporary);

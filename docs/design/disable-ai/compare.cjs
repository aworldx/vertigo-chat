const fs = require('node:fs');
const path = require('node:path');
const { PNG } = require('../../../apps/web/node_modules/pngjs');
for (const name of ['desktop', 'mobile']) {
  const read = suffix => PNG.sync.read(fs.readFileSync(path.join(__dirname, `history-${name}-${suffix}.png`)));
  const mock = read('mock'), actual = read('actual');
  if (mock.width !== actual.width || mock.height !== actual.height) throw new Error('Viewport mismatch');
  const pair = new PNG({ width: mock.width * 2, height: mock.height });
  const overlay = new PNG({ width: mock.width, height: mock.height });
  const diff = new PNG({ width: mock.width, height: mock.height });
  let changed = 0;
  PNG.bitblt(mock, pair, 0, 0, mock.width, mock.height, 0, 0);
  PNG.bitblt(actual, pair, 0, 0, actual.width, actual.height, mock.width, 0);
  for (let i = 0; i < mock.data.length; i += 4) {
    let delta = false;
    for (let c = 0; c < 3; c++) {
      overlay.data[i+c] = Math.round((mock.data[i+c] + actual.data[i+c]) / 2);
      diff.data[i+c] = Math.abs(mock.data[i+c] - actual.data[i+c]);
      if (diff.data[i+c]) delta = true;
    }
    if (delta) changed++;
    overlay.data[i+3] = diff.data[i+3] = 255;
  }
  for (const [suffix, png] of [['side-by-side', pair], ['overlay', overlay], ['diff', diff]]) {
    fs.writeFileSync(path.join(__dirname, `history-${name}-${suffix}.png`), PNG.sync.write(png));
  }
  console.log(JSON.stringify({ name, width: mock.width, height: mock.height, changed, total: mock.width * mock.height }));
}

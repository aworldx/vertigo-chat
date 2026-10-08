const { chromium } = require('/app/apps/web/node_modules/playwright');
const fs = require('node:fs');

(async () => {
  const output = '/tmp/disable-ai-design';
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  for (const [name, width, height] of [['desktop', 1440, 900], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, locale: 'ru-RU', timezoneId: 'Europe/Moscow' });
    const page = await context.newPage();
    await page.clock.install({ time: new Date('2026-10-08T09:00:00Z') });
    await page.goto('http://127.0.0.1:4080/history');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${output}/history-${name}-baseline.png`, animations: 'disabled' });
    await page.locator('#history-summarize').evaluate(button => {
      const explanation = button.nextElementSibling;
      if (!explanation || explanation.tagName !== 'P') throw new Error('Missing adjacent summary explanation');
      explanation.remove();
      button.remove();
    });
    await page.getByText('Дата и время по Москве. Последняя выбранная минута включена целиком. Период применяется к истории и AI-саммари.', { exact: true }).evaluate(node => {
      node.textContent = 'Дата и время по Москве. Последняя выбранная минута включена целиком. Период применяется к истории.';
    });
    await page.screenshot({ path: `${output}/history-${name}-mock.png`, animations: 'disabled' });
    fs.writeFileSync(`${output}/history-${name}-state.json`, JSON.stringify(await page.evaluate(() => ({
      route: location.pathname, viewport: { width: innerWidth, height: innerHeight }, scrollY,
      overflow: document.documentElement.scrollWidth > innerWidth,
      fonts: [...new Set([...document.querySelectorAll('*')].map(e => getComputedStyle(e).fontFamily))],
      images: [...document.images].map(e => e.src), body: document.body.innerText,
    })), null, 2));
    await context.close();
  }
  await browser.close();
})();

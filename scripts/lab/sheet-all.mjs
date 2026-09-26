// Renders every family in the given batches at one moment into a contact sheet.
// Usage: node scripts/lab/sheet-all.mjs <outDir> [time=12] [families,comma,separated]
import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const [outDir = 'artifacts/lab/all', time = '12', list] = process.argv.slice(2);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const files = [];
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
    await page.goto('http://127.0.0.1:5189/', { waitUntil: 'load' });
    await page.waitForFunction(() => window.lab?.ready, null, { timeout: 120000 });
    const families = list ? list.split(',') : await page.evaluate(() => window.lab.families);
    for (const family of families) {
      if (files.some(f => f.endsWith(`/${family}.png`))) continue;
      const [url] = await page.evaluate(([f, t]) => window.lab.render({ family: f }, 480, 320, [t]), [family, Number(time)]);
      const file = `${outDir}/${family}.png`; await writeFile(file, Buffer.from(url.split(',')[1], 'base64')); files.push(file);
    }
    break;
  } catch (e) { console.error('retrying after', e.message.slice(0, 120)); }
}
await browser.close();
execFileSync('montage', [...files.map(f => ['-label', f.split('/').pop().replace('.png', ''), f]).flat(), '-tile', '6x', '-geometry', '320x213+4+4', '-background', '#222', '-fill', '#ddd', `${outDir}/sheet.png`]);
console.log(`${outDir}/sheet.png`, files.length);

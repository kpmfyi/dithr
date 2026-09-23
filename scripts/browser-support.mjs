import { chromium } from 'playwright-core';
export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROME_BIN || '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-webgpu', ...(process.env.SEEDBANK_GPU === 'hardware' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
  });
}
export async function openConsumer(browser, url, backend) {
  const page = await browser.newPage({ viewport: { width: 1120, height: 1000 }, deviceScaleFactor: 1 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/consumer/index.html?frozen&backend=${backend}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.seedbank || window.seedbankError, { timeout: 45000 });
  const failure = await page.evaluate(() => window.seedbankError);
  if (failure) { await page.close(); throw new Error(failure); }
  return { page, errors };
}

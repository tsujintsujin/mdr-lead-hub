// node tools/mobile-shot.mjs <url> <out.png> [wait-ms]
// Real Chrome, emulating a 390x844 phone (touch, mobile viewport), full-page screenshot.
import puppeteer from 'puppeteer-core';
const [url, out, wait = '6000'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
await new Promise((r) => setTimeout(r, Number(wait)));
const w = await page.evaluate(() => [innerWidth, document.documentElement.scrollWidth]);
await page.screenshot({ path: out, fullPage: true });
console.log(out, 'innerWidth', w[0], 'scrollWidth', w[1], w[1] > w[0] ? 'HORIZONTAL OVERFLOW' : 'no overflow');
await browser.close();

// node tools/find-wide.mjs <url> : lists elements wider than a 390px phone screen
import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.goto(process.argv[2], { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 4000));
console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => e.getBoundingClientRect().right > 391).slice(0, 12).map((e) => e.tagName + '.' + String(e.className).slice(0, 50) + ' right=' + Math.round(e.getBoundingClientRect().right)).join('\n')));
await browser.close();

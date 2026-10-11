// Mobile Lighthouse performance run for one URL, printed as one line of JSON.
//   node tools/lh.mjs <base64url-of-the-address>
// The address arrives base64-encoded so nothing a visitor typed can reach the shell.
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

const out = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); process.exit(0); };
let url;
try {
  url = new URL(Buffer.from(process.argv[2] || '', 'base64url').toString('utf8'));
  if (!/^https?:$/.test(url.protocol)) throw new Error('only http(s)');
} catch (e) { out({ ok: false, error: 'bad url' }); }

let chrome;
// Hard cap so a slow site can't hold the visitor's results page; Chrome is closed either way.
const timer = setTimeout(async () => { try { if (chrome) await chrome.kill(); } catch (_) {} out({ ok: false, error: 'timeout' }); }, 40000);
try {
  chrome = await chromeLauncher.launch({ chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'] });
  const r = await lighthouse(url.href, { port: chrome.port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], formFactor: 'mobile', maxWaitForLoad: 20000 });
  const lhr = r.lhr;
  const lcp = lhr.audits['largest-contentful-paint'];
  clearTimeout(timer);
  await chrome.kill();
  out({ ok: true, score: Math.round((lhr.categories.performance.score || 0) * 100), lcp_s: lcp && lcp.numericValue ? Math.round(lcp.numericValue / 100) / 10 : null, final_url: lhr.finalDisplayedUrl || lhr.finalUrl });
} catch (e) {
  clearTimeout(timer);
  try { if (chrome) await chrome.kill(); } catch (_) {}
  out({ ok: false, error: String(e.message || e).slice(0, 200) });
}

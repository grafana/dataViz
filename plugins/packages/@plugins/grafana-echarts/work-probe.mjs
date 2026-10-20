import { chromium } from '@playwright/test';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1512, height: 900 } });
await p.goto(process.argv[2]);
const t0 = Date.now(); const changes = {}; const last = {};
while (Date.now() - t0 < 9000) {
  const h = await p.evaluate(() => [...document.querySelectorAll('canvas')].filter((c) => c.width < 600 && c.width > 100).map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 17) s = (s * 31 + d[i]) | 0; return s; }));
  h.forEach((v, i) => { if (last[i] !== undefined && last[i] !== v) (changes[i] ??= []).push(Date.now() - t0); last[i] = v; });
  await p.waitForTimeout(50);
}
console.log('cards', Object.keys(last).length, JSON.stringify(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.length + ' changes, last at ' + v.at(-1) + 'ms']))));
await b.close();

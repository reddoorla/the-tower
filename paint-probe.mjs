// Paint-extent probe: the review showed height-only metrics can't see a
// gradient stopping at content height. Measures the gradient elements'
// geometry inside bands 5 and 7, ours vs live.
import { chromium } from "@playwright/test";

const KILL_CSS = `*, *::before, *::after { transition-duration: 0s !important; animation-duration: 0s !important; }`;

async function grads(page, bandSel) {
  return page.evaluate((sel) => {
    const band = document.querySelector(sel);
    if (!band) return null;
    const bandR = band.getBoundingClientRect();
    const els = [...band.querySelectorAll("*")].filter((el) =>
      (el.getAttribute("style") ?? "").includes("linear-gradient"),
    );
    return {
      bandH: Math.round(bandR.height),
      gradients: els.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          h: Math.round(r.height),
          w: Math.round(r.width),
          topInBand: Math.round(r.top - bandR.top),
        };
      }),
    };
  }, bandSel);
}

async function settle(page) {
  await page.addStyleTag({ content: KILL_CSS });
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= total; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(25);
  }
  await page.evaluate(() => {
    document.querySelectorAll('[style*="opacity"]').forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  });
  await page.waitForTimeout(500);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

await page.goto("http://localhost:5201/dev/blux-site", { waitUntil: "networkidle" });
await settle(page);
// ours: band index by section order (live band 5 = ours idx 5, band 7 = idx 6)
await page.evaluate(() => {
  [...document.querySelectorAll("section")]
    .filter((s) => s.offsetHeight > 40)
    .forEach((s, i) => s.setAttribute("data-b", String(i)));
});
const ours5 = await grads(page, '[data-b="5"]');
const ours7 = await grads(page, '[data-b="6"]');

await page
  .goto("https://www.thetowerburbank.com/", { waitUntil: "networkidle", timeout: 90000 })
  .catch(() => page.goto("https://www.thetowerburbank.com/", { waitUntil: "load", timeout: 90000 }));
await settle(page);
const live5 = await grads(page, "#page-block-5");
const live7 = await grads(page, "#page-block-7");

await browser.close();
console.log(JSON.stringify({ ours5, live5, ours7, live7 }, null, 2));

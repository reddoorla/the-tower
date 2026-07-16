// First-pass pipeline scorecard: ours (/dev/blux-site) vs live thetowerburbank.com.
// Measures band geometry deltas, text-run parity, broken images, console
// errors, and mobile overflow — no fixes, just the numbers.
import { chromium } from "@playwright/test";

const OURS = "http://localhost:5201/dev/blux-site";
const LIVE = "https://www.thetowerburbank.com/";

const KILL_CSS = `
*, *::before, *::after {
  transition-duration: 0s !important;
  transition-delay: 0s !important;
  animation-duration: 0s !important;
  animation-delay: 0s !important;
}`;

async function settle(page) {
  await page.addStyleTag({ content: KILL_CSS });
  const total = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= total; y += 600) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(30);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => {
    document.querySelectorAll('[style*="opacity"]').forEach((el) => {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  });
  await page.waitForTimeout(600);
}

const textRuns = () =>
  Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,figcaption,a,span"))
    .filter((el) => el.offsetParent !== null || el.closest("[hidden],.hidden") === null)
    .map((el) =>
      Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase(),
    )
    .filter((t) => t.length > 2);

const imageAudit = () => {
  const imgs = Array.from(document.querySelectorAll("img"));
  return {
    total: imgs.length,
    broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src.slice(0, 90)),
  };
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160));
});
page.on("pageerror", (e) => consoleErrors.push(`PAGEERROR ${String(e).slice(0, 160)}`));

// ===== LIVE desktop =====
await page
  .goto(LIVE, { waitUntil: "networkidle", timeout: 90000 })
  .catch(() => page.goto(LIVE, { waitUntil: "load", timeout: 90000 }));
await settle(page);
const live = await page.evaluate(() => {
  const bands = Array.from(document.querySelectorAll('[id^="page-block-"]'))
    .filter((s) => /^page-block-\d+$/.test(s.id))
    .map((s) => ({ id: s.id, h: Math.round(s.getBoundingClientRect().height) }));
  return { bands };
});
const liveText = await page.evaluate(textRuns);
const liveImgs = await page.evaluate(imageAudit);
const liveConsoleCount = consoleErrors.length;
consoleErrors.length = 0;

// ===== OURS desktop =====
await page.goto(OURS, { waitUntil: "networkidle", timeout: 60000 });
await settle(page);
const ours = await page.evaluate(() => {
  const secs = Array.from(document.querySelectorAll("main section, main > div > section, section"))
    .filter((s) => s.offsetHeight > 40);
  const uniq = [...new Set(secs)];
  return { bands: uniq.map((s, i) => ({ i, h: Math.round(s.getBoundingClientRect().height) })) };
});
const oursText = await page.evaluate(textRuns);
const oursImgs = await page.evaluate(imageAudit);
const oursConsole = [...consoleErrors];

// ===== Mobile overflow (ours) =====
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: "networkidle" });
await settle(page);
const mobile = await page.evaluate(() => ({
  scrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}));

await browser.close();

// ===== Report =====
const liveSet = new Set(liveText);
const oursSet = new Set(oursText);
const missing = [...new Set(liveText.filter((t) => !oursSet.has(t)))];
const extra = [...new Set(oursText.filter((t) => !liveSet.has(t)))];

console.log(JSON.stringify(
  {
    liveBands: live.bands,
    oursBands: ours.bands,
    liveTextRuns: liveSet.size,
    oursTextRuns: oursSet.size,
    missingFromOurs: missing.slice(0, 40),
    missingCount: missing.length,
    extraInOurs: extra.slice(0, 15),
    liveImgs: { total: liveImgs.total, broken: liveImgs.broken.length },
    oursImgs,
    liveConsoleErrors: liveConsoleCount,
    oursConsoleErrors: oursConsole,
    mobile,
  },
  null,
  2,
));

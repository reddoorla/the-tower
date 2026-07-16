import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const pages = [
  { path: "/dev/a11y-fixtures", name: "a11y fixtures" },
  { path: "/dev/animate-in", name: "animate-in demo" },
  { path: "/dev/blux-page", name: "blux band fixture" },
];

for (const { path, name } of pages) {
  test(`${name} has no axe violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

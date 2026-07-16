import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import SplitFeature from "./index.svelte";
import type { Presentation } from "$lib/blux/presentation";

afterEach(() => cleanup());

const presentation: Presentation = {
  bands: {
    "1": {
      split: {
        mediaSide: "right",
        ratio: 40,
        media: { kind: "image", url: "https://cdn/split.jpg" },
        text: { kind: "body", html: "<p>Manifest text</p>" },
      },
    },
  },
};

const slice = {
  slice_type: "split_feature",
  variation: "default",
  primary: { band: 1, body: [] },
  items: [],
} as never;

describe("SplitFeature slice", () => {
  it("renders media on the token side at the token ratio, text from the manifest tree", () => {
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    expect(cells).toHaveLength(2);
    // mediaSide right → text first, media second
    expect(cells[0]?.textContent).toContain("Manifest text");
    expect(cells[1]?.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn/split.jpg",
    );
    expect(
      (cells[0] as HTMLElement).style.getPropertyValue("--cell-basis"),
    ).toBe("60%");
    expect(
      (cells[1] as HTMLElement).style.getPropertyValue("--cell-basis"),
    ).toBe("40%");
    // Cells stack full-width on mobile; from md: up the ratio basis applies,
    // shrunk by half the column gutter so the two cells + gutter fit one line
    // instead of wrapping (Blux's ~4% column gutter, reserved here in the basis).
    expect((cells[1] as HTMLElement).className).toContain("basis-full");
    expect((cells[1] as HTMLElement).className).toContain(
      "md:basis-[calc(var(--cell-basis)_-_2%)]",
    );
    // The row carries the horizontal gutter between the two columns (md: up),
    // and keeps the vertical gap for the stacked mobile layout.
    const row = cells[0]?.parentElement as HTMLElement;
    expect(row.className).toContain("md:gap-x-[4%]");
    expect(row.className).toContain("gap-y-8");
    // Media on the right → no direction flip.
    expect(row.className).not.toContain("flex-row-reverse");
  });

  it("flips visual order with flex-row-reverse when media belongs left, keeping text-first DOM order", () => {
    const left: Presentation = {
      bands: {
        "1": {
          split: {
            mediaSide: "left",
            ratio: 40,
            media: { kind: "image", url: "https://cdn/split.jpg" },
            text: { kind: "body", html: "<p>Manifest text</p>" },
          },
        },
      },
    };
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation: left } },
    });
    const cells = container.querySelectorAll("[data-split-cell]");
    expect(cells).toHaveLength(2);
    expect(cells[0]?.parentElement?.className).toContain("flex-row-reverse");
    // DOM order stays text first, media second (screen readers, mobile stack).
    expect(cells[0]?.textContent).toContain("Manifest text");
    expect(cells[1]?.querySelector("img")).not.toBeNull();
  });

  it("renders nothing without a manifest split payload", () => {
    const { container } = render(SplitFeature, {
      props: { slice, context: { presentation: { bands: {} } } },
    });
    expect(container.querySelector("[data-split-cell]")).toBeNull();
  });
});

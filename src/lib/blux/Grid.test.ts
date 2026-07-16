import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/svelte";
import Grid from "./Grid.svelte";
import type { RenderNode } from "./presentation";

afterEach(() => cleanup());

const tree: RenderNode = {
  kind: "stack",
  children: [
    { kind: "heading", level: 2, html: "The <em>Space</em>", role: "text2" },
    {
      kind: "row",
      cells: [
        {
          token: { cols: 2, ratio: 60 },
          node: { kind: "body", html: "<p>Left copy</p>", role: "text4" },
        },
        {
          token: { cols: 2, ratio: 40 },
          node: {
            kind: "media",
            media: { kind: "image", url: "https://cdn/a.jpg" },
          },
        },
      ],
    },
  ],
};

describe("Grid (recursive fallback)", () => {
  it("renders nested rows/cells with token widths and role classes", () => {
    const { container } = render(Grid, { props: { node: tree } });
    const h2 = container.querySelector("h2");
    expect(h2?.innerHTML).toContain("The <em>Space</em>");
    expect(h2?.className).toContain("txt-role-text2");
    const cells = container.querySelectorAll("[data-grid-cell]");
    expect(cells).toHaveLength(2);
    // The two 60/40 cells share one flex line (k=2), so each reserves half the
    // 4% column gutter (2%) out of its basis — the columns still fit one line.
    expect(
      (cells[0] as HTMLElement).style.getPropertyValue("--cell-basis"),
    ).toBe("calc(60% - 2%)");
    expect(
      (cells[1] as HTMLElement).style.getPropertyValue("--cell-basis"),
    ).toBe("calc(40% - 2%)");
    // Cells stack full-width on mobile; the token basis applies from md: up.
    expect((cells[0] as HTMLElement).className).toContain("basis-full");
    expect((cells[0] as HTMLElement).className).toContain(
      "md:basis-(--cell-basis)",
    );
    // The row carries the horizontal gutter (md: up) plus the vertical rhythm
    // for cells that wrap to their own line (mobile, stacked bands).
    const row = cells[0]?.parentElement as HTMLElement;
    expect(row.className).toContain("md:gap-x-[4%]");
    expect(row.className).toContain("gap-y-10");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://cdn/a.jpg",
    );
    expect(container.textContent).toContain("Left copy");
  });

  it("renders raw html verbatim and a placeholder for widgets", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          children: [
            { kind: "raw", html: "<div class='legacy'>kept</div>" },
            { kind: "widget", widget: { type: "map" } },
          ],
        },
      },
    });
    expect(container.querySelector(".legacy")?.textContent).toBe("kept");
    expect(container.querySelector("[data-widget='map']")).not.toBeNull();
  });

  it("mounts LocationMap for a widget:map when a map config is provided", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          children: [{ kind: "widget", widget: { type: "map" } }],
        },
        map: { mid: "M", layers: [], toggles: [], styles: [] },
      },
    });
    expect(container.querySelector("[data-map-placeholder]")).not.toBeNull();
    expect(container.querySelector("[data-widget='map']")).toBeNull();
  });

  it("clamps heading levels to the h1–h6 range", () => {
    const { container } = render(Grid, {
      props: {
        node: { kind: "heading", level: 9, html: "Deep" },
      },
    });
    expect(container.querySelector("h6")).not.toBeNull();
    expect(container.querySelector("h9")).toBeNull();
  });

  it("wraps media in a full-width block with an inline-block image, never mx-auto", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "media",
          media: { kind: "image", url: "https://cdn/rule.png" },
        },
      },
    });
    const img = container.querySelector("img") as HTMLElement;
    // Image is inline-block so it follows the ancestor's text-align, not forced
    // center: no `mx-auto`, no `block`.
    expect(img.className).toContain("inline-block");
    expect(img.className).not.toContain("mx-auto");
    // It sits inside a full-width wrapper div.
    const wrapper = img.parentElement as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
    expect(wrapper.className).toContain("w-full");
  });

  it("applies a text node's export style: inline color/padding, margin-right as a md-scoped var", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "subtitle",
          text: "aside",
          role: "text5",
          style: {
            color: "rgb(255, 255, 255)",
            padding: "8px",
            "margin-right": "20%",
          },
        },
      },
    });
    const p = container.querySelector("p") as HTMLElement;
    // Role class is preserved alongside the md-scoped margin utility.
    expect(p.className).toContain("txt-role-text5");
    // color + padding apply inline at every width.
    expect(p.style.color).toBe("rgb(255, 255, 255)");
    expect(p.style.padding).toBe("8px");
    // margin-right is desktop-only: it rides a custom property + md: class, and
    // must NOT be an unconditional inline margin-right that leaks onto mobile.
    expect(p.style.marginRight).toBe("");
    expect(p.style.getPropertyValue("--node-mr")).toBe("20%");
    expect(p.className).toContain("md:mr-(--node-mr)");
  });

  it("applies inline color to a styled heading", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "heading",
          level: 2,
          html: "Bright",
          role: "text11",
          style: { color: "rgb(255, 255, 255)" },
        },
      },
    });
    const h2 = container.querySelector("h2") as HTMLElement;
    expect(h2.className).toContain("txt-role-text11");
    expect(h2.style.color).toBe("rgb(255, 255, 255)");
    // No margin var when the export carries no margin-right.
    expect(h2.className).not.toContain("md:mr-(--node-mr)");
  });

  it("a text node with no style carries only its role class and no inline style", () => {
    const { container } = render(Grid, {
      props: {
        node: { kind: "subtitle", text: "plain", role: "text5" },
      },
    });
    const p = container.querySelector("p") as HTMLElement;
    expect(p.className).toBe("txt-role-text5");
    expect(p.getAttribute("style")).toBeNull();
  });

  it("a cell with cols 'any' falls back to an auto basis from md: up", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [
            { token: { cols: "any" }, node: { kind: "subtitle", text: "s" } },
          ],
        },
      },
    });
    const cell = container.querySelector("[data-grid-cell]") as HTMLElement;
    expect(cell.style.getPropertyValue("--cell-basis")).toBe("auto");
    expect(cell.className).toContain("basis-full");
    expect(cell.className).toContain("md:basis-(--cell-basis)");
  });

  it("reserves the gutter per line (cols), not per cell, on a wrapping grid", () => {
    // Band 14 shape: 7 cells at cols=4 → 4 per line (25% each) → reserve 3%.
    const cells = Array.from({ length: 7 }, () => ({
      token: { cols: 4 },
      node: { kind: "subtitle", text: "card" } as RenderNode,
    }));
    const { container } = render(Grid, {
      props: { node: { kind: "row", cells } },
    });
    const rendered = container.querySelectorAll("[data-grid-cell]");
    expect(rendered).toHaveLength(7);
    for (const c of rendered) {
      expect((c as HTMLElement).style.getPropertyValue("--cell-basis")).toBe(
        "calc(25% - 3%)",
      );
    }
  });

  it("leaves a single-per-line (cols 1) stat stack at full-width, no gutter carved out", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [
            {
              token: { cols: 1, spacing: 40 },
              node: { kind: "subtitle", text: "stat a" },
            },
            {
              token: { cols: 1, spacing: 40 },
              node: { kind: "subtitle", text: "stat b" },
            },
          ],
        },
      },
    });
    const cells = container.querySelectorAll("[data-grid-cell]");
    for (const c of cells) {
      expect((c as HTMLElement).style.getPropertyValue("--cell-basis")).toBe(
        "100%",
      );
    }
  });

  it("paints a row's card background from its style (a peeled .blocks0 fill)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          style: { "background-color": "rgb(255, 255, 255)" },
          cells: [
            { token: { cols: 1 }, node: { kind: "subtitle", text: "s" } },
          ],
        },
      },
    });
    const row = container.querySelector("[data-grid-row]") as HTMLElement;
    expect(row.style.backgroundColor).toBe("rgb(255, 255, 255)");
  });

  it("a row without a card style carries no inline background", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: [
            { token: { cols: 1 }, node: { kind: "subtitle", text: "s" } },
          ],
        },
      },
    });
    const row = container.querySelector("[data-grid-row]") as HTMLElement;
    expect(row.style.backgroundColor).toBe("");
  });

  it("paints a stack's card background from its style", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: { "background-color": "rgb(0, 0, 0)" },
          children: [{ kind: "subtitle", text: "y" }],
        },
      },
    });
    const stack = container.firstElementChild as HTMLElement;
    expect(stack.style.backgroundColor).toBe("rgb(0, 0, 0)");
  });

  it("cells never grow: a wrapping grid's short last line keeps full-line widths", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          cells: Array.from({ length: 7 }, () => ({
            token: { cols: 4 },
            node: { kind: "subtitle", text: "card" } as RenderNode,
          })),
        },
      },
    });
    for (const c of container.querySelectorAll("[data-grid-cell]")) {
      expect((c as HTMLElement).className).not.toContain("grow");
    }
  });

  it("a min-height + _valign stack centers its content in the box, keeping flow rhythm inside", () => {
    // A nested block-in-cell (e.g. an 80vh gradient panel): the stack pins its
    // own box and vertically centers the copy. The outer flex column centers;
    // the inner flow-root wrapper keeps children in NORMAL FLOW so their
    // margins still collapse (flex items' margins can't).
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: {
            "min-height": "80vh",
            background:
              "linear-gradient(45deg, rgb(82, 102, 126), rgb(175, 173, 168))",
            _valign: "middle",
          },
          children: [
            { kind: "heading", level: 1, html: "the tower", role: "text11" },
            { kind: "subtitle", text: "Stand above the rest", role: "text10" },
          ],
        },
      },
    });
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("flex-col");
    expect(outer.className).toContain("justify-center");
    // min-height + background apply; the _valign hint never leaks as CSS.
    expect(outer.getAttribute("style")).toContain("min-height: 80vh");
    expect(outer.getAttribute("style")).toContain("linear-gradient");
    expect(outer.getAttribute("style")).not.toContain("_valign");
    const inner = outer.firstElementChild as HTMLElement;
    expect(inner.className).toContain("flow-root");
    expect(inner.querySelector("h1")?.textContent).toBe("the tower");
  });

  it("a _valign stack WITHOUT a min-height keeps the plain flow-root (row-cell centering only)", () => {
    // Band 6/12's side captions: _valign means self-center against row
    // siblings (the cell class), not an internal flex box.
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "stack",
          style: { _valign: "middle" },
          children: [{ kind: "subtitle", text: "caption", role: "text5" }],
        },
      },
    });
    const outer = container.firstElementChild as HTMLElement;
    expect(outer.className).toContain("flow-root");
    expect(outer.className).not.toContain("justify-center");
  });

  it("a panels row shows only the active toggle's cell; the rest stay mounted hidden", async () => {
    // The clickMap shape: stack[widget:map, panels row], toggles drive which
    // panel is visible. Clicking tab 2 hides panel 0 and reveals panel 1.
    const node: RenderNode = {
      kind: "stack",
      children: [
        { kind: "widget", widget: { type: "map" } },
        {
          kind: "row",
          panels: true,
          cells: [
            {
              token: { cols: 1 },
              node: { kind: "subtitle", text: "addresses" },
            },
            { token: { cols: 1 }, node: { kind: "subtitle", text: "logos" } },
          ],
        },
      ],
    };
    const map = {
      mid: "M",
      layers: [],
      toggles: [
        { label: "All", layers: [] },
        { label: "Offices", layers: [] },
      ],
      styles: [],
    };
    const { container, getByRole } = render(Grid, { props: { node, map } });
    const panelCells = () =>
      [...container.querySelectorAll("[data-panels] > [data-grid-cell]")].map(
        (c) => (c as HTMLElement).className.includes("hidden"),
      );
    expect(panelCells()).toEqual([false, true]);
    await fireEvent.click(getByRole("button", { name: "Offices" }));
    expect(panelCells()).toEqual([true, false]);
    // The panel fade-in rides a :global data-attribute selector, so the cells
    // stay hash-free: exactly `hidden` or nothing. (A scoped selector would
    // stamp Svelte's scope class on every dynamic-class element here.)
    const classes = [
      ...container.querySelectorAll("[data-panels] > [data-grid-cell]"),
    ].map((c) => (c as HTMLElement).className);
    expect(classes.sort()).toEqual(["", "hidden"]);
  });

  it("a panels row without toggles renders its first cell (no crash, nothing hidden twice)", () => {
    const { container } = render(Grid, {
      props: {
        node: {
          kind: "row",
          panels: true,
          cells: [
            { token: { cols: 1 }, node: { kind: "subtitle", text: "only" } },
          ],
        },
      },
    });
    const cells = container.querySelectorAll(
      "[data-panels] > [data-grid-cell]",
    );
    expect(cells).toHaveLength(1);
    expect((cells[0] as HTMLElement).className).not.toContain("hidden");
    expect(container.textContent).toContain("only");
  });
});

import { describe, expect, it, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/svelte";
import CarouselFrames, { type CarouselFrame } from "./CarouselFrames.svelte";

afterEach(() => cleanup());

const frames: CarouselFrame[] = [
  {
    media: {
      kind: "image",
      url: "https://cdn/a.jpg",
      alt: "A",
      minHeight: "80vh",
    },
    caption: "a place to sit and breathe",
    role: "text5",
  },
  {
    media: {
      kind: "image",
      url: "https://cdn/b.jpg",
      alt: "B",
      minHeight: "80vh",
    },
    caption: "a calm escape right outside your door",
    role: "text5",
  },
  // Uncaptioned frame without a source min-height.
  { media: { kind: "image", url: "https://cdn/c.jpg" } },
];

const renderFrames = () =>
  render(CarouselFrames, { props: { frames, label: "Photo slideshow" } });

describe("CarouselFrames", () => {
  it("renders an APG carousel region with one figure per frame", () => {
    const { getByRole, container } = renderFrames();
    const region = getByRole("region");
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
    expect(region.getAttribute("aria-label")).toBe("Photo slideshow");
    expect(container.querySelectorAll("figure")).toHaveLength(3);
  });

  it("reserves the source min-height on each frame (60vh default)", () => {
    const { container } = renderFrames();
    const figures = container.querySelectorAll<HTMLElement>("figure");
    expect(figures[0]?.style.minHeight).toBe("80vh");
    expect(figures[2]?.style.minHeight).toBe("60vh");
  });

  it("renders caption text in a figcaption carrying the caption's txt-role", () => {
    const { container } = renderFrames();
    const captions = container.querySelectorAll("figcaption");
    // The uncaptioned frame renders no figcaption at all.
    expect(captions).toHaveLength(2);
    expect(captions[0]?.textContent).toBe("a place to sit and breathe");
    expect(captions[0]?.querySelector("span")?.className).toContain(
      "txt-role-text5",
    );
  });

  it("honors the source data-columns — all frames visible means no controls", () => {
    const { container } = render(CarouselFrames, {
      props: { frames, label: "Photo slideshow", columns: 3 },
    });
    // Slider renders no arrows when everything fits in one view.
    expect(container.querySelector("button")).toBeNull();
  });

  it("shows prev/next arrows but no dots and no autoplay pause control", () => {
    const { getByLabelText, container } = renderFrames();
    expect(getByLabelText("Previous slide")).toBeTruthy();
    expect(getByLabelText("Next slide")).toBeTruthy();
    // Arrows overlay the frame edges like the source (not a below-track row).
    expect(container.querySelector(".blux-carousel-nav")).toBeTruthy();
    // The export encodes no dots …
    expect(container.querySelector('[aria-label^="Go to slide"]')).toBeNull();
    // … and no autoplay, so no rotation and no pause control.
    expect(container.querySelector('[aria-label="Pause slides"]')).toBeNull();
  });
});

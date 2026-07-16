import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/svelte";
import Nav from "./Nav.svelte";

// jsdom has no WAAPI (Element.animate), so we report reduced motion: the
// $lib/transitions wrappers then collapse durations to 0 and Svelte skips the
// animation machinery entirely. This is the same path real reduced-motion
// users hit in production.
function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches:
      query === "(prefers-reduced-motion: reduce)" ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

// jsdom performs no layout — treat connected elements as visible so
// trapFocus's getClientRects() filter keeps them.
beforeEach(() => {
  mockMatchMedia(true);
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (
    this: Element,
  ) {
    return (this.isConnected ? [{}] : []) as unknown as DOMRectList;
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const frame = () => new Promise((r) => requestAnimationFrame(r));

// Hash hrefs keep jsdom from attempting (unimplemented) page navigation.
const navLinks = [
  { text: "Services", href: "#services" },
  { text: "About", href: "#about" },
];

describe("Nav — logo-only mode", () => {
  it("renders no menu button without navLinks", () => {
    const { queryByLabelText, getByText } = render(Nav);
    expect(getByText("Logo")).toBeTruthy();
    expect(queryByLabelText("Open menu")).toBeNull();
  });
});

describe("Nav — mobile menu", () => {
  it("opens the menu and moves focus into it", async () => {
    const { getByLabelText, getByRole } = render(Nav, { navLinks });

    await fireEvent.click(getByLabelText("Open menu"));
    const dialog = getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");

    await frame();
    expect(document.activeElement).toBe(getByLabelText("Close menu"));
  });

  it("wraps Tab from the last link back to the close button", async () => {
    const { getByLabelText, getByRole } = render(Nav, { navLinks });
    await fireEvent.click(getByLabelText("Open menu"));
    await frame();

    const dialog = getByRole("dialog");
    const links = Array.from(dialog.querySelectorAll("a"));
    const last = links[links.length - 1];
    last.focus();

    const e = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    last.dispatchEvent(e);

    expect(e.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(getByLabelText("Close menu"));
  });

  it("closes on Escape and returns focus to the re-mounted trigger", async () => {
    const { getByLabelText, getByRole, queryByRole } = render(Nav, {
      navLinks,
    });
    await fireEvent.click(getByLabelText("Open menu"));
    await frame();

    await fireEvent.keyDown(getByRole("dialog"), { key: "Escape" });
    expect(queryByRole("dialog")).toBeNull();

    // The trigger unmounted while the menu was open; focus lands on the fresh
    // instance one frame after close.
    await frame();
    await frame();
    expect(document.activeElement).toBe(getByLabelText("Open menu"));
  });

  it("closes when a menu link is activated", async () => {
    const { getByLabelText, getByRole, queryByRole } = render(Nav, {
      navLinks,
    });
    await fireEvent.click(getByLabelText("Open menu"));
    await frame();

    const link = Array.from(getByRole("dialog").querySelectorAll("a"))[0];
    await fireEvent.click(link);

    expect(queryByRole("dialog")).toBeNull();
  });
});

# `animateIn` Svelte Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `AnimateIn.svelte` wrapper component with a `use:animateIn` Svelte action that applies viewport-triggered or state-triggered fade-up reveal directly to any element.

**Architecture:** A single action function in `src/lib/actions/animateIn.ts`. Mode (viewport vs. triggered) is locked at mount based on param shape — `undefined` or options without a `trigger` key → viewport (IntersectionObserver); boolean or options with `trigger` defined → triggered (state-driven). All animation applied as inline styles on the host element — no class mutation, no wrapper element. Respects `prefers-reduced-motion`.

**Tech Stack:** Svelte 5, TypeScript, Tailwind v4 (only the `--transition-fast-slow` CSS var is consumed), Vitest + `@testing-library/svelte` with jsdom.

**Spec:** [docs/superpowers/specs/2026-04-23-animate-in-action-design.md](../specs/2026-04-23-animate-in-action-design.md)

---

## File Structure

| File                                            | Action | Responsibility                                                     |
| ----------------------------------------------- | ------ | ------------------------------------------------------------------ |
| `src/lib/actions/animateIn.ts`                  | Create | The action — mode selection, styles, observer, update, destroy.    |
| `src/lib/actions/animateIn.test.ts`             | Create | Unit tests for both modes, options overrides, reduced-motion.      |
| `src/lib/components/ContentWidth.svelte`        | Modify | Drop `AnimateIn` wrapper; apply `use:animateIn` on inner `<div>`.  |
| `src/lib/components/Animation/AnimateIn.svelte` | Delete | No longer needed after `ContentWidth` refactor.                    |
| `README.md`                                     | Modify | Add `use:animateIn` docs; remove `AnimateIn` from components list. |

Each task ends with a commit. Commits are small and focused so any single task can be reverted cleanly.

---

## Task 1: Scaffold the action + viewport mode initial hidden styles

**Files:**

- Create: `src/lib/actions/animateIn.ts`
- Create: `src/lib/actions/animateIn.test.ts`

**Context:** A Svelte 5 action is a plain function `(node, param?) => { update?, destroy? }`. We'll test it by calling it directly against a `document.createElement('div')` — no Svelte render needed.

- [ ] **Step 1: Write the failing test for viewport mode initial styles**

Create `src/lib/actions/animateIn.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { animateIn } from "./animateIn";

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];
  disconnected = false;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  // Test helper — trigger an intersection event.
  trigger(isIntersecting: boolean) {
    this.callback(
      [
        {
          isIntersecting,
          target: this.observed[0],
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }
}

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

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  // @ts-expect-error — replacing global for test
  window.IntersectionObserver = FakeIntersectionObserver;
  mockMatchMedia(false);
});

describe("animateIn — viewport mode", () => {
  it("applies initial hidden styles on mount", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);

    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("translateY(50%)");
    expect(el.style.transition).toContain(
      "opacity 2400ms var(--transition-fast-slow)",
    );
    expect(el.style.transition).toContain(
      "transform 2400ms var(--transition-fast-slow)",
    );
  });
});
```

- [ ] **Step 2: Run the test — confirm it fails**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — `Cannot find module './animateIn'`.

- [ ] **Step 3: Create the action with viewport-mode initial styles**

Create `src/lib/actions/animateIn.ts`:

```ts
export type AnimateInOptions = {
  trigger?: boolean;
  duration?: number;
  delayMax?: number;
  translateY?: string;
};

export type AnimateInParam = boolean | AnimateInOptions | undefined;

type ResolvedConfig = {
  mode: "viewport" | "triggered";
  trigger: boolean;
  duration: number;
  delayMax: number;
  translateY: string;
};

function resolveConfig(param: AnimateInParam): ResolvedConfig {
  const isTriggered =
    typeof param === "boolean" ||
    (param !== undefined && typeof param === "object" && "trigger" in param);

  const opts: AnimateInOptions =
    typeof param === "object" && param !== null ? param : {};
  const trigger = typeof param === "boolean" ? param : (opts.trigger ?? false);

  return {
    mode: isTriggered ? "triggered" : "viewport",
    trigger,
    duration: opts.duration ?? 2400,
    delayMax: opts.delayMax ?? 400,
    translateY: opts.translateY ?? "50%",
  };
}

function applyHidden(node: HTMLElement, cfg: ResolvedConfig) {
  node.style.opacity = "0";
  node.style.transform = `translateY(${cfg.translateY})`;
  node.style.transition =
    `opacity ${cfg.duration}ms var(--transition-fast-slow), ` +
    `transform ${cfg.duration}ms var(--transition-fast-slow)`;
}

export function animateIn(node: HTMLElement, param?: AnimateInParam) {
  const cfg = resolveConfig(param);
  applyHidden(node, cfg);

  return {
    update(_next?: AnimateInParam) {},
    destroy() {},
  };
}
```

- [ ] **Step 4: Run the test — confirm it passes**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 1 test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): scaffold animateIn action with viewport initial styles"
```

---

## Task 2: Viewport mode — intersection reveal and destroy cleanup

**Files:**

- Modify: `src/lib/actions/animateIn.ts`
- Modify: `src/lib/actions/animateIn.test.ts`

- [ ] **Step 1: Add failing tests for reveal and destroy**

Append to `src/lib/actions/animateIn.test.ts` inside the `describe("animateIn — viewport mode", ...)` block:

```ts
it("reveals on intersection and disconnects the observer", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  animateIn(el);
  const observer = FakeIntersectionObserver.instances[0];
  expect(observer).toBeDefined();
  expect(observer.observed[0]).toBe(el);

  observer.trigger(true);

  expect(el.style.opacity).toBe("1");
  expect(el.style.transform).toBe("translateY(0)");
  expect(observer.disconnected).toBe(true);
});

it("does not reveal when not intersecting", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  animateIn(el);
  FakeIntersectionObserver.instances[0].trigger(false);

  expect(el.style.opacity).toBe("0");
  expect(FakeIntersectionObserver.instances[0].disconnected).toBe(false);
});

it("disconnects the observer on destroy", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const ret = animateIn(el);
  const observer = FakeIntersectionObserver.instances[0];
  ret.destroy();

  expect(observer.disconnected).toBe(true);
});
```

- [ ] **Step 2: Run tests — confirm they fail**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — observer is never constructed in viewport mode; destroy does nothing.

- [ ] **Step 3: Add observer creation and reveal logic**

Edit `src/lib/actions/animateIn.ts`. Add a `reveal` helper above `animateIn`:

```ts
function reveal(node: HTMLElement) {
  node.style.opacity = "1";
  node.style.transform = "translateY(0)";
}
```

Replace the body of `animateIn` with:

```ts
export function animateIn(node: HTMLElement, param?: AnimateInParam) {
  const cfg = resolveConfig(param);
  applyHidden(node, cfg);

  let observer: IntersectionObserver | undefined;

  if (cfg.mode === "viewport") {
    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal(node);
          observer?.disconnect();
        }
      },
      { threshold: 0 },
    );
    observer.observe(node);
  }

  return {
    update(_next?: AnimateInParam) {},
    destroy() {
      observer?.disconnect();
    },
  };
}
```

- [ ] **Step 4: Run tests — confirm all four pass**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): viewport-mode intersection reveal and destroy cleanup"
```

---

## Task 3: Viewport mode — position-based stagger delay

**Files:**

- Modify: `src/lib/actions/animateIn.ts`
- Modify: `src/lib/actions/animateIn.test.ts`

**Context:** Matches the existing `AnimateIn.svelte` formula: `transitionDelay = delayMax * (rect.left / innerWidth)`. Computed once at mount.

- [ ] **Step 1: Add failing test for transition-delay**

Append to `src/lib/actions/animateIn.test.ts` inside the viewport describe block:

```ts
it("sets transition-delay based on horizontal position", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  // Element 25% across a 1000px viewport, delayMax 400 → 100ms delay.
  Object.defineProperty(window, "innerWidth", {
    value: 1000,
    configurable: true,
  });
  el.getBoundingClientRect = () =>
    ({
      left: 250,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  animateIn(el);

  expect(el.style.transitionDelay).toBe("100ms");
});

it("honors a custom delayMax", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  Object.defineProperty(window, "innerWidth", {
    value: 1000,
    configurable: true,
  });
  el.getBoundingClientRect = () =>
    ({
      left: 500,
      top: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  animateIn(el, { delayMax: 800 });

  expect(el.style.transitionDelay).toBe("400ms");
});
```

- [ ] **Step 2: Run — confirm they fail**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — `transitionDelay` is empty string.

- [ ] **Step 3: Compute and apply delay in viewport mode**

In `src/lib/actions/animateIn.ts`, inside the `if (cfg.mode === "viewport")` block, BEFORE the observer is created, add:

```ts
const delay =
  cfg.delayMax * (node.getBoundingClientRect().left / window.innerWidth);
node.style.transitionDelay = `${delay}ms`;
```

- [ ] **Step 4: Run — confirm both tests pass**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 6 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): position-based stagger delay in viewport mode"
```

---

## Task 4: Triggered mode — initial state from boolean or options

**Files:**

- Modify: `src/lib/actions/animateIn.ts`
- Modify: `src/lib/actions/animateIn.test.ts`

**Context:** Mode selection is already wired through `resolveConfig`. This task makes the action branch on it — no observer in triggered mode, and the initial styles match the incoming `trigger` value.

- [ ] **Step 1: Add failing tests for triggered mode initial state**

Append to `src/lib/actions/animateIn.test.ts` AFTER the viewport describe block:

```ts
describe("animateIn — triggered mode", () => {
  it("mounts hidden when trigger is false (boolean shorthand)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.opacity).toBe("0");
    expect(el.style.transform).toBe("translateY(50%)");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("mounts visible when trigger is true (boolean shorthand)", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, true);

    expect(el.style.opacity).toBe("1");
    expect(el.style.transform).toBe("translateY(0)");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("mounts visible when options have trigger: true", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { trigger: true });

    expect(el.style.opacity).toBe("1");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("does not set transition-delay in triggered mode", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.transitionDelay).toBe("");
  });
});
```

- [ ] **Step 2: Run — confirm they fail**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — triggered mode still creates an observer and mounts hidden regardless of `trigger`.

- [ ] **Step 3: Branch on mode in the action**

In `src/lib/actions/animateIn.ts`, replace the body of `animateIn` with:

```ts
export function animateIn(node: HTMLElement, param?: AnimateInParam) {
  const cfg = resolveConfig(param);
  let observer: IntersectionObserver | undefined;

  if (cfg.mode === "triggered") {
    if (cfg.trigger) {
      applyHidden(node, cfg);
      reveal(node);
    } else {
      applyHidden(node, cfg);
    }
  } else {
    applyHidden(node, cfg);
    const delay =
      cfg.delayMax * (node.getBoundingClientRect().left / window.innerWidth);
    node.style.transitionDelay = `${delay}ms`;

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal(node);
          observer?.disconnect();
        }
      },
      { threshold: 0 },
    );
    observer.observe(node);
  }

  return {
    update(_next?: AnimateInParam) {},
    destroy() {
      observer?.disconnect();
    },
  };
}
```

- [ ] **Step 4: Run — confirm all tests pass**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 10 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): triggered mode with boolean and options params"
```

---

## Task 5: Triggered mode — `update` flips styles on reactive change

**Files:**

- Modify: `src/lib/actions/animateIn.ts`
- Modify: `src/lib/actions/animateIn.test.ts`

**Context:** In Svelte 5, when a reactive param passed to an action changes, the action's `update` callback runs with the new value. In viewport mode `update` stays a no-op (decided in the spec).

- [ ] **Step 1: Add failing test for triggered update**

Append to the triggered describe block in `src/lib/actions/animateIn.test.ts`:

```ts
it("flips to visible when update passes trigger: true", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const ret = animateIn(el, false);
  expect(el.style.opacity).toBe("0");

  ret.update(true);
  expect(el.style.opacity).toBe("1");
  expect(el.style.transform).toBe("translateY(0)");
});

it("flips back to hidden when update passes trigger: false", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const ret = animateIn(el, true);
  ret.update(false);

  expect(el.style.opacity).toBe("0");
  expect(el.style.transform).toBe("translateY(50%)");
});

it("update is a no-op in viewport mode", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);

  const ret = animateIn(el);
  ret.update({ duration: 500 });

  // Still the default duration — viewport mode ignores updates.
  expect(el.style.transition).toContain("2400ms");
});
```

- [ ] **Step 2: Run — confirm they fail**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — `update` currently does nothing.

- [ ] **Step 3: Implement `update` for triggered mode**

In `src/lib/actions/animateIn.ts`, replace the return statement of `animateIn` with:

```ts
return {
  update(next?: AnimateInParam) {
    if (cfg.mode !== "triggered") return;
    const nextCfg = resolveConfig(next);
    if (nextCfg.trigger) {
      reveal(node);
    } else {
      applyHidden(node, cfg);
    }
  },
  destroy() {
    observer?.disconnect();
  },
};
```

- [ ] **Step 4: Run — confirm all tests pass**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 13 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): update flips styles when trigger changes"
```

---

## Task 6: Options overrides — `duration` and `translateY`

**Files:**

- Modify: `src/lib/actions/animateIn.test.ts`

**Context:** `duration` and `translateY` defaults flow through `resolveConfig` already. This task is a regression guard to confirm the overrides reach the DOM. No implementation change expected.

- [ ] **Step 1: Add failing or guard test**

Append to `src/lib/actions/animateIn.test.ts` as a new describe block:

```ts
describe("animateIn — options overrides", () => {
  it("applies a custom duration in the transition", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { duration: 1200 });

    expect(el.style.transition).toContain(
      "opacity 1200ms var(--transition-fast-slow)",
    );
    expect(el.style.transition).toContain(
      "transform 1200ms var(--transition-fast-slow)",
    );
  });

  it("applies a custom translateY on the hidden transform", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { translateY: "24px" });

    expect(el.style.transform).toBe("translateY(24px)");
  });

  it("passes duration through in triggered mode too", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, { trigger: false, duration: 800 });

    expect(el.style.transition).toContain("800ms");
  });
});
```

- [ ] **Step 2: Run — expect all to pass (no impl change needed)**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 16 tests total. If any fail, fix by routing the option through `applyHidden` / `resolveConfig` in `animateIn.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/animateIn.test.ts
git commit -m "test(actions): regression coverage for duration and translateY overrides"
```

---

## Task 7: `prefers-reduced-motion` short-circuit

**Files:**

- Modify: `src/lib/actions/animateIn.ts`
- Modify: `src/lib/actions/animateIn.test.ts`

**Context:** When the user prefers reduced motion, render the element visible and skip all animation machinery — no observer, no transition, no transform.

- [ ] **Step 1: Add failing test**

Append to `src/lib/actions/animateIn.test.ts` as a new describe block:

```ts
describe("animateIn — prefers-reduced-motion", () => {
  it("skips animation when reduced motion is preferred (viewport mode)", () => {
    mockMatchMedia(true);
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el);

    expect(el.style.opacity).toBe("");
    expect(el.style.transform).toBe("");
    expect(el.style.transition).toBe("");
    expect(FakeIntersectionObserver.instances.length).toBe(0);
  });

  it("skips animation when reduced motion is preferred (triggered mode)", () => {
    mockMatchMedia(true);
    const el = document.createElement("div");
    document.body.appendChild(el);

    animateIn(el, false);

    expect(el.style.opacity).toBe("");
    expect(el.style.transition).toBe("");
  });
});
```

- [ ] **Step 2: Run — confirm they fail**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: FAIL — styles still applied regardless of `matchMedia`.

- [ ] **Step 3: Short-circuit at the top of `animateIn`**

In `src/lib/actions/animateIn.ts`, add this check as the first statement inside `animateIn`, BEFORE `const cfg = resolveConfig(param)`:

```ts
if (
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  return { update() {}, destroy() {} };
}
```

- [ ] **Step 4: Run — confirm all tests pass**

Run: `pnpm test src/lib/actions/animateIn.test.ts`
Expected: PASS — 18 tests total.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/animateIn.ts src/lib/actions/animateIn.test.ts
git commit -m "feat(actions): skip animation when prefers-reduced-motion is set"
```

---

## Task 8: Refactor `ContentWidth.svelte` and delete the wrapper component

**Files:**

- Modify: `src/lib/components/ContentWidth.svelte`
- Delete: `src/lib/components/Animation/AnimateIn.svelte`

**Context:** `ContentWidth` is the only consumer of `AnimateIn.svelte`. The action attaches directly to the inner `<div>` when the `animateIn` prop is true. No action when disabled — branch the template so we don't wire up a no-op.

- [ ] **Step 1: Rewrite `ContentWidth.svelte`**

Replace the entire contents of `src/lib/components/ContentWidth.svelte` with:

```svelte
<script lang="ts">
  import { animateIn as animateInAction } from "$lib/actions/animateIn";
  import { viewport } from "$stores/viewport.svelte";
  import { onMount } from "svelte";

  let {
    animateIn = false,
    class: passedClasses = "",
    style: passedStyle = "",
    children = undefined,
    edgeFadeColor = "",
  } = $props();

  onMount(() => viewport.subscribe());

  const baseClasses =
    "max-w-[1220px] xl:max-w-[1440px] xl:mx-auto mx-[4%] w-[92%]";
  const defaultLayouts = "flex flex-col items-center justify-center relative";

  const edgeWidthPx = $derived.by(() => {
    const w = viewport.width;
    if (w < 1060) return w * 0.04;
    if (w < 1340) return (w - 1220) / 2;
    if (w < 1500) return w * 0.04;
    return (w - 1440) / 2;
  });
</script>

{#snippet content()}
  {#if animateIn}
    <div
      use:animateInAction
      class="{baseClasses} {passedClasses || defaultLayouts}"
      style={passedStyle}
    >
      {@render children?.()}
    </div>
  {:else}
    <div
      class="{baseClasses} {passedClasses || defaultLayouts}"
      style={passedStyle}
    >
      {@render children?.()}
    </div>
  {/if}
{/snippet}

{#if edgeFadeColor}
  <div class="w-screen relative">
    <div
      class="absolute h-full top-0 right-0 z-20"
      style="background: linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, {edgeFadeColor} 100%);width:{edgeWidthPx}px;"
    ></div>
    <div
      class="absolute h-full top-0 left-0 z-20"
      style="background: linear-gradient(270deg, rgba(0, 0, 0, 0) 0%, {edgeFadeColor} 100%);width:{edgeWidthPx}px;"
    ></div>
    <div class="w-screen relative">
      {@render content()}
    </div>
  </div>
{:else}
  {@render content()}
{/if}
```

Notable changes: the import is renamed to `animateInAction` to avoid colliding with the `animateIn` prop; the `animatableContent` snippet is gone — its branching is fused into `content`.

- [ ] **Step 2: Delete the wrapper component**

```bash
git rm src/lib/components/Animation/AnimateIn.svelte
```

- [ ] **Step 3: Type-check the project**

Run: `pnpm check`
Expected: no errors. If any file still imports `AnimateIn.svelte`, that's a real reference to fix — investigate, don't paper over.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass (18 action tests + existing suites).

- [ ] **Step 5: Manually verify in the dev server**

Start: `pnpm dev`
Navigate to any page that uses `<ContentWidth animateIn />` (search the repo with `grep -rn "animateIn" src/lib/slices src/routes` first — if there are no consumers using `animateIn={true}`, add one temporarily to a slice you're editing, verify reveal, then revert).
Expected: element fades/translates in on scroll into view, no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/ContentWidth.svelte src/lib/components/Animation/AnimateIn.svelte
git commit -m "refactor(content-width): use animateIn action, delete wrapper component"
```

---

## Task 9: README update

**Files:**

- Modify: `README.md`

**Context:** Add documentation for the new action and remove `AnimateIn` from the listed components.

- [ ] **Step 1: Remove `AnimateIn` from the Animation components bullet**

Edit `README.md`. Replace:

```md
- **Animation** — `AnimateIn`, `AnimateInTriggered`, `AnimateOutTriggered`, `Slider`, `TriggerTransitionOnMount`
```

With:

```md
- **Animation** — `AnimateInTriggered`, `AnimateOutTriggered`, `Slider`, `TriggerTransitionOnMount`
```

- [ ] **Step 2: Add the action subsection**

In `README.md`, after the `## Components` section ending (after "allowing work from different projects to carry over rather than rebuilding from scratch.") and before `## Getting Started`, insert:

````md
### Animation action — `use:animateIn`

A Svelte action that attaches fade-up reveal behavior to any element. Defaults to viewport-triggered (via `IntersectionObserver` — reveals on first scroll into view); pass a boolean or `{ trigger }` option to drive it from state instead. Applies inline styles only, so it composes with whatever `class` / `style` the host already has. Respects `prefers-reduced-motion`.

```svelte
<script>
  import { animateIn } from "$lib/actions/animateIn";
  let isOpen = $state(false);
</script>

<!-- Viewport-triggered -->
<div use:animateIn>…</div>

<!-- State-triggered -->
<div use:animateIn={isOpen}>…</div>

<!-- With overrides -->
<div use:animateIn={{ duration: 1200, delayMax: 0 }}>…</div>
```

**Options:** `trigger?: boolean` · `duration?: number` (ms, default `2400`) · `delayMax?: number` (ms, default `400`; viewport mode only — position-based stagger) · `translateY?: string` (default `"50%"`).
````

- [ ] **Step 3: Render-check the README**

Run: `pnpm lint` (Prettier will catch any markdown formatting issues)
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document use:animateIn action"
```

---

## Self-Review

**Spec coverage:**

- API surface (`AnimateInOptions`, `AnimateInParam`, mode selection table) → Tasks 1, 4, 6 ✓
- Inline styles on host, no class mutation → Task 1 ✓
- Viewport mode: IntersectionObserver, reveal on first intersect, disconnect → Task 2 ✓
- Viewport mode: position-based stagger → Task 3 ✓
- Triggered mode: initial state from param → Task 4 ✓
- Triggered mode: update() flips styles → Task 5 ✓
- Viewport update is a no-op → Task 5 (explicit test) ✓
- `prefers-reduced-motion` short-circuit → Task 7 ✓
- `ContentWidth` refactor + `AnimateIn.svelte` deletion → Task 8 ✓
- README docs → Task 9 ✓
- File layout matches spec → ✓

**Placeholder scan:** No TBD/TODO/"similar to". All steps show actual code or actual commands.

**Type consistency:** `AnimateInOptions`, `AnimateInParam`, `ResolvedConfig`, `animateIn`, `resolveConfig`, `applyHidden`, `reveal` — names used consistently across all tasks. The import rename (`animateIn` → `animateInAction`) in `ContentWidth.svelte` is deliberate to avoid clashing with the `animateIn` prop and is called out in Task 8.

**Scope:** One action, one consumer refactor, one deletion, one docs update — fits a single plan.

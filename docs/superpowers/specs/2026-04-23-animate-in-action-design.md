# `animateIn` Svelte Action — Design

## Goal

Replace the `AnimateIn.svelte` wrapper component with a togglable Svelte action (`use:animateIn`) that can attach to any element, removing the extra wrapper `<div>` and letting the behavior ride alongside whatever classes/styles the host element already has.

A single action handles both modes:

- **Viewport mode** (default) — reveal on first intersection with the viewport.
- **Triggered mode** — reveal tied to a reactive boolean, chosen automatically when a `boolean` or `{ trigger }` option is passed.

## Non-goals

- Porting `AnimateInTriggered` / `AnimateOutTriggered` / `TriggerTransitionOnMount` to actions. They remain as components; no current consumers in the repo.
- Introducing a new animation primitive, library dependency, or easing. The action reuses the existing `--transition-fast-slow` CSS variable from `src/app.css`.
- Mode switching. Viewport vs. triggered is locked at mount; switching mid-life is not supported.

## Architecture

### File layout

```text
src/lib/actions/
  animateIn.ts           # new — action implementation
  animateIn.test.ts      # new — vitest coverage

src/lib/components/Animation/
  AnimateIn.svelte       # DELETED

src/lib/components/
  ContentWidth.svelte    # refactored to use the action

README.md                # new "Animation action" subsection under Components
```

### API

```ts
type AnimateInOptions = {
  trigger?: boolean; // present → triggered mode; absent → viewport mode
  duration?: number; // default 2400 (ms)
  delayMax?: number; // default 400 (ms); viewport mode only — position-based stagger
  translateY?: string; // default "50%"
};

type AnimateInParam = boolean | AnimateInOptions | undefined;

export function animateIn(
  node: HTMLElement,
  param?: AnimateInParam,
): { update(p?: AnimateInParam): void; destroy(): void };
```

**Mode selection rule (locked at mount):**

| Param shape                               | Mode      |
| ----------------------------------------- | --------- |
| `undefined`                               | viewport  |
| `AnimateInOptions` without `trigger` key  | viewport  |
| `boolean`                                 | triggered |
| `AnimateInOptions` with `trigger` defined | triggered |

### Usage

```svelte
<!-- Viewport, default options -->
<div use:animateIn>…</div>

<!-- Triggered by a reactive boolean -->
<div use:animateIn={isOpen}>…</div>

<!-- Viewport with overrides -->
<div use:animateIn={{ duration: 1200 }}>…</div>

<!-- Triggered with overrides -->
<div use:animateIn={{ trigger: isOpen, duration: 1200 }}>…</div>
```

## Behavior

All styles are applied **inline** on the host element so the action composes with any existing `class` / `style` the element carries. No class mutation, no wrapper element.

### Initial (hidden) styles, both modes

```css
opacity: 0;
transform: translateY({translateY});
transition:
  opacity {duration}ms var(--transition-fast-slow),
  transform {duration}ms var(--transition-fast-slow);
```

### Viewport mode

1. Compute `transitionDelay = delayMax * (rect.left / innerWidth)` once, on mount, matching the current `AnimateIn.svelte` formula.
2. Apply `transition-delay: {transitionDelay}ms` inline.
3. Create `new IntersectionObserver(cb, { threshold: 0 })`, observe the host.
4. On first `isIntersecting`: clear hidden styles (`opacity: 1`, `transform: translateY(0)`) and `observer.disconnect()`.
5. On `destroy`: `observer.disconnect()`.

### Triggered mode

1. No observer, no position-based delay.
2. Initial visible/hidden state reflects the incoming `trigger` bool.
3. `update(param)` reads the new `trigger` value and toggles between the hidden and visible inline styles.
4. No-op on `destroy`.

### `update` semantics in viewport mode

In viewport mode, `update` is a no-op. Option changes after mount (e.g. `duration`, `delayMax`) are not re-applied — they would either conflict with an in-flight transition or arrive after the reveal has already fired. Consumers that need dynamic durations should use triggered mode.

### `prefers-reduced-motion`

If `window.matchMedia('(prefers-reduced-motion: reduce)').matches` at mount, skip the animation entirely: no hidden styles applied, no observer created, no transition set. Element renders visible.

### SSR

Actions run client-side after hydration. The action sets initial hidden styles synchronously in its mount body, before the first paint following hydration, so there is no visible flash in practice. This is not part of v1 to address, but if a flash appears for above-the-fold content we can add a documented belt-and-suspenders pattern (consumer adds `opacity-0` on the element; action overrides).

## Migration

### `ContentWidth.svelte`

Currently wraps its content in `<AnimateIn>` via a `{#snippet animatableContent}` when the `animateIn` prop is true. Refactor to apply the action directly to the existing inner `<div>`, branching the template to avoid a no-op action when disabled:

```svelte
{#if animateIn}
  <div use:animateIn class={classes} style={passedStyle}>
    {@render children?.()}
  </div>
{:else}
  <div class={classes} style={passedStyle}>
    {@render children?.()}
  </div>
{/if}
```

The `animatableContent` snippet is removed. The edge-fade branch continues to wrap this block.

### Deletions

- `src/lib/components/Animation/AnimateIn.svelte` — deleted (only consumer was `ContentWidth`).

### Unchanged

- `AnimateInTriggered.svelte`, `AnimateOutTriggered.svelte`, `Slider.svelte`, `TriggerTransitionOnMount.svelte` — no consumers in the repo, left alone.

## Testing

`src/lib/actions/animateIn.test.ts`, three cases using `@testing-library/svelte` and `vitest`:

1. **Viewport mode** — mock `IntersectionObserver`, mount an element with `use:animateIn`, assert initial hidden inline styles. Trigger an intersection via the mock, assert styles flip to visible and `disconnect()` is called.
2. **Triggered mode** — mount with `use:animateIn={false}`, assert hidden styles. Re-render with `true`, assert visible styles.
3. **`prefers-reduced-motion`** — mock `window.matchMedia` to return `matches: true`, mount, assert no transition-related inline styles are set and `IntersectionObserver` is not constructed.

## README update

Under the existing **Components** section in `README.md`, add a short subsection documenting the action:

````md
### Animation action — `use:animateIn`

A Svelte action that attaches fade-up reveal behavior to any element. Defaults to viewport-triggered (via `IntersectionObserver`); pass a boolean or `{ trigger }` option to drive it from state instead.

```svelte
<script>
  import { animateIn } from "$lib/actions/animateIn";
</script>

<div use:animateIn>…</div>
<div use:animateIn={isOpen}>…</div>
<div use:animateIn={{ duration: 1200, delayMax: 0 }}>…</div>
```

Options: `trigger?`, `duration?` (default 2400ms), `delayMax?` (default 400ms, viewport only), `translateY?` (default `"50%"`). Respects `prefers-reduced-motion`.
````

Also update the existing component bullet list so `AnimateIn` is removed from the `Animation` line (it's no longer a component).

## Open risks

- **Inline style collisions.** If a host element already sets `opacity`, `transform`, or `transition` inline, the action will overwrite. Acceptable — documented in the README note if we see it bite.
- **Mode switch mid-life** is explicitly unsupported. If a consumer changes `undefined ↔ boolean`, behavior is undefined. Consider a dev-mode warning in a follow-up.

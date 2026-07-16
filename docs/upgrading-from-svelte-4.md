# Upgrading a Svelte 4 / Vite 5 / Tailwind 3 site to this starter's stack

This is the playbook for bringing an existing Reddoor SvelteKit + Prismic site (Svelte 4.x, Vite 5.x, Tailwind 3.x, npm) to the stack this starter ships: Svelte 5, Vite 8, Tailwind 4 (CSS-first), pnpm 10, explicit `adapter-netlify`, ESLint flat config, Lucide icons, `@zerodevx/svelte-img`. Battle-tested on `medical-solutions-of-texas` in May 2026.

For the inline equivalent that auto-loads in Claude Code sessions, see `~/.claude/skills/svelte4-to-5-upgrade/SKILL.md`.

## When to use this

Read `package.json`. If it has `"svelte": "^4"` and `"@sveltejs/kit": "^2"` and `"tailwindcss": "^3"`, this guide applies. If on Svelte 3, run `npx sv migrate svelte-4` first. If already on Svelte 5 + Tailwind 4, this guide doesn't apply — match this starter's component-level conventions directly.

## Pre-flight inventory

Before any changes, run this in the project root and review the output. The two numbers that surprise people are the `$$props.class` count (codemod can't auto-handle these) and the FA-CDN `<i>` tag count (separate from npm-package usages).

```bash
echo "=== current versions ==="
node -p "Object.entries({...require('./package.json').devDependencies, ...require('./package.json').dependencies}).filter(([k]) => /svelte|vite|tailwind|prismic|lucide|fortawesome|gestures/.test(k)).map(([k,v]) => k+'@'+v).join('\n')"
echo "=== Svelte 4 idiom counts ==="
echo "  <slot:           $(grep -rln '<slot' src/ | wc -l) files"
echo "  on:              $(grep -rln 'on:[a-z]' src/ | wc -l) files"
echo "  export let:      $(grep -rln 'export let' src/ | wc -l) files"
echo '  $:               '"$(grep -rlnE '^[[:space:]]*\$:' src/ | wc -l) files"
echo '  $$props.class:   '"$(grep -rln '\$\$props\.class' src/ | wc -l) files (codemod blockers)"
echo "=== FontAwesome ==="
echo "  npm:     $(grep -rln '@fortawesome' src/ | wc -l) files"
echo "  CDN <i>: $(grep -rlnE 'fa-[a-z-]+ fa-[0-9x]+|fa-sharp|fa-thin|fa-light' src/ | wc -l) files"
```

### Pre-flight pitfall: `svelte-select`

If the project uses `svelte-select` 5.8.3, the version on npm hasn't moved since January 2024 — you'll be tempted to replace it. Don't. It compiles cleanly under Svelte 5 in legacy mode. Verify with a 60-second scratch test:

```bash
mkdir -p /tmp/sselect-test && cd /tmp/sselect-test
echo '{"name":"x","private":true,"type":"module"}' > package.json
pnpm add svelte@^5 svelte-select@5.8.3 >/dev/null
node -e "
import('svelte/compiler').then(({compile}) => {
  import('node:fs').then(({readdirSync, readFileSync}) => {
    const files = readdirSync('node_modules/svelte-select').filter(f => f.endsWith('.svelte'));
    let ok = 0, errs = 0;
    for (const f of files) {
      try { compile(readFileSync('node_modules/svelte-select/'+f, 'utf-8'), { filename: f, generate: 'client' }); ok++; }
      catch (e) { errs++; }
    }
    console.log(ok+' ok, '+errs+' failed');
  });
});
"
```

Expected: `4 ok, 0 failed`. If anything fails, that's when you discuss replacement options with the user.

## The 7-commit recipe

Each commit boots cleanly: `pnpm vite:dev` starts and `curl /` returns 200, even if rendering is partially broken between commits (e.g. Tailwind directives are mid-migration). That's the verification bar after every commit; full visual correctness is the final commit's job.

### Commit 1 — Stack bump

Files touched: `package.json`, `pnpm-lock.yaml` (replaces `package-lock.json`), `netlify.toml`, `svelte.config.js`, `vite.config.ts` (renamed from `.js`), `tsconfig.json` (renames `jsconfig.json`), `eslint.config.js` (new).

**Crucially also delete `postcss.config.js` in this commit** — not Commit 2 as it might seem to belong. Keeping it around makes `pnpm dev` crash during `vite-plugin-svelte`'s preprocess of `svelte-select`'s vendored `<style>` block (PostCSS auto-discovers the broken `tailwindcss` plugin reference and Tailwind 4 throws `It looks like you're trying to use 'tailwindcss' directly as a PostCSS plugin`).

The end-state versions are whatever this starter's `package.json` ships. Caret-float them. Set `"packageManager": "pnpm@10.33.1"`, `"engines": { "node": ">=20" }`, and `"pnpm": { "onlyBuiltDependencies": ["@scarf/scarf", "esbuild", "sharp"] }`.

`netlify.toml` needs:

```toml
[build]
    command = "pnpm build"
    publish = "build/"

[build.environment]
    NODE_VERSION = "22.12.0"
    COREPACK_INTEGRITY_KEYS = "0"
```

`COREPACK_INTEGRITY_KEYS = "0"` is non-obvious but required: Node 22 ships corepack 0.30 whose signing keys don't recognize pnpm 10.33+, so Netlify builds fail with "Cannot find matching keyid" without this.

`svelte.config.js`: import `adapter` from `@sveltejs/adapter-netlify`, pass `{ edge: false, split: false }` (forms-safe defaults from `gallerysonder`), add the `kit.alias` block (`$components`, `$utils`, `$stores`, `$assets`), and `compilerOptions.warningFilter` filtering `element_invalid_self_closing_tag`. **Don't add a CSP block** — the starter has one, but adding it during a deps-bump too easily breaks Typekit / Prismic preview at runtime. Defer to a separate pass.

`vite.config.ts` mirrors this starter's: `defineConfig` from `vite`, plugins `[sveltekit(), imagetools(), tailwindcss()]`, `server.fs.allow: ['..']`.

`tsconfig.json` keeps `allowJs/checkJs` (don't force-rename `.js` source files in this commit). Add `"moduleResolution": "bundler"`.

`eslint.config.js`: copy verbatim from this starter. Pre-disable five noisy `eslint-plugin-svelte` v3 rules to keep the legacy codebase quiet: `svelte/no-navigation-without-resolve`, `svelte/require-each-key`, `svelte/no-reactive-functions`, `svelte/no-useless-mustaches`, `svelte/no-at-html-tags`. Re-enable incrementally as a follow-up.

`app.html`: **leave the FontAwesome Kit CDN `<script>` alone for now.** Removing it before Commit 5 (where you swap the icons) breaks the close button between commits. Same for any Vimeo player script — leave until you've audited Prismic content for embeds (a source-tree grep won't catch CMS-authored iframes).

If `adapter-auto` was being used previously, it likely was failing silently in production: build output `"Could not detect a supported production environment"` with exit code 0, so Netlify built fine but with no adapter wiring. Switching to explicit `adapter-netlify` reveals and fixes this. Worth flagging to the user.

Verify: `pnpm install` clean, `pnpm vite:dev` boots, `curl /` returns 200. Tailwind errors appear in the console — Commit 2 fixes those.

### Commit 2 — Tailwind 4 CSS-only migration

Touch `src/app.css` and delete `tailwind.config.js`.

The new `src/app.css` shape is:

1. `@import "tailwindcss";` at top (no more `@tailwind` directives)
2. `@theme {}` block with breakpoints, color palette, easing tokens, custom heights
3. `@source inline("...")` directives replacing the v3 `safelist` array
4. `@utility` blocks for hover / active class effects (`.bump`, `.negative-bump`)
5. `@layer base { ... }` containing typography defaults and custom selectors

Tailwind 4 token names matter: use `--breakpoint-*` (per official docs), `--color-*`, `--ease-*`, `--height-*`. The brace-expansion syntax `@source inline("sm:justify-{center,start,end}")` works in `@source inline()` — list each pattern as its own directive for readability.

Watch for pre-existing config bugs the v3 file accumulated. The medical-solutions-of-texas migration found a `light:' #E1DDCB;'` typo (extraneous space + colon + semicolon, somehow valid v3 syntax) and 5× duplicated screen-heights. Transcribe carefully; fix in transit.

Verify: `pnpm vite:dev` builds CSS without errors. Walk the site, check colors / spacing / safelisted classes still render. Production bundle should shrink ~5-10%.

### Commit 3 — Run codemod (raw)

```
npx sv migrate svelte-5
```

The codemod prompts three times — `Continue?` (default No, hit ↑ then Enter), `Which folders should be migrated?` (Enter to accept all defaults), `Do you want to use the migration tool to convert your Svelte components to the new syntax?` (default Yes). It's interactive and runs poorly under stdin redirection — have a human drive it in their terminal.

**Commit the raw output untouched.** This gives a clean diff between mechanical (codemod) and judgment (next commit) work.

What the codemod does: `export let` → `$props()`, `on:click` → `onclick`, `<slot />` → `{@render children?.()}`, mutable locals → `$state(...)`, `$:` → `run(() => ...)` from `svelte/legacy` (conservative — the next commit promotes these to `$derived`/`$effect`).

What it can't do: components using `$$props.class` for arbitrary class spread will get a `<!-- @migration-task -->` comment. In those files, _other_ migrations also stop — they retain Svelte 4 event syntax until you hand-fix.

### Commit 4 — Hand-clean

This is the bulk of the work — touch every component once. Bucket the work:

**Bucket A: `@migration-task` files** — replace the `$$props.class` idiom:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  interface Props {
    foo?: string;
    class?: string;
    children?: Snippet;
  }
  let {
    foo = "default",
    class: klass = "",
    children,
    ...rest
  }: Props = $props();
</script>

<a class="...{klass}">{@render children?.()}</a>
```

Also finish the event-handler migration in these files (the codemod stopped after the migration-task warning, so `on:click` etc. remain).

**Bucket B: `run()` from `svelte/legacy`** — promote each. Pure derivation → `$derived` (or `$derived.by()` for complex expressions). Side effect → `$effect(function descriptiveName() { ... })`. Always name the effect function for debuggability.

**Bucket C: `$state()` typing** — the codemod produces `let main: HTMLElement | null = $state()` whose actual type is `HTMLElement | null | undefined` (because `$state()` without an argument returns `undefined`). Either provide an SSR-safe initial value, or change the type to `| undefined`:

```ts
// Codemod output (errors):
let viewportWidth: number = $state();
let main: HTMLElement | null = $state();

// Fixed:
let viewportWidth: number = $state(
  typeof window !== "undefined" ? window.innerWidth : 1920,
);
let main: HTMLElement | undefined = $state();
```

**Bucket D: `ComponentProps<X>` requires `typeof`**:

```ts
// Before (Svelte 4):
testimonialBoxPropsArray?: ComponentProps<TestimonialBox>[]
// After (Svelte 5):
testimonialBoxPropsArray?: ComponentProps<typeof TestimonialBox>[]
```

**Bucket E: Slot fallback semantics** — `<slot>{text}</slot>` was a common pattern (slot renders if children passed, otherwise renders `text`). The codemod converts to bare `{@render children?.()}`, **dropping the fallback**. Restore manually:

```svelte
{#if children}{@render children()}{:else}{text}{/if}
```

This caught a real bug in `medical-solutions-of-texas`'s `DefaultButton.svelte`: callers passed `text="submit"` without children and the button rendered empty.

**Bucket F: typed `interface Props`** — every component that takes props should declare an `interface Props` and destructure with `: Props = $props()`. Match the starter's pattern.

Verify: `pnpm check` errors should drop sharply. The remaining ones should be the deferred library-swap errors only.

### Commit 5 — Library swaps

**svelte-gestures v4 → v5**: the named `swipe` action no longer exists; v5 uses an attachments-based `useSwipe` factory. Wrap with this small helper at `src/lib/utils/swipeAction.ts`:

```ts
import { useSwipe, type SwipeCustomEvent } from "svelte-gestures";

export const createSwipeAction = (handler: (e: SwipeCustomEvent) => void) => {
  const gesture = useSwipe(handler, undefined, undefined, true);
  return (node: HTMLElement) => ({ destroy: gesture.swipe(node) });
};
```

Each slider component then becomes:

```svelte
<script lang="ts">
  import { createSwipeAction } from "$utils/swipeAction";
  const swipe = createSwipeAction((e) => {
    if (e.detail.direction === "left") slideRight();
    if (e.detail.direction === "right") slideLeft();
  });
</script>

<div use:swipe>...</div>
```

**FontAwesome → Lucide**: pre-flight grep for `@fortawesome` only catches the npm side. Also grep for CDN `<i>` tags — they're often 2-4× more numerous and easy to miss.

FA size → Lucide pixel mapping: `fa-xl` ≈ 24, `fa-2xl` ≈ 32, `fa-3x` ≈ 48. FA stroke weight → Lucide `strokeWidth`: `fa-thin` ≈ 1, `fa-light` ≈ 1.5, default ≈ 2.

| FA                                  | Lucide                                     | Notes                                                               |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------------------- |
| `faEnvelope` / `fa-envelope`        | `Mail`                                     |                                                                     |
| `fa-close fa-3x` / `fa-xmark fa-3x` | `<X size={48} strokeWidth={1} />`          | with `fa-thin`                                                      |
| `fa-bars fa-3x`                     | `<Menu size={48} strokeWidth={1.5} />`     | hamburger                                                           |
| `fa-plus fa-2xl`                    | `<Plus size={36} strokeWidth={1} />`       | rotates to X via `class:rotate-45`                                  |
| `fa-chevron-left/right fa-xl`       | `ChevronLeft/Right size={24}`              |                                                                     |
| `fa-download fa-xl`                 | `<Download size={24} strokeWidth={1.5} />` | with `fa-light`                                                     |
| Brand icons (Reddit, etc.)          | not in core Lucide                         | hand-roll an inline SVG. **Don't pull `@lucide/lab` for one icon.** |

**Visual gotcha**: FA `<i>` glyphs anchor to the text baseline. Lucide SVGs anchor to top-left. `<i class="absolute top-10">` and `<Plus class="absolute top-10">` render at visibly different vertical offsets. **Fix by dropping absolute positioning** and letting flexbox center the icon as a sibling of the text it accompanies — this is the cleanest pattern, survives layout changes, and matches the starter's style.

After all swaps:

- Drop `<script src="https://kit.fontawesome.com/...">` from `app.html` — last consumer is gone.
- `pnpm install` again. **Manually `rm -rf node_modules/@fortawesome`** if pre-pnpm npm install left dirs there. `pnpm install` doesn't auto-prune them.
- Delete any unused-and-unimported components (medical-solutions-of-texas dropped `SocialsRow.svelte` and `TeamBox.svelte`).

Verify: `pnpm check` should now be **0 errors** (warnings for pre-existing a11y / markup quality are OK).

### Commit 6 — Format normalization

Run `pnpm format`. The diff will be enormous and almost entirely whitespace — prettier 3.5 + prettier-plugin-svelte 3.5 reformat tabs to 2-space, split attributes across lines, and wrap at 80 cols. Commit separately so reviewers can fold it on whitespace.

Then `pnpm lint`. Expect a handful of fixups:

- **`NodeJS.Timeout`** isn't globally typed — replace with `ReturnType<typeof setInterval>` (or `setTimeout`).
- **`@typescript-eslint/no-explicit-any`** — tighten to concrete types or `unknown`. For SvelteKit page data: `import type { PageProps } from "./$types"; let { data }: PageProps = $props()`. For Prismic SliceZone in slice-simulator: `ComponentProps<typeof SliceZone>["slices"]`.
- **`no-irregular-whitespace`** flags zero-width spaces (U+200B) and non-breaking spaces (U+00A0) from CMS-pasted copy. Strip with:
  ```bash
  perl -i -pe 's/\xe2\x80\x8b//g; s/\xc2\xa0/ /g' path/to/file.svelte
  ```
- **Unused imports / dead vars** — drop them.

Verify: `pnpm lint` clean, `pnpm check` 0 errors, `pnpm vite:dev` boots, all routes 200, `pnpm build` clean via adapter-netlify.

### Commit 7 — `docs/UPGRADE_NOTES.md`

Author a retrospective in the project capturing:

- Final stack table (before/after)
- Commit-by-commit summary
- **Gotchas actually hit** (distinguish from planned)
- Pointer back to this starter as canonical reference
- Out-of-scope deferred work (e.g. `.js` → `.ts` source rename, tests, CSP, arbitrary-value canonical-class sweep)

The medical-solutions-of-texas `docs/UPGRADE_NOTES.md` is the prototype.

## Recurring gotchas, ranked by likelihood of biting

1. **Delete `postcss.config.js` in Commit 1** — not Commit 2 — or `pnpm dev` crashes during svelte-select preprocessing.
2. **Codemod stops on `$$props.class`** patterns. Often 30-40% of components use this idiom.
3. **`$state()` typing strictness** trips ~16 instances per project.
4. **CDN `<i class="fa-...">` outnumbers npm-package FA usage** — usually 3-4× more.
5. **`adapter-auto` was failing silently** in v3 / pre-upgrade builds. Switch to explicit `adapter-netlify` immediately.
6. **Lucide visual offset differs from FA** — drop absolute positioning, use flexbox centering.
7. **`node_modules/@fortawesome/` dirs persist** after dep removal. `rm -rf` manually.
8. **Codemod is interactive** — drive it in a real terminal, not via stdin redirection.
9. **`ComponentProps<X>`** needs `typeof` in Svelte 5.
10. **Slot fallback semantics dropped** by codemod (`<slot>{text}</slot>` → `{@render children?.()}` loses the `{text}` fallback).
11. **`svelte-select` 5.8.3 actually works** under Svelte 5. Don't replace preemptively.
12. **Netlify + Node 22 + pnpm 10.33+** corepack mismatch. Set `COREPACK_INTEGRITY_KEYS = "0"`.

## Out of scope (deferred to follow-up)

These are deliberately _not_ in the upgrade:

- Convert `.js` source files to `.ts` (incrementally as files get touched).
- Add tests (this starter ships vitest + playwright + a11y harness — port the harness in a separate pass).
- Replace `svelte-select` with native `<select>` or a smaller library.
- Add CSP block to `svelte.config.js`. The starter has one, but it's easy to misconfigure and break Typekit / Prismic preview at runtime.
- Tailwind 4 arbitrary-value canonical-class sweep (`-translate-x-[1px]` → `-translate-x-px`, `aspect-[4/3]` → `aspect-4/3`, `bg-gradient-to-r` → `bg-linear-to-r`). The IDE flags these via `suggestCanonicalClasses` warnings.
- Pre-existing a11y / markup-quality warnings (missing `aria-label`, missing `alt`, nested `<a>`, implicit `</div>` close).

## Reference projects

- **`reddoor-website`** — production-deployed predecessor that hit the corepack and ESLint v3 gotchas first.
- **`gallerysonder`** — the Netlify-forms / `edge: false` gotcha origin.
- **`medical-solutions-of-texas`** — the most complete migration following this exact recipe; `docs/UPGRADE_NOTES.md` there is the as-built record.

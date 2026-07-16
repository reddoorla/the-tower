<script lang="ts">
  import { Menu, X } from "@lucide/svelte";
  import { trapFocus } from "$lib/actions/trapFocus";
  import { fade } from "$lib/transitions";

  interface NavLink {
    text: string;
    href: string;
  }

  interface Props {
    navLinks?: NavLink[];
  }

  // Placeholder styling — restyle per project. Pass `navLinks` to get inline
  // links on desktop and a focus-trapped full-screen menu on mobile; omit it
  // for a logo-only bar.
  let { navLinks = [] }: Props = $props();

  let isMenuOpen = $state(false);
  let openButtonEl = $state<HTMLButtonElement>();

  const openMenu = () => (isMenuOpen = true);
  const closeMenu = () => (isMenuOpen = false);
</script>

<nav
  class="fixed top-0 left-0 w-full z-50 px-8 py-4 flex items-center justify-between"
>
  <a href="/" class="font-bold text-lg">Logo</a>

  {#if navLinks.length > 0}
    <div class="hidden lg:flex items-center gap-8">
      {#each navLinks as link (link.href)}
        <a href={link.href}>{link.text}</a>
      {/each}
    </div>

    {#if !isMenuOpen}
      <button
        bind:this={openButtonEl}
        type="button"
        class="lg:hidden flex items-center justify-center min-h-11 min-w-11"
        onclick={openMenu}
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
    {/if}
  {/if}
</nav>

{#if isMenuOpen}
  <!-- The open trigger above unmounts while the menu is open, so the element
       trapFocus captured is detached by close time — `restoreFocus` hands it
       the re-mounted trigger instead. -->
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Menu"
    class="fixed inset-0 z-50 h-dvh w-screen bg-background flex flex-col items-center justify-center gap-8 lg:hidden"
    transition:fade
    use:trapFocus={{ onEscape: closeMenu, restoreFocus: () => openButtonEl }}
  >
    <button
      type="button"
      class="absolute top-4 right-8 flex items-center justify-center min-h-11 min-w-11"
      onclick={closeMenu}
      aria-label="Close menu"
    >
      <X size={24} />
    </button>

    {#each navLinks as link (link.href)}
      <a href={link.href} class="py-3 px-4" onclick={closeMenu}>{link.text}</a>
    {/each}
  </div>
{/if}

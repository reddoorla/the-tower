<script lang="ts">
  import { PrismicRichText } from "@prismicio/svelte";
  import { bandFor, type Presentation } from "$lib/blux/presentation";
  import SectionBand from "$lib/blux/SectionBand.svelte";
  import BandContent from "$lib/blux/BandContent.svelte";
  import Grid from "$lib/blux/Grid.svelte";
  import Media from "$lib/blux/Media.svelte";
  import { isFilled } from "@prismicio/client";
  import type { RichTextField } from "@prismicio/client";

  type Props = {
    slice: {
      slice_type: string;
      variation?: string;
      primary: { band?: number | null; body?: RichTextField | null };
    };
    context?: { presentation?: Presentation };
  };
  let { slice, context = {} }: Props = $props();
  const band = $derived(
    bandFor(context.presentation, slice.primary.band ?? null),
  );
  const split = $derived(band?.split ?? null);
</script>

{#if split}
  <SectionBand
    {band}
    sliceType={slice.slice_type}
    sliceVariation={slice.variation}
  >
    <BandContent {band}>
      <!--
        Two columns with a horizontal gutter between them at md: up, mirroring
        Blux's ~4% column gutter. The gutter is reserved out of each cell's basis
        (half of 4% per cell) so the columns still fit on one line — a plain
        gap-x with basis summing to 100% would push past the row and wrap. On
        mobile the columns stack (basis-full) and gap-y-8 spaces them instead.
      -->
      <div
        class="flex w-full flex-wrap items-center gap-y-8 md:gap-x-[4%]"
        class:flex-row-reverse={split.mediaSide === "left"}
      >
        <div
          data-split-cell
          class="min-w-0 grow basis-full text-left md:basis-[calc(var(--cell-basis)_-_2%)] md:pt-20"
          style:--cell-basis="{100 - split.ratio}%"
        >
          {#if slice.primary.body && isFilled.richText(slice.primary.body)}
            <PrismicRichText field={slice.primary.body} />
          {:else}
            <Grid node={split.text} />
          {/if}
        </div>
        <div
          data-split-cell
          class="min-w-0 grow basis-full md:basis-[calc(var(--cell-basis)_-_2%)] {split
            .media.minHeight
            ? ''
            : 'md:pt-[100px]'}"
          style:--cell-basis="{split.ratio}%"
        >
          {#if split.media.minHeight}
            <!-- The source reserves the frame's height (a bg-cover block, e.g.
                 a 90vh panel) — a natural-height img would collapse the band.
                 Same cover-frame idiom as CarouselFrames; the reserved frame
                 IS the design, so the decorative top inset stays off. -->
            <div
              class="relative w-full"
              style={`min-height:${split.media.minHeight}`}
            >
              <Media
                media={split.media}
                class="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          {:else}
            <Media media={split.media} class="h-auto w-full" />
          {/if}
        </div>
      </div>
    </BandContent>
  </SectionBand>
{/if}

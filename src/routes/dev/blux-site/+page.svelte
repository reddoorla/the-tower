<script lang="ts">
  import { SliceZone } from "@prismicio/svelte";
  import { components } from "$lib/slices";
  import { loadPresentation } from "$lib/blux/presentation";
  import slices from "$lib/blux/page-slices.json";

  const presentation = loadPresentation();
</script>

<!-- The converted site straight from `blux convert` output: the migration
     plan's home-document slices (page-slices.json) through the same SliceZone
     wiring the Prismic-backed routes use. This is the pre-migrate render —
     the fidelity-verification vehicle (the-pointe precedent, its PR #6) and
     the exact page the homepage serves once `blux migrate` pushes these
     slices to Prismic. Unlike dev/blux-page (hermetic CI fixture), media here
     loads from the export's CDN. -->
<SliceZone slices={slices as never} {components} context={{ presentation }} />

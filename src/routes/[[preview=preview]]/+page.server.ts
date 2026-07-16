import { asText } from "@prismicio/client";
import { error } from "@sveltejs/kit";

import { createClient, isPlaceholderRepo } from "$lib/prismicio";

export async function load({ fetch, cookies }) {
  const client = createClient({ fetch, cookies });

  try {
    const page = await client.getByUID("page", "home");

    return {
      page,
      title: asText(page.data.title),
      meta_description: page.data.meta_description,
      meta_title: page.data.meta_title,
      meta_image: page.data.meta_image?.url,
      meta_image_alt: page.data.meta_image?.alt ?? undefined,
    };
  } catch {
    error(404, { message: "Page not found" });
  }
}

// On an unconfigured starter, skip prerendering "/" — the load above would
// 404 on the placeholder repo and fail the build. Real sites still prerender
// the home route normally.
export function entries() {
  return isPlaceholderRepo ? [] : [{}];
}

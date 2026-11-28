import { z } from "zod";

const response = z.object({
  query: z
    .object({
      pages: z.array(
        z.object({
          title: z.string(),
          imageinfo: z.array(z.object({ thumburl: z.url(), descriptionurl: z.url() })).optional(),
        }),
      ),
    })
    .optional(),
});

const onHost = (value: string, host: string) => {
  const url = new URL(value);
  return url.protocol === "https:" && url.host === host && !url.username && !url.password;
};

export const findCommonsImages = async (query: string, signal: AbortSignal) => {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrnamespace: "6",
    gsrlimit: "6",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "320",
    format: "json",
    formatversion: "2",
    origin: "*",
  }).toString();
  const result = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!result.ok) throw new Error("Image search failed");
  const parsed = response.parse(await result.json());
  return (parsed.query?.pages ?? []).flatMap(({ title, imageinfo }) => {
    const image = imageinfo?.[0];
    if (
      !image ||
      !(
        onHost(image.thumburl, "upload.wikimedia.org") ||
        onHost(image.thumburl, "thumb.wikimedia.org")
      ) ||
      !onHost(image.descriptionurl, "commons.wikimedia.org")
    )
      return [];
    return [
      {
        title: title.replace(/^File:/, ""),
        thumbnail: image.thumburl,
        source: image.descriptionurl,
      },
    ];
  });
};

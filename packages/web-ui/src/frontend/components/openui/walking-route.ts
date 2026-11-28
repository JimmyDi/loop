import { z } from "zod";

const routeResponse = z.object({
  code: z.literal("Ok"),
  routes: z
    .array(
      z.object({
        geometry: z.object({
          type: z.literal("LineString"),
          coordinates: z
            .array(z.tuple([z.number().min(-180).max(180), z.number().min(-85).max(85)]))
            .min(2)
            .max(2000),
        }),
      }),
    )
    .min(1),
});

type Stop = { longitude: number; latitude: number };

export const findWalkingRoute = async (stops: readonly Stop[], signal: AbortSignal) => {
  const coordinates = stops
    .map(({ longitude, latitude }) =>
      [longitude, latitude].map((value) => value.toFixed(5)).join(","),
    )
    .join(";");
  const url = new URL(
    "https://routing.openstreetmap.de/routed-foot/route/v1/driving/" + coordinates,
  );
  url.search = "overview=simplified&geometries=geojson&steps=false";
  const response = await fetch(url, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(10000)]),
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!response.ok) throw new Error("Walking route unavailable");
  const result = routeResponse.parse(await response.json());
  return result.routes[0]!.geometry.coordinates;
};

export const walkingRouteLinks = (stops: readonly Stop[]) => {
  const links: string[] = [];
  // Google Maps URLs support three intermediate waypoints on mobile browsers.
  for (let start = 0; start < stops.length - 1; start += 4) {
    const [origin, ...remaining] = stops
      .slice(start, start + 5)
      .map(({ latitude, longitude }) => latitude + "," + longitude);
    const destination = remaining.pop()!;
    const url = new URL("https://www.google.com/maps/dir/");
    url.search = new URLSearchParams({
      api: "1",
      origin: origin!,
      destination,
      travelmode: "walking",
    }).toString();
    if (remaining.length) url.searchParams.set("waypoints", remaining.join("|"));
    links.push(url.href);
  }
  return links;
};

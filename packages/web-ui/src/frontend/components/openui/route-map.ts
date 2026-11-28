import { type GeoJSONSource, LngLatBounds, Map, Marker, NavigationControl } from "maplibre-gl";
import type { z } from "zod";

import "maplibre-gl/dist/maplibre-gl.css";

import type { mapViewProps } from "../../../shared/openui-scenarios";

type Props = z.infer<typeof mapViewProps>;

export const mountRouteMap = (
  container: HTMLElement,
  stops: Props["stops"],
  select: (index: number) => void,
  onError: () => void,
) => {
  const first = stops[0];
  if (!first) throw new Error("At least one stop is required");
  const map = new Map({
    container,
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [first.longitude, first.latitude],
    zoom: 12,
    scrollZoom: false,
  });
  let styleLoaded = false;

  map.on("error", () => {
    if (!styleLoaded) onError();
  });
  map.addControl(new NavigationControl({ showCompass: false }));
  const bounds = new LngLatBounds();
  const markers = stops.map((stop, index) => {
    const coords: [number, number] = [stop.longitude, stop.latitude];
    bounds.extend(coords);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "loop-openui-map-marker";
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", stop.name);
    button.addEventListener("click", () => select(index));
    return new Marker({ element: button }).setLngLat(coords).addTo(map);
  });
  if (stops.length > 1) map.fitBounds(bounds, { padding: 48, maxZoom: 14, duration: 0 });
  let route: Props["route"];
  const drawRoute = () => {
    if (!styleLoaded) return;
    const source = map.getSource<GeoJSONSource>("route");
    if (!route) {
      if (source) {
        map.removeLayer("route");
        map.removeSource("route");
      }
      return;
    }
    const data = { type: "LineString" as const, coordinates: route };
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource("route", { type: "geojson", data });
    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      paint: {
        "line-color": "#1559ad",
        "line-width": 4,
      },
    });
  };
  map.once("style.load", () => {
    styleLoaded = true;
    drawRoute();
  });
  const observer = new ResizeObserver(() => map.resize());
  observer.observe(container);
  return {
    setRoute: (points: Props["route"]) => {
      route = points;
      drawRoute();
    },
    focus: (longitude: number, latitude: number) => map.easeTo({ center: [longitude, latitude] }),
    dispose: () => {
      observer.disconnect();
      for (const marker of markers) marker.remove();
      map.remove();
    },
  };
};

// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import "../../i18n/setup";
import MapView from "./MapView";

const map = vi.hoisted(() => ({
  focus: vi.fn(),
  dispose: vi.fn(),
  mounted: vi.fn(),
  setRoute: vi.fn(),
}));
vi.mock("@openuidev/react-lang", () => ({ useIsStreaming: () => false }));
vi.mock("./route-map", () => ({ mountRouteMap: map.mounted }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

test("focuses stops, requests walking geometry after a click and cleans up the map", async () => {
  map.mounted.mockReturnValue(map);
  const coordinates = [
    [-122, 37],
    [-123, 38],
  ];
  const fetchRoute = vi.fn(async () =>
    Response.json({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates } }] }),
  );
  vi.stubGlobal("fetch", fetchRoute);
  const stops = [
    { name: "1. A", longitude: -122, latitude: 37, detail: "Start here" },
    { name: "B", longitude: -123, latitude: 38 },
  ];
  let intersect: IntersectionObserverCallback | undefined;
  const observer = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal(
    "IntersectionObserver",
    vi.fn(function (callback: IntersectionObserverCallback) {
      intersect = callback;
      return observer;
    }),
  );
  const ui = render(<MapView title="Walk" stops={stops} />);
  expect(observer.observe).toHaveBeenCalled();
  expect(map.mounted).not.toHaveBeenCalled();
  act(() =>
    intersect?.(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      observer as unknown as IntersectionObserver,
    ),
  );
  await waitFor(() => expect(map.mounted).toHaveBeenCalledTimes(1));
  fireEvent.click(ui.getByRole("button", { name: "A" }));
  expect(map.focus).toHaveBeenCalledWith(-122, 37);
  expect(ui.getByText("Start here")).toBeTruthy();
  expect(fetchRoute).not.toHaveBeenCalled();
  fireEvent.click(ui.getByRole("button", { name: "Find walking route" }));
  await waitFor(() => expect(map.setRoute).toHaveBeenLastCalledWith(coordinates));
  expect(ui.getByRole("link", { name: /FOSSGIS/ })).toBeTruthy();
  expect(ui.queryByRole("button", { name: "Find walking route" })).toBeNull();
  ui.unmount();
  expect(map.mounted).toHaveBeenCalledTimes(1);
  expect(map.dispose).toHaveBeenCalledTimes(1);
});

test("offers ordered walking directions on failure and clears them after a successful retry", async () => {
  map.mounted.mockReturnValue(map);
  vi.stubGlobal("IntersectionObserver", undefined);
  const coordinates = [
    [0, 0],
    [1, 1],
  ];
  const fetchRoute = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({ code: "Ok", routes: [{ geometry: { type: "LineString", coordinates } }] }),
    );
  vi.stubGlobal("fetch", fetchRoute);
  const stops = Array.from({ length: 6 }, (_, index) => ({
    name: "Stop " + (index + 1),
    longitude: index + 10,
    latitude: index + 20,
  }));
  const ui = render(<MapView title="Walk" stops={stops} />);
  fireEvent.click(ui.getByRole("button", { name: "Find walking route" }));
  const first = await ui.findByRole("link", { name: "Google Maps · Part 1" });
  const second = ui.getByRole("link", { name: "Google Maps · Part 2" });
  const firstUrl = new URL(first.getAttribute("href")!);
  const secondUrl = new URL(second.getAttribute("href")!);
  expect(firstUrl.origin).toBe("https://www.google.com");
  expect(Object.fromEntries(firstUrl.searchParams)).toEqual({
    api: "1",
    origin: "20,10",
    destination: "24,14",
    travelmode: "walking",
    waypoints: "21,11|22,12|23,13",
  });
  expect(secondUrl.searchParams.get("origin")).toBe(firstUrl.searchParams.get("destination"));
  expect(secondUrl.searchParams.get("destination")).toBe("25,15");
  expect(ui.getByRole("button", { name: "Stop 6" })).toBeTruthy();
  expect(fetchRoute).toHaveBeenCalledTimes(1);
  fireEvent.click(ui.getByRole("button", { name: "Retry walking route" }));
  expect(await ui.findByRole("link", { name: /FOSSGIS/ })).toBeTruthy();
  expect(ui.queryByRole("link", { name: /Google Maps/ })).toBeNull();
  expect(fetchRoute).toHaveBeenCalledTimes(2);
});

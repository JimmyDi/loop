import { Button } from "@openuidev/react-ui";
import { useIsStreaming } from "@openuidev/react-lang";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { z } from "zod";

import type { mapViewProps } from "../../../shared/openui-scenarios";
import type { mountRouteMap } from "./route-map";
import { findWalkingRoute, walkingRouteLinks } from "./walking-route";
import "./MapView.css";

const MapView = ({ title, stops: sourceStops, route }: z.infer<typeof mapViewProps>) => {
  const { t } = useTranslation();
  const streaming = useIsStreaming();
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<ReturnType<typeof mountRouteMap>>(undefined);
  const [selected, setSelected] = useState<number>();
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const routeRequest = useRef<AbortController>(undefined);
  const [walking, setWalking] = useState<{ key: string; route?: typeof route; failed?: boolean }>();
  const stops = useMemo(
    () =>
      sourceStops.map((stop, index) => {
        const prefix = /^\s*(\d+)(?:[.．]\s+|[、)]\s*)/.exec(stop.name);
        const name =
          prefix && Number(prefix[1]) === index + 1
            ? stop.name.slice(prefix[0].length).trim()
            : stop.name;
        return { ...stop, name: name || stop.name };
      }),
    [sourceStops],
  );
  const key = JSON.stringify(stops);
  const current = walking?.key === key ? walking : undefined;
  const displayedRoute = route ?? current?.route;
  const routeLinks = current?.failed ? walkingRouteLinks(stops) : [];
  const routing = !!current && !current.failed && !current.route;
  useEffect(() => () => routeRequest.current?.abort(), [key]);

  const search = async () => {
    routeRequest.current?.abort();
    const request = new AbortController();
    routeRequest.current = request;
    setWalking({ key });
    try {
      const points = await findWalkingRoute(stops, request.signal);
      if (!request.signal.aborted) setWalking({ key, route: points });
    } catch {
      if (!request.signal.aborted) setWalking({ key, failed: true });
    }
  };

  useEffect(() => {
    const element = container.current;
    if (streaming || nearViewport || !element) return;
    if (typeof IntersectionObserver === "undefined") {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setNearViewport(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [streaming, nearViewport]);

  const latestRoute = useRef(displayedRoute);
  useEffect(() => {
    latestRoute.current = displayedRoute;
    map.current?.setRoute(displayedRoute);
  }, [displayedRoute]);

  useEffect(() => {
    const element = container.current;
    if (streaming || !nearViewport || !element) return;
    let disposed = false;
    setFailed(false);
    void import("./route-map")
      .then(({ mountRouteMap }) => {
        if (disposed) return;
        map.current = mountRouteMap(element, JSON.parse(key), setSelected, () => setFailed(true));
        map.current.setRoute(latestRoute.current);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      map.current?.dispose();
      map.current = undefined;
    };
  }, [key, nearViewport, streaming]);

  const stop = selected === undefined ? undefined : stops[selected];
  return (
    <section className="loop-openui-route-map" aria-label={title}>
      <h3>{title}</h3>
      <div className="loop-openui-controls">
        <Button
          type="button"
          size="small"
          variant="secondary"
          aria-expanded={expanded}
          disabled={failed || streaming}
          onClick={() => {
            setNearViewport(true);
            setExpanded(!expanded);
          }}
        >
          {t(expanded ? "openUi.collapseMap" : "openUi.expandMap")}
        </Button>
        {!displayedRoute && stops.length > 1 && (
          <Button
            type="button"
            size="small"
            variant="secondary"
            disabled={streaming || routing}
            onClick={() => void search()}
          >
            {t(
              routing
                ? "openUi.routing"
                : current?.failed
                  ? "openUi.retryWalkingRoute"
                  : "openUi.walkingRoute",
            )}
          </Button>
        )}
      </div>
      {current?.failed && (
        <p className="loop-openui-route-source" role="status">
          {t("openUi.routeUnavailable")}{" "}
          {routeLinks.map((href, index) => (
            <a key={index} href={href} target="_blank" rel="noreferrer">
              {routeLinks.length === 1
                ? t("openUi.openWalkingRoute")
                : t("openUi.openWalkingRoutePart", { part: index + 1 })}
            </a>
          ))}
        </p>
      )}
      <div
        className="loop-openui-map-viewport"
        ref={container}
        data-expanded={expanded}
        hidden={failed}
      />
      {failed && <p role="status">{t("openUi.mapUnavailable")}</p>}
      {current?.route && (
        <p className="loop-openui-route-source" role="status">
          <a href="https://routing.openstreetmap.de/" target="_blank" rel="noreferrer">
            {t("openUi.routeSource")}
          </a>
        </p>
      )}
      <ol className="loop-openui-map-stops">
        {stops.map((item, index) => (
          <li key={index}>
            <Button
              type="button"
              size="small"
              variant={selected === index ? "primary" : "secondary"}
              aria-pressed={selected === index}
              onClick={() => {
                setSelected(index);
                map.current?.focus(item.longitude, item.latitude);
              }}
            >
              <span className="loop-openui-stop-number" aria-hidden="true">
                {index + 1}
              </span>
              {item.name}
            </Button>
          </li>
        ))}
      </ol>
      {stop?.detail && <p aria-live="polite">{stop.detail}</p>}
    </section>
  );
};

export default MapView;

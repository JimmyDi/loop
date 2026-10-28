import { useId } from "react";
import type { CSSProperties } from "react";

import type { VoicePackageProgressProps } from "./voice-package-progress-types";
import "./VoicePackageProgress.css";

export const VoicePackageProgress = ({
  label,
  error,
  loading,
  complete,
  failed,
  received = 0,
  total = 0,
}: VoicePackageProgressProps) => {
  const id = useId();
  const known = Number.isFinite(total) && total > 0;
  const fraction = complete
    ? 1
    : known && Number.isFinite(received)
      ? Math.max(0, Math.min(1, received / total))
      : 0;
  const state = loading ? "loading" : failed ? "failed" : complete ? "completed" : "incomplete";
  return (
    <span
      className="voice-package-progress"
      data-state={state}
      role={loading ? "progressbar" : "img"}
      aria-label={label}
      tabIndex={failed ? 0 : undefined}
      aria-describedby={failed && error ? id : undefined}
      aria-valuemin={loading ? 0 : undefined}
      aria-valuemax={loading ? 100 : undefined}
      aria-valuenow={loading && known ? Math.floor(fraction * 100) : undefined}
      style={{ "--voice-progress-angle": fraction * 360 + "deg" } as CSSProperties}
    >
      <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={id + "-gradient"} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="55%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
        {loading && <circle className="voice-package-progress-halo" cx="16" cy="16" r="13" />}
        <circle className="voice-package-progress-outline" cx="16" cy="16" r="14" />
        <circle className="voice-package-progress-track" cx="16" cy="16" r="10" />
        <circle
          className="voice-package-progress-fill"
          style={loading ? { stroke: "url(#" + id + "-gradient)" } : undefined}
          cx="16"
          cy="16"
          r="10"
          pathLength="100"
          strokeDasharray={fraction * 100 + " 100"}
          transform="rotate(-90 16 16)"
        />
        {loading && fraction > 0 && (
          <g className="voice-package-progress-runner">
            <circle className="voice-package-progress-comet-glow" cx="16" cy="6" r="2.5" />
            <circle cx="16" cy="6" r="1.2" />
          </g>
        )}
        {(state === "completed" || state === "failed") && (
          <path
            className="voice-package-progress-symbol"
            d={failed ? "m13 13 6 6m0-6-6 6" : "m12 16 3 3 5-6"}
          />
        )}
      </svg>
      {failed && error && (
        <span id={id} role="tooltip" className="voice-package-error-tooltip">
          {error}
        </span>
      )}
      {loading && (
        <span className="voice-package-progress-percent" aria-hidden="true">
          {known ? Math.floor(fraction * 100) + "%" : "—"}
        </span>
      )}
    </span>
  );
};

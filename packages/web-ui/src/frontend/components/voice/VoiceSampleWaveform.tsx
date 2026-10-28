import type { VoiceSampleWaveformProps } from "./voice-sample-waveform-types";
import "./VoiceSampleWaveform.css";

export const VoiceSampleWaveform = ({
  samples,
  active,
  dense = false,
}: VoiceSampleWaveformProps) => (
  <svg
    className="voice-sample-waveform"
    data-active={active}
    data-dense={dense}
    viewBox="0 0 240 32"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    {Array.from({ length: dense ? 120 : 80 }, (_, index) => {
      const level = samples[samples.length - 80 + Math.floor(index * (dense ? 2 / 3 : 1))] ?? 0;
      const amplitude = Math.min(1, Math.sqrt(Math.max(0, level - 0.002) / 0.298));
      const height = (dense ? 0.3 : 0.5) + amplitude * (dense ? 27.7 : 27.5);
      return (
        <line
          key={index}
          x1={(index + 0.5) * (dense ? 2 : 3)}
          x2={(index + 0.5) * (dense ? 2 : 3)}
          y1={16 - height / 2}
          y2={16 + height / 2}
        />
      );
    })}
  </svg>
);

import "./LoopIcon.css";

export const LoopIcon = ({ size = 28, className }: { size?: number; className?: string }) => (
  <span
    className={["loop-icon", className].filter(Boolean).join(" ")}
    style={{ width: size, height: size }}
    aria-hidden="true"
  />
);

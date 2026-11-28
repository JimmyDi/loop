import type { z } from "zod";

import type { colorSwatchProps } from "../../../shared/openui-scenarios";
import "./ColorSwatch.css";

const ColorSwatch = ({ name, hex, description }: z.infer<typeof colorSwatchProps>) => (
  <figure className="loop-openui-color-swatch">
    <div aria-hidden="true" style={{ backgroundColor: hex }} />
    <figcaption>
      <strong>{name}</strong> <code>{hex.toUpperCase()}</code>
      {description && <span>{description}</span>}
    </figcaption>
  </figure>
);

export default ColorSwatch;

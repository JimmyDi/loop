import type { ButtonHTMLAttributes } from "react";
import type { Ref } from "react";

import "./ActionButton.css";

export const ActionButton = ({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { ref?: Ref<HTMLButtonElement> }) => (
  <button type="button" {...props} className={"action-button " + className} />
);

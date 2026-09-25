import type { ButtonHTMLAttributes } from "react";

import "./ActionButton.css";

export const ActionButton = ({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" {...props} className={"action-button " + className} />
);

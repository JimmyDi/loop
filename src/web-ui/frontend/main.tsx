import { createRoot } from "react-dom/client";

import { App } from "./App";
import { initializeTheme } from "./state/theme-store";
import "katex/dist/katex.min.css";

initializeTheme();

const root = document.getElementById("root");

if (!root) throw new Error("Missing root element");

createRoot(root).render(<App />);

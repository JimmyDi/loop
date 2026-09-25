import { createRoot } from "react-dom/client";

import { App } from "./App";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

const root = document.getElementById("root");

if (!root) throw new Error("Missing root element");

createRoot(root).render(<App />);

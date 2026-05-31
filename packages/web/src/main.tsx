import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
// Bundled (offline) terminal fonts: JetBrains Mono for crisp Latin/code,
// Nanum Gothic Coding for readable, fixed-width Korean. The Korean subset is
// lazy-loaded by the browser only when Korean glyphs actually render.
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/700.css";
import "@fontsource/nanum-gothic-coding/400.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "../popup/App";
import "../popup/style.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Options root element not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App variant="options" />
  </StrictMode>
);

import { setupMockChrome } from "../lib/mock-chrome";

if (import.meta.env.DEV) {
  setupMockChrome();
}

import React from "react";
import { createRoot } from "react-dom/client";
import { Popup } from "./Popup";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
